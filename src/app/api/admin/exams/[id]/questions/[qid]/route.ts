import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  type: z.enum(["mcq", "numeric", "subjective"]).optional(),
  text: z.string().min(1).optional(),
  options: z.array(z.object({ key: z.string(), text: z.string() })).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  marks: z.number().nonnegative().optional(),
  negative_marks: z.number().nonnegative().optional(),
  order_index: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const profile = await requireRole("admin");
  const { id, qid } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("questions")
    .update(parsed.data)
    .eq("id", qid)
    .eq("exam_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ question: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const profile = await requireRole("admin");
  const { id, qid } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const { error } = await supabase.from("questions").delete().eq("id", qid).eq("exam_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
