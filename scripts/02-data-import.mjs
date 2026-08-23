#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
import readXlsxFile from "read-excel-file/node";
import { importAuthUsers } from "./lib/import-auth-users.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = resolve(ROOT, "data/leaderboard.json");
const USERS_CSV_PATH = resolve(ROOT, "data/users.csv");
try {
  loadEnvFile(resolve(ROOT, ".env"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const SOURCES = {
  index_xlsx: "https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/generateEXCEL/index.xlsx",
  cruel_ids: "https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/getRank/id.in",
  cruel_dates: "https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/generateEXCEL/Data/Members/In.txt",
  group_record: "https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/generateEXCEL/Data/Members/GroupRecord.xlsx",
};

const force = process.argv.includes("--force");
const snapshotOnly = process.argv.includes("--snapshot-only");
if (process.argv.some((arg) => !["--force", "--snapshot-only"].includes(arg) && arg.startsWith("--"))) {
  console.error("usage: scripts/02-data-import.mjs [--force] [--snapshot-only]");
  process.exit(2);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableUserId(cruelId) {
  const hex = sha256(`cruel-coding:user:${normalize(cruelId)}`).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function resolveSupabaseCredentials() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configuredKey = process.env.SUPABASE_SECRET_KEY;
  if (configuredUrl && configuredKey) {
    return { supabaseUrl: configuredUrl, secretKey: configuredKey };
  }

  let projectRef;
  try {
    projectRef = (await readFile(resolve(ROOT, "supabase/.temp/project-ref"), "utf8")).trim();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!projectRef) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY, or link a Supabase project, or use --snapshot-only.",
    );
  }

  let keys;
  try {
    const output = execFileSync(
      "npx",
      [
        "--yes",
        "supabase@2.115.0",
        "projects",
        "api-keys",
        "--project-ref",
        projectRef,
        "--reveal",
        "--output",
        "json",
      ],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    keys = JSON.parse(output);
  } catch (error) {
    const detail = error?.stderr?.trim();
    throw new Error(
      `Unable to read API keys for linked Supabase project ${projectRef}.${detail ? ` ${detail}` : ""}`,
      { cause: error },
    );
  }

  const serverKey = keys.find((key) => key.type === "secret")
    ?? keys.find((key) => key.name === "service_role");
  if (!serverKey?.api_key || serverKey.api_key.includes("·")) {
    throw new Error(`No usable server API key found for linked Supabase project ${projectRef}.`);
  }

  console.log(`Using linked Supabase project ${projectRef}.`);
  return {
    supabaseUrl: `https://${projectRef}.supabase.co`,
    secretKey: serverKey.api_key,
  };
}

async function download([name, url]) {
  const response = await fetch(url, { headers: { "user-agent": "cruel-coding-importer/1.0" } });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return [name, { url, bytes, hash: sha256(bytes) }];
}

function parseMemberships(text) {
  const memberships = new Map();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = line.trim().match(/^(\S+)\s+(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\S+))?$/);
    if (!match) throw new Error(`Invalid In.txt line ${index + 1}: ${line}`);
    const [, username, month, day, year, subgroup] = match;
    memberships.set(normalize(username), {
      cruel_date: `${year}-${month}-${day}`,
      subgroup: subgroup ?? null,
    });
  }
  return memberships;
}

async function parseScoreboard(files) {
  const rows = await readXlsxFile(files.index_xlsx.bytes);
  const groupRows = await readXlsxFile(files.group_record.bytes, { sheet: "Current" });
  const cruelIds = new Map(
    files.cruel_ids.bytes.toString("utf8").split(/\r?\n/)
      .map((line) => line.trim()).filter(Boolean)
      .map((id) => [normalize(id), id]),
  );
  const memberships = parseMemberships(files.cruel_dates.bytes.toString("utf8"));
  const profiles = new Map();
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
    for (const accountId of accountIds.map((value) => value.trim()).filter(Boolean)) {
      profiles.set(normalize(accountId), profile);
    }
  }

  const contests = [];
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
    if (!cruelId || !membership) {
      throw new Error(`No CruelID/CruelDate match for index.xlsx row ${rowIndex + 1}: ${workbookId}`);
    }
    members.push({
      user_id: stableUserId(cruelId),
      cruel_id: cruelId,
      cruel_date: membership.cruel_date,
      subgroup: membership.subgroup,
      days: Math.trunc(numberOrNull(row[2]) ?? 0),
      rating: numberOrNull(row[3]) === null ? null : Math.trunc(row[3]),
      score: Number((numberOrNull(row[4]) ?? 0).toFixed(1)),
      source_rank: Math.trunc(sourceRank),
      ...profile,
      contests: contests.map(({ column, contest, participants }) => {
        const rank = numberOrNull(row[column]);
        return {
          contest,
          participants,
          rank: rank !== null && rank > 0 ? Math.trunc(rank) : null,
          score: Number((numberOrNull(row[column + 1]) ?? 0).toFixed(1)),
        };
      }),
    });
  }

  if (!members.length || !contests.length) throw new Error("Parsed source is unexpectedly empty");
  return { members, latestContest: Math.max(...contests.map(({ contest }) => contest)) };
}

const downloaded = Object.fromEntries(await Promise.all(Object.entries(SOURCES).map(download)));
const sourceHashes = Object.fromEntries(Object.entries(downloaded).map(([name, file]) => [name, file.hash]));
const combinedHash = sha256(JSON.stringify(sourceHashes));
const { members, latestContest } = await parseScoreboard(downloaded);

await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
await writeFile(
  SNAPSHOT_PATH,
  `${JSON.stringify(members.map((member) => Object.fromEntries(
    Object.entries(member).filter(([key]) => key !== "source_rank"),
  )), null, 2)}\n`,
  "utf8",
);

if (snapshotOnly) {
  console.log(`Wrote ${members.length} members to data/leaderboard.json (${combinedHash}).`);
  process.exit(0);
}

const { supabaseUrl, secretKey } = await resolveSupabaseCredentials();

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const authImport = await importAuthUsers(supabase, USERS_CSV_PATH);
console.log(`Auth import complete: ${authImport.created} created, ${authImport.updated} updated.`);

if (!force) {
  const { data, error } = await supabase
    .from("scoreboard_snapshots")
    .select("id")
    .eq("combined_hash", combinedHash)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    console.log(`Sources unchanged (${combinedHash}); database import skipped.`);
    process.exit(0);
  }
}

const payload = {
  combined_hash: combinedHash,
  source_hashes: sourceHashes,
  source_urls: SOURCES,
  latest_contest: latestContest,
  members,
};
const { data: snapshotId, error } = await supabase.rpc("replace_scoreboard_snapshot", { payload });
if (error) throw error;
console.log(`Imported snapshot ${snapshotId}: ${members.length} members (${combinedHash}).`);
