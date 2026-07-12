import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const profile = await requireRole("admin");
  const { id, attemptId } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const { data: events } = await supabase
    .from("proctoring_events")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("timestamp", { ascending: false });

  const withSignedUrls = await Promise.all(
    (events ?? []).map(async (e) => {
      if (!e.snapshot_path) return { ...e, snapshotUrl: null };
      const { data } = await supabase.storage
        .from("proctoring-snapshots")
        .createSignedUrl(e.snapshot_path, 60 * 10);
      return { ...e, snapshotUrl: data?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ events: withSignedUrls });
}
