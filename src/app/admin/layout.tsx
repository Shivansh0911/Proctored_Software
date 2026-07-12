import { requireRole } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");

  return (
    <div className="min-h-screen bg-muted/20">
      <AppNav title="Admin" links={[{ href: "/admin", label: "Exams" }]} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
