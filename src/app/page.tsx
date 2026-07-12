import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Proctored Exams</h1>
        <p className="max-w-md text-muted-foreground">
          A reusable proctored online examination platform — question authoring, bulk student
          onboarding, browser-based proctoring, and automatic evaluation.
        </p>
      </div>
      <Link href="/login">
        <Button size="lg">Sign in</Button>
      </Link>
    </div>
  );
}
