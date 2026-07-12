import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

function answersMatch(response: string, correct: string): boolean {
  const a = response.trim().toLowerCase();
  const b = correct.trim().toLowerCase();
  if (a === b) return true;
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return Math.abs(numA - numB) < 1e-6;
  }
  return false;
}

/**
 * Auto-grades every mcq/numeric answer for one attempt against the exam's
 * answer key. Subjective answers are left ungraded for the manual queue.
 * Uses the service-role client because correct_answer is never readable
 * under the student's own RLS session.
 */
export async function gradeAttempt(attemptId: string) {
  const admin = createAdminClient();

  const { data: attempt } = await admin.from("attempts").select("*").eq("id", attemptId).single();
  if (!attempt) return;

  const { data: questions } = await admin
    .from("questions")
    .select("id, type, correct_answer, marks, negative_marks")
    .eq("exam_id", attempt.exam_id);

  const { data: answers } = await admin
    .from("answers")
    .select("*")
    .eq("attempt_id", attemptId);

  for (const question of questions ?? []) {
    if (question.type === "subjective") continue;

    const answer = answers?.find((a) => a.question_id === question.id);
    const response = answer?.response?.trim();

    let isCorrect = false;
    let marksAwarded = 0;

    if (response) {
      isCorrect = question.correct_answer ? answersMatch(response, question.correct_answer) : false;
      marksAwarded = isCorrect ? question.marks : -question.negative_marks;
    }

    if (answer) {
      await admin
        .from("answers")
        .update({ is_correct: isCorrect, marks_awarded: marksAwarded, graded: true })
        .eq("id", answer.id);
    } else {
      await admin.from("answers").insert({
        attempt_id: attemptId,
        question_id: question.id,
        response: null,
        is_correct: false,
        marks_awarded: 0,
        graded: true,
      });
    }
  }
}

/**
 * Recomputes total marks, dense ranks, and percentiles for every submitted
 * attempt of an exam. Safe to re-run any time (e.g. after manual subjective
 * grading) — never overwrites `published`.
 */
export async function recomputeResultsForExam(examId: string) {
  const admin = createAdminClient();

  const { data: attempts } = await admin
    .from("attempts")
    .select("id, student_id")
    .eq("exam_id", examId)
    .in("status", ["submitted", "auto_submitted"]);

  if (!attempts || attempts.length === 0) return;

  const totals: { attemptId: string; studentId: string; total: number }[] = [];

  for (const attempt of attempts) {
    const { data: answers } = await admin
      .from("answers")
      .select("marks_awarded, graded")
      .eq("attempt_id", attempt.id);

    const total = (answers ?? []).reduce(
      (sum, a) => sum + (a.graded ? Number(a.marks_awarded ?? 0) : 0),
      0
    );
    totals.push({ attemptId: attempt.id, studentId: attempt.student_id, total });
  }

  const sorted = [...totals].sort((a, b) => b.total - a.total);
  const n = sorted.length;

  for (let i = 0; i < n; i++) {
    const { attemptId, studentId, total } = sorted[i];
    const rank =
      i === 0 || sorted[i - 1].total !== total ? i + 1 : (sorted[i - 1] as unknown as { rank: number }).rank;
    (sorted[i] as unknown as { rank: number }).rank = rank;
    const percentile = n > 1 ? ((n - rank) / (n - 1)) * 100 : 100;

    const { data: existing } = await admin
      .from("results")
      .select("id, published")
      .eq("attempt_id", attemptId)
      .maybeSingle();

    if (existing) {
      await admin
        .from("results")
        .update({ total_marks: total, rank, percentile })
        .eq("id", existing.id);
    } else {
      await admin.from("results").insert({
        attempt_id: attemptId,
        exam_id: examId,
        student_id: studentId,
        total_marks: total,
        rank,
        percentile,
        published: false,
      });
    }
  }
}
