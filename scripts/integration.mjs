// Exercises real simultaneous network requests against a configured Supabase project.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  password = process.env.SEED_PASSWORD;
if (!url || !key || !password)
  throw new Error("Configure .env.local and seed first.");
const login = async (email) => {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
};
const manager = await login("manager@gather.test"),
  staff = await login("staff@gather.test"),
  admin = await login("admin@gather.test");
const input = {
  code: `TEST-${Date.now()}`,
  title: "Concurrency verification",
  instructor: "Test Instructor",
  starts_at: new Date(Date.now() + 86400000).toISOString(),
  duration_minutes: 60,
  capacity: 1,
  status: "scheduled",
  location: "Test Centre",
  category: "Testing",
  description: "Automated test record; retained for audit.",
};
const { data: w, error } = await manager.rpc("save_workshop", {
  p_input: input,
});
if (error) throw error;
assert.ok(
  (await staff.rpc("save_workshop", { p_input: input })).error,
  "Staff workshop mutation must fail",
);
assert.ok(
  (
    await admin.rpc("register_attendee", {
      p_workshop_id: w.id,
      p_name: "Denied Admin",
      p_email: "denied@example.test",
    })
  ).error,
  "Admin booking must fail",
);
assert.ok(
  (await staff.from("workshops").update({ capacity: 99 }).eq("id", w.id)).error,
  "Direct table write must fail",
);
const requests = await Promise.all(
  Array.from({ length: 20 }, (_, i) =>
    (i % 2 ? manager : staff).rpc("register_attendee", {
      p_workshop_id: w.id,
      p_name: `Race Person ${i}`,
      p_email: `race${i}@example.test`,
    }),
  ),
);
const success = requests.filter((r) => !r.error);
assert.equal(
  success.length,
  1,
  "Exactly one of twenty last-seat requests must succeed",
);
const registered = success[0].data;
assert.equal(
  (await staff.from("workshops").select("active_count").eq("id", w.id).single())
    .data.active_count,
  1,
);
const cancelled = await staff.rpc("cancel_registration", {
  p_id: registered.id,
});
if (cancelled.error) throw cancelled.error;
assert.equal(
  (
    await staff
      .from("registrations")
      .select("status,cancelled_by,registered_by")
      .eq("id", registered.id)
      .single()
  ).data.status,
  "cancelled",
);
const cancelAgain = await staff.rpc("cancel_registration", {
  p_id: registered.id,
});
if (cancelAgain.error) throw cancelAgain.error;
assert.equal(
  (await staff.from("workshops").select("active_count").eq("id", w.id).single())
    .data.active_count,
  0,
);
const reopened = await manager.rpc("register_attendee", {
  p_workshop_id: w.id,
  p_name: "Replacement Person",
  p_email: "replacement@example.test",
});
if (reopened.error) throw reopened.error;
await manager.rpc("cancel_registration", { p_id: reopened.data.id });
const close = await manager.rpc("save_workshop", {
  p_input: { ...input, id: w.id, status: "cancelled" },
});
if (close.error) throw close.error;
console.log(
  "PASS: role enforcement, direct write denial, 20 simultaneous last-seat requests, preserved cancellation history, idempotent cancellation, and seat reuse. Test workshop retained as cancelled.",
);
