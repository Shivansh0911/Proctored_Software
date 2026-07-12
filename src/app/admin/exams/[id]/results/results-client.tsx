"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface GradingItem {
  id: string;
  response: string | null;
  marks_awarded: number | null;
  questions: { text: string; marks: number } | { text: string; marks: number }[];
  attempts: { students: { name: string; roll_no: string } | { name: string; roll_no: string }[] };
}

interface ResultRow {
  id: string;
  attempt_id: string;
  total_marks: number;
  rank: number | null;
  percentile: number | null;
  published: boolean;
  students: { name: string; roll_no: string; email: string } | { name: string; roll_no: string; email: string }[];
}

function one<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

export function ResultsClient({ examId }: { examId: string }) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [grading, setGrading] = useState<GradingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [marksDraft, setMarksDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [resultsRes, gradingRes] = await Promise.all([
      fetch(`/api/admin/exams/${examId}/results`),
      fetch(`/api/admin/exams/${examId}/grading`),
    ]);
    const resultsData = await resultsRes.json();
    const gradingData = await gradingRes.json();
    setResults(resultsData.results ?? []);
    setGrading(gradingData.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function evaluate() {
    setEvaluating(true);
    const res = await fetch(`/api/admin/exams/${examId}/grade`, { method: "POST" });
    setEvaluating(false);
    if (!res.ok) {
      toast.error("Evaluation failed");
      return;
    }
    toast.success("Evaluated — ranks recomputed");
    load();
  }

  async function saveMarks(answerId: string, maxMarks: number) {
    const raw = marksDraft[answerId];
    const marks = Number(raw);
    if (Number.isNaN(marks)) {
      toast.error("Enter a number");
      return;
    }
    if (marks > maxMarks) {
      toast.error(`Cannot exceed ${maxMarks} marks`);
      return;
    }
    const res = await fetch(`/api/admin/exams/${examId}/grading/${answerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marksAwarded: marks }),
    });
    if (!res.ok) {
      toast.error("Failed to save grade");
      return;
    }
    toast.success("Graded");
    load();
  }

  async function togglePublish(published: boolean) {
    setPublishing(true);
    const res = await fetch(`/api/admin/exams/${examId}/results/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    setPublishing(false);
    if (!res.ok) {
      toast.error("Failed to update publish state");
      return;
    }
    toast.success(published ? "Results published" : "Results unpublished");
    load();
  }

  const allPublished = results.length > 0 && results.every((r) => r.published);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Evaluation</CardTitle>
            <CardDescription>
              MCQ/numeric are auto-graded on submit. Re-run after manual grading to refresh ranks.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <a href={`/api/admin/exams/${examId}/results/export`}>
              <Button variant="outline">Export Excel</Button>
            </a>
            <a href={`/print/exams/${examId}/results`} target="_blank" rel="noreferrer">
              <Button variant="outline">Print / PDF</Button>
            </a>
            <Button onClick={evaluate} disabled={evaluating}>
              {evaluating ? "Evaluating..." : "Evaluate now"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {grading.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual grading queue ({grading.length})</CardTitle>
            <CardDescription>Subjective answers awaiting a mark.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {grading.map((item) => {
              const q = one(item.questions);
              const student = one(item.attempts.students);
              return (
                <div key={item.id} className="space-y-2 rounded-md border p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {student?.name} ({student?.roll_no})
                    </span>
                    <Badge variant="outline">Max {q?.marks} marks</Badge>
                  </div>
                  <p className="font-medium">{q?.text}</p>
                  <p className="rounded-md bg-muted/40 p-2 text-sm">{item.response || "(no answer)"}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-32"
                      placeholder="Marks"
                      value={marksDraft[item.id] ?? ""}
                      onChange={(e) => setMarksDraft({ ...marksDraft, [item.id]: e.target.value })}
                    />
                    <Button size="sm" onClick={() => saveMarks(item.id, q?.marks ?? 0)}>
                      Save grade
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Leaderboard ({results.length})</CardTitle>
            <CardDescription>Students only see this once published.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Publish to students</span>
            <Switch checked={allPublished} disabled={publishing} onCheckedChange={togglePublish} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Percentile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No submissions yet. Run &quot;Evaluate now&quot; after students submit.
                  </TableCell>
                </TableRow>
              )}
              {results.map((r) => {
                const student = one(r.students);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.rank}</TableCell>
                    <TableCell>{student?.roll_no}</TableCell>
                    <TableCell>{student?.name}</TableCell>
                    <TableCell>{r.total_marks}</TableCell>
                    <TableCell>{r.percentile?.toFixed(1)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
