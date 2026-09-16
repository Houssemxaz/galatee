import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ReservationError, ReservationSystem, SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = () => new Date("2026-08-29T10:00:00.000Z");
const wednesday = "2026-09-02";

function createSystem(t, options = {}) {
  const store = new SqliteReservationStore(options);
  t.after(() => store.close());
  return new ReservationSystem({ store, now: fixedNow });
}

async function createReservation(system, overrides = {}) {
  return system.createReservation({
    firstName: "Lina",
    lastName: "Martin",
    phone: "+33 6 12 34 56 78",
    email: "lina@example.com",
    date: wednesday,
    time: "19:00",
    partySize: 2,
    tableType: "normal",
    specialRequest: "Allergie noisette",
    ...overrides,
  });
}

async function createConfirmedReservation(system, overrides = {}) {
  const result = await createReservation(system, overrides);
  await system.updateReservationStatus(result.reservation.id, "confirmed");
  return result;
}

test("GET availability returns normal capacity by default", async (t) => {
  const system = createSystem(t);

  const availability = await system.getAvailability({
    date: wednesday,
    partySize: 2,
  });

  assert.equal(availability.tableType, "normal");
  assert.equal(availability.service.id, "dinner-wednesday");
  assert.equal(availability.service.capacityCovers, 18);
  assert.deepEqual(availability.timeSlots[0], {
    time: "19:00",
    remainingCovers: 18,
    available: true,
  });
});

test("GET availability applies VIP capacity independently from normal capacity", async (t) => {
  const system = createSystem(t);
  await createConfirmedReservation(system, { tableType: "vip", partySize: 4, time: "19:00" });

  const vipAvailability = await system.getAvailability({
    date: wednesday,
    partySize: 1,
    tableType: "vip",
  });
  const normalAvailability = await system.getAvailability({
    date: wednesday,
    partySize: 2,
    tableType: "normal",
  });

  assert.equal(vipAvailability.service.capacityCovers, 4);
  assert.equal(vipAvailability.timeSlots.some((slot) => slot.time === "19:00"), false);
  assert.equal(normalAvailability.timeSlots.find((slot) => slot.time === "19:00").remainingCovers, 18);
});

test("GET availability hides blocked time slots for matching table type", async (t) => {
  const system = createSystem(t);
  await system.blockTimeSlot({
    date: wednesday,
    time: "19:30",
    tableType: "vip",
    reason: "Private tasting",
  });

  const vipAvailability = await system.getAvailability({ date: wednesday, partySize: 2, tableType: "vip" });
  const normalAvailability = await system.getAvailability({ date: wednesday, partySize: 2, tableType: "normal" });

  assert.equal(vipAvailability.timeSlots.some((slot) => slot.time === "19:30"), false);
  assert.equal(normalAvailability.timeSlots.some((slot) => slot.time === "19:30"), true);
});

test("GET availability hides all table types when blocked time slot has no tableType", async (t) => {
  const system = createSystem(t);
  await system.blockTimeSlot({
    date: wednesday,
    time: "20:00",
    reason: "Private event",
  });

  const vipAvailability = await system.getAvailability({ date: wednesday, partySize: 2, tableType: "vip" });
  const normalAvailability = await system.getAvailability({ date: wednesday, partySize: 2, tableType: "normal" });

  assert.equal(vipAvailability.timeSlots.some((slot) => slot.time === "20:00"), false);
  assert.equal(normalAvailability.timeSlots.some((slot) => slot.time === "20:00"), false);
});

test("POST reservation requires first name, last name, phone and table type but accepts optional email", async (t) => {
  const system = createSystem(t);

  const result = await createReservation(system, {
    firstName: "  Lina  ",
    lastName: "  Martin  ",
    email: "",
    tableType: "vip",
  });

  assert.equal(result.reservation.firstName, "Lina");
  assert.equal(result.reservation.lastName, "Martin");
  assert.equal(result.reservation.guestName, "Lina Martin");
  assert.equal(result.reservation.email, "");
  assert.equal(result.reservation.guestEmail, "");
  assert.equal(result.reservation.phone, "+33 6 12 34 56 78");
  assert.equal(result.reservation.guestPhone, "+33 6 12 34 56 78");
  assert.equal(result.reservation.tableType, "vip");
  assert.equal(result.reservation.status, "requested");
});

test("POST reservation rejects invalid table type", async (t) => {
  const system = createSystem(t);

  await assert.rejects(
    () => createReservation(system, { tableType: "terrace" }),
    (error) => error instanceof ReservationError && error.code === "TABLE_TYPE_INVALID",
  );
});

test("POST reservation requests do not consume capacity until confirmed", async (t) => {
  const system = createSystem(t);
  await createReservation(system, { tableType: "vip", partySize: 4, time: "20:30" });
  await createReservation(system, { tableType: "vip", partySize: 4, time: "20:30" });

  const vipAvailability = await system.getAvailability({ date: wednesday, partySize: 4, tableType: "vip" });

  assert.equal(vipAvailability.timeSlots.find((slot) => slot.time === "20:30").remainingCovers, 4);
});

test("Admin confirmation consumes capacity and prevents overbooking per table type", async (t) => {
  const system = createSystem(t);
  const first = await createReservation(system, { tableType: "vip", partySize: 4, time: "20:30" });
  const second = await createReservation(system, { tableType: "vip", partySize: 1, time: "20:30" });

  await system.updateReservationStatus(first.reservation.id, "confirmed");

  await assert.rejects(
    () => system.updateReservationStatus(second.reservation.id, "confirmed"),
    (error) => error instanceof ReservationError && error.code === "TIME_SLOT_UNAVAILABLE",
  );

  await createReservation(system, { tableType: "normal", partySize: 2, time: "20:30" });
  const requested = await system.listReservations({ status: "requested" });
  assert.equal(requested.reservations.some((reservation) => reservation.id === second.reservation.id), true);
});

test("Admin can list reservations by date and status with compatibility fields", async (t) => {
  const system = createSystem(t);
  const created = await createReservation(system, { tableType: "normal" });

  const result = await system.listReservations({
    date: wednesday,
    status: "requested",
  });

  assert.equal(result.reservations.length, 1);
  assert.equal(result.reservations[0].id, created.reservation.id);
  assert.equal(result.reservations[0].guestName, "Lina Martin");
  assert.equal(result.reservations[0].guestPhone, result.reservations[0].phone);
  assert.equal(result.reservations[0].guestEmail, result.reservations[0].email);
});

test("Admin can update reservation status", async (t) => {
  const system = createSystem(t);
  const created = await createReservation(system);

  const result = await system.updateReservationStatus(created.reservation.id, "cancelled");

  assert.equal(result.reservation.status, "cancelled");
  assert.equal((await system.listReservations({ status: "cancelled" })).reservations.length, 1);
});

test("Admin confirmation automatically blocks the reservation table type and is idempotent", async (t) => {
  const system = createSystem(t);
  const created = await createReservation(system, { tableType: "normal", time: "19:00" });

  await system.updateReservationStatus(created.reservation.id, "confirmed");
  await system.updateReservationStatus(created.reservation.id, "confirmed");

  const blockedTimeSlots = (await system.listBlockedTimeSlots({ date: wednesday })).blockedTimeSlots;
  assert.equal(blockedTimeSlots.length, 1);
  assert.equal(blockedTimeSlots[0].tableType, "normal");
  assert.equal(blockedTimeSlots[0].reservationId, created.reservation.id);
  assert.equal(blockedTimeSlots[0].createdBy, "reservation_confirmation");

  const normalAvailability = await system.getAvailability({ date: wednesday, partySize: 1, tableType: "normal" });
  const vipAvailability = await system.getAvailability({ date: wednesday, partySize: 1, tableType: "vip" });

  assert.equal(normalAvailability.timeSlots.some((slot) => slot.time === "19:00"), false);
  assert.equal(vipAvailability.timeSlots.some((slot) => slot.time === "19:00"), true);

  await assert.rejects(
    () => createReservation(system, { tableType: "normal", partySize: 2, time: "19:00" }),
    (error) => error instanceof ReservationError && error.code === "TIME_SLOT_UNAVAILABLE",
  );
});

test("Reservation requests reject unavailable interval times and oversized parties", async (t) => {
  const system = createSystem(t);

  await assert.rejects(
    () => createReservation(system, { tableType: "normal", time: "19:15" }),
    (error) => error instanceof ReservationError && error.code === "TIME_SLOT_UNAVAILABLE",
  );
  await assert.rejects(
    () => createReservation(system, { tableType: "vip", partySize: 5, time: "20:00" }),
    (error) => error instanceof ReservationError && error.code === "TIME_SLOT_UNAVAILABLE",
  );
});

test("Availability recalculates legacy automatic blocks after adding a table", async (t) => {
  const system = createSystem(t);
  const first = await createReservation(system, { tableType: "normal", time: "19:00" });
  await system.updateReservationStatus(first.reservation.id, "confirmed");

  const settings = (await system.getAvailabilitySettings()).settings;
  await system.updateAvailabilitySettings({ ...settings, normalTableCount: 2 });
  const reopened = await system.getAvailability({ date: wednesday, partySize: 2, tableType: "normal" });
  assert.equal(reopened.timeSlots.some((slot) => slot.time === "19:00"), true);

  const second = await createReservation(system, { tableType: "normal", time: "19:00", firstName: "Nora" });
  await system.updateReservationStatus(second.reservation.id, "confirmed");
  const full = await system.getAvailability({ date: wednesday, partySize: 2, tableType: "normal" });
  assert.equal(full.timeSlots.some((slot) => slot.time === "19:00"), false);
});

test("Admin cancellation removes only the automatic block for the reservation", async (t) => {
  const system = createSystem(t);
  const created = await createReservation(system, { tableType: "normal", time: "19:30" });
  const manual = await system.blockTimeSlot({
    date: wednesday,
    time: "19:30",
    tableType: "vip",
    reason: "Private table",
  });

  await system.updateReservationStatus(created.reservation.id, "confirmed");
  await system.updateReservationStatus(created.reservation.id, "cancelled");

  const blockedTimeSlots = (await system.listBlockedTimeSlots({ date: wednesday })).blockedTimeSlots;
  assert.equal(blockedTimeSlots.length, 1);
  assert.equal(blockedTimeSlots[0].id, manual.blockedTimeSlot.id);
  assert.equal(blockedTimeSlots[0].createdBy, "manual");

  const normalAvailability = await system.getAvailability({ date: wednesday, partySize: 1, tableType: "normal" });
  const vipAvailability = await system.getAvailability({ date: wednesday, partySize: 1, tableType: "vip" });

  assert.equal(normalAvailability.timeSlots.some((slot) => slot.time === "19:30"), true);
  assert.equal(vipAvailability.timeSlots.some((slot) => slot.time === "19:30"), false);
});

test("Admin confirmation fails clearly when a manual block collides with the reservation slot", async (t) => {
  const system = createSystem(t);
  const created = await createReservation(system, { tableType: "vip", time: "21:00" });
  await system.blockTimeSlot({
    date: wednesday,
    time: "21:00",
    tableType: "vip",
    reason: "Manual hold",
  });

  await assert.rejects(
    () => system.updateReservationStatus(created.reservation.id, "confirmed"),
    (error) => error instanceof ReservationError && error.code === "TIME_SLOT_ALREADY_BLOCKED",
  );

  const requested = await system.listReservations({ status: "requested" });
  assert.equal(requested.reservations.some((reservation) => reservation.id === created.reservation.id), true);
});

test("Admin availability exposes capacity, confirmed covers, remaining covers, availability and block state by type", async (t) => {
  const system = createSystem(t);
  const created = await createReservation(system, { tableType: "vip", partySize: 4, time: "20:00" });
  await system.updateReservationStatus(created.reservation.id, "confirmed");

  const availability = await system.getAdminAvailability({
    date: wednesday,
    partySize: 1,
    tableType: "all",
    time: "20:00",
  });

  assert.equal(availability.timeSlots.length, 1);
  assert.deepEqual(availability.timeSlots[0], {
    time: "20:00",
    types: {
      normal: {
        capacityCovers: 18,
        confirmedCovers: 0,
        remainingCovers: 18,
        available: true,
        blocked: false,
      },
      vip: {
        capacityCovers: 4,
        confirmedCovers: 4,
        remainingCovers: 0,
        available: false,
        blocked: true,
      },
    },
  });
});

test("Admin availability validates table type and active service time filters", async (t) => {
  const system = createSystem(t);

  await assert.rejects(
    () => system.getAdminAvailability({ date: wednesday, partySize: 2, tableType: "terrace" }),
    (error) => error instanceof ReservationError && error.code === "TABLE_TYPE_INVALID",
  );

  await assert.rejects(
    () => system.getAdminAvailability({ date: wednesday, partySize: 2, tableType: "all", time: "18:00" }),
    (error) => error instanceof ReservationError && error.code === "TIME_SLOT_INVALID",
  );
});

test("Admin can block and unblock a time slot", async (t) => {
  const system = createSystem(t);

  const created = await system.blockTimeSlot({
    date: wednesday,
    time: "21:00",
    tableType: "normal",
    reason: "Kitchen pacing",
  });

  assert.equal(created.blockedTimeSlot.tableType, "normal");
  assert.equal((await system.listBlockedTimeSlots({ date: wednesday })).blockedTimeSlots.length, 1);

  await system.unblockTimeSlot(created.blockedTimeSlot.id);
  assert.equal((await system.listBlockedTimeSlots({ date: wednesday })).blockedTimeSlots.length, 0);
});

test("SQLite store persists reservations and blocked time slots across reopen", async () => {
  const dir = await mkdtemp(join(tmpdir(), "galatee-sqlite-"));
  const databasePath = join(dir, "galatee.sqlite");
  let secondStore;

  try {
    const firstStore = new SqliteReservationStore({ databasePath });
    const firstSystem = new ReservationSystem({ store: firstStore, now: fixedNow });
    const created = await createReservation(firstSystem, { tableType: "vip", time: "21:30" });
    await firstSystem.blockTimeSlot({ date: wednesday, time: "19:30", reason: "Buyout" });
    firstStore.close();

    secondStore = new SqliteReservationStore({ databasePath });
    const secondSystem = new ReservationSystem({ store: secondStore, now: fixedNow });

    assert.equal((await secondSystem.listReservations()).reservations[0].id, created.reservation.id);
    assert.equal((await secondSystem.listBlockedTimeSlots()).blockedTimeSlots[0].reason, "Buyout");
  } finally {
    secondStore?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("SQLite store migrates legacy JSON once when present", async () => {
  const dir = await mkdtemp(join(tmpdir(), "galatee-legacy-"));
  const databasePath = join(dir, "galatee.sqlite");
  const legacyJsonPath = join(dir, "reservations.json");
  let store;

  try {
    await writeFile(legacyJsonPath, JSON.stringify({
      reservations: [
        {
          id: "legacy-reservation",
          guestName: "Noor Benali",
          guestPhone: "0612345678",
          guestEmail: "noor@example.com",
          date: wednesday,
          time: "19:00",
          partySize: 2,
          status: "confirmed",
          specialRequest: "Window",
          createdAt: "2026-08-29T10:00:00.000Z",
          updatedAt: "2026-08-29T10:00:00.000Z",
        },
      ],
      blockedTimeSlots: [
        {
          id: "legacy-block",
          date: wednesday,
          time: "20:00",
          reason: "Maintenance",
          createdAt: "2026-08-29T10:00:00.000Z",
        },
      ],
    }));

    store = new SqliteReservationStore({ databasePath, legacyJsonPath });
    const system = new ReservationSystem({ store, now: fixedNow });

    const reservations = await system.listReservations();
    const blockedTimeSlots = await system.listBlockedTimeSlots();

    assert.equal(reservations.reservations[0].id, "legacy-reservation");
    assert.equal(reservations.reservations[0].firstName, "Noor");
    assert.equal(reservations.reservations[0].lastName, "Benali");
    assert.equal(reservations.reservations[0].tableType, "normal");
    const legacyBlock = blockedTimeSlots.blockedTimeSlots.find((blockedTimeSlot) => blockedTimeSlot.id === "legacy-block");
    const automaticBlock = blockedTimeSlots.blockedTimeSlots.find(
      (blockedTimeSlot) => blockedTimeSlot.reservationId === "legacy-reservation",
    );
    assert.equal(legacyBlock.createdBy, "manual");
    assert.equal(legacyBlock.reservationId, null);
    assert.equal(automaticBlock.createdBy, "reservation_confirmation");
  } finally {
    store?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("SQLite store backfills automatic blocks for existing confirmed reservations once", async () => {
  const dir = await mkdtemp(join(tmpdir(), "galatee-backfill-"));
  const databasePath = join(dir, "galatee.sqlite");
  let seedStore;
  let secondStore;
  let thirdStore;

  try {
    seedStore = new SqliteReservationStore({ databasePath });
    seedStore.db.prepare(`
      INSERT INTO reservations (
        id, first_name, last_name, phone, email, date, time, party_size, table_type, status, special_request, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "existing-confirmed",
      "Noor",
      "Benali",
      "0612345678",
      "noor@example.com",
      wednesday,
      "21:00",
      2,
      "normal",
      "confirmed",
      "",
      "2026-08-29T10:00:00.000Z",
      "2026-08-29T10:00:00.000Z",
    );
    seedStore.close();
    seedStore = null;

    secondStore = new SqliteReservationStore({ databasePath });
    const secondSystem = new ReservationSystem({ store: secondStore, now: fixedNow });

    const blockedTimeSlots = (await secondSystem.listBlockedTimeSlots({ date: wednesday })).blockedTimeSlots;
    assert.equal(blockedTimeSlots.length, 1);
    assert.equal(blockedTimeSlots[0].tableType, "normal");
    assert.equal(blockedTimeSlots[0].reservationId, "existing-confirmed");
    assert.equal(blockedTimeSlots[0].createdBy, "reservation_confirmation");
    secondStore.close();
    secondStore = null;

    thirdStore = new SqliteReservationStore({ databasePath });
    const thirdSystem = new ReservationSystem({ store: thirdStore, now: fixedNow });
    assert.equal((await thirdSystem.listBlockedTimeSlots({ date: wednesday })).blockedTimeSlots.length, 1);
  } finally {
    seedStore?.close();
    secondStore?.close();
    thirdStore?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("SQLite store backfill preserves manual block collisions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "galatee-backfill-manual-"));
  const databasePath = join(dir, "galatee.sqlite");
  let seedStore;
  let reopenedStore;

  try {
    seedStore = new SqliteReservationStore({ databasePath });
    seedStore.db.prepare(`
      INSERT INTO reservations (
        id, first_name, last_name, phone, email, date, time, party_size, table_type, status, special_request, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "existing-confirmed-with-manual-block",
      "Lina",
      "Martin",
      "0612345678",
      "",
      wednesday,
      "20:30",
      2,
      "normal",
      "confirmed",
      "",
      "2026-08-29T10:00:00.000Z",
      "2026-08-29T10:00:00.000Z",
    );
    seedStore.db.prepare(`
      INSERT INTO blocked_time_slots (id, date, time, table_type, reason, reservation_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "manual-block",
      wednesday,
      "20:30",
      null,
      "Private event",
      null,
      "manual",
      "2026-08-29T10:00:00.000Z",
    );
    seedStore.close();
    seedStore = null;

    reopenedStore = new SqliteReservationStore({ databasePath });
    const system = new ReservationSystem({ store: reopenedStore, now: fixedNow });
    const blockedTimeSlots = (await system.listBlockedTimeSlots({ date: wednesday })).blockedTimeSlots;

    assert.equal(blockedTimeSlots.length, 1);
    assert.equal(blockedTimeSlots[0].id, "manual-block");
    assert.equal(blockedTimeSlots[0].createdBy, "manual");
    assert.equal(blockedTimeSlots[0].reservationId, null);
  } finally {
    seedStore?.close();
    reopenedStore?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("Date validation rejects years longer than four digits", async (t) => {
  const system = createSystem(t);

  await assert.rejects(
    () => system.getAvailability({ date: "02026-09-02", partySize: 2, tableType: "normal" }),
    (error) => error instanceof ReservationError && error.code === "DATE_INVALID",
  );
});

