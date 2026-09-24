import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./server.js";
import { ReservationSystem, SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = () => new Date("2026-08-29T10:00:00.000Z");
const wednesday = "2026-09-02";

const TEST_ADMIN_TOKEN = "test-admin-token";

// assertAdminAuthorized() now fails closed with no token configured, so every
// test server needs a real one, and every /api/admin/* call needs this header.
function adminAuthHeaders(extra = {}) {
  return { Authorization: `Bearer ${TEST_ADMIN_TOKEN}`, ...extra };
}

async function createTestServer(t) {
  const store = new SqliteReservationStore();
  const system = new ReservationSystem({ store, now: fixedNow });
  const server = createApp({ system, requiredAdminToken: TEST_ADMIN_TOKEN });

  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  t.after(() => store.close());

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function reservationBody(overrides = {}) {
  return {
    firstName: "Lina",
    lastName: "Martin",
    phone: "+33142380125",
    email: "lina@example.com",
    date: wednesday,
    time: "19:00",
    partySize: 2,
    tableType: "normal",
    specialRequest: "Allergie noisette",
    ...overrides,
  };
}

test("HTTP API exposes availability by table type and creates reservations with the new contract", async (t) => {
  const baseUrl = await createTestServer(t);

  const availabilityResponse = await fetch(`${baseUrl}/api/availability?date=${wednesday}&partySize=2&tableType=vip`);
  assert.equal(availabilityResponse.status, 200);
  const availability = await availabilityResponse.json();
  assert.equal(availability.tableType, "vip");
  assert.equal(availability.service.capacityCovers, 4);
  assert.equal(availability.timeSlots[0].time, "19:00");

  const reservationResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ email: "", tableType: "vip" })),
  });
  assert.equal(reservationResponse.status, 201);
  const reservation = await reservationResponse.json();
  assert.equal(reservation.reservation.status, "requested");
  assert.equal(reservation.reservation.firstName, "Lina");
  assert.equal(reservation.reservation.lastName, "Martin");
  assert.equal(reservation.reservation.guestName, "Lina Martin");
  assert.equal(reservation.reservation.phone, "+33142380125");
  assert.equal(reservation.reservation.guestPhone, "+33142380125");
  assert.equal(reservation.reservation.email, "");
  assert.equal(reservation.reservation.guestEmail, "");
  assert.equal(reservation.reservation.tableType, "vip");
});

test("HTTP API rejects missing required first name", async (t) => {
  const baseUrl = await createTestServer(t);

  const response = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ firstName: "" })),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "GUEST_FIRST_NAME_REQUIRED",
      message: "Guest first name is required.",
    },
  });
});

test("HTTP requested reservations do not consume availability until admin confirmation", async (t) => {
  const baseUrl = await createTestServer(t);

  const firstResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ partySize: 4, tableType: "vip", time: "20:00" })),
  });
  assert.equal(firstResponse.status, 201);
  const first = await firstResponse.json();

  const secondResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ partySize: 1, tableType: "vip", time: "20:00" })),
  });
  assert.equal(secondResponse.status, 201);
  const second = await secondResponse.json();

  const openAvailabilityResponse = await fetch(`${baseUrl}/api/availability?date=${wednesday}&partySize=4&tableType=vip`);
  const openAvailability = await openAvailabilityResponse.json();
  assert.equal(openAvailability.timeSlots.find((slot) => slot.time === "20:00").remainingCovers, 4);

  const confirmFirstResponse = await fetch(`${baseUrl}/api/admin/reservations/${first.reservation.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(confirmFirstResponse.status, 200);

  const confirmSecondResponse = await fetch(`${baseUrl}/api/admin/reservations/${second.reservation.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(confirmSecondResponse.status, 409);
  assert.equal((await confirmSecondResponse.json()).error.code, "TIME_SLOT_UNAVAILABLE");

  const normalResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ partySize: 2, tableType: "normal", time: "20:00" })),
  });
  assert.equal(normalResponse.status, 201);
});

test("HTTP admin confirmation creates an automatic block and cancellation removes it", async (t) => {
  const baseUrl = await createTestServer(t);

  const reservationResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ tableType: "normal", time: "20:30" })),
  });
  const created = await reservationResponse.json();

  const confirmResponse = await fetch(`${baseUrl}/api/admin/reservations/${created.reservation.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(confirmResponse.status, 200);

  const blocksAfterConfirmResponse = await fetch(`${baseUrl}/api/admin/blocked-time-slots?date=${wednesday}`, { headers: adminAuthHeaders() });
  const blocksAfterConfirm = await blocksAfterConfirmResponse.json();
  assert.equal(blocksAfterConfirm.blockedTimeSlots.length, 1);
  assert.equal(blocksAfterConfirm.blockedTimeSlots[0].tableType, "normal");
  assert.equal(blocksAfterConfirm.blockedTimeSlots[0].reservationId, created.reservation.id);
  assert.equal(blocksAfterConfirm.blockedTimeSlots[0].createdBy, "reservation_confirmation");

  const publicAvailabilityResponse = await fetch(`${baseUrl}/api/availability?date=${wednesday}&partySize=1&tableType=normal`);
  const publicAvailability = await publicAvailabilityResponse.json();
  assert.equal(publicAvailability.timeSlots.some((slot) => slot.time === "20:30"), false);

  const cancelResponse = await fetch(`${baseUrl}/api/admin/reservations/${created.reservation.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ status: "cancelled" }),
  });
  assert.equal(cancelResponse.status, 200);

  const blocksAfterCancelResponse = await fetch(`${baseUrl}/api/admin/blocked-time-slots?date=${wednesday}`, { headers: adminAuthHeaders() });
  const blocksAfterCancel = await blocksAfterCancelResponse.json();
  assert.equal(blocksAfterCancel.blockedTimeSlots.length, 0);
});

test("HTTP admin confirmation returns 409 when a manual block collides", async (t) => {
  const baseUrl = await createTestServer(t);

  const reservationResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ tableType: "vip", time: "21:00" })),
  });
  const created = await reservationResponse.json();

  const blockResponse = await fetch(`${baseUrl}/api/admin/blocked-time-slots`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      date: wednesday,
      time: "21:00",
      tableType: "vip",
      reason: "Manual hold",
    }),
  });
  assert.equal(blockResponse.status, 201);

  const confirmResponse = await fetch(`${baseUrl}/api/admin/reservations/${created.reservation.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(confirmResponse.status, 409);
  assert.deepEqual(await confirmResponse.json(), {
    error: {
      code: "TIME_SLOT_ALREADY_BLOCKED",
      message: "Time slot is manually blocked for this table type.",
    },
  });
});

test("HTTP admin API lists reservations and updates reservation status", async (t) => {
  const baseUrl = await createTestServer(t);

  const reservationResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ tableType: "normal" })),
  });
  const created = await reservationResponse.json();

  const listResponse = await fetch(`${baseUrl}/api/admin/reservations?date=${wednesday}`, { headers: adminAuthHeaders() });
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  assert.equal(listPayload.reservations.length, 1);
  assert.equal(listPayload.reservations[0].tableType, "normal");

  const statusResponse = await fetch(`${baseUrl}/api/admin/reservations/${created.reservation.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(statusResponse.status, 200);
  assert.equal((await statusResponse.json()).reservation.status, "confirmed");
});

test("HTTP admin API exposes detailed availability filters", async (t) => {
  const baseUrl = await createTestServer(t);

  const reservationResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ tableType: "vip", partySize: 4, time: "20:00" })),
  });
  const created = await reservationResponse.json();

  const confirmResponse = await fetch(`${baseUrl}/api/admin/reservations/${created.reservation.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(confirmResponse.status, 200);

  const response = await fetch(`${baseUrl}/api/admin/availability?date=${wednesday}&partySize=1&tableType=all&time=20:00`, { headers: adminAuthHeaders() });
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.tableType, "all");
  assert.equal(payload.time, "20:00");
  assert.deepEqual(payload.timeSlots[0], {
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

test("HTTP admin availability validates query filters", async (t) => {
  const baseUrl = await createTestServer(t);

  const badDateResponse = await fetch(`${baseUrl}/api/admin/availability?date=02026-09-02&partySize=2&tableType=all`, { headers: adminAuthHeaders() });
  assert.equal(badDateResponse.status, 400);
  assert.equal((await badDateResponse.json()).error.code, "DATE_INVALID");

  const badTableTypeResponse = await fetch(`${baseUrl}/api/admin/availability?date=${wednesday}&partySize=2&tableType=terrace`, { headers: adminAuthHeaders() });
  assert.equal(badTableTypeResponse.status, 400);
  assert.equal((await badTableTypeResponse.json()).error.code, "TABLE_TYPE_INVALID");

  const badTimeResponse = await fetch(`${baseUrl}/api/admin/availability?date=${wednesday}&partySize=2&tableType=all&time=18:00`, { headers: adminAuthHeaders() });
  assert.equal(badTimeResponse.status, 422);
  assert.equal((await badTimeResponse.json()).error.code, "TIME_SLOT_INVALID");
});

test("HTTP admin API blocks and unblocks typed time slots", async (t) => {
  const baseUrl = await createTestServer(t);

  const blockResponse = await fetch(`${baseUrl}/api/admin/blocked-time-slots`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      date: wednesday,
      time: "19:30",
      tableType: "vip",
      reason: "Private event",
    }),
  });
  assert.equal(blockResponse.status, 201);
  const blockPayload = await blockResponse.json();
  assert.equal(blockPayload.blockedTimeSlot.tableType, "vip");

  const vipAvailabilityResponse = await fetch(`${baseUrl}/api/availability?date=${wednesday}&partySize=2&tableType=vip`);
  const vipAvailability = await vipAvailabilityResponse.json();
  assert.equal(vipAvailability.timeSlots.some((slot) => slot.time === "19:30"), false);

  const normalAvailabilityResponse = await fetch(`${baseUrl}/api/availability?date=${wednesday}&partySize=2&tableType=normal`);
  const normalAvailability = await normalAvailabilityResponse.json();
  assert.equal(normalAvailability.timeSlots.some((slot) => slot.time === "19:30"), true);

  const unblockResponse = await fetch(`${baseUrl}/api/admin/blocked-time-slots/${blockPayload.blockedTimeSlot.id}`, {
    method: "DELETE",
    headers: adminAuthHeaders(),
  });
  assert.equal(unblockResponse.status, 200);
  assert.deepEqual(await unblockResponse.json(), { removed: true });
});

test("HTTP admin API lists and updates recurring service table settings", async (t) => {
  const baseUrl = await createTestServer(t);

  const servicesResponse = await fetch(`${baseUrl}/api/admin/services`, { headers: adminAuthHeaders() });
  assert.equal(servicesResponse.status, 200);
  const servicesPayload = await servicesResponse.json();
  const wednesdayService = servicesPayload.services.find((service) => service.weekday === 3);
  assert.equal(wednesdayService.normalTableCount, 1);
  assert.equal(wednesdayService.normalTableCapacity, 18);

  const updateResponse = await fetch(`${baseUrl}/api/admin/services/${wednesdayService.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      ...wednesdayService,
      normalTableCount: 3,
      normalTableCapacity: 4,
      vipTableCount: 2,
      vipTableCapacity: 2,
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json();
  assert.equal(updated.service.normalCapacityCovers, 12);
  assert.equal(updated.service.vipCapacityCovers, 4);

  const availabilityResponse = await fetch(`${baseUrl}/api/availability?date=${wednesday}&partySize=4&tableType=normal`);
  assert.equal(availabilityResponse.status, 200);
  assert.equal((await availabilityResponse.json()).service.capacityCovers, 12);
});

test("HTTP admin service update rejects invalid table settings", async (t) => {
  const baseUrl = await createTestServer(t);
  const services = await (await fetch(`${baseUrl}/api/admin/services`, { headers: adminAuthHeaders() })).json();
  const service = services.services.find((entry) => entry.weekday === 3);

  const response = await fetch(`${baseUrl}/api/admin/services/${service.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ normalTableCount: -1 }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "SERVICE_TABLE_CONFIG_INVALID");
});

test("HTTP admin availability settings apply globally and special events override them", async (t) => {
  const baseUrl = await createTestServer(t);

  const settingsResponse = await fetch(`${baseUrl}/api/admin/availability-settings`, { headers: adminAuthHeaders() });
  assert.equal(settingsResponse.status, 200);
  const settingsPayload = await settingsResponse.json();
  assert.deepEqual(settingsPayload.settings.activeDays, [3, 4, 5, 6]);

  const updateSettingsResponse = await fetch(`${baseUrl}/api/admin/availability-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      ...settingsPayload.settings,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: "18:00",
      endTime: "22:00",
      slotIntervalMinutes: 60,
      normalTableCount: 2,
      normalTableCapacity: 4,
      vipTableCount: 2,
      vipTableCapacity: 2,
    }),
  });
  assert.equal(updateSettingsResponse.status, 200);
  const updatedSettings = await updateSettingsResponse.json();
  assert.equal(updatedSettings.settings.normalCapacityCovers, 8);
  assert.equal(updatedSettings.settings.vipCapacityCovers, 4);

  const sundayAvailabilityResponse = await fetch(`${baseUrl}/api/availability?date=2026-08-30&partySize=4&tableType=normal`);
  assert.equal(sundayAvailabilityResponse.status, 200);
  const sundayAvailability = await sundayAvailabilityResponse.json();
  assert.equal(sundayAvailability.service.id, "global-service");
  assert.deepEqual(sundayAvailability.timeSlots.map((slot) => slot.time), ["18:00", "19:00", "20:00", "21:00", "22:00"]);

  const firstTableReservationResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ date: "2026-08-30", time: "18:00", partySize: 4, tableType: "normal" })),
  });
  const firstTableReservation = await firstTableReservationResponse.json();
  const secondTableReservationResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ date: "2026-08-30", time: "18:00", partySize: 4, tableType: "normal", firstName: "Nora" })),
  });
  const secondTableReservation = await secondTableReservationResponse.json();
  for (const reservation of [firstTableReservation, secondTableReservation]) {
    const confirmationResponse = await fetch(`${baseUrl}/api/admin/reservations/${reservation.reservation.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(confirmationResponse.status, 200);
  }
  const fullSundayResponse = await fetch(`${baseUrl}/api/availability?date=2026-08-30&partySize=2&tableType=normal`);
  assert.equal((await fullSundayResponse.json()).timeSlots.some((slot) => slot.time === "18:00"), false);

  const conflictingSettingsResponse = await fetch(`${baseUrl}/api/admin/availability-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ ...updatedSettings.settings, activeDays: [3, 4, 5, 6] }),
  });
  assert.equal(conflictingSettingsResponse.status, 409);
  assert.equal((await conflictingSettingsResponse.json()).error.code, "AVAILABILITY_CHANGE_CONFLICT");

  const eventResponse = await fetch(`${baseUrl}/api/admin/availability-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      name: "Dîner privé",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-02",
      startTime: "20:00",
      endTime: "23:00",
      slotIntervalMinutes: 30,
      normalTableCount: 1,
      normalTableCapacity: 6,
      vipTableCount: 0,
      vipTableCapacity: 1,
      active: true,
    }),
  });
  assert.equal(eventResponse.status, 201);
  const eventPayload = await eventResponse.json();
  assert.equal(eventPayload.event.name, "Dîner privé");

  const overlapResponse = await fetch(`${baseUrl}/api/admin/availability-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      name: "Autre événement",
      dateFrom: "2026-09-02",
      dateTo: "2026-09-03",
      startTime: "19:00",
      endTime: "22:00",
      slotIntervalMinutes: 30,
      normalTableCount: 1,
      normalTableCapacity: 6,
      vipTableCount: 1,
      vipTableCapacity: 4,
      active: true,
    }),
  });
  assert.equal(overlapResponse.status, 409);
  assert.equal((await overlapResponse.json()).error.code, "AVAILABILITY_EVENT_OVERLAP");

  const eventAvailabilityResponse = await fetch(`${baseUrl}/api/availability?date=2026-09-01&partySize=2&tableType=normal`);
  assert.equal(eventAvailabilityResponse.status, 200);
  const eventAvailability = await eventAvailabilityResponse.json();
  assert.equal(eventAvailability.service.id, eventPayload.event.id);
  assert.equal(eventAvailability.timeSlots[0].time, "20:00");
  assert.equal(eventAvailability.timeSlots.at(-1).time, "23:00");

  const deleteEventResponse = await fetch(`${baseUrl}/api/admin/availability-events/${eventPayload.event.id}`, { method: "DELETE", headers: adminAuthHeaders() });
  assert.equal(deleteEventResponse.status, 200);
  const historyResponse = await fetch(`${baseUrl}/api/admin/availability-settings/history`, { headers: adminAuthHeaders() });
  assert.equal(historyResponse.status, 200);
  assert.ok((await historyResponse.json()).history.length >= 1);
  const revertedAvailabilityResponse = await fetch(`${baseUrl}/api/availability?date=2026-09-01&partySize=2&tableType=normal`);
  assert.equal((await revertedAvailabilityResponse.json()).service.id, "global-service");
});

test("HTTP admin API requires bearer auth when an admin token is configured", async (t) => {
  const store = new SqliteReservationStore();
  const system = new ReservationSystem({ store, now: fixedNow });
  const server = createApp({
    system,
    requiredAdminToken: "secret-admin-token",
    corsAllowedOrigin: "https://demo-galatee.vercel.app",
  });

  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  t.after(() => store.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const preflightResponse = await fetch(`${baseUrl}/api/admin/reservations`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://demo-galatee.vercel.app",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  assert.equal(preflightResponse.status, 204);
  assert.equal(preflightResponse.headers.get("access-control-allow-origin"), "https://demo-galatee.vercel.app");
  assert.match(preflightResponse.headers.get("access-control-allow-methods") || "", /OPTIONS/);
  assert.equal(preflightResponse.headers.get("access-control-allow-headers"), "Content-Type, Authorization");

  const unauthorizedResponse = await fetch(`${baseUrl}/api/admin/reservations`);
  assert.equal(unauthorizedResponse.status, 401);

  const authorizedResponse = await fetch(`${baseUrl}/api/admin/reservations`, {
    headers: {
      Authorization: "Bearer secret-admin-token",
    },
  });
  assert.equal(authorizedResponse.status, 200);
});

test("HTTP admin API stays open when no admin token is configured at all (intentional)", async (t) => {
  // Documents a deliberate choice, not an oversight: with GALATEE_ADMIN_TOKEN
  // unset, admin routes are reachable with no login, matching the "Token
  // admin optionnel" convenience described in the back-office AuthGate screen.
  // Anyone changing this back to fail-closed should update this test on purpose.
  const store = new SqliteReservationStore();
  const system = new ReservationSystem({ store, now: fixedNow });
  const server = createApp({ system, requiredAdminToken: "" });

  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  t.after(() => store.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const noHeaderResponse = await fetch(`${baseUrl}/api/admin/reservations`);
  assert.equal(noHeaderResponse.status, 200);
});

test("HTTP API returns frontend-friendly validation errors", async (t) => {
  const baseUrl = await createTestServer(t);
  const response = await fetch(`${baseUrl}/api/availability?date=bad-date&partySize=2`);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "DATE_INVALID",
      message: "Date must use YYYY-MM-DD.",
    },
  });
});

test("HTTP API rejects dates with years longer than four digits", async (t) => {
  const baseUrl = await createTestServer(t);
  const response = await fetch(`${baseUrl}/api/availability?date=02026-09-02&partySize=2`);

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "DATE_INVALID");
});

test("HTTP API rejects impossible calendar dates", async (t) => {
  const baseUrl = await createTestServer(t);
  const availabilityResponse = await fetch(`${baseUrl}/api/availability?date=2026-02-30&partySize=2`);

  assert.equal(availabilityResponse.status, 400);
  assert.deepEqual(await availabilityResponse.json(), {
    error: {
      code: "DATE_INVALID",
      message: "Date must be a real calendar date.",
    },
  });
});

test("HTTP reservation creation rejects past dates and dates without active service", async (t) => {
  const baseUrl = await createTestServer(t);

  const pastDateResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ date: "2026-08-28" })),
  });
  assert.equal(pastDateResponse.status, 400);
  assert.equal((await pastDateResponse.json()).error.code, "DATE_IN_PAST");

  const closedDateResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationBody({ date: "2026-09-01" })),
  });
  assert.equal(closedDateResponse.status, 422);
  assert.equal((await closedDateResponse.json()).error.code, "SERVICE_CLOSED");
});

test("HTTP server injects the API base when serving the frontend", async (t) => {
  const baseUrl = await createTestServer(t);
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /window\.GALATEE_API_BASE = "\/api"/);
});
