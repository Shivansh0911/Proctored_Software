import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getClient();
  const from = process.env.EMAIL_FROM ?? "Proctored Exams <onboarding@resend.dev>";
  return resend.emails.send({ from, to, subject, html });
}
