import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id, title").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const { data: results } = await supabase
    .from("results")
    .select("*, students(name, roll_no, email)")
    .eq("exam_id", id)
    .order("rank", { ascending: true, nullsFirst: false });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Results");
  sheet.columns = [
    { header: "Rank", key: "rank", width: 8 },
    { header: "Roll No", key: "roll_no", width: 16 },
    { header: "Name", key: "name", width: 28 },
    { header: "Email", key: "email", width: 32 },
    { header: "Total Marks", key: "total_marks", width: 14 },
    { header: "Percentile", key: "percentile", width: 14 },
    { header: "Published", key: "published", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of results ?? []) {
    const student = Array.isArray(r.students) ? r.students[0] : r.students;
    sheet.addRow({
      rank: r.rank,
      roll_no: student?.roll_no,
      name: student?.name,
      email: student?.email,
      total_marks: r.total_marks,
      percentile: r.percentile ? Number(r.percentile.toFixed(2)) : null,
      published: r.published ? "Yes" : "No",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${exam.title.replace(/[^a-z0-9]+/gi, "_")}_results.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
