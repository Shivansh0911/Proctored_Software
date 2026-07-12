"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Option {
  key: string;
  text: string;
}

interface DraftQuestion {
  id?: string;
  type: "mcq" | "numeric" | "subjective";
  text: string;
  options: Option[] | null;
  correct_answer: string | null;
  marks: number;
  negative_marks: number;
  order_index: number;
}

function emptyQuestion(order: number): DraftQuestion {
  return {
    type: "mcq",
    text: "",
    options: [
      { key: "A", text: "" },
      { key: "B", text: "" },
    ],
    correct_answer: null,
    marks: 1,
    negative_marks: 0,
    order_index: order,
  };
}

export function QuestionsClient({ examId }: { examId: string }) {
  const [saved, setSaved] = useState<DraftQuestion[]>([]);
  const [draft, setDraft] = useState<DraftQuestion[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const questionFileRef = useRef<HTMLInputElement>(null);
  const answerKeyFileRef = useRef<HTMLInputElement>(null);

  async function loadSaved() {
    const res = await fetch(`/api/admin/exams/${examId}/questions`);
    const data = await res.json();
    setSaved(data.questions ?? []);
  }

  useEffect(() => {
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    const questionPaper = questionFileRef.current?.files?.[0];
    if (!questionPaper) {
      toast.error("Choose a question paper PDF first");
      return;
    }

    const formData = new FormData();
    formData.append("questionPaper", questionPaper);
    const answerKey = answerKeyFileRef.current?.files?.[0];
    if (answerKey) formData.append("answerKey", answerKey);

    setParsing(true);
    const res = await fetch(`/api/admin/exams/${examId}/questions/parse-pdf`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setParsing(false);

    if (!res.ok) {
      toast.error(data.error ?? "Failed to parse PDF");
      return;
    }
    setDraft(data.draft);
    setWarning(data.warning);
  }

  function updateDraftQuestion(idx: number, patch: Partial<DraftQuestion>) {
    if (!draft) return;
    const next = [...draft];
    next[idx] = { ...next[idx], ...patch };
    setDraft(next);
  }

  function updateDraftOption(idx: number, optIdx: number, patch: Partial<Option>) {
    if (!draft) return;
    const q = draft[idx];
    const options = [...(q.options ?? [])];
    options[optIdx] = { ...options[optIdx], ...patch };
    updateDraftQuestion(idx, { options });
  }

  function addDraftOption(idx: number) {
    if (!draft) return;
    const q = draft[idx];
    const options = [...(q.options ?? [])];
    const nextKey = String.fromCharCode(65 + options.length);
    options.push({ key: nextKey, text: "" });
    updateDraftQuestion(idx, { options });
  }

  function removeDraft(idx: number) {
    if (!draft) return;
    setDraft(draft.filter((_, i) => i !== idx));
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(`/api/admin/exams/${examId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: draft, replaceAll: false }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to save questions");
      return;
    }
    toast.success(`Saved ${data.questions.length} question(s)`);
    setDraft(null);
    setWarning(null);
    loadSaved();
  }

  async function deleteSaved(qid: string) {
    const res = await fetch(`/api/admin/exams/${examId}/questions/${qid}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete question");
      return;
    }
    loadSaved();
  }

  async function updateSaved(qid: string, patch: Partial<DraftQuestion>) {
    const res = await fetch(`/api/admin/exams/${examId}/questions/${qid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      toast.error("Failed to update question");
      return;
    }
    loadSaved();
  }

  function addManualDraftQuestion() {
    setDraft([...(draft ?? []), emptyQuestion(draft?.length ?? saved.length)]);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import question paper (PDF)</CardTitle>
          <CardDescription>
            Upload the question paper and, optionally, a separate answer key. Parsing is
            heuristic — you must review every question before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleParse} className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Question paper (PDF)</Label>
              <Input ref={questionFileRef} type="file" accept="application/pdf" required />
            </div>
            <div className="space-y-2">
              <Label>Answer key (PDF, optional)</Label>
              <Input ref={answerKeyFileRef} type="file" accept="application/pdf" />
            </div>
            <Button type="submit" disabled={parsing}>
              {parsing ? "Parsing..." : "Parse PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={addManualDraftQuestion}>
              Add question manually
            </Button>
          </form>
        </CardContent>
      </Card>

      {draft && (
        <Card>
          <CardHeader>
            <CardTitle>Review parsed questions ({draft.length})</CardTitle>
            {warning && <CardDescription className="text-amber-600">{warning}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            {draft.map((q, idx) => (
              <div key={idx} className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Question {idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={q.type}
                      onValueChange={(v) => updateDraftQuestion(idx, { type: v as DraftQuestion["type"] })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">MCQ</SelectItem>
                        <SelectItem value="numeric">Numeric</SelectItem>
                        <SelectItem value="subjective">Subjective</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => removeDraft(idx)}>
                      Remove
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={q.text}
                  onChange={(e) => updateDraftQuestion(idx, { text: e.target.value })}
                  placeholder="Question text"
                />
                {q.type === "mcq" && (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <span className="w-6 text-sm font-medium">{opt.key}</span>
                        <Input
                          value={opt.text}
                          onChange={(e) => updateDraftOption(idx, optIdx, { text: e.target.value })}
                        />
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => addDraftOption(idx)}>
                      Add option
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label>Correct answer</Label>
                    <Input
                      value={q.correct_answer ?? ""}
                      onChange={(e) => updateDraftQuestion(idx, { correct_answer: e.target.value })}
                      placeholder={q.type === "mcq" ? "e.g. B" : "expected answer"}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Marks</Label>
                    <Input
                      type="number"
                      value={q.marks}
                      onChange={(e) => updateDraftQuestion(idx, { marks: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Negative marks</Label>
                    <Input
                      type="number"
                      value={q.negative_marks}
                      onChange={(e) => updateDraftQuestion(idx, { negative_marks: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                Discard
              </Button>
              <Button onClick={saveDraft} disabled={saving}>
                {saving ? "Saving..." : `Save ${draft.length} question(s) to exam`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Saved questions ({saved.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {saved.length === 0 && (
            <p className="text-sm text-muted-foreground">No questions saved yet.</p>
          )}
          {saved.map((q) => (
            <div key={q.id} className="space-y-2 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{q.type}</Badge>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{q.marks} marks</span>
                  <Button variant="ghost" size="sm" onClick={() => q.id && deleteSaved(q.id)}>
                    Delete
                  </Button>
                </div>
              </div>
              <Textarea
                defaultValue={q.text}
                onBlur={(e) => q.id && updateSaved(q.id, { text: e.target.value })}
              />
              {q.type === "mcq" && (
                <div className="space-y-1 text-sm">
                  {(q.options ?? []).map((opt) => (
                    <div key={opt.key}>
                      <span className="font-medium">{opt.key}.</span> {opt.text}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Correct answer: {q.correct_answer ?? "—"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
