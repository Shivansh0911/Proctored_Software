import { requireStudent } from "@/lib/auth";

// Deliberately no shared nav/logout chrome here — once a student is in the
// pre-exam check or the exam itself, there should be no easy one-click way
// to navigate away while proctoring/fullscreen is active.
export default async function ExamSessionLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  return <div className="min-h-screen bg-background">{children}</div>;
}
