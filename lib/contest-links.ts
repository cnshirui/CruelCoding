// LeetCode paginates the contest ranking 25 rows per page.
export const RANKING_PAGE_SIZE = 25;

// leetcode.com hides its ranking API behind a Cloudflare challenge, so members are looked up in, and linked to,
// leetcode.cn's copy of the merged `global_v2` ranking. It omits a few accounts leetcode.com lists, so its pages drift
// from leetcode.com's further down the ranking.
export function contestRankingPageUrl(contest: number, page: number) {
  return `https://leetcode.cn/contest/weekly-contest-${contest}/ranking/${page}/?region=global_v2`;
}

// Where a member sits in LeetCode's ranking. The ranking page shows display names, not usernames, so both are returned
// for the viewer to search the page with.
export type ContestRankingLookup = {
  found: boolean;
  page: number;
  row: number | null;
  rank: number | null;
  username: string;
  displayName: string | null;
  url: string;
};

// LeetCode has no per-member contest page, so the lookup finds the ranking page holding the member's row, where each
// solved problem opens their submission. `rank` is the WisdomPeak rank, which drifts from LeetCode's, so it only seeds
// the search. Members without a rank did not submit, so they get no lookup.
export function contestRankingLookupUrl(contest: number, rank: number | null | undefined, username: string) {
  if (!rank || rank <= 0) return null;
  return `/api/contest-ranking?${new URLSearchParams({ contest: String(contest), user: username, rank: String(rank) })}`;
}
