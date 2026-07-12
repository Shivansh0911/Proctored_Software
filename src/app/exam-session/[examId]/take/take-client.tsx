"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProctoring } from "@/hooks/use-proctoring";
import type { ProctoringEventType, ProctoringSeverity, ProctoringSettings, PublicQuestion } from "@/types/database";

interface AnswerState {
  response: string;
  markedForReview: boolean;
}

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function TakeExamClient({ examId }: { examId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [proctoringSettings, setProctoringSettings] = useState<ProctoringSettings | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const submittedRef = useRef(false);

  useEffect(() => {
    async function init() {
      const startRes = await fetch("/api/attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setError(startData.error ?? "Could not load this exam");
        setLoading(false);
        return;
      }

      const dataRes = await fetch(`/api/attempts/${startData.attempt.id}/data`);
      const data = await dataRes.json();
      if (!dataRes.ok) {
        setError(data.error ?? "Could not load this exam");
        setLoading(false);
        return;
      }

      setAttemptId(startData.attempt.id);
      setTitle(data.exam.title);
      setInstructions(data.exam.instructions);
      setProctoringSettings(data.exam.proctoring_settings);
      setQuestions(data.questions);
      setRemainingSeconds(data.remainingSeconds);

      const initialAnswers: Record<string, AnswerState> = {};
      for (const q of data.questions as PublicQuestion[]) {
        const existing = data.answers.find((a: { question_id: string }) => a.question_id === q.id);
        initialAnswers[q.id] = {
          response: existing?.response ?? "",
          markedForReview: existing?.marked_for_review ?? false,
        };
      }
      setAnswers(initialAnswers);
      setLoading(false);
    }
    init();
  }, [examId]);

  const submitAttempt = useCallback(
    async (autoSubmitted: boolean) => {
      if (!attemptId || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSubmitted }),
      });
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      toast.success(autoSubmitted ? "Exam auto-submitted" : "Exam submitted");
      router.push("/student");
    },
    [attemptId, router]
  );

  // Countdown timer
  useEffect(() => {
    if (loading || error) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitAttempt(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, error, submitAttempt]);

  const saveAnswer = useCallback(
    (questionId: string, response: string, markedForReview: boolean) => {
      if (!attemptId) return;
      if (saveTimers.current[questionId]) clearTimeout(saveTimers.current[questionId]);
      saveTimers.current[questionId] = setTimeout(() => {
        fetch(`/api/attempts/${attemptId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, response, markedForReview }),
        });
      }, 500);
    },
    [attemptId]
  );

  function updateResponse(questionId: string, response: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: { ...prev[questionId], response } };
      saveAnswer(questionId, response, next[questionId].markedForReview);
      return next;
    });
  }

  function toggleMarkForReview(questionId: string) {
    setAnswers((prev) => {
      const marked = !prev[questionId]?.markedForReview;
      const next = { ...prev, [questionId]: { ...prev[questionId], markedForReview: marked } };
      saveAnswer(questionId, next[questionId].response, marked);
      return next;
    });
  }

  const handleProctoringEvent = useCallback(
    async (type: ProctoringEventType, severity: ProctoringSeverity, snapshot?: Blob) => {
      if (!attemptId || submittedRef.current) return { shouldAutoSubmit: false };
      const formData = new FormData();
      formData.append("type", type);
      formData.append("severity", severity);
      if (snapshot) formData.append("snapshot", snapshot, "snapshot.jpg");

      const res = await fetch(`/api/attempts/${attemptId}/proctoring-event`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.shouldAutoSubmit) {
        toast.error("Too many proctoring violations — exam auto-submitted.");
        submittedRef.current = true;
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        router.push("/student");
      } else if (type === "fullscreen_exit") {
        toast.warning("Please stay in fullscreen for the remainder of the exam.");
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (type === "tab_switch") {
        toast.warning("Tab switch detected and logged.");
      } else if (type === "face_missing") {
        toast.warning("No face detected — please stay in frame.");
      } else if (type === "multiple_faces") {
        toast.warning("Multiple faces detected.");
      }

      return { shouldAutoSubmit: Boolean(data.shouldAutoSubmit) };
    },
    [attemptId, router]
  );

  useProctoring({
    settings: proctoringSettings ?? {
      camera: false,
      face_detection: false,
      tab_switch_limit: 3,
      fullscreen_required: false,
      fullscreen_exit_limit: 3,
      auto_submit_on_violation: false,
      disable_copy_paste: false,
      disable_right_click: false,
    },
    onEvent: handleProctoringEvent,
    enabled: !loading && !error && !!proctoringSettings,
  });

  const currentQuestion = questions[currentIndex];
  const stats = useMemo(() => {
    let answered = 0;
    let marked = 0;
    for (const q of questions) {
      const a = answers[q.id];
      if (a?.markedForReview) marked++;
      else if (a?.response?.trim()) answered++;
    }
    return { answered, marked, unanswered: questions.length - answered - marked };
  }, [questions, answers]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading exam...</div>;
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error}</p>
        <Button className="mt-4" onClick={() => router.push("/student")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div
      className="grid min-h-screen grid-cols-1 gap-0 md:grid-cols-[1fr_280px]"
      style={{ userSelect: proctoringSettings?.disable_copy_paste ? "none" : "auto" }}
    >
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b bg-background px-6 py-3">
          <div>
            <h1 className="font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">{instructions}</p>
          </div>
          <Badge variant={remainingSeconds < 60 ? "destructive" : "outline"} className="text-base">
            {formatTime(remainingSeconds)}
          </Badge>
        </header>

        <main className="flex-1 space-y-4 p-6">
          {currentQuestion && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <Badge variant="outline">{currentQuestion.marks} marks</Badge>
              </div>
              <p className="text-lg">{currentQuestion.text}</p>

              {currentQuestion.type === "mcq" && (
                <div className="space-y-2">
                  {(currentQuestion.options ?? []).map((opt) => {
                    const selected = answers[currentQuestion.id]?.response === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => updateResponse(currentQuestion.id, opt.key)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
                          selected ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                        )}
                      >
                        <span className="font-medium">{opt.key}.</span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === "numeric" && (
                <input
                  type="number"
                  step="any"
                  className="w-full rounded-md border p-3"
                  value={answers[currentQuestion.id]?.response ?? ""}
                  onChange={(e) => updateResponse(currentQuestion.id, e.target.value)}
                  placeholder="Enter a numeric answer"
                />
              )}

              {currentQuestion.type === "subjective" && (
                <Textarea
                  rows={8}
                  value={answers[currentQuestion.id]?.response ?? ""}
                  onChange={(e) => updateResponse(currentQuestion.id, e.target.value)}
                  placeholder="Write your answer"
                />
              )}
            </>
          )}
        </main>

        <footer className="flex items-center justify-between border-t bg-background px-6 py-3">
          <Button
            variant="outline"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => currentQuestion && toggleMarkForReview(currentQuestion.id)}
            >
              {answers[currentQuestion?.id]?.markedForReview ? "Unmark" : "Mark for review"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => currentQuestion && updateResponse(currentQuestion.id, "")}
            >
              Clear
            </Button>
          </div>
          <Button
            disabled={currentIndex === questions.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          >
            Next
          </Button>
        </footer>
      </div>

      <aside className="border-l bg-muted/20 p-4">
        <div className="mb-4 space-y-1 text-sm">
          <p>
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> Answered: {stats.answered}
          </p>
          <p>
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Marked: {stats.marked}
          </p>
          <p>
            <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" /> Unanswered: {stats.unanswered}
          </p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, idx) => {
            const a = answers[q.id];
            const state = a?.markedForReview ? "marked" : a?.response?.trim() ? "answered" : "unanswered";
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium",
                  state === "answered" && "border-green-500 bg-green-500/20",
                  state === "marked" && "border-amber-500 bg-amber-500/20",
                  state === "unanswered" && "bg-background",
                  idx === currentIndex && "ring-2 ring-primary"
                )}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button className="mt-6 w-full" variant="destructive" disabled={submitting}>
                Submit exam
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit this exam?</AlertDialogTitle>
              <AlertDialogDescription>
                You have answered {stats.answered} of {questions.length} questions. Once
                submitted you cannot change your answers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep working</AlertDialogCancel>
              <AlertDialogAction onClick={() => submitAttempt(false)}>Submit</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>
    </div>
  );
}
