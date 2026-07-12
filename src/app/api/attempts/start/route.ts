import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({ examId: z.string().uuid() });

export async function POST(request: Request) {
  const user = await requireStudent();

  if (!checkRateLimit(`attempt-start:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { examId } = parsed.data;

  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, status")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "Not enrolled in this exam" }, { status: 403 });
  if (student.status !== "active") {
    return NextResponse.json({ error: "Your access to this exam has been disabled" }, { status: 403 });
  }

  const { data: exam } = await supabase.from("exams").select("*").eq("id", examId).single();
  if (!exam || exam.status !== "published") {
    return NextResponse.json({ error: "This exam is not currently available" }, { status: 403 });
  }
  const now = new Date();
  if (exam.window_start && new Date(exam.window_start) > now) {
    return NextResponse.json({ error: "This exam has not opened yet" }, { status: 403 });
  }
  if (exam.window_end && new Date(exam.window_end) < now) {
    return NextResponse.json({ error: "This exam window has closed" }, { status: 403 });
  }

  // One attempt per student per exam (idempotent resume): rely on the
  // (student_id, exam_id) unique constraint rather than a read-then-write
  // race between concurrent tabs/devices.
  const { data: attempt, error: upsertError } = await supabase
    .from("attempts")
    .upsert(
      { student_id: student.id, exam_id: examId },
      { onConflict: "student_id,exam_id", ignoreDuplicates: true }
    )
    .select()
    .maybeSingle();

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });

  const finalAttempt =
    attempt ??
    (
      await supabase
        .from("attempts")
        .select("*")
        .eq("student_id", student.id)
        .eq("exam_id", examId)
        .single()
    ).data;

  if (!finalAttempt) {
    return NextResponse.json({ error: "Could not start attempt" }, { status: 500 });
  }

  if (finalAttempt.status !== "in_progress") {
    return NextResponse.json({ error: "This attempt has already been submitted" }, { status: 409 });
  }

  return NextResponse.json({ attempt: finalAttempt });
}
