import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OWNER_COOKIE = "cruel_checkin_owner";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type CheckinInput = {
  cruel_id?: unknown;
  checkin_date?: unknown;
  note?: unknown;
};

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function ownerFor(request: NextRequest) {
  const existing = request.cookies.get(OWNER_COOKIE)?.value;
  const token = existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : randomUUID();
  return { token, hash: createHash("sha256").update(token).digest("hex"), isNew: !existing };
}

function withOwnerCookie(response: NextResponse, token: string, isNew: boolean) {
  if (isNew) response.cookies.set(OWNER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseInput(body: CheckinInput) {
  const cruelId = typeof body.cruel_id === "string" ? body.cruel_id.trim() : undefined;
  const date = typeof body.checkin_date === "string" ? body.checkin_date : undefined;
  const note = typeof body.note === "string" ? body.note.trim() || null : body.note === null ? null : undefined;
  if (date && !DATE_PATTERN.test(date)) throw new Error("checkin_date must use YYYY-MM-DD");
  if (note && note.length > 500) throw new Error("note must be 500 characters or fewer");
  return { cruelId, date, note };
}

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    const cruelId = request.nextUrl.searchParams.get("cruel_id");
    if (date && !DATE_PATTERN.test(date)) return errorResponse("date must use YYYY-MM-DD", 400);

    const owner = ownerFor(request);
    let query = database()
      .from("daily_checkins")
      .select("id,cruel_id,checkin_date,note,created_at,updated_at,owner_hash")
      .order("created_at", { ascending: true });
    if (date) query = query.eq("checkin_date", date);
    if (cruelId) query = query.eq("cruel_id", cruelId);
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 503);
    const checkins = data?.map(({ owner_hash, ...checkin }) => ({ ...checkin, can_edit: owner_hash === owner.hash }));
    return withOwnerCookie(NextResponse.json({ checkins }), owner.token, owner.isNew);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to read check-ins", 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CheckinInput;
    const { cruelId, date, note } = parseInput(body);
    if (!cruelId) return errorResponse("cruel_id is required", 400);
    const owner = ownerFor(request);
    const record = { cruel_id: cruelId, owner_hash: owner.hash, ...(date ? { checkin_date: date } : {}), ...(note !== undefined ? { note } : {}) };
    const { data, error } = await database().from("daily_checkins").insert(record)
      .select("id,cruel_id,checkin_date,note,created_at,updated_at").single();
    if (error?.code === "23505") return errorResponse("This member has already checked in for that date", 409);
    if (error?.code === "23503") return errorResponse("Unknown CruelID", 404);
    if (error) return errorResponse(error.message, 503);
    return withOwnerCookie(NextResponse.json({ checkin: data }, { status: 201 }), owner.token, owner.isNew);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid request", 400);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return errorResponse("A valid id is required", 400);
    const body = await request.json() as CheckinInput;
    const { cruelId, date, note } = parseInput(body);
    const changes = { ...(cruelId ? { cruel_id: cruelId } : {}), ...(date ? { checkin_date: date } : {}), ...(note !== undefined ? { note } : {}), updated_at: new Date().toISOString() };
    const owner = ownerFor(request);
    const { data, error } = await database().from("daily_checkins").update(changes)
      .eq("id", id).eq("owner_hash", owner.hash)
      .select("id,cruel_id,checkin_date,note,created_at,updated_at").maybeSingle();
    if (error?.code === "23505") return errorResponse("This member has already checked in for that date", 409);
    if (error) return errorResponse(error.message, 503);
    if (!data) return errorResponse("Check-in not found or not owned by this browser", 404);
    return NextResponse.json({ checkin: data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid request", 400);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return errorResponse("A valid id is required", 400);
    const owner = ownerFor(request);
    const { data, error } = await database().from("daily_checkins").delete()
      .eq("id", id).eq("owner_hash", owner.hash).select("id").maybeSingle();
    if (error) return errorResponse(error.message, 503);
    if (!data) return errorResponse("Check-in not found or not owned by this browser", 404);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to delete check-in", 503);
  }
}
