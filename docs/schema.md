# CruelCoding 数据库模型

本文档包含两部分：

1. `GroupRecord.xlsx` 对应的用户、平台账号和群成员经历模型。
2. `LeetCode打卡记录` 对应的题目、标签、讲解资源、群友讨论和周赛模型。

以下用户模型与题目模型通过 `users.id` 关联。例如，群友发起的讨论及其回答可以引用已经导入的群成员，无需为讨论者再建立一套用户表。

# GroupRecord 用户数据模型

## 结论

`GroupRecord.xlsx` 不应该按 Excel 的 14 列原样塞进一张 `users` 宽表。

建议把“人”“平台账号”“入群/退群经历”拆开：

- `users`：一个自然人一行，保存姓名、邮箱、公司、学校等资料。
- `user_identities`：LeetCode 主账号和历史/备用账号；一个用户可以有多个账号。
- `memberships`：每次入群到退群是一段经历；用户退出后再加入时不覆盖旧记录。
- `user_import_rows`：可选的原始导入暂存表，用来审计、去重和重跑导入。

工作簿共有 7 个 sheet。`Current`（116 行）和 `Quited`（1,335 行）是成员主数据；`Sheet1` 是比赛/积分统计，`Sheet3` 是对退出数据的排序或派生视图，其余 `Sheet2/4/5` 也不应直接作为新用户重复导入。若目标是“把所有成员导入 users”，数据源应限定为 `Current + Quited`，其他 sheet 按业务另建比赛结果表，或者暂不导入。

## Excel 列映射

Excel 没有表头。根据现有 `Data/Read_Excel.py` 和单元格内容，可确认或推断如下：

| 列 | 建议字段 | 说明 |
|---|---|---|
| A | `display_name` | 群昵称/展示名 |
| B | `leetcode_username` | LeetCode 主账号；`X` 代表缺失，不能当真实账号 |
| C | `joined_at` | Excel 日期序列，必须转换成 `date` |
| D | `left_at` | 仅退出成员有值 |
| E | 不落库 | 在退出表中是成员天数，可由 `left_at - joined_at` 计算 |
| F | `invited_by_text` | 邀请人昵称；旧数据未必能稳定关联到用户 |
| G | `company` | 公司 |
| H | `subgroup` | 当前数据中为 A/B/C 分组 |
| I | `external_handle` | 含义不完全确定，先保留为扩展账号/原始字段 |
| J | `school` | 学校 |
| K | `notes` | 备注；存在自由文本，不要用于程序判断 |
| L | `email` | 邮箱；导入前 trim、转小写，空串转 NULL |
| M | `real_name` | 真实姓名；有尾随逗号/空格等脏数据 |
| N | `alternate_leetcode_usernames` | 逗号分隔的历史/备用账号，应拆到 `user_identities` |

列 I、K 的业务含义没有在代码中定义，因此应先原样保留，不能凭内容强行赋予严格语义。

## PostgreSQL 设计

下面的 DDL 可直接作为第一版实现。主键使用 UUID，便于以后接登录系统或 API；如果项目只使用单机自增 ID，也可以将 UUID 换成 `bigint generated always as identity`。

```sql
create extension if not exists pgcrypto;

create type user_status as enum ('active', 'inactive', 'merged');
create type identity_provider as enum ('leetcode', 'email', 'legacy_external');

create table users (
    id uuid primary key default gen_random_uuid(),
    display_name text not null,
    real_name text,
    email text,
    company text,
    school text,
    notes text,
    status user_status not null default 'inactive',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    merged_into_user_id uuid references users(id),

    constraint users_display_name_not_blank
        check (btrim(display_name) <> ''),
    constraint users_email_normalized
        check (email is null or email = lower(btrim(email))),
    constraint users_merged_target_required
        check (
            (status = 'merged' and merged_into_user_id is not null)
            or (status <> 'merged' and merged_into_user_id is null)
        )
);

-- 邮箱只在非空时唯一；如确认多人共用邮箱，应删除该唯一索引。
create unique index users_email_unique
    on users (lower(email))
    where email is not null;

create table user_identities (
    id bigint generated always as identity primary key,
    user_id uuid not null references users(id) on delete cascade,
    provider identity_provider not null,
    username text not null,
    normalized_username text generated always as (lower(btrim(username))) stored,
    is_primary boolean not null default false,
    created_at timestamptz not null default now(),

    constraint user_identities_username_not_blank
        check (btrim(username) <> ''),
    constraint user_identities_legacy_missing_not_allowed
        check (provider <> 'leetcode' or upper(btrim(username)) <> 'X'),
    unique (provider, normalized_username)
);

create unique index user_identities_one_primary_per_provider
    on user_identities (user_id, provider)
    where is_primary;

create table memberships (
    id bigint generated always as identity primary key,
    user_id uuid not null references users(id) on delete cascade,
    joined_at date not null,
    left_at date,
    subgroup text,
    invited_by_user_id uuid references users(id),
    invited_by_text text,
    source_sheet text not null,
    source_row integer not null,
    created_at timestamptz not null default now(),

    membership_days integer generated always as (
        case
            when left_at is null then null
            else left_at - joined_at
        end
    ) stored,

    constraint memberships_dates_valid
        check (left_at is null or left_at >= joined_at),
    constraint memberships_source_sheet_valid
        check (source_sheet in ('Current', 'Quited')),
    unique (source_sheet, source_row)
);

-- 一个用户最多有一段当前有效的成员经历。
create unique index memberships_one_open_membership_per_user
    on memberships (user_id)
    where left_at is null;

create index memberships_joined_at_idx on memberships (joined_at);
create index memberships_left_at_idx on memberships (left_at);
create index memberships_subgroup_idx on memberships (subgroup)
    where subgroup is not null;
```

`users.status` 是便于查询的缓存状态：存在 `left_at is null` 的 membership 时为 `active`，否则为 `inactive`。写入 membership 后应在同一个事务中更新它，或者直接删除该字段并通过视图计算，避免状态不一致。

## 原始导入暂存表

Excel 数据存在 `X`、空字符串、多账号逗号分隔、大小写不一致、同名和字段意义不明确等情况。不要让导入程序直接写正式表，先写 staging 表更安全：

```sql
create table user_import_rows (
    import_batch_id uuid not null,
    source_file text not null,
    source_sheet text not null,
    source_row integer not null,
    raw_data jsonb not null,
    import_status text not null default 'pending'
        check (import_status in ('pending', 'imported', 'skipped', 'conflict', 'error')),
    resolved_user_id uuid references users(id),
    error_message text,
    imported_at timestamptz,
    primary key (import_batch_id, source_sheet, source_row)
);
```

暂存表保留 Excel 原值，正式表只放清洗后的数据。这样发生误合并时，可以定位到具体 sheet 和行号。

## 去重与导入规则

不要使用群昵称作为唯一键。群昵称和真实姓名都会改变或重复。

按以下顺序匹配已有用户：

1. 非 `X` 的 LeetCode 主账号，使用 trim 后的小写值精确匹配。
2. N 列拆出的任意历史/备用 LeetCode 账号。
3. 规范化邮箱精确匹配。
4. 仍无法匹配时新建用户；仅凭展示名或真实姓名相同不能自动合并，应标记为 `conflict` 人工确认。

导入细节：

1. Excel 日期序列按工作簿 date system 转换，不能把 `43345` 直接存入数据库。
2. 空字符串、纯空格和 B 列的 `X` 转成 NULL。
3. N 列按英文逗号和中文逗号拆分、trim、去重，每项写入 `user_identities`；第一主账号标记 `is_primary = true`。
4. `Current` 创建 `left_at = NULL` 的 membership，并将用户设为 `active`。
5. `Quited` 使用 C/D 列创建已结束 membership。E 列只用于校验：应等于 `D - C`，不作为事实字段写入。
6. 若同一用户同时出现在 `Quited` 和 `Current`，保留两段 membership，表示退出后重新加入；不要覆盖历史记录。
7. F 列先写入 `invited_by_text`。只有当邀请人昵称能够唯一匹配一个用户时，才回填 `invited_by_user_id`。
8. 每批导入放在事务中；冲突行留在 staging 表，不能静默跳过或随意合并。

## 查询视图

如果现有代码希望像读取一张 `users` 表那样获得当前成员，可以提供视图：

```sql
create view active_users as
select
    u.id,
    u.display_name,
    u.real_name,
    u.email,
    u.company,
    u.school,
    i.username as leetcode_username,
    m.joined_at,
    m.subgroup,
    m.invited_by_user_id,
    m.invited_by_text
from users u
join memberships m
  on m.user_id = u.id
 and m.left_at is null
left join user_identities i
  on i.user_id = u.id
 and i.provider = 'leetcode'
 and i.is_primary
where u.status = 'active';
```

## 不建议的设计

- 不建议将 `Current` 和 `Quited` 分成两张用户表：退出只是 membership 状态变化，不是另一类人。
- 不建议只用 `leetcode_username` 作为 `users` 主键：历史数据中有大量 `X`，且账号会变更。
- 不建议保存 `membership_days` 的 Excel 值：它是日期差的派生数据，重复存储容易失真。
- 不建议把 N 列整个字符串存成一个 `aliases` 字段后直接查询：拆表后才能建立唯一约束并正确去重。
- 不建议把 `Sheet1` 的每周比赛列继续加到 `users`：比赛结果属于独立的 event/result 数据模型。

# LeetCode 题目库数据模型

## 结论

`LeetCode打卡记录` 不应按照工作表当前的列结构直接建立一张题目宽表。建议以 `problems` 为中心，将标签、视频与文章等资源、群友讨论和比赛分别建模：

```text
problems
  ├── problem_tags ── tags
  ├── problem_resources ── resources
  ├── discussion_topics ── discussion_answers
  └── contest_problems ── contests ── contest_resources
```

工作簿目前包含四个 sheet：

- `Problem List`：约 3,375 条有效题目记录，是题目主数据来源。
- `群友讨论题`：讨论主题、提问人和整理后的回答。
- `LintCode周赛讲解`：比赛、比赛链接和讲解视频。
- `Backup`：历史备份，不应成为正式业务表。

当前结构需要注意以下问题：

- `Tag 1`、`Tag 2` 实际是题目与标签的多对多关系，标签数量不应限制为两个。
- `YouTube`、`B站` 是同一种讲解资源的不同平台，不应继续增加平台专用列。
- `No.` 中存在类似 `2123*` 的特殊值，也存在重复记录，不能作为数据库主键。
- `Level` 表示 `Easy`、`Medium`、`Hard`，小写 `difficulty` 看起来是数值难度分，两者应分别存储。
- 群友讨论中多个回答者和回答内容混在一个长文本字段中，后续难以按作者检索和统计。

## PostgreSQL 设计

以下 DDL 延续前文用户模型的 UUID 主键约定。

### 题目

```sql
create table problems (
    id uuid primary key default gen_random_uuid(),
    platform text not null default 'leetcode',
    external_id text,
    title text not null,
    level text,
    difficulty_rating integer,
    problem_url text,
    is_special boolean not null default false,
    published_at date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint problems_title_not_blank
        check (btrim(title) <> ''),
    constraint problems_platform_not_blank
        check (btrim(platform) <> ''),
    constraint problems_level_valid
        check (level in ('Easy', 'Medium', 'Hard') or level is null),
    constraint problems_difficulty_rating_valid
        check (difficulty_rating is null or difficulty_rating >= 0),
    unique (platform, external_id)
);
```

数据库生成的 `id` 才是主键。LeetCode 的题号写入 `external_id`；例如 `2123*` 应清洗为 `external_id = '2123'`、`is_special = true`。如果相同平台和题号在源数据中出现多次，应先判断是重复数据、历史版本还是特殊题目，再决定合并或保留。

### 标签

```sql
create table tags (
    id bigint generated always as identity primary key,
    name text not null,
    normalized_name text not null,

    constraint tags_name_not_blank
        check (btrim(name) <> ''),
    constraint tags_normalized_name_not_blank
        check (btrim(normalized_name) <> ''),
    unique (normalized_name)
);

create table problem_tags (
    problem_id uuid not null references problems(id) on delete cascade,
    tag_id bigint not null references tags(id) on delete restrict,
    is_primary boolean not null default false,
    sort_order smallint not null default 0,
    primary key (problem_id, tag_id)
);

create index problem_tags_tag_id_idx
    on problem_tags (tag_id, problem_id);
```

`normalized_name` 用于合并大小写或别名不同的标签。例如可以将 `DP` 与 `Dynamic Programming` 映射到同一个规范标签；原始展示名称仍保存在 `name` 中。

### 视频、代码和文章资源

```sql
create table resources (
    id uuid primary key default gen_random_uuid(),
    resource_type text not null,
    platform text not null,
    url text not null,
    title text,
    recorded_at date,
    created_at timestamptz not null default now(),

    constraint resources_type_valid
        check (resource_type in ('video', 'article', 'code', 'editorial', 'other')),
    constraint resources_platform_not_blank
        check (btrim(platform) <> ''),
    constraint resources_url_not_blank
        check (btrim(url) <> ''),
    unique (platform, url)
);

create table problem_resources (
    problem_id uuid not null references problems(id) on delete cascade,
    resource_id uuid not null references resources(id) on delete cascade,
    relation text not null default 'explanation',
    primary key (problem_id, resource_id),

    constraint problem_resources_relation_valid
        check (relation in ('explanation', 'solution', 'code', 'editorial', 'reference'))
);

create index resources_recorded_at_idx
    on resources (recorded_at desc)
    where recorded_at is not null;
```

`platform` 可保存 `youtube`、`bilibili`、`github`、`leetcode`、`lintcode` 等值。以后增加新平台时只新增资源行，不修改表结构。

### 群友讨论

讨论者直接复用前文的 `users` 表：

```sql
create table discussion_topics (
    id uuid primary key default gen_random_uuid(),
    proposer_user_id uuid references users(id) on delete set null,
    proposer_name_text text,
    title text,
    description text not null,
    discussed_on date,
    linked_problem_id uuid references problems(id) on delete set null,
    created_at timestamptz not null default now(),

    constraint discussion_topics_description_not_blank
        check (btrim(description) <> '')
);

create table discussion_answers (
    id uuid primary key default gen_random_uuid(),
    topic_id uuid not null references discussion_topics(id) on delete cascade,
    author_user_id uuid references users(id) on delete set null,
    author_name_text text,
    content text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),

    constraint discussion_answers_content_not_blank
        check (btrim(content) <> '')
);

create index discussion_topics_discussed_on_idx
    on discussion_topics (discussed_on desc);

create index discussion_answers_topic_idx
    on discussion_answers (topic_id, sort_order);
```

旧数据中类似 `【wisdompeak】……【陈建旭】……` 的内容应拆成两条 `discussion_answers`。如果名字能够唯一匹配 `users`，回填对应的用户 ID；无法稳定匹配时保留 `author_name_text`，不能仅凭昵称强行合并用户。

### 比赛与周赛讲解

```sql
create table contests (
    id uuid primary key default gen_random_uuid(),
    platform text not null,
    external_id text,
    title text not null,
    contest_url text,
    contest_number integer,
    held_at date,
    created_at timestamptz not null default now(),

    constraint contests_platform_not_blank
        check (btrim(platform) <> ''),
    constraint contests_title_not_blank
        check (btrim(title) <> ''),
    unique (platform, external_id)
);

create table contest_resources (
    contest_id uuid not null references contests(id) on delete cascade,
    resource_id uuid not null references resources(id) on delete cascade,
    primary key (contest_id, resource_id)
);

create table contest_problems (
    contest_id uuid not null references contests(id) on delete cascade,
    problem_id uuid not null references problems(id) on delete cascade,
    position smallint,
    primary key (contest_id, problem_id)
);
```

`LintCode周赛讲解` 的赛题链接和期数进入 `contests`，视频进入 `resources`，再通过 `contest_resources` 关联。以后获得单场比赛的题目清单后，再写入 `contest_problems`。

## 原始导入与可追溯性

不要直接从 Google Sheets 写入正式表。先保存导入批次和每一行原始数据：

```sql
create table import_batches (
    id uuid primary key default gen_random_uuid(),
    source_name text not null,
    source_url text,
    imported_at timestamptz not null default now()
);

create table import_rows (
    id bigint generated always as identity primary key,
    batch_id uuid not null references import_batches(id) on delete cascade,
    sheet_name text not null,
    source_row integer not null,
    raw_data jsonb not null,
    entity_type text,
    imported_record_id uuid,
    import_status text not null default 'pending'
        check (import_status in ('pending', 'imported', 'skipped', 'conflict', 'error')),
    import_error text,
    imported_at timestamptz,
    unique (batch_id, sheet_name, source_row)
);
```

`Backup` 只作为导入和审计来源，不建立同名业务表。`imported_record_id` 是跨实体的审计引用，不设置外键；具体目标表由 `entity_type` 标识。

## 导入规则

1. 将 `No.` 清洗为字符串，去掉用于标记的 `*`，但把标记保存到 `is_special`。
2. 使用 `(platform, external_id)` 匹配题目；不能仅根据标题自动合并。
3. 空字符串、纯空格、`N/A` 和 `-` 按字段语义转换为 NULL，不要把它们当成真实 URL、标签或难度等级。
4. `Level` 只接受 `Easy`、`Medium`、`Hard`；其他值进入 staging 的冲突或错误状态。
5. 将 `difficulty` 中合法的非负整数写入 `difficulty_rating`。
6. 拆分 `Tag 1`、`Tag 2`，规范化后写入 `tags` 和 `problem_tags`；不要假设未来最多两个标签。
7. YouTube、B站及 GitHub 链接分别写入 `resources`，并通过关联表连接题目或比赛。
8. `Recording Date` 写入资源的 `recorded_at`，不要放在题目主表。
9. 群友讨论的提问者和回答者优先匹配已有 `users`；无法唯一匹配时保留原始姓名文本，留待人工确认。
10. 每批导入放在事务中；重复、非法日期和无法解析的记录进入 `import_rows`，不能静默丢弃。

## 查询索引与搜索

```sql
create index problems_level_rating_idx
    on problems (level, difficulty_rating);

create index problems_published_at_idx
    on problems (published_at desc)
    where published_at is not null;
```

如果 PostgreSQL 需要支持按英文题名模糊搜索，可启用 `pg_trgm`：

```sql
create extension if not exists pg_trgm;

create index problems_title_trgm_idx
    on problems using gin (title gin_trgm_ops);
```

## 不建议的设计

- 不建议把题目、标签和所有视频塞进一张宽表；新增标签或平台会持续增加列。
- 不建议使用 LeetCode 题号作为数据库主键；题号只在特定平台内有意义，源数据也可能重复或带特殊标记。
- 不建议将标签保存为逗号分隔字符串；无法可靠建立唯一约束和标签索引。
- 不建议为 YouTube、B站、GitHub 分别建立固定 URL 列；统一资源表更容易扩展。
- 不建议把多个讨论回答保存在一个长文本字段中；拆分后才能按作者、时间和主题查询。
- 不建议把 `Backup` 当成正式表导入；历史原始值应进入 staging/import 表。
