import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const { data: attempts, error } = await supabase
    .from("attempts")
    .select("id, status, started_at, violation_count, students(name, roll_no)")
    .eq("exam_id", id)
    .order("violation_count", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const attemptIds = (attempts ?? []).map((a) => a.id);
  const { data: events } = await supabase
    .from("proctoring_events")
    .select("attempt_id, severity")
    .in("attempt_id", attemptIds.length ? attemptIds : ["00000000-0000-0000-0000-000000000000"]);

  const enriched = (attempts ?? []).map((a) => {
    const attemptEvents = events?.filter((e) => e.attempt_id === a.id) ?? [];
    return {
      ...a,
      eventCounts: {
        high: attemptEvents.filter((e) => e.severity === "high").length,
        medium: attemptEvents.filter((e) => e.severity === "medium").length,
        low: attemptEvents.filter((e) => e.severity === "low").length,
      },
    };
  });

  return NextResponse.json({ attempts: enriched });
}
