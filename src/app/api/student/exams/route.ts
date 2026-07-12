import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";

export async function GET() {
  const user = await requireStudent();
  const supabase = await createClient();

  const { data: students, error } = await supabase
    .from("students")
    .select(
      "id, exam_id, roll_no, status, exams(id, title, status, duration_minutes, window_start, window_end)"
    )
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const examIds = (students ?? []).map((s) => s.exam_id);
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, exam_id, status, submitted_at")
    .in("exam_id", examIds.length ? examIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: results } = await supabase
    .from("results")
    .select("exam_id, published, total_marks, rank")
    .in("exam_id", examIds.length ? examIds : ["00000000-0000-0000-0000-000000000000"]);

  const enriched = (students ?? []).map((s) => ({
    ...s,
    attempt: attempts?.find((a) => a.exam_id === s.exam_id) ?? null,
    result: results?.find((r) => r.exam_id === s.exam_id) ?? null,
  }));

  return NextResponse.json({ enrollments: enriched });
}
