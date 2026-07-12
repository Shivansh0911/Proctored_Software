import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({ is_active: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("super_admin");
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ is_active: parsed.data.is_active })
    .eq("id", id)
    .eq("role", "admin");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
