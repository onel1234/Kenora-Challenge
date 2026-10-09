import { test } from "node:test";
import assert from "node:assert/strict";
import { dateBoundary } from "../lib/dates";
test("inclusive date filters use local midnight and the next local calendar day", () => {
  const start = new Date(dateBoundary("2026-10-09"));
  const end = new Date(dateBoundary("2026-10-09", true));
  assert.equal(start.getHours(), 0);
  assert.equal(start.getDate(), 9);
  assert.equal(end.getHours(), 0);
  assert.equal(end.getDate(), 10);
});
