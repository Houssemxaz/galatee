import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { seedDemoData } from "./seedDemo.js";
import { SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = new Date("2026-09-04T12:00:00.000Z");

test("demo seed creates a useful dataset and is repeatable without duplicates", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "galatee-demo-seed-"));
  const databasePath = join(dir, "galatee.sqlite");
  let store = null;
  t.after(() => store?.close());
  t.after(async () => rm(dir, { recursive: true, force: true }));

  const first = seedDemoData({ databasePath, now: fixedNow });
  const second = seedDemoData({ databasePath, now: fixedNow });

  assert.deepEqual(
    {
      reservations: first.demoReservations,
      blocks: first.demoBlockedTimeSlots,
      revenue: first.demoRevenueEntries,
      events: first.demoAnalyticsEvents,
    },
    { reservations: 5, blocks: 3, revenue: 6, events: 24 },
  );
  assert.deepEqual(
    {
      reservations: second.demoReservations,
      blocks: second.demoBlockedTimeSlots,
      revenue: second.demoRevenueEntries,
      events: second.demoAnalyticsEvents,
    },
    {
      reservations: first.demoReservations,
      blocks: first.demoBlockedTimeSlots,
      revenue: first.demoRevenueEntries,
      events: first.demoAnalyticsEvents,
    },
  );
  assert.equal(first.dates.upcoming.length, 4);
  assert.equal(first.dates.recent.length, 6);

  store = new SqliteReservationStore({ databasePath });
  const confirmed = store.listReservations({ status: "confirmed" }).filter((item) => item.id.startsWith("demo-"));
  assert.equal(confirmed.length, 2);
  assert.equal(store.listBlockedTimeSlots().filter((item) => item.id.startsWith("demo-")).length, 1);
  assert.equal(store.listBlockedTimeSlots().filter((item) => item.reservationId?.startsWith("demo-")).length, 2);
});

test("demo reset removes only demo rows", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "galatee-demo-reset-"));
  const databasePath = join(dir, "galatee.sqlite");
  t.after(async () => rm(dir, { recursive: true, force: true }));

  seedDemoData({ databasePath, now: fixedNow });
  const reset = seedDemoData({ databasePath, now: fixedNow, resetOnly: true });

  assert.equal(reset.mode, "reset");
  assert.equal(reset.demoReservations, 0);
  assert.equal(reset.demoBlockedTimeSlots, 0);
  assert.equal(reset.demoRevenueEntries, 0);
  assert.equal(reset.demoAnalyticsEvents, 0);
  assert.equal(reset.menuItems, 3);
});
