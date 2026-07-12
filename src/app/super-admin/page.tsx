import { AdminsClient } from "./admins-client";

export default function SuperAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin management</h1>
        <p className="text-muted-foreground">
          Create and manage exam-conducting admin accounts.
        </p>
      </div>
      <AdminsClient />
    </div>
  );
}
