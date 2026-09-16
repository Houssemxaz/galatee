import assert from "node:assert/strict";
import test from "node:test";
import { CustomerAuthSystem } from "./customerAuthSystem.js";
import { createApp } from "./server.js";
import { ReservationSystem, SqliteReservationStore } from "./reservationSystem.js";

const fixedDate = "2026-08-29T10:00:00.000Z";

function makeAuth(store, sentEmails, now = () => new Date(fixedDate)) {
  return new CustomerAuthSystem({
    db: store.db,
    now,
    sendEmail: async (message) => sentEmails.push(message),
  });
}

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}

test("customer auth creates an account and verifies a one-time email code", async () => {
  const store = new SqliteReservationStore();
  const sentEmails = [];
  try {
    const auth = makeAuth(store, sentEmails);
    const requestResult = await auth.requestCode({
      mode: "signup",
      email: " Lina@example.com ",
      firstName: "Lina",
      lastName: "Martin",
      phone: "+213 555 123 456",
    });

    assert.equal(requestResult.accepted, true);
    assert.equal(sentEmails.length, 1);
    assert.match(sentEmails[0].code, /^\d{6}$/);
    assert.equal(requestResult.code, undefined);

    const result = await auth.verifyCode({ email: "lina@example.com", code: sentEmails[0].code });
    assert.equal(result.account.email, "lina@example.com");
    assert.equal(result.account.firstName, "Lina");
    assert.equal(result.account.phone, "+213 555 123 456");
    assert.match(result.sessionToken, /^[a-f0-9]{64}$/);

    const session = auth.getSession({ headers: { cookie: `galatee_customer_session=${result.sessionToken}` } });
    assert.equal(session.account.id, result.account.id);
    await assert.rejects(
      () => auth.verifyCode({ email: "lina@example.com", code: sentEmails[0].code }),
      (error) => error.code === "AUTH_CODE_INVALID",
    );
  } finally {
    store.close();
  }
});

test("customer auth applies resend cooldown and does not enumerate unknown login emails", async () => {
  const store = new SqliteReservationStore();
  const sentEmails = [];
  try {
    const auth = makeAuth(store, sentEmails);
    const unknown = await auth.requestCode({ mode: "login", email: "unknown@example.com" });
    assert.equal(unknown.accepted, true);
    assert.equal(sentEmails.length, 0);

    await auth.requestCode({
      mode: "signup",
      email: "lina@example.com",
      firstName: "Lina",
      lastName: "Martin",
      phone: "+213555123456",
    });
    await assert.rejects(
      () => auth.requestCode({
        mode: "signup",
        email: "lina@example.com",
        firstName: "Lina",
        lastName: "Martin",
        phone: "+213555123456",
      }),
      (error) => error.code === "AUTH_CODE_TOO_SOON",
    );
    await auth.verifyCode({ email: "lina@example.com", code: sentEmails[0].code });
    await assert.rejects(
      () => auth.requestCode({
        mode: "signup",
        email: "lina@example.com",
        firstName: "Lina",
        lastName: "Martin",
        phone: "+213555123456",
      }),
      (error) => error.code === "AUTH_ACCOUNT_EXISTS",
    );
  } finally {
    store.close();
  }
});

test("customer auth creates password accounts with residence and protects password login", () => {
  const store = new SqliteReservationStore();
  try {
    const auth = makeAuth(store, []);
    const created = auth.createAccount({
      email: "client@example.com",
      firstName: "Nora",
      lastName: "Benali",
      phone: "+213555123456",
      residenceCommune: "Hydra",
      password: "PastaLover!2026",
    });
    assert.equal(created.account.residenceCommune, "Hydra");
    assert.equal(created.account.password, undefined);
    assert.match(created.sessionToken, /^[a-f0-9]{64}$/);
    assert.equal(auth.loginWithPassword({ email: "client@example.com", password: "PastaLover!2026" }).account.id, created.account.id);
    assert.throws(
      () => auth.loginWithPassword({ email: "client@example.com", password: "wrong-password" }),
      (error) => error.code === "AUTH_INVALID_CREDENTIALS" && error.status === 401,
    );
    assert.throws(
      () => auth.createAccount({ email: "other@example.com", firstName: "A", lastName: "B", phone: "+213555123456", password: "short" }),
      (error) => error.code === "AUTH_RESIDENCE_REQUIRED",
    );
  } finally {
    store.close();
  }
});

test("authenticated reservations are linked and available through the account endpoint", async (t) => {
  const store = new SqliteReservationStore();
  const sentEmails = [];
  const auth = makeAuth(store, sentEmails);
  const system = new ReservationSystem({ store, now: () => new Date(fixedDate) });
  const server = createApp({ system, customerAuth: auth, corsAllowedOrigin: "https://galatee.example" });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  t.after(() => store.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const codeResponse = await fetch(`${baseUrl}/api/auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://galatee.example" },
    body: JSON.stringify({
      mode: "signup",
      email: "lina@example.com",
      firstName: "Lina",
      lastName: "Martin",
      phone: "+213555123456",
    }),
  });
  assert.equal(codeResponse.status, 202);
  const verifyResponse = await fetch(`${baseUrl}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://galatee.example" },
    body: JSON.stringify({ email: "lina@example.com", code: sentEmails[0].code }),
  });
  assert.equal(verifyResponse.status, 200);
  const cookie = cookieFrom(verifyResponse);
  assert.match(cookie, /^galatee_customer_session=/);
  assert.equal(verifyResponse.headers.get("access-control-allow-credentials"), "true");

  const reservationResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: "https://galatee.example",
    },
    body: JSON.stringify({
      date: "2026-09-02",
      time: "19:00",
      partySize: 2,
      tableType: "normal",
      specialRequest: "Chaise haute",
    }),
  });
  assert.equal(reservationResponse.status, 201);
  const reservation = (await reservationResponse.json()).reservation;
  assert.ok(reservation.customerId);
  assert.equal(reservation.firstName, "Lina");

  const accountReservations = await fetch(`${baseUrl}/api/account/reservations`, {
    headers: { Cookie: cookie, Origin: "https://galatee.example" },
  });
  assert.equal(accountReservations.status, 200);
  assert.equal((await accountReservations.json()).reservations[0].id, reservation.id);
});

test("customer auth logs a safe Brevo rejection diagnostic", async () => {
  const store = new SqliteReservationStore();
  const logs = [];
  try {
    const auth = new CustomerAuthSystem({
      db: store.db,
      brevoApiKey: "test-key",
      mailFromEmail: "verified@example.com",
      fetchImpl: async () => new Response(JSON.stringify({
        code: "unauthorized",
        message: "Key is not valid",
      }), { status: 401, headers: { "Content-Type": "application/json" } }),
      logger: { error: (message) => logs.push(message) },
    });

    await assert.rejects(
      () => auth.requestCode({
        mode: "signup",
        email: "lina@example.com",
        firstName: "Lina",
        lastName: "Martin",
        phone: "+213555123456",
      }),
      (error) => error.code === "AUTH_EMAIL_SEND_FAILED" && error.details.providerStatus === 401,
    );
    assert.match(logs[0], /\[Brevo\] SMTP API 401 \(unauthorized\): Key is not valid/);
    assert.doesNotMatch(logs[0], /test-key|lina@example.com/);
  } finally {
    store.close();
  }
});
