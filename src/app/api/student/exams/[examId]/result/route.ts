import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const user = await requireStudent();
  const { examId } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

  const { data: result } = await supabase
    .from("results")
    .select("*")
    .eq("exam_id", examId)
    .eq("student_id", student.id)
    .eq("published", true)
    .maybeSingle();

  if (!result) {
    return NextResponse.json({ error: "Result not published yet" }, { status: 404 });
  }

  const { data: exam } = await supabase.from("exams").select("title").eq("id", examId).single();

  const { data: attempt } = await supabase
    .from("attempts")
    .select("id")
    .eq("exam_id", examId)
    .eq("student_id", student.id)
    .single();

  const { count: totalCandidates } = await supabase
    .from("results")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);

  const { data: answers } = attempt
    ? await supabase
        .from("answers")
        .select("marks_awarded, is_correct, graded, questions(marks)")
        .eq("attempt_id", attempt.id)
    : { data: [] };

  const maxMarks = (answers ?? []).reduce((sum, a) => {
    const q = Array.isArray(a.questions) ? a.questions[0] : a.questions;
    return sum + (q?.marks ?? 0);
  }, 0);

  return NextResponse.json({
    examTitle: exam?.title,
    result,
    totalCandidates,
    maxMarks,
  });
}
