import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationSchema, userSchema } from "../lib/validation";
test("validate emails, UUIDs and passwords before calling the backend", () => {
  assert.equal(
    registrationSchema.safeParse({
      workshop_id: "not-a-uuid",
      attendee_name: "A",
      attendee_email: "bad",
    }).success,
    false,
  );
  assert.equal(
    userSchema.safeParse({
      name: "Good Name",
      email: "test@example.com",
      password: "short",
      role: "admin",
    }).success,
    false,
  );
  assert.equal(
    userSchema.safeParse({
      name: "Good Name",
      email: "test@example.com",
      password: "long-enough-test-password",
      role: "superuser",
    }).success,
    false,
  );
});
