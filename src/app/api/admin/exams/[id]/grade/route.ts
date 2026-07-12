import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { recomputeResultsForExam } from "@/lib/grading";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  await recomputeResultsForExam(id);
  return NextResponse.json({ ok: true });
}
