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
const samples = [
  [
    "POT-101",
    "The art of pottery",
    "Maya Thompson",
    "Creative",
    "Riverside Centre",
    16,
    "Shape something with your own hands. A gentle introduction to wheel throwing and clay.",
  ],
  [
    "CODE-201",
    "Your first website",
    "Daniel Park",
    "Technology",
    "Central Studio",
    12,
    "Turn an idea into a working website, with friendly guidance at every step.",
  ],
  [
    "FIT-102",
    "Mindful movement",
    "Sofia Patel",
    "Wellbeing",
    "Northside Hub",
    20,
    "Slow down, stretch, and find a little more balance in your week.",
  ],
  [
    "ART-103",
    "Watercolour mornings",
    "Eleanor Brooks",
    "Creative",
    "Central Studio",
    10,
    "Explore colour, light, and the joy of painting without the pressure.",
  ],
  [
    "COOK-104",
    "Seasonal kitchen",
    "Luca Bennett",
    "Food & Living",
    "Riverside Centre",
    8,
    "Good food, fresh ingredients, and a few new skills to bring home.",
  ],
  [
    "PHOTO-105",
    "See your city differently",
    "Noah Williams",
    "Creative",
    "Northside Hub",
    14,
    "A practical walk through the fundamentals of everyday photography.",
  ],
];
const { data: manager } = await db
  .from("profiles")
  .select("id")
  .eq("email", "manager@gather.test")
  .single();
for (let i = 0; i < samples.length; i++) {
  const [code, title, instructor, category, location, capacity, description] =
    samples[i];
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + i + 2);
  date.setUTCHours(4, 30, 0, 0);
  const { data: exists } = await db
    .from("workshops")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (exists) continue;
  const { error } = await db
    .from("workshops")
    .insert({
      code,
      title,
      instructor,
      category,
      location,
      capacity,
      description,
      starts_at: date.toISOString(),
      duration_minutes: 90,
      created_by: manager.id,
    });
  if (error) throw error;
}
console.log(
  "Sample workshops ready. Password is the SEED_PASSWORD you configured; it is never printed.",
);
