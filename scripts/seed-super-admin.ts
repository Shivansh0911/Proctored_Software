/**
 * One-time bootstrap: creates the first Super Admin account.
 * Run with: npm run seed:super-admin
 * Requires SUPABASE_SERVICE_ROLE_KEY, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD,
 * SUPER_ADMIN_NAME in your environment (see .env.example).
 */
import "../src/lib/websocket-polyfill";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  if (!url || !serviceKey || !email || !password) {
    console.error(
      "Missing one of NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log("A super admin already exists. Nothing to do.");
    return;
  }

  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !userData.user) {
    console.error("Failed to create auth user:", createError?.message);
    process.exit(1);
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userData.user.id,
    role: "super_admin",
    display_name: name,
    email,
    created_by: null,
  });

  if (profileError) {
    console.error("Failed to create profile row:", profileError.message);
    process.exit(1);
  }

  console.log(`Super Admin created: ${email}`);
}

main();
