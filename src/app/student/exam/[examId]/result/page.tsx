"use client";

import { use, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResultData {
  examTitle: string;
  result: { total_marks: number; rank: number | null; percentile: number | null };
  totalCandidates: number;
  maxMarks: number;
}

export default function StudentResultPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const [data, setData] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/student/exams/${examId}/result`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Result not available");
          return;
        }
        setData(json);
      })
      .catch(() => setError("Result not available"));
  }, [examId]);

  if (error) return <p className="text-muted-foreground">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{data.examTitle} — Result</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your score</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Marks</p>
            <p className="text-2xl font-semibold">
              {data.result.total_marks} / {data.maxMarks}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rank</p>
            <p className="text-2xl font-semibold">
              {data.result.rank} <span className="text-base text-muted-foreground">/ {data.totalCandidates}</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Percentile</p>
            <p className="text-2xl font-semibold">{data.result.percentile?.toFixed(1)}</p>
          </div>
          <div>
            <Badge>Published</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
