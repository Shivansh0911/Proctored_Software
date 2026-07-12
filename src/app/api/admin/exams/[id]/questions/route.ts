import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

const optionSchema = z.object({ key: z.string(), text: z.string() });

const questionSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["mcq", "numeric", "subjective"]),
  text: z.string().min(1),
  options: z.array(optionSchema).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  marks: z.number().nonnegative(),
  negative_marks: z.number().nonnegative().optional().default(0),
  order_index: z.number().int().optional().default(0),
});

const bulkSaveSchema = z.object({
  questions: z.array(questionSchema),
  replaceAll: z.boolean().optional().default(false),
});

async function assertOwnsExam(examId: string, adminId: string) {
  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id").eq("id", examId).single();
  return !!exam && exam.admin_id === adminId;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;
  if (!(await assertOwnsExam(id, profile.id))) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("exam_id", id)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ questions: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;
  if (!(await assertOwnsExam(id, profile.id))) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const parsed = bulkSaveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = await createClient();

  if (parsed.data.replaceAll) {
    const { error: deleteError } = await supabase.from("questions").delete().eq("exam_id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  const rows = parsed.data.questions.map((q, idx) => ({
    exam_id: id,
    type: q.type,
    text: q.text,
    options: q.type === "mcq" ? q.options : null,
    correct_answer: q.correct_answer || null,
    marks: q.marks,
    negative_marks: q.negative_marks,
    order_index: q.order_index ?? idx,
  }));

  const { data, error } = await supabase.from("questions").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ questions: data });
}
