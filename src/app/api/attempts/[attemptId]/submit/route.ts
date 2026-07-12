import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { gradeAttempt, recomputeResultsForExam } from "@/lib/grading";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({ autoSubmitted: z.boolean().optional().default(false) });

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireStudent();
  const { attemptId } = await params;

  if (!checkRateLimit(`submit:${attemptId}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many submit attempts — please wait a moment." }, { status: 429 });
  }

  const { autoSubmitted } = schema.parse(await request.json().catch(() => ({})));

  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, exam_id, status, students!inner(user_id)")
    .eq("id", attemptId)
    .single();

  if (!attempt || (attempt.students as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Not your attempt" }, { status: 403 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ ok: true }); // already submitted — idempotent
  }

  const { error } = await supabase
    .from("attempts")
    .update({
      status: autoSubmitted ? "auto_submitted" : "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", attemptId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await gradeAttempt(attemptId);
  await recomputeResultsForExam(attempt.exam_id);

  return NextResponse.json({ ok: true });
}
