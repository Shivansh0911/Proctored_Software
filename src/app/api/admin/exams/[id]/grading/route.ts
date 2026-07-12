import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

// Manual grading queue: every subjective answer belonging to a submitted
// attempt that hasn't been graded yet.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const { data: questionIds } = await supabase
    .from("questions")
    .select("id")
    .eq("exam_id", id)
    .eq("type", "subjective");

  const ids = (questionIds ?? []).map((q) => q.id);
  if (ids.length === 0) return NextResponse.json({ items: [] });

  const { data: answers, error } = await supabase
    .from("answers")
    .select(
      "id, response, marks_awarded, graded, questions(text, marks), attempts!inner(exam_id, status, students(name, roll_no))"
    )
    .in("question_id", ids)
    .eq("graded", false)
    .in("attempts.status", ["submitted", "auto_submitted"])
    .eq("attempts.exam_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: answers ?? [] });
}
