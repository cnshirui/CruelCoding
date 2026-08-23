import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import readXlsxFile from "read-excel-file";

const SOURCES = {
  index_xlsx: "https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/generateEXCEL/index.xlsx",
  cruel_ids: "https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/getRank/id.in",
  cruel_dates: "https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/generateEXCEL/Data/Members/In.txt",
  group_record: "https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/generateEXCEL/Data/Members/GroupRecord.xlsx",
} as const;

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql/";
const CONTEST_HISTORY_QUERY = `
  query contestV2HistoryContests($skip: Int!, $limit: Int!) {
    contestV2HistoryContests(skip: $skip, limit: $limit) {
      contests { titleSlug title startTime duration cardImg }
    }
  }
`;

type LeetCodeContest = {
  titleSlug: string;
  title: string;
  startTime: number;
  duration: number;
  cardImg: string | null;
};

type DownloadedFile = { url: string; bytes: Buffer; arrayBuffer: ArrayBuffer; hash: string };

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableUserId(cruelId: string) {
  const hex = sha256(`cruel-coding:user:${normalize(cruelId)}`).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function download(name: keyof typeof SOURCES): Promise<[typeof name, DownloadedFile]> {
  const url = SOURCES[name];
  const response = await fetch(url, { cache: "no-store", headers: { "user-agent": "cruel-coding-refresh/1.0" } });
  if (!response.ok) throw new Error(`WisdomPeak download failed for ${name} (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  return [name, { url, bytes, arrayBuffer, hash: sha256(bytes) }];
}

async function fetchLeetCodeContests() {
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "user-agent": "cruel-coding-refresh/1.0",
      "x-operation-name": "contestV2HistoryContests",
    },
    body: JSON.stringify({
      query: CONTEST_HISTORY_QUERY,
      variables: { limit: 20, skip: 0 },
      operationName: "contestV2HistoryContests",
    }),
  });
  if (!response.ok) throw new Error(`LeetCode contest history failed (${response.status})`);
  const payload = await response.json() as {
    data?: { contestV2HistoryContests?: { contests?: LeetCodeContest[] } };
    errors?: { message?: string }[];
  };
  if (payload.errors?.length) throw new Error(payload.errors[0].message ?? "LeetCode contest history failed");

  return (payload.data?.contestV2HistoryContests?.contests ?? []).flatMap((contest) => {
    const match = contest.titleSlug.match(/^weekly-contest-(\d+)$/);
    if (!match || !Number.isFinite(contest.startTime)) return [];
    const startTime = new Date(contest.startTime * 1_000).toISOString();
    return [{
      contest_number: Number(match[1]),
      title: contest.title,
      title_slug: contest.titleSlug,
      start_time: startTime,
      origin_start_time: startTime,
      card_img: contest.cardImg,
    }];
  });
}

function parseMemberships(text: string) {
  const memberships = new Map<string, { cruel_date: string; subgroup: string | null }>();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = line.trim().match(/^(\S+)\s+(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\S+))?$/);
    if (!match) throw new Error(`Invalid membership source line ${index + 1}`);
    const [, username, month, day, year, subgroup] = match;
    memberships.set(normalize(username), { cruel_date: `${year}-${month}-${day}`, subgroup: subgroup ?? null });
  }
  return memberships;
}

async function parseScoreboard(files: Record<keyof typeof SOURCES, DownloadedFile>) {
  const rows = await readXlsxFile(files.index_xlsx.arrayBuffer);
  const groupRows = await readXlsxFile(files.group_record.arrayBuffer, { sheet: "Current" });
  const cruelIds = new Map(files.cruel_ids.bytes.toString("utf8").split(/\r?\n/)
    .map((line) => line.trim()).filter(Boolean).map((id) => [normalize(id), id]));
  const memberships = parseMemberships(files.cruel_dates.bytes.toString("utf8"));
  const profiles = new Map<string, { wechat_name: string | null; wechat_id: string | null; referral: string | null }>();

  for (const row of groupRows) {
    const primaryId = typeof row[1] === "string" ? row[1].trim() : "";
    if (!primaryId || normalize(primaryId) === "x") continue;
    const profile = {
      wechat_name: typeof row[0] === "string" ? row[0].trim() || null : null,
      wechat_id: typeof row[8] === "string" ? row[8].trim() || null : null,
      referral: typeof row[5] === "string" ? row[5].trim() || null : null,
    };
    const accountIds = [primaryId];
    if (typeof row[13] === "string") accountIds.push(...row[13].split(/[,，]/));
    for (const accountId of accountIds.map((value) => value.trim()).filter(Boolean)) profiles.set(normalize(accountId), profile);
  }

  const contests: { column: number; contest: number; participants: number }[] = [];
  for (let column = 5; column < rows[8].length; column += 2) {
    const contest = numberOrNull(rows[8][column]);
    if (contest === null) continue;
    contests.push({ column, contest: Math.trunc(contest), participants: Math.trunc(numberOrNull(rows[9][column]) ?? 0) });
  }

  const members = [];
  for (let rowIndex = 11; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const sourceRank = numberOrNull(row[0]);
    const workbookId = typeof row[1] === "string" ? row[1].trim() : "";
    if (sourceRank === null || !workbookId) continue;
    const key = normalize(workbookId);
    const cruelId = cruelIds.get(key);
    const membership = memberships.get(key);
    const profile = profiles.get(key) ?? { wechat_name: null, wechat_id: null, referral: null };
    if (!cruelId || !membership) throw new Error(`No member match for scoreboard row ${rowIndex + 1}: ${workbookId}`);
    members.push({
      user_id: stableUserId(cruelId), cruel_id: cruelId, cruel_date: membership.cruel_date, subgroup: membership.subgroup,
      days: Math.trunc(numberOrNull(row[2]) ?? 0), rating: numberOrNull(row[3]) === null ? null : Math.trunc(row[3] as number),
      score: Number((numberOrNull(row[4]) ?? 0).toFixed(1)), source_rank: Math.trunc(sourceRank), ...profile,
      contests: contests.map(({ column, contest, participants }) => {
        const rank = numberOrNull(row[column]);
        return { contest, participants, rank: rank !== null && rank > 0 ? Math.trunc(rank) : null, score: Number((numberOrNull(row[column + 1]) ?? 0).toFixed(1)) };
      }),
    });
  }
  if (!members.length || !contests.length) throw new Error("WisdomPeak scoreboard parsed as empty");
  return { members, latestContest: Math.max(...contests.map(({ contest }) => contest)) };
}

export async function refreshLeaderboard() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase refresh credentials are not configured");

  const [downloadedFiles, leetCodeContests] = await Promise.all([
    Promise.all((Object.keys(SOURCES) as (keyof typeof SOURCES)[]).map(download)),
    fetchLeetCodeContests(),
  ]);
  const files = Object.fromEntries(downloadedFiles) as Record<keyof typeof SOURCES, DownloadedFile>;
  const sourceHashes = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, file.hash]));
  const combinedHash = sha256(JSON.stringify(sourceHashes));
  const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!leetCodeContests.length) throw new Error("LeetCode contest history returned no weekly contests");
  const { error: contestError } = await supabase.from("contests").upsert(leetCodeContests, { onConflict: "contest_number" });
  if (contestError) throw contestError;
  const { data: existing, error: lookupError } = await supabase.from("scoreboard_snapshots").select("id").eq("combined_hash", combinedHash).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { changed: false, snapshotId: existing.id, memberCount: null, contestCount: leetCodeContests.length };

  const { members, latestContest } = await parseScoreboard(files);
  const payload = { combined_hash: combinedHash, source_hashes: sourceHashes, source_urls: SOURCES, latest_contest: latestContest, members };
  const { data: snapshotId, error } = await supabase.rpc("replace_scoreboard_snapshot", { payload });
  if (error) throw error;
  return { changed: true, snapshotId, memberCount: members.length, contestCount: leetCodeContests.length };
}
