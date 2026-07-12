import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function GET() {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("exams")
    .select("id, title, status, duration_minutes, created_at, profiles!exams_admin_id_fkey(display_name, email)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exams: data });
}
