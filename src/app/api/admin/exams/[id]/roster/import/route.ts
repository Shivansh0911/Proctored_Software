import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { sendMail } from "@/lib/email";
import { generatePassword } from "@/lib/password";
import { escapeHtml } from "@/lib/html";

export const runtime = "nodejs";

interface RosterRow {
  name: string;
  email: string;
  roll_no: string;
}

function normalizeRows(raw: Record<string, unknown>[]): RosterRow[] {
  return raw
    .map((row) => {
      const lower: Record<string, unknown> = {};
      for (const key of Object.keys(row)) lower[key.trim().toLowerCase()] = row[key];
      return {
        name: String(lower.name ?? "").trim(),
        email: String(lower.email ?? "").trim().toLowerCase(),
        roll_no: String(lower.roll_no ?? lower["roll no"] ?? lower.rollno ?? "").trim(),
      };
    })
    .filter((r) => r.name && r.email && r.roll_no);
}

async function emailCredentials(params: {
  name: string;
  email: string;
  rollNo: string;
  password: string;
  examTitle: string;
}) {
  await sendMail({
    to: params.email,
    subject: `Your login for ${params.examTitle}`,
    html: `<p>Hi ${escapeHtml(params.name)},</p>
      <p>You have been registered for <b>${escapeHtml(params.examTitle)}</b>.</p>
      <p><b>Roll No:</b> ${escapeHtml(params.rollNo)}<br/>
         <b>Login email:</b> ${escapeHtml(params.email)}<br/>
         <b>Password:</b> ${escapeHtml(params.password)}</p>
      <p>Sign in at <a href="${process.env.NEXT_PUBLIC_APP_URL}/login">${process.env.NEXT_PUBLIC_APP_URL}/login</a>.
         You will be asked to set a new password on first login.</p>`,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("admin_id, title").eq("id", id).single();
  if (!exam || exam.admin_id !== profile.id) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("roster") as File | null;
  if (!file) return NextResponse.json({ error: "roster file is required" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  const rows = normalizeRows(raw);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found. Expected columns: name, email, roll_no." },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  const created: { name: string; email: string; roll_no: string }[] = [];
  const errors: { row: RosterRow; error: string }[] = [];

  // Build an email -> auth user id map once (paginated), instead of listing
  // all users on every row — matters once rosters reach dozens of students.
  const emailToUserId = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data: pageData, error: listError } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (listError || !pageData) break;
    for (const u of pageData.users) {
      if (u.email) emailToUserId.set(u.email, u.id);
    }
    if (pageData.users.length < 1000) break;
  }

  for (const row of rows) {
    let userId = emailToUserId.get(row.email);
    const password = generatePassword();

    if (!userId) {
      const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email: row.email,
        password,
        email_confirm: true,
      });
      if (createError || !userData.user) {
        errors.push({ row, error: createError?.message ?? "Failed to create user" });
        continue;
      }
      userId = userData.user.id;
      emailToUserId.set(row.email, userId);
    } else {
      // This email already has an auth account (enrolled in another exam
      // previously) — reset its password to the one we're about to email,
      // otherwise the invite would quote a password that was never set.
      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        password,
      });
      if (updateError) {
        errors.push({ row, error: updateError.message });
        continue;
      }
    }

    const { error: insertError } = await adminClient.from("students").insert({
      user_id: userId,
      exam_id: id,
      name: row.name,
      email: row.email,
      roll_no: row.roll_no,
      must_change_password: true,
    });

    if (insertError) {
      const message =
        insertError.code === "23505"
          ? "Already enrolled in this exam"
          : insertError.message;
      errors.push({ row, error: message });
      continue;
    }

    let emailStatus: "sent" | "failed" = "failed";
    try {
      await emailCredentials({
        name: row.name,
        email: row.email,
        rollNo: row.roll_no,
        password,
        examTitle: exam.title,
      });
      emailStatus = "sent";
    } catch (e) {
      console.error("Failed to email credentials", e);
    }

    await adminClient
      .from("students")
      .update({ last_email_status: emailStatus, last_email_at: new Date().toISOString() })
      .eq("exam_id", id)
      .eq("email", row.email);

    created.push(row);
  }

  return NextResponse.json({ createdCount: created.length, errors });
}
