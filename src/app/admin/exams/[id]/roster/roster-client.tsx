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

interface NewCredential {
  name: string;
  email: string;
  roll_no: string;
  password: string;
  emailStatus: "sent" | "failed";
}

export function RosterClient({ examId }: { examId: string }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [newCredentials, setNewCredentials] = useState<NewCredential[]>([]);
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
    const created: NewCredential[] = data.created ?? [];
    toast.success(`Imported ${created.length} student(s)`);
    if (data.errors?.length) {
      toast.warning(`${data.errors.length} row(s) had issues — check console`);
      console.warn("Roster import errors:", data.errors);
    }
    setNewCredentials(created);
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
    const student = students.find((s) => s.id === studentId);
    setNewCredentials([
      {
        name: student?.name ?? "",
        email: data.email,
        roll_no: student?.roll_no ?? "",
        password: data.password,
        emailStatus: data.emailStatus,
      },
    ]);
    toast.success(
      data.emailStatus === "sent" ? "Credentials resent" : "New password ready below — email it yourself"
    );
    load();
  }

  async function downloadCredentials() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(
      newCredentials.map((c) => ({
        Name: c.name,
        Email: c.email,
        "Roll No": c.roll_no,
        Password: c.password,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Credentials");
    XLSX.writeFile(workbook, `credentials-${examId}.xlsx`);
  }

  function copyCredentials() {
    const text = newCredentials
      .map((c) => `${c.name}\t${c.email}\t${c.roll_no}\t${c.password}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied — paste into a sheet or mail merge");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import roster</CardTitle>
          <CardDescription>
            Excel file with columns: name, email, roll_no. Each new student gets a random
            password. The app will also try to email it automatically if Resend is configured —
            but that&apos;s optional: every password shows up below either way, so you can export
            it and send credentials yourself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Roster file (.xlsx)</Label>
              <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" required />
            </div>
            <Button type="submit" disabled={importing}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {newCredentials.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>New passwords — visible once</CardTitle>
              <CardDescription>
                Export or copy this now. These passwords are never stored anywhere and won&apos;t
                show again after you leave this page.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyCredentials}>
                Copy all
              </Button>
              <Button size="sm" onClick={downloadCredentials}>
                Download Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Auto-email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newCredentials.map((c, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{c.roll_no}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell className="font-mono">{c.password}</TableCell>
                    <TableCell>
                      <Badge variant={c.emailStatus === "sent" ? "default" : "secondary"}>
                        {c.emailStatus === "sent" ? "sent" : "not sent — use export"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                      {resendingId === s.id ? "Sending..." : "Reset password"}
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
