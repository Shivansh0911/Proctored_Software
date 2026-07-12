import { ExamsClient } from "./exams-client";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Exams</h1>
        <p className="text-muted-foreground">Create and manage your exams.</p>
      </div>
      <ExamsClient />
    </div>
  );
}
