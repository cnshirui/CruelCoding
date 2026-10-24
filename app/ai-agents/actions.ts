"use server";

import { refresh } from "next/cache";
import { signupAdminClient } from "@/lib/signup-activation";
import { isRedPocketAdmin } from "@/lib/red-pocket-admin";
import { beijingDateKey, courseCodes, displayNameOf, getAiViewer } from "@/lib/ai-group";

export type ActionState = { ok: boolean; message: string } | null;
const fail = (message: string): ActionState => ({ ok: false, message });
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function applyToJoin(): Promise<ActionState> {
  const { supabase, user, member } = await getAiViewer();
  if (!user) return fail("请先登录。");
  if (member) return fail("你已经提交过申请。");
  const { error } = await supabase.from("ai_group_members").insert({ user_id: user.id, display_name: displayNameOf(user) });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "申请已提交，等待管理员批准。" };
}

export async function saveCheckin(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, member } = await getAiViewer();
  if (!user || member?.status !== "approved") return fail("只有已批准的群成员可以打卡。");
  const date = String(formData.get("checkin_date") ?? "");
  const course = String(formData.get("course_code") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!DATE.test(date)) return fail("日期格式不正确。");
  if (date > beijingDateKey()) return fail("不能给未来的日期打卡。");
  if (!courseCodes.includes(course)) return fail("请选择课程。");
  if (note.length < 50) return fail(`笔记至少 50 字，当前 ${note.length} 字。`);
  if (note.length > 2000) return fail("笔记最多 2000 字。");
  const { error } = await supabase.from("ai_checkins")
    .upsert({ user_id: user.id, checkin_date: date, course_code: course, note, updated_at: new Date().toISOString() }, { onConflict: "user_id,checkin_date" });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: `${date} 打卡成功。` };
}

export async function addComment(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, member } = await getAiViewer();
  if (!user || member?.status !== "approved") return fail("只有已批准的群成员可以评论。");
  const checkinId = Number(formData.get("checkin_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!Number.isSafeInteger(checkinId) || checkinId <= 0) return fail("打卡记录不存在。");
  if (!body) return fail("评论不能为空。");
  if (body.length > 1000) return fail("评论最多 1000 字。");
  const { error } = await supabase.from("ai_checkin_comments").insert({ checkin_id: checkinId, user_id: user.id, body });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "评论已发布。" };
}

export async function reviewMember(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isRedPocketAdmin())) return fail("只有管理员可以审核。");
  const { user } = await getAiViewer();
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["approved", "rejected"].includes(status)) return fail("请求格式不正确。");
  const { error } = await signupAdminClient().from("ai_group_members")
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null }).eq("user_id", userId);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: status === "approved" ? "已批准加入。" : "已拒绝。" };
}
