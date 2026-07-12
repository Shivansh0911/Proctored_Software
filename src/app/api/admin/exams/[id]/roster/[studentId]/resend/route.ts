import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { sendMail } from "@/lib/email";
import { generatePassword } from "@/lib/password";
import { escapeHtml } from "@/lib/html";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const profile = await requireRole("admin");
  const { id, studentId } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id, title").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .eq("exam_id", id)
    .single();
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const adminClient = createAdminClient();
  const password = generatePassword();

  const { error: updateError } = await adminClient.auth.admin.updateUserById(student.user_id, {
    password,
  });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await adminClient.from("students").update({ must_change_password: true }).eq("id", studentId);

  let emailStatus: "sent" | "failed" = "failed";
  try {
    await sendMail({
      to: student.email,
      subject: `Your login for ${exam.title} (resent)`,
      html: `<p>Hi ${escapeHtml(student.name)},</p>
        <p>Here is a fresh password for <b>${escapeHtml(exam.title)}</b>.</p>
        <p><b>Roll No:</b> ${escapeHtml(student.roll_no)}<br/>
           <b>Login email:</b> ${escapeHtml(student.email)}<br/>
           <b>Password:</b> ${escapeHtml(password)}</p>
        <p>Sign in at <a href="${process.env.NEXT_PUBLIC_APP_URL}/login">${process.env.NEXT_PUBLIC_APP_URL}/login</a>.</p>`,
    });
    emailStatus = "sent";
  } catch (e) {
    console.error("Failed to resend credentials", e);
  }

  await adminClient
    .from("students")
    .update({ last_email_status: emailStatus, last_email_at: new Date().toISOString() })
    .eq("id", studentId);

  return NextResponse.json({ ok: true, emailStatus, password, email: student.email });
}
