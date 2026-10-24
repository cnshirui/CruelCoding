import type { User } from "@supabase/supabase-js";
import { agentCourses } from "@/lib/ai-agent-courses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AiMemberStatus = "pending" | "approved" | "rejected";
export type AiMember = { user_id: string; display_name: string; status: AiMemberStatus; applied_at: string; reviewed_at: string | null };
export type AiCheckin = { id: number; user_id: string; checkin_date: string; course_code: string; note: string; created_at: string; updated_at: string; display_name: string; comment_count: number };
export type AiComment = { id: number; user_id: string; body: string; created_at: string; display_name: string };
export type AiCheckinFilters = { course?: string; date?: string; user?: string };
export type AiMemberStats = AiMember & { total: number; streak: number; last_date: string | null; last_course: string | null; last7: boolean[] };

export const courseOptions = agentCourses.map((course) => ({ code: course.code, title: course.title, school: course.school }));
export const courseCodes = courseOptions.map((course) => course.code);
export const courseTitle = (code: string) => courseOptions.find((course) => course.code === code)?.title ?? code;

export function displayNameOf(user: User | null | undefined) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const name = [metadata?.full_name, metadata?.name, metadata?.preferred_username, metadata?.user_name].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return name?.trim() || user?.email?.split("@")[0] || "成员";
}

// 残酷AI群 members are in China, so "today" follows Beijing time.
export function beijingDateKey(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

const memberColumns = "user_id,display_name,status,applied_at,reviewed_at";
const checkinColumns = "id,user_id,checkin_date,course_code,note,created_at,updated_at,member:ai_group_members(display_name),comments:ai_checkin_comments(count)";
type RawCheckin = Omit<AiCheckin, "display_name" | "comment_count"> & { member: { display_name: string } | null; comments: { count: number }[] | null };
const shapeCheckin = ({ member, comments, ...checkin }: RawCheckin): AiCheckin => ({ ...checkin, display_name: member?.display_name ?? "成员", comment_count: comments?.[0]?.count ?? 0 });

export async function getAiViewer() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, member: null };
  const { data } = await supabase.from("ai_group_members").select(memberColumns).eq("user_id", user.id).maybeSingle();
  return { supabase, user, member: (data as AiMember | null) ?? null };
}

export async function getAiMembers(): Promise<AiMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_group_members").select(memberColumns).order("applied_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AiMember[];
}

// ponytail: latest 500 rows per view; add server paging when the group outgrows it.
export async function getAiCheckins(filters: AiCheckinFilters = {}, limit = 500): Promise<AiCheckin[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("ai_checkins").select(checkinColumns).order("checkin_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  if (filters.course) query = query.eq("course_code", filters.course);
  if (filters.date) query = query.eq("checkin_date", filters.date);
  if (filters.user) query = query.eq("user_id", filters.user);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawCheckin[]).map(shapeCheckin);
}

export async function getAiCheckin(id: number): Promise<{ checkin: AiCheckin; comments: AiComment[] } | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: checkin }, { data: comments }] = await Promise.all([
    supabase.from("ai_checkins").select(checkinColumns).eq("id", id).maybeSingle(),
    supabase.from("ai_checkin_comments").select("id,user_id,body,created_at,member:ai_group_members(display_name)").eq("checkin_id", id).order("created_at", { ascending: true }),
  ]);
  if (!checkin) return null;
  type RawComment = Omit<AiComment, "display_name"> & { member: { display_name: string } | null };
  return {
    checkin: shapeCheckin(checkin as unknown as RawCheckin),
    comments: ((comments ?? []) as unknown as RawComment[]).map(({ member, ...comment }) => ({ ...comment, display_name: member?.display_name ?? "成员" })),
  };
}

export async function getAiStats(): Promise<AiMemberStats[]> {
  const supabase = await createSupabaseServerClient();
  const [members, { data, error }] = await Promise.all([
    getAiMembers(),
    supabase.from("ai_checkins").select("user_id,checkin_date,course_code").order("checkin_date", { ascending: false }).limit(10_000),
  ]);
  if (error) throw new Error(error.message);
  const byUser = new Map<string, { dates: Set<string>; last_date: string | null; last_course: string | null }>();
  for (const row of data ?? []) {
    const entry = byUser.get(row.user_id) ?? { dates: new Set<string>(), last_date: null, last_course: null };
    entry.dates.add(row.checkin_date);
    if (!entry.last_date) { entry.last_date = row.checkin_date; entry.last_course = row.course_code; }
    byUser.set(row.user_id, entry);
  }
  const days = Array.from({ length: 7 }, (_, index) => beijingDateKey(-6 + index));
  return members.map((member) => {
    const entry = byUser.get(member.user_id);
    const dates = entry?.dates ?? new Set<string>();
    let streak = 0;
    for (let offset = dates.has(beijingDateKey()) ? 0 : -1; dates.has(beijingDateKey(offset)); offset -= 1) streak += 1;
    return { ...member, total: dates.size, streak, last_date: entry?.last_date ?? null, last_course: entry?.last_course ?? null, last7: days.map((day) => dates.has(day)) };
  });
}
