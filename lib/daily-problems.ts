import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import readXlsxFile from "read-excel-file/node";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1kBGyRsSdbGDu7DzjQcC-UkZjZERdrP8-_QyVGXHSrB8/export?format=xlsx";

export type DailyProblem = {
  date: string;
  number: string | null;
  title: string;
  slug: string | null;
  url: string | null;
  tags: string[];
  level: string | null;
  difficulty: number | null;
  youtube: string | null;
  bilibili: string | null;
};

type LeetCodeQuestion = { questionFrontendId?: string; titleSlug?: string };

export async function getDailyProblems(): Promise<DailyProblem[]> {
  const [response, metadataText] = await Promise.all([
    fetch(SHEET_URL, { next: { revalidate: 3600 } }),
    readFile(resolve(process.cwd(), "leetcode_questions.json"), "utf8"),
  ]);
  if (!response.ok) throw new Error(`Could not download daily problems (${response.status})`);

  const rows = await readXlsxFile(Buffer.from(await response.arrayBuffer()), { sheet: "Problem List" });
  const metadata = JSON.parse(metadataText) as LeetCodeQuestion[];
  const slugs = new Map(metadata.flatMap((question) =>
    question.questionFrontendId && question.titleSlug ? [[question.questionFrontendId, question.titleSlug] as const] : [],
  ));

  return rows.slice(6).flatMap((row) => {
    const date = row[2] instanceof Date && !Number.isNaN(row[2].valueOf()) ? row[2].toISOString().slice(0, 10) : null;
    const title = typeof row[1] === "string" ? row[1].trim() : "";
    if (!date || !title || title.toUpperCase() === "SKIPPED") return [];
    const number = row[0] === null ? null : String(row[0]).replace(/\*$/, "");
    const slug = number ? slugs.get(number) : undefined;
    return [{
      date,
      number,
      title,
      slug: slug ?? null,
      url: slug ? `https://leetcode.com/problems/${slug}/` : null,
      tags: [row[3], row[4]].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()),
      level: typeof row[5] === "string" ? row[5] : null,
      difficulty: typeof row[6] === "number" ? row[6] : null,
      youtube: typeof row[7] === "string" && row[7].startsWith("http") ? row[7] : null,
      bilibili: typeof row[9] === "string" && row[9].startsWith("http") ? row[9] : null,
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
}
