"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ExamRow {
  id: string;
  title: string;
  status: string;
  duration_minutes: number;
  created_at: string;
  profiles: { display_name: string; email: string } | null;
}

export default function SuperAdminExamsPage() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/exams")
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">All exams</h1>
        <p className="text-muted-foreground">Read-only view across every admin.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Exams</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && exams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No exams yet.
                  </TableCell>
                </TableRow>
              )}
              {exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.title}</TableCell>
                  <TableCell>
                    {e.profiles?.display_name} ({e.profiles?.email})
                  </TableCell>
                  <TableCell>{e.duration_minutes} min</TableCell>
                  <TableCell>
                    <Badge variant="outline">{e.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
