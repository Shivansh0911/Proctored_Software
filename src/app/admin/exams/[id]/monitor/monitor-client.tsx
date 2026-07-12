"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AttemptRow {
  id: string;
  status: string;
  started_at: string;
  violation_count: number;
  students: { name: string; roll_no: string } | { name: string; roll_no: string }[];
  eventCounts: { high: number; medium: number; low: number };
}

interface EventRow {
  id: string;
  type: string;
  severity: string;
  timestamp: string;
  snapshotUrl: string | null;
}

function one<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

export function MonitorClient({ examId }: { examId: string }) {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch(`/api/admin/exams/${examId}/monitor`);
    const data = await res.json();
    setAttempts(data.attempts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function openTimeline(attemptId: string) {
    setSelected(attemptId);
    const res = await fetch(`/api/admin/exams/${examId}/monitor/${attemptId}`);
    const data = await res.json();
    setEvents(data.events ?? []);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Live attempts ({attempts.length})</CardTitle>
          <CardDescription>Refreshes automatically every few seconds.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Violations</TableHead>
                <TableHead>High / Med / Low</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && attempts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No attempts yet.
                  </TableCell>
                </TableRow>
              )}
              {attempts.map((a) => {
                const student = one(a.students);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      {student?.name} ({student?.roll_no})
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.status === "in_progress" ? "default" : "outline"}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.violation_count > 0 ? (
                        <Badge variant="destructive">{a.violation_count}</Badge>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.eventCounts.high} / {a.eventCounts.medium} / {a.eventCounts.low}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openTimeline(a.id)}>
                        View timeline
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proctoring timeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">No events logged.</p>
            )}
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-md border p-3">
                <Badge
                  variant={
                    e.severity === "high" ? "destructive" : e.severity === "medium" ? "default" : "secondary"
                  }
                >
                  {e.severity}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{e.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.timestamp).toLocaleString()}
                  </p>
                  {e.snapshotUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.snapshotUrl} alt="snapshot" className="mt-2 w-40 rounded-md border" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
