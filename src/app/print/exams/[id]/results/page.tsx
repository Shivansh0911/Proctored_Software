import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export default async function PrintResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin", "super_admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: exam } = await supabase.from("exams").select("title, admin_id").eq("id", id).single();
  if (profile.role === "admin" && exam?.admin_id !== profile.id) {
    return <p className="p-8">Not found.</p>;
  }

  const { data: results } = await supabase
    .from("results")
    .select("rank, total_marks, percentile, published, students(name, roll_no, email)")
    .eq("exam_id", id)
    .order("rank", { ascending: true, nullsFirst: false });

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">{exam?.title} — Results</h1>
        <PrintButton />
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Rank</th>
            <th>Roll No</th>
            <th>Name</th>
            <th>Marks</th>
            <th>Percentile</th>
          </tr>
        </thead>
        <tbody>
          {(results ?? []).map((r, idx) => {
            const student = Array.isArray(r.students) ? r.students[0] : r.students;
            return (
              <tr key={idx} className="border-b">
                <td className="py-1">{r.rank}</td>
                <td>{student?.roll_no}</td>
                <td>{student?.name}</td>
                <td>{r.total_marks}</td>
                <td>{r.percentile?.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-8 text-xs text-muted-foreground print:mt-4">Built by Shivansh Shekhar Ojha</p>
    </div>
  );
}
