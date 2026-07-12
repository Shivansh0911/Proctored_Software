import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Tells the client where to redirect after a successful sign-in.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active")
    .eq("id", user.id)
    .single();

  if (profile) {
    if (!profile.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { authenticated: false, error: "Account deactivated" },
        { status: 200 }
      );
    }
    const redirectTo = profile.role === "super_admin" ? "/super-admin" : "/admin";
    return NextResponse.json({
      authenticated: true,
      role: profile.role,
      displayName: profile.display_name,
      redirectTo,
    });
  }

  // Not in profiles -> must be a student
  const { data: studentRows } = await supabase
    .from("students")
    .select("must_change_password")
    .eq("user_id", user.id);

  if (studentRows && studentRows.length > 0) {
    const mustChange = studentRows.some((r) => r.must_change_password);
    return NextResponse.json({
      authenticated: true,
      role: "student",
      redirectTo: mustChange ? "/student/change-password" : "/student",
    });
  }

  return NextResponse.json(
    { authenticated: false, error: "No profile found for this account" },
    { status: 200 }
  );
}
