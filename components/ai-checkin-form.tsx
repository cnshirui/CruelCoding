"use client";

import { useState } from "react";
import { saveCheckin } from "@/app/ai-agents/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

type CourseOption = { code: string; title: string; school: string };

export function AiCheckinForm({ today, courses }: { today: string; courses: CourseOption[] }) {
  const [length, setLength] = useState(0);
  const schools = [...new Set(courses.map((course) => course.school))];
  return (
    <ActionForm action={saveCheckin} className="ai-checkin-form">
      <div className="ai-checkin-fields">
        <label>日期<Input type="date" name="checkin_date" defaultValue={today} max={today} required aria-label="打卡日期" /></label>
        <label>课程
          <Select name="course_code" required>
            <SelectTrigger aria-label="选择课程" className="w-full"><SelectValue placeholder="选择课程" /></SelectTrigger>
            <SelectContent>{schools.map((school) => <SelectGroup key={school}><SelectLabel>{school}</SelectLabel>{courses.filter((course) => course.school === school).map((course) => <SelectItem value={course.code} key={course.code}>{course.code} · {course.title}</SelectItem>)}</SelectGroup>)}</SelectContent>
          </Select>
        </label>
      </div>
      <label>读书笔记<textarea name="note" rows={7} minLength={50} maxLength={2000} required placeholder="今天学了什么？至少 50 字。" onChange={(event) => setLength(event.target.value.trim().length)} /></label>
      <div className="ai-checkin-footer"><span className={length < 50 ? "ai-count short" : "ai-count"}>{length} / 50 字{length < 50 ? `（还差 ${50 - length} 字）` : " ✓"}</span><SubmitButton pendingLabel="保存中…">提交打卡</SubmitButton></div>
    </ActionForm>
  );
}
