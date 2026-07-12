import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

const createExamSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().optional().default(""),
  duration_minutes: z.number().int().positive(),
  window_start: z.string().nullable().optional(),
  window_end: z.string().nullable().optional(),
  negative_marking: z.boolean().optional().default(false),
  negative_marking_value: z.number().optional().default(0),
  shuffle_questions: z.boolean().optional().default(false),
});

export async function GET() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("admin_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exams: data });
}

export async function POST(request: Request) {
  const profile = await requireRole("admin");
  const parsed = createExamSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .insert({ ...parsed.data, admin_id: profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exam: data });
}
