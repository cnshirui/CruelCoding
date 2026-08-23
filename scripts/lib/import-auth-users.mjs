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

export async function importAuthUsers(supabase, csvPath) {
  const records = parseCsv(await readFile(csvPath, "utf8"));
  if (!records.length) throw new Error("data/users.csv has no users");
  const seen = new Set();
  for (const [index, record] of records.entries()) {
    record.email = record.email.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(record.email)) throw new Error(`Row ${index + 2}: invalid email`);
    if (record.password.length < 8) throw new Error(`Row ${index + 2}: password must be at least 8 characters`);
    if (!record.name) throw new Error(`Row ${index + 2}: name is required`);
    if (!/^[a-z][a-z0-9_-]*$/i.test(record.role)) throw new Error(`Row ${index + 2}: invalid role`);
    if (seen.has(record.email)) throw new Error(`Row ${index + 2}: duplicate email`);
    seen.add(record.email);
  }

  const existingByEmail = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((user) => existingByEmail.set(user.email?.toLowerCase(), user));
    if (data.users.length < 1000) break;
  }

  let created = 0, updated = 0;
  for (const record of records) {
    const attributes = {
      email: record.email,
      password: record.password,
      email_confirm: true,
      user_metadata: { name: record.name },
      app_metadata: { role: record.role },
    };
    const existing = existingByEmail.get(record.email);
    if (existing) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, attributes);
      if (error) throw new Error(`Could not update ${record.email}: ${error.message}`);
      updated += 1;
    } else {
      const { error } = await supabase.auth.admin.createUser(attributes);
      if (error) throw new Error(`Could not create ${record.email}: ${error.message}`);
      created += 1;
    }
  }
  return { created, updated };
}
