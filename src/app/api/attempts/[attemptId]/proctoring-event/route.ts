import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { gradeAttempt, recomputeResultsForExam } from "@/lib/grading";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ProctoringEventType, ProctoringSeverity } from "@/types/database";

const TAB_EVENT_TYPES: ProctoringEventType[] = ["tab_switch", "window_blur"];

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireStudent();
  const { attemptId } = await params;

  if (!checkRateLimit(`proctoring-event:${attemptId}`, 30, 30_000)) {
    return NextResponse.json({ error: "Too many events" }, { status: 429 });
  }

  const formData = await request.formData();
  const type = formData.get("type") as ProctoringEventType | null;
  const severity = (formData.get("severity") as ProctoringSeverity | null) ?? "low";
  const snapshot = formData.get("snapshot") as File | null;

  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, exam_id, status, violation_count, students!inner(user_id)")
    .eq("id", attemptId)
    .single();

  if (!attempt || (attempt.students as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Not your attempt" }, { status: 403 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ ok: true, shouldAutoSubmit: false });
  }

  let snapshotPath: string | null = null;
  if (snapshot) {
    const path = `${attemptId}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("proctoring-snapshots")
      .upload(path, snapshot, { contentType: "image/jpeg" });
    if (!uploadError) snapshotPath = path;
  }

  await supabase.from("proctoring_events").insert({
    attempt_id: attemptId,
    type,
    severity,
    snapshot_path: snapshotPath,
  });

  const newViolationCount = attempt.violation_count + 1;
  await supabase.from("attempts").update({ violation_count: newViolationCount }).eq("id", attemptId);

  const { data: exam } = await supabase
    .from("exams")
    .select("proctoring_settings")
    .eq("id", attempt.exam_id)
    .single();

  const settings = exam?.proctoring_settings;
  let shouldAutoSubmit = false;

  if (settings?.auto_submit_on_violation) {
    const limit = TAB_EVENT_TYPES.includes(type)
      ? settings.tab_switch_limit
      : type === "fullscreen_exit"
        ? settings.fullscreen_exit_limit
        : null;

    if (limit != null && newViolationCount > limit) {
      shouldAutoSubmit = true;
      await supabase
        .from("attempts")
        .update({ status: "auto_submitted", submitted_at: new Date().toISOString() })
        .eq("id", attemptId);
      await gradeAttempt(attemptId);
      await recomputeResultsForExam(attempt.exam_id);
    }
  }

  return NextResponse.json({ ok: true, shouldAutoSubmit });
}
