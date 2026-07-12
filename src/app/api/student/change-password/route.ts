import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`change-password:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts — please wait a moment." }, { status: 429 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await supabase
    .from("students")
    .update({ must_change_password: false })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
