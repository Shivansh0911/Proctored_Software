import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  questionId: z.string().uuid(),
  response: z.string().nullable(),
  markedForReview: z.boolean().optional().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireStudent();
  const { attemptId } = await params;

  if (!checkRateLimit(`answer:${attemptId}`, 60, 30_000)) {
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, status, student_id, students!inner(user_id)")
    .eq("id", attemptId)
    .single();

  if (!attempt || (attempt.students as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Not your attempt" }, { status: 403 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt is no longer in progress" }, { status: 409 });
  }

  const { error } = await supabase.from("answers").upsert(
    {
      attempt_id: attemptId,
      question_id: parsed.data.questionId,
      response: parsed.data.response,
      marked_for_review: parsed.data.markedForReview,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id,question_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
