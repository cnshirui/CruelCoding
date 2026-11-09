import { readFile } from "node:fs/promises";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (quoted) throw new Error("users.csv contains an unclosed quoted field");
  const [headers, ...records] = rows;
  return records.filter((values) => values.some(Boolean)).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() ?? ""])),
  );
}

// Seeds app_users (the app's own accounts, Google sign-in only) from data/users.csv: email,name,role.
// Existing rows keep their id and google_sub; name and role follow the CSV.
export async function importAuthUsers(supabase, csvPath) {
  const records = parseCsv(await readFile(csvPath, "utf8"));
  if (!records.length) throw new Error("data/users.csv has no users");
  const seen = new Set();
  for (const [index, record] of records.entries()) {
    record.email = record.email.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(record.email)) throw new Error(`Row ${index + 2}: invalid email`);
    if (!record.name) throw new Error(`Row ${index + 2}: name is required`);
    if (!/^[a-z][a-z0-9_-]*$/.test(record.role)) throw new Error(`Row ${index + 2}: invalid role`);
    if (seen.has(record.email)) throw new Error(`Row ${index + 2}: duplicate email`);
    seen.add(record.email);
  }

  const { data: existing, error: lookupError } = await supabase.from("app_users").select("email").in("email", [...seen]);
  if (lookupError) throw lookupError;
  const { error } = await supabase.from("app_users").upsert(
    records.map(({ email, name, role }) => ({ email, name, role })),
    { onConflict: "email" },
  );
  if (error) throw new Error(`Could not import users: ${error.message}`);
  return { created: records.length - existing.length, updated: existing.length };
}
