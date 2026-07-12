import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Not authorized</h1>
      <p className="text-muted-foreground">
        Your account doesn&apos;t have access to this page.
      </p>
      <Link href="/login" className="underline">
        Back to sign in
      </Link>
    </div>
  );
}
