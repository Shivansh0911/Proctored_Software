"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { StudentRow } from "@/types/database";

export function RosterClient({ examId }: { examId: string }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/exams/${examId}/roster`);
    const data = await res.json();
    setStudents(data.students ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose an Excel file first");
      return;
    }
    const formData = new FormData();
    formData.append("roster", file);

    setImporting(true);
    const res = await fetch(`/api/admin/exams/${examId}/roster/import`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setImporting(false);

    if (!res.ok) {
      toast.error(data.error ?? "Import failed");
      return;
    }
    toast.success(`Imported ${data.createdCount} student(s)`);
    if (data.errors?.length) {
      toast.warning(`${data.errors.length} row(s) had issues — check console`);
      console.warn("Roster import errors:", data.errors);
    }
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function resend(studentId: string) {
    setResendingId(studentId);
    const res = await fetch(`/api/admin/exams/${examId}/roster/${studentId}/resend`, {
      method: "POST",
    });
    const data = await res.json();
    setResendingId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to resend");
      return;
    }
    toast.success(data.emailStatus === "sent" ? "Credentials resent" : "Password reset, but email failed to send");
    load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import roster</CardTitle>
          <CardDescription>
            Excel file with columns: name, email, roll_no. Each new student gets a random
            password and an emailed invite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Roster file (.xlsx)</Label>
              <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" required />
            </div>
            <Button type="submit" disabled={importing}>
              {importing ? "Importing..." : "Import & email credentials"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students ({students.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Password status</TableHead>
                <TableHead>Email status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No students imported yet.
                  </TableCell>
                </TableRow>
              )}
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.roll_no}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>
                    <Badge variant={s.must_change_password ? "secondary" : "default"}>
                      {s.must_change_password ? "Not changed yet" : "Changed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.last_email_status === "sent" ? "default" : "destructive"}>
                      {s.last_email_status ?? "not sent"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resendingId === s.id}
                      onClick={() => resend(s.id)}
                    >
                      {resendingId === s.id ? "Sending..." : "Resend"}
                    </Button>
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
