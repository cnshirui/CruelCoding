import { NextResponse, type NextRequest } from "next/server";
import { contestRankingPageUrl, RANKING_PAGE_SIZE, type ContestRankingLookup } from "@/lib/contest-links";

const RANKING_API = "https://leetcode.cn/contest/api/ranking";
const PAGES_PER_ROUND = 10;
// Member pages trail their WisdomPeak pages by up to ~45 pages deep in the ranking.
const MAX_PAGES_SEARCHED = 150;
const CACHE_SECONDS = 3600;

type RankingRow = { user_slug?: string; username?: string; rank: number };
type RankingPage = { user_num: number; total_rank: RankingRow[] };

async function fetchRankingPage(contest: number, page: number): Promise<RankingPage | null> {
  try {
    const response = await fetch(`${RANKING_API}/weekly-contest-${contest}/?pagination=${page}&region=global_v2`, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: CACHE_SECONDS } });
    if (!response.ok) return null;
    // Pages past the end of the ranking come back as `{}`.
    const body = await response.json() as Partial<RankingPage>;
    return { user_num: body.user_num ?? 0, total_rank: Array.isArray(body.total_rank) ? body.total_rank : [] };
  } catch {
    return null;
  }
}

// WisdomPeak drops flagged accounts from LeetCode's ranking, so a member's LeetCode rank is never above their WisdomPeak
// rank: search forward from the page that rank falls on.
async function findRankingRow(contest: number, username: string, firstPage: number) {
  const slug = username.toLowerCase();
  const rowIndex = (page: RankingPage | null) => page ? page.total_rank.findIndex((row) => row.user_slug?.toLowerCase() === slug || row.username?.toLowerCase() === slug) : -1;
  for (let start = firstPage; start < firstPage + MAX_PAGES_SEARCHED; start += PAGES_PER_ROUND) {
    const round = Array.from({ length: PAGES_PER_ROUND }, (_, offset) => start + offset);
    const results = await Promise.all(round.map((page) => fetchRankingPage(contest, page)));
    for (const [index, result] of results.entries()) {
      const row = rowIndex(result);
      if (result && row >= 0) return { page: round[index], row: row + 1, entry: result.total_rank[row] };
    }
    // Stop at the end of the ranking, or when LeetCode is unreachable.
    if (results.some((page) => !page || page.total_rank.length < RANKING_PAGE_SIZE)) return null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const contest = Number(params.get("contest"));
  const rank = Number(params.get("rank"));
  const username = params.get("user") ?? "";
  if (!Number.isInteger(contest) || contest <= 0 || !Number.isInteger(rank) || rank <= 0 || !/^[\w.-]{1,64}$/.test(username)) {
    return NextResponse.json({ error: "无效的排名查询。" }, { status: 400 });
  }

  const firstPage = Math.ceil(rank / RANKING_PAGE_SIZE);
  const found = await findRankingRow(contest, username, firstPage);
  // Without a match, point at the earliest page the member can be on so the viewer can still look for them.
  const result: ContestRankingLookup = found
    ? { found: true, page: found.page, row: found.row, rank: found.entry.rank + 1, username: found.entry.user_slug ?? username, displayName: found.entry.username ?? null, url: contestRankingPageUrl(contest, found.page) }
    : { found: false, page: firstPage, row: null, rank: null, username, displayName: null, url: contestRankingPageUrl(contest, firstPage) };
  return NextResponse.json(result, { headers: { "Cache-Control": found ? `public, s-maxage=${CACHE_SECONDS}` : "no-store" } });
}
