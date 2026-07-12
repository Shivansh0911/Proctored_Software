import { requireStudent } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();

  return (
    <div className="min-h-screen bg-muted/20">
      <AppNav title="My Exams" links={[{ href: "/student", label: "Dashboard" }]} />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
