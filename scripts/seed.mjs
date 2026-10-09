import { createClient } from "@supabase/supabase-js";
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  SEED_PASSWORD: password,
} = process.env;
if (!url || !key || !password || password.length < 12)
  throw new Error(
    "Set Supabase URL, service role key, and SEED_PASSWORD (12+ characters) in .env.local.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
// Confirm the migration exists before creating any Auth accounts.
for (const table of ["profiles", "workshops", "registrations", "audit_log"]) {
  const { error } = await db.from(table).select("id").limit(1);
  if (error) {
    throw new Error(
      `Database setup is incomplete (${table}). Apply supabase/migrations/202610090001_workshop_service.sql before seeding.`,
    );
  }
}
const accounts = [
  ["admin@gather.test", "Alex Morgan", "admin"],
  ["manager@gather.test", "Jamie Chen", "manager"],
  ["staff@gather.test", "Sam Rivera", "staff"],
];
for (const [email, name, role] of accounts) {
  const { data: existing, error: listError } = await db.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) throw listError;
  let user = existing.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }
  const { error } = await db
    .from("profiles")
    .upsert({ id: user.id, email, name, role });
  if (error) throw error;
  console.log(`Ready: ${email} (${role})`);
}
console.log("Staff accounts ready. The configured password is never printed.");
