import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/auth";
import { seededShuffle } from "@/lib/shuffle";
import type { PublicQuestion } from "@/types/database";

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireStudent();
  const { attemptId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", attempt.student_id)
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ error: "Not your attempt" }, { status: 403 });
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "This attempt has already been submitted", submitted: true }, { status: 409 });
  }

  const { data: exam } = await supabase.from("exams").select("*").eq("id", attempt.exam_id).single();
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  // Regular RLS-scoped `questions` reads are admin-only, so a student session
  // can never read this table directly (not even to accidentally see
  // correct_answer). Ownership of the attempt was already verified above
  // with the RLS-scoped client, so it's safe to use the service-role client
  // here purely to fetch the (explicitly whitelisted, answer-free) columns.
  const admin = createAdminClient();
  const { data: questions } = await admin
    .from("questions")
    .select("id, exam_id, type, text, options, marks, negative_marks, order_index, created_at")
    .eq("exam_id", exam.id)
    .order("order_index", { ascending: true });

  const publicQuestions: PublicQuestion[] = questions ?? [];
  const ordered = exam.shuffle_questions
    ? seededShuffle(publicQuestions, attemptId)
    : publicQuestions;

  const { data: answers } = await supabase
    .from("answers")
    .select("question_id, response, marked_for_review")
    .eq("attempt_id", attemptId);

  const elapsedSeconds = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
  const remainingSeconds = Math.max(0, exam.duration_minutes * 60 - elapsedSeconds);

  return NextResponse.json({
    attempt,
    exam: {
      id: exam.id,
      title: exam.title,
      instructions: exam.instructions,
      duration_minutes: exam.duration_minutes,
      proctoring_settings: exam.proctoring_settings,
    },
    questions: ordered,
    answers: answers ?? [],
    remainingSeconds,
  });
}
