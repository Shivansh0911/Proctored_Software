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

  const { data, error } = await supabase
    .from("results")
    .select("*, students(name, roll_no, email)")
    .eq("exam_id", id)
    .order("rank", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ results: data });
}
