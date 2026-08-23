#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { importAuthUsers } from "./lib/import-auth-users.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = resolve(ROOT, "data/users.csv");
try { loadEnvFile(resolve(ROOT, ".env")); } catch (error) { if (error?.code !== "ENOENT") throw error; }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.");

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const { created, updated } = await importAuthUsers(supabase, CSV_PATH);
console.log(`Auth import complete: ${created} created, ${updated} updated.`);
