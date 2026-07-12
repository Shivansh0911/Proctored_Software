import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function StudentDashboardPage() {
  const user = await requireStudent();
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, exam_id, roll_no, must_change_password, exams(id, title, status, duration_minutes, window_start, window_end)")
    .eq("user_id", user.id);

  if (students?.some((s) => s.must_change_password)) {
    redirect("/student/change-password");
  }

  const examIds = (students ?? []).map((s) => s.exam_id);
  const { data: attempts } = await supabase
    .from("attempts")
    .select("exam_id, status")
    .in("exam_id", examIds.length ? examIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: results } = await supabase
    .from("results")
    .select("exam_id, published")
    .in("exam_id", examIds.length ? examIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("published", true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your exams</h1>
        <p className="text-muted-foreground">Everything you&apos;re enrolled in.</p>
      </div>

      {(!students || students.length === 0) && (
        <p className="text-muted-foreground">
          You&apos;re not enrolled in any exams yet. Contact your exam administrator.
        </p>
      )}

      <div className="grid gap-4">
        {students?.map((s) => {
          const exam = Array.isArray(s.exams) ? s.exams[0] : s.exams;
          if (!exam) return null;
          const attempt = attempts?.find((a) => a.exam_id === s.exam_id);
          const resultPublished = results?.some((r) => r.exam_id === s.exam_id);
          const now = new Date();
          const withinWindow =
            (!exam.window_start || new Date(exam.window_start) <= now) &&
            (!exam.window_end || now <= new Date(exam.window_end));

          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{exam.title}</CardTitle>
                <Badge variant="outline">{exam.duration_minutes} min</Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Roll No: {s.roll_no}</span>
                {exam.status !== "published" && (
                  <Badge variant="secondary">Not yet published</Badge>
                )}
                {exam.status === "published" && !attempt && withinWindow && (
                  <Link href={`/exam-session/${exam.id}/precheck`}>
                    <Button>Start exam</Button>
                  </Link>
                )}
                {exam.status === "published" && !attempt && !withinWindow && (
                  <Badge variant="secondary">Outside exam window</Badge>
                )}
                {attempt?.status === "in_progress" && (
                  <Link href={`/exam-session/${exam.id}/take`}>
                    <Button>Resume exam</Button>
                  </Link>
                )}
                {(attempt?.status === "submitted" || attempt?.status === "auto_submitted") &&
                  (resultPublished ? (
                    <Link href={`/student/exam/${exam.id}/result`}>
                      <Button variant="outline">View result</Button>
                    </Link>
                  ) : (
                    <Badge variant="secondary">Submitted — awaiting results</Badge>
                  ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
