import { requireRole } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("super_admin");

  return (
    <div className="min-h-screen bg-muted/20">
      <AppNav
        title="Super Admin"
        links={[
          { href: "/super-admin", label: "Admins" },
          { href: "/super-admin/exams", label: "All Exams" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
