import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  manager: "00000000-0000-4000-8000-000000000002",
  staff: "00000000-0000-4000-8000-000000000003",
};
test("Supabase schema, permission boundary and booking invariants", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202610090001_workshop_service.sql",
      "utf8",
    ),
  );
  for (const [role, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      `${role}@gather.test`,
    ]);
    await db.query(
      "insert into public.profiles(id,name,email,role) values($1,$2,$3,$4)",
      [id, role + " person", `${role}@gather.test`, role],
    );
  }
  const as = async (role: keyof typeof ids) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      ids[role],
    ]);
    await db.exec("set role authenticated");
  };
  const input = {
    code: "TEST-01",
    title: "Workshop test",
    instructor: "Test Instructor",
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    duration_minutes: 90,
    capacity: 1,
    status: "scheduled",
    location: "Central Studio",
    category: "Creative",
    description: "Test",
  };
  let workshopId = "";
  let registrationId = "";
  await t.test(
    "only manager can create a workshop; even admin is refused",
    async () => {
      for (const r of ["admin", "staff"] as const) {
        await as(r);
        await assert.rejects(
          db.query("select public.save_workshop($1::jsonb)", [
            JSON.stringify(input),
          ]),
          /permission/,
        );
      }
      await as("manager");
      const result = await db.query<{ w: { id: string } }>(
        "select to_jsonb(public.save_workshop($1::jsonb)) w",
        [JSON.stringify(input)],
      );
      workshopId = result.rows[0].w.id;
      assert.ok(workshopId);
    },
  );
  await t.test(
    "staff cannot write tables directly or provision accounts",
    async () => {
      await as("staff");
      await assert.rejects(
        db.query("update public.workshops set capacity=999 where id=$1", [
          workshopId,
        ]),
        /permission/,
      );
      await assert.rejects(
        db.query("select public.change_role($1,$2)", [ids.staff, "admin"]),
        /permission/,
      );
      await assert.rejects(
        db.query("select public.provision_profile($1,$2,$3,$4)", [
          ids.staff,
          "hacker",
          "staff@gather.test",
          "admin",
        ]),
        /permission/,
      );
    },
  );
  await t.test(
    "admin cannot see workshop, registration, or operational history",
    async () => {
      await as("admin");
      assert.equal(
        (await db.query("select * from public.workshops")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.registrations")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.audit_log")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "one seat allows exactly one successful request from a burst",
    async () => {
      await as("staff");
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) =>
          db.query<{ r: { id: string } }>(
            "select to_jsonb(public.register_attendee($1,$2,$3)) r",
            [workshopId, `Attendee ${i}`, `person${i}@example.test`],
          ),
        ),
      );
      const success = results.filter((x) => x.status === "fulfilled");
      assert.equal(success.length, 1);
      registrationId = (
        success[0] as PromiseFulfilledResult<{ rows: { r: { id: string } }[] }>
      ).value.rows[0].r.id;
      assert.ok(registrationId);
      const w = await db.query<{ active_count: number }>(
        "select active_count from public.workshops where id=$1",
        [workshopId],
      );
      assert.equal(w.rows[0].active_count, 1);
    },
  );
  await t.test(
    "capacity cannot shrink below active registrations",
    async () => {
      await as("manager");
      await assert.rejects(
        db.query("select public.save_workshop($1::jsonb)", [
          JSON.stringify({ ...input, id: workshopId, capacity: 0 }),
        ]),
        /Capacity cannot/,
      );
      await assert.rejects(
        db.query("select public.save_workshop($1::jsonb)", [
          JSON.stringify({ ...input, id: workshopId, status: "cancelled" }),
        ]),
        /Cancel active/,
      );
    },
  );
  await t.test(
    "cancellation is idempotent, frees a seat and keeps actor history",
    async () => {
      await as("staff");
      await db.query("select public.cancel_registration($1)", [registrationId]);
      await db.query("select public.cancel_registration($1)", [registrationId]);
      const r = await db.query<{
        status: string;
        cancelled_by: string;
        registered_by: string;
      }>("select * from public.registrations where id=$1", [registrationId]);
      assert.equal(r.rows[0].status, "cancelled");
      assert.equal(r.rows[0].cancelled_by, ids.staff);
      assert.equal(r.rows[0].registered_by, ids.staff);
      assert.equal(
        (
          await db.query<{ active_count: number }>(
            "select active_count from public.workshops where id=$1",
            [workshopId],
          )
        ).rows[0].active_count,
        0,
      );
      await db.query("select public.register_attendee($1,$2,$3)", [
        workshopId,
        "Next Attendee",
        "next@example.test",
      ]);
      assert.equal(
        (
          await db.query(
            "select * from public.registrations where workshop_id=$1",
            [workshopId],
          )
        ).rows.length,
        2,
      );
    },
  );
  await t.test("duplicate active attendee is rejected", async () => {
    await as("manager");
    await db.query("select public.save_workshop($1::jsonb)", [
      JSON.stringify({ ...input, id: workshopId, capacity: 2 }),
    ]);
    await assert.rejects(
      db.query("select public.register_attendee($1,$2,$3)", [
        workshopId,
        "Next Attendee",
        "NEXT@example.test",
      ]),
      /unique/,
    );
    assert.equal(
      (
        await db.query<{ active_count: number }>(
          "select active_count from public.workshops where id=$1",
          [workshopId],
        )
      ).rows[0].active_count,
      1,
    );
  });
  await t.test(
    "keep the last administrator; staff cannot read other staff profiles",
    async () => {
      await as("admin");
      await assert.rejects(
        db.query("select public.change_role($1,$2)", [ids.admin, "staff"]),
        /at least one/,
      );
      await as("staff");
      assert.equal(
        (await db.query("select * from public.profiles")).rows.length,
        1,
      );
    },
  );
  await t.test("anonymous requests cannot invoke mutation RPCs", async () => {
    await db.exec("reset role; set role anon");
    await assert.rejects(
      db.query("select public.register_attendee($1,$2,$3)", [
        workshopId,
        "Anonymous Person",
        "anon@example.test",
      ]),
      /permission/,
    );
  });
  await db.close();
});
