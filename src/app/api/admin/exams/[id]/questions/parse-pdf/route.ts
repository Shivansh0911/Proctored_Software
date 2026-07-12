import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { extractTextFromPdf, parseAnswerKeyFromText, parseQuestionsFromText } from "@/lib/pdf-parse";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const questionFile = formData.get("questionPaper") as File | null;
  const answerKeyFile = formData.get("answerKey") as File | null;

  if (!questionFile) {
    return NextResponse.json({ error: "questionPaper file is required" }, { status: 400 });
  }

  try {
    const questionBuffer = Buffer.from(await questionFile.arrayBuffer());
    const questionText = await extractTextFromPdf(questionBuffer);
    const parsed = parseQuestionsFromText(questionText);

    let answerKey: Record<number, string> = {};
    if (answerKeyFile) {
      const keyBuffer = Buffer.from(await answerKeyFile.arrayBuffer());
      const keyText = await extractTextFromPdf(keyBuffer);
      answerKey = parseAnswerKeyFromText(keyText);
    }

    const draft = parsed.map((q, idx) => ({
      ...q,
      correct_answer: answerKey[idx + 1] ?? null,
    }));

    return NextResponse.json({
      draft,
      warning:
        "This is a heuristic parse. Review every question, option, and answer before saving — nothing here is published yet.",
    });
  } catch (e) {
    console.error("PDF parse failed", e);
    return NextResponse.json(
      { error: "Could not parse the PDF. Try a text-based (not scanned/image) PDF, or enter questions manually." },
      { status: 400 }
    );
  }
}
