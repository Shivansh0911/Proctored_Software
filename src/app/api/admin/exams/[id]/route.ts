import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

const updateExamSchema = z.object({
  title: z.string().min(1).optional(),
  instructions: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  window_start: z.string().nullable().optional(),
  window_end: z.string().nullable().optional(),
  negative_marking: z.boolean().optional(),
  negative_marking_value: z.number().optional(),
  shuffle_questions: z.boolean().optional(),
  proctoring_settings: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "super_admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.from("exams").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ exam: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const parsed = updateExamSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exam: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("exams").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
