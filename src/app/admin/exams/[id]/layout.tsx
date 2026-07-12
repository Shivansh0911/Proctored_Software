import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ExamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, admin_id, status")
    .eq("id", id)
    .single();

  if (!exam || exam.admin_id !== profile.id) notFound();

  const tabs = [
    { href: `/admin/exams/${id}`, label: "Details" },
    { href: `/admin/exams/${id}/questions`, label: "Questions" },
    { href: `/admin/exams/${id}/roster`, label: "Roster" },
    { href: `/admin/exams/${id}/monitor`, label: "Live monitor" },
    { href: `/admin/exams/${id}/results`, label: "Results" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
            &larr; All exams
          </Link>
          <h1 className="text-2xl font-semibold">{exam.title}</h1>
        </div>
      </div>
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-primary"
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
