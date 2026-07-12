"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";

interface ExamRow {
  id: string;
  title: string;
  status: string;
  duration_minutes: number;
  created_at: string;
}

export function ExamsClient() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [duration, setDuration] = useState(60);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/exams");
    const data = await res.json();
    setExams(data.exams ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, instructions, duration_minutes: duration }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to create exam");
      return;
    }
    setOpen(false);
    setTitle("");
    setInstructions("");
    setDuration(60);
    router.push(`/admin/exams/${data.exam.id}`);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Your exams</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>New exam</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create exam</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  required
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Creating..." : "Create exam"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && exams.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No exams yet. Create your first one.
                </TableCell>
              </TableRow>
            )}
            {exams.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.title}</TableCell>
                <TableCell>{e.duration_minutes} min</TableCell>
                <TableCell>
                  <Badge variant="outline">{e.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/exams/${e.id}`}>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
