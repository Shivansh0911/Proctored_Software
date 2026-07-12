import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

/** Current logged-in super_admin/admin profile, or null if not authenticated as one. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

/** Redirects to /login if not authenticated, or to /unauthorized if wrong role. */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!roles.includes(profile.role)) redirect("/unauthorized");
  return profile;
}

/** Requires an authenticated student (a user with no profiles row). Redirects otherwise. */
export async function requireStudent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) redirect("/unauthorized");

  return user;
}

/** The logged-in student's roster row for a given exam, or null. */
export async function getCurrentStudent(examId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .single();

  return data;
}
