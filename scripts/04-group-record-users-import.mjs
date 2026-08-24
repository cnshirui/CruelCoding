#!/usr/bin/env node

import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
import readXlsxFile from "read-excel-file/node";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GROUP_RECORD = resolve(ROOT, "lc-score-board/generateEXCEL/Data/Members/GroupRecord.xlsx");
const SCOREBOARD = resolve(ROOT, "lc-score-board/generateEXCEL/index.xlsx");
const dryRun = process.argv.includes("--dry-run");

if (process.argv.some((arg) => arg.startsWith("--") && arg !== "--dry-run")) {
  console.error("usage: scripts/04-group-record-users-import.mjs [--dry-run]");
  process.exit(2);
}

try {
  loadEnvFile(resolve(ROOT, ".env"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalize(value) {
  return clean(value)?.toLocaleLowerCase("en-US") ?? null;
}

function email(value) {
  const normalized = normalize(value);
  return normalized?.includes("@") ? normalized : null;
}

function dateOnly(value, label) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  throw new Error(`Invalid Excel date at ${label}: ${String(value)}`);
}

function stableUuid(key) {
  const hex = createHash("sha256").update(`cruel-coding:user:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function identitiesFrom(row) {
  const values = [clean(row[1])];
  if (typeof row[13] === "string") values.push(...row[13].split(/[,，]/));
  const seen = new Set();
  return values.map(clean).filter((value) => value && value.toUpperCase() !== "X")
    .filter((value) => {
      const key = normalize(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseRow(row, sheet, index) {
  const displayName = clean(row[0]);
  if (!displayName) throw new Error(`${sheet}!A${index + 1} has no display name`);
  const joinedAt = dateOnly(row[2], `${sheet}!C${index + 1}`);
  const leftAt = sheet === "Current" ? null : dateOnly(row[3], `${sheet}!D${index + 1}`);
  if (leftAt && leftAt < joinedAt) throw new Error(`${sheet}!${index + 1} ends before it starts`);
  return {
    sourceSheet: sheet,
    sourceRow: index + 1,
    displayName,
    identities: identitiesFrom(row),
    joinedAt,
    leftAt,
    invitedByText: clean(row[5]),
    company: clean(row[6]),
    subgroup: clean(row[7]),
    externalHandle: clean(row[8]),
    school: clean(row[9]),
    notes: clean(row[10]),
    email: email(row[11]),
    realName: clean(row[12])?.replace(/[，,\s]+$/u, "") || null,
  };
}

function unionFind(size) {
  const parent = Array.from({ length: size }, (_, index) => index);
  const find = (index) => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  return { find, union };
}

async function allRows(queryFactory, pageSize = 1000) {
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await queryFactory().range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

async function upsertChunks(supabase, table, rows, options, size = 300) {
  for (let start = 0; start < rows.length; start += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(start, start + size), options);
    if (error) throw new Error(`${table} upsert failed at row ${start + 1}: ${error.message}`);
  }
}

const [currentRows, quitedRows, scoreboardRows] = await Promise.all([
  readXlsxFile(GROUP_RECORD, { sheet: "Current" }),
  readXlsxFile(GROUP_RECORD, { sheet: "Quited" }),
  readXlsxFile(SCOREBOARD),
]);

const sourceRows = [
  ...quitedRows.map((row, index) => parseRow(row, "Quited", index)),
  ...currentRows.map((row, index) => parseRow(row, "Current", index)),
];
const scoreboardAccounts = new Set(scoreboardRows.slice(11)
  .filter((row) => typeof row[0] === "number" && clean(row[1]))
  .map((row) => normalize(row[1])));

const uf = unionFind(sourceRows.length);
const identityOwner = new Map();
const emailOwner = new Map();
for (const [index, row] of sourceRows.entries()) {
  for (const username of row.identities) {
    const key = normalize(username);
    if (identityOwner.has(key)) uf.union(index, identityOwner.get(key));
    else identityOwner.set(key, index);
  }
  if (row.email) {
    if (emailOwner.has(row.email)) uf.union(index, emailOwner.get(row.email));
    else emailOwner.set(row.email, index);
  }
}

const groups = new Map();
for (const [index, row] of sourceRows.entries()) {
  const root = uf.find(index);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(row);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const [existingUsers, existingIdentities] = await Promise.all([
  allRows(() => supabase.from("users").select("*")),
  allRows(() => supabase.from("user_identities").select("user_id,normalized_username,is_primary").eq("provider", "leetcode")),
]);
const existingByEmail = new Map(existingUsers.filter((row) => row.email).map((row) => [normalize(row.email), row.id]));
const existingByIdentity = new Map(existingIdentities.map((row) => [row.normalized_username, row.user_id]));
const existingById = new Map(existingUsers.map((row) => [row.id, row]));
const existingPrimaryByUser = new Map(existingIdentities.filter((row) => row.is_primary).map((row) => [row.user_id, row.normalized_username]));

const users = [];
const identities = [];
const memberships = [];
const activeIds = new Set();
const importedIds = new Set();
for (const rows of groups.values()) {
  rows.sort((a, b) => Number(a.sourceSheet === "Current") - Number(b.sourceSheet === "Current") || a.joinedAt.localeCompare(b.joinedAt));
  const preferred = [...rows].reverse().find((row) => row.sourceSheet === "Current") ?? rows.at(-1);
  const usernames = [...new Map(rows.flatMap((row) => row.identities).map((value) => [normalize(value), value])).values()];
  const emails = [...new Set(rows.map((row) => row.email).filter(Boolean))];
  if (emails.length > 1) throw new Error(`Conflicting emails for ${preferred.displayName}: ${emails.join(", ")}`);
  const matchedIds = new Set([
    ...usernames.map((value) => existingByIdentity.get(normalize(value))),
    ...emails.map((value) => existingByEmail.get(value)),
  ].filter(Boolean));
  if (matchedIds.size > 1) throw new Error(`Existing records conflict for ${preferred.displayName}: ${[...matchedIds].join(", ")}`);
  const scoreboardUsername = usernames.find((value) => scoreboardAccounts.has(normalize(value)));
  const key = scoreboardUsername ? normalize(scoreboardUsername)
    : usernames.length ? normalize(usernames[0])
      : emails.length ? `email:${emails[0]}`
        : `source:${rows[0].sourceSheet}:${rows[0].sourceRow}`;
  const userId = [...matchedIds][0] ?? stableUuid(key);
  const active = Boolean(scoreboardUsername);
  importedIds.add(userId);
  if (active) activeIds.add(userId);
  users.push({
    id: userId,
    cruel_id: existingById.get(userId)?.cruel_id ?? scoreboardUsername ?? usernames[0] ?? `group-record-${rows[0].sourceSheet.toLowerCase()}-${rows[0].sourceRow}`,
    cruel_date: existingById.get(userId)?.cruel_date ?? rows.map((row) => row.joinedAt).sort()[0],
    display_name: preferred.displayName,
    real_name: preferred.realName,
    email: emails[0] ?? null,
    company: preferred.company,
    school: preferred.school,
    notes: preferred.notes,
    external_handle: preferred.externalHandle,
    status: active ? "active" : "inactive",
    merged_into_user_id: null,
    updated_at: new Date().toISOString(),
  });
  const existingPrimary = existingPrimaryByUser.get(userId);
  usernames.forEach((username, index) => identities.push({
    user_id: userId,
    provider: "leetcode",
    username,
    is_primary: existingPrimary ? normalize(username) === existingPrimary : index === 0,
  }));
  for (const row of rows) memberships.push({
    user_id: userId,
    joined_at: row.joinedAt,
    left_at: row.leftAt,
    subgroup: row.subgroup,
    invited_by_text: row.invitedByText,
    source_sheet: row.sourceSheet,
    source_row: row.sourceRow,
  });
}

const openMembershipCounts = new Map();
for (const membership of memberships.filter((row) => row.left_at === null)) {
  openMembershipCounts.set(membership.user_id, (openMembershipCounts.get(membership.user_id) ?? 0) + 1);
}
const duplicateOpen = [...openMembershipCounts].filter(([, count]) => count > 1);
if (duplicateOpen.length) throw new Error(`${duplicateOpen.length} users have multiple Current rows after deduplication`);

const summary = {
  source: { current: currentRows.length, quited: quitedRows.length, scoreboard: scoreboardAccounts.size },
  import: { users: users.length, identities: identities.length, memberships: memberships.length, active: activeIds.size },
  existingMatches: users.filter((row) => existingUsers.some((existing) => existing.id === row.id)).length,
  onlineUserColumns: Object.keys(existingUsers[0] ?? {}).sort(),
};

if (dryRun) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

await upsertChunks(supabase, "users", users, { onConflict: "id" });
await upsertChunks(supabase, "user_identities", identities, { onConflict: "provider,normalized_username" });
await upsertChunks(supabase, "memberships", memberships, { onConflict: "source_sheet,source_row" });

const [allVerifiedUsers, allVerifiedIdentities, allVerifiedMemberships] = await Promise.all([
  allRows(() => supabase.from("users").select("id,status")),
  allRows(() => supabase.from("user_identities").select("id,user_id")),
  allRows(() => supabase.from("memberships").select("id,user_id,left_at")),
]);
const verifiedUsers = allVerifiedUsers.filter((row) => importedIds.has(row.id));
const verifiedIdentities = allVerifiedIdentities.filter((row) => importedIds.has(row.user_id));
const verifiedMemberships = allVerifiedMemberships.filter((row) => importedIds.has(row.user_id));
const verifiedActive = verifiedUsers.filter((row) => row.status === "active").length;
if (verifiedUsers.length !== users.length || verifiedActive !== activeIds.size) {
  throw new Error(`Verification failed: users=${verifiedUsers.length}/${users.length}, active=${verifiedActive}/${activeIds.size}`);
}

console.log(JSON.stringify({
  ...summary,
  verified: { users: verifiedUsers.length, identities: verifiedIdentities.length, memberships: verifiedMemberships.length, active: verifiedActive },
}, null, 2));
