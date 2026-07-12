import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { generatePassword } from "@/lib/password";
import { escapeHtml } from "@/lib/html";
import { z } from "zod";

const createAdminSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function GET() {
  const profile = await requireRole("super_admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, is_active, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ admins: data, currentAdminId: profile.id });
}

export async function POST(request: Request) {
  const profile = await requireRole("super_admin");
  const body = await request.json();
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, email } = parsed.data;
  const password = generatePassword();

  const adminClient = createAdminClient();
  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !userData.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Failed to create user" },
      { status: 400 }
    );
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: userData.user.id,
    role: "admin",
    display_name: name,
    email,
    created_by: profile.id,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // Email credentials via Resend (best-effort — admin can still see the
  // password in this response once, in case delivery fails).
  try {
    const { sendMail } = await import("@/lib/email");
    await sendMail({
      to: email,
      subject: "Your exam platform admin account",
      html: `<p>Hi ${escapeHtml(name)},</p><p>An administrator account has been created for you.</p>
        <p><b>Email:</b> ${escapeHtml(email)}<br/><b>Password:</b> ${escapeHtml(password)}</p>
        <p>Sign in at <a href="${process.env.NEXT_PUBLIC_APP_URL}/login">${process.env.NEXT_PUBLIC_APP_URL}/login</a> and change your password after logging in.</p>`,
    });
  } catch (e) {
    console.error("Failed to email admin credentials", e);
  }

  return NextResponse.json({ ok: true, email, password });
}
