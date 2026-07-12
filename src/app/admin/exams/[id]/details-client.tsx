"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Exam } from "@/types/database";

export function ExamDetailsClient({ examId }: { examId: string }) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/exams/${examId}`);
    const data = await res.json();
    setExam(data.exam);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function save(patch: Partial<Exam>) {
    setSaving(true);
    const res = await fetch(`/api/admin/exams/${examId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to save");
      return;
    }
    setExam(data.exam);
    toast.success("Saved");
  }

  if (!exam) return <p className="text-muted-foreground">Loading...</p>;

  const settings = exam.proctoring_settings;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Exam details</CardTitle>
          <Badge variant="outline">{exam.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={exam.title}
              onChange={(e) => setExam({ ...exam, title: e.target.value })}
              onBlur={() => save({ title: exam.title })}
            />
          </div>
          <div className="space-y-2">
            <Label>Instructions</Label>
            <Textarea
              value={exam.instructions}
              onChange={(e) => setExam({ ...exam, instructions: e.target.value })}
              onBlur={() => save({ instructions: exam.instructions })}
            />
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={1}
              value={exam.duration_minutes}
              onChange={(e) => setExam({ ...exam, duration_minutes: Number(e.target.value) })}
              onBlur={() => save({ duration_minutes: exam.duration_minutes })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Window start</Label>
              <Input
                type="datetime-local"
                value={exam.window_start?.slice(0, 16) ?? ""}
                onChange={(e) => setExam({ ...exam, window_start: e.target.value })}
                onBlur={() => save({ window_start: exam.window_start })}
              />
            </div>
            <div className="space-y-2">
              <Label>Window end</Label>
              <Input
                type="datetime-local"
                value={exam.window_end?.slice(0, 16) ?? ""}
                onChange={(e) => setExam({ ...exam, window_end: e.target.value })}
                onBlur={() => save({ window_end: exam.window_end })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Shuffle questions</Label>
            <Switch
              checked={exam.shuffle_questions}
              onCheckedChange={(v) => {
                setExam({ ...exam, shuffle_questions: v });
                save({ shuffle_questions: v });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Negative marking</Label>
            <Switch
              checked={exam.negative_marking}
              onCheckedChange={(v) => {
                setExam({ ...exam, negative_marking: v });
                save({ negative_marking: v });
              }}
            />
          </div>
          {exam.negative_marking && (
            <div className="space-y-2">
              <Label>Negative marks per wrong answer</Label>
              <Input
                type="number"
                step="0.25"
                min={0}
                value={exam.negative_marking_value}
                onChange={(e) => setExam({ ...exam, negative_marking_value: Number(e.target.value) })}
                onBlur={() => save({ negative_marking_value: exam.negative_marking_value })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proctoring settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["camera", "Camera capture"],
              ["face_detection", "Face presence detection"],
              ["fullscreen_required", "Require fullscreen"],
              ["disable_copy_paste", "Disable copy / paste"],
              ["disable_right_click", "Disable right-click"],
              ["auto_submit_on_violation", "Auto-submit after violation limit"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch
                checked={Boolean(settings[key])}
                onCheckedChange={(v) => {
                  const next = { ...settings, [key]: v };
                  setExam({ ...exam, proctoring_settings: next });
                  save({ proctoring_settings: next });
                }}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tab-switch limit</Label>
              <Input
                type="number"
                min={0}
                value={settings.tab_switch_limit}
                onChange={(e) => {
                  const next = { ...settings, tab_switch_limit: Number(e.target.value) };
                  setExam({ ...exam, proctoring_settings: next });
                }}
                onBlur={() => save({ proctoring_settings: exam.proctoring_settings })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fullscreen-exit limit</Label>
              <Input
                type="number"
                min={0}
                value={settings.fullscreen_exit_limit}
                onChange={(e) => {
                  const next = { ...settings, fullscreen_exit_limit: Number(e.target.value) };
                  setExam({ ...exam, proctoring_settings: next });
                }}
                onBlur={() => save({ proctoring_settings: exam.proctoring_settings })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Browser-based proctoring deters and logs suspicious behavior, but it is not a true
            lockdown browser — a determined cheater with a second device cannot be fully
            prevented. For high-stakes exams, pair this with a dedicated lockdown/SEB solution.
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Publish</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {exam.status !== "published" ? (
            <Button disabled={saving} onClick={() => save({ status: "published" })}>
              Publish exam
            </Button>
          ) : (
            <Button variant="destructive" disabled={saving} onClick={() => save({ status: "closed" })}>
              Close exam
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            Students only see and can attempt exams once published, and only within the exam
            window if one is set.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
