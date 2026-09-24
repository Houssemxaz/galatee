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

test("customer auth resets a forgotten password end to end", async () => {
  const store = new SqliteReservationStore();
  const sentEmails = [];
  try {
    const auth = makeAuth(store, sentEmails);
    const created = auth.createAccount({
      email: "client@example.com",
      firstName: "Nora",
      lastName: "Benali",
      phone: "+213555123456",
      residenceCommune: "Hydra",
      password: "OldPassword!1",
    });

    const requested = await auth.requestPasswordReset({ email: "client@example.com" });
    assert.equal(requested.accepted, true);
    assert.equal(sentEmails.length, 1);
    assert.match(sentEmails[0].code, /^\d{6}$/);
    assert.equal(sentEmails[0].mode, "reset");

    const result = auth.confirmPasswordReset({
      email: "client@example.com",
      code: sentEmails[0].code,
      newPassword: "NewPassword!2",
    });
    assert.equal(result.account.id, created.account.id);
    assert.match(result.sessionToken, /^[a-f0-9]{64}$/);

    assert.equal(
      auth.loginWithPassword({ email: "client@example.com", password: "NewPassword!2" }).account.id,
      created.account.id,
    );
    assert.throws(
      () => auth.loginWithPassword({ email: "client@example.com", password: "OldPassword!1" }),
      (error) => error.code === "AUTH_INVALID_CREDENTIALS",
    );

    // The code is single-use - trying it again must fail, not reset the password twice.
    assert.throws(
      () => auth.confirmPasswordReset({ email: "client@example.com", code: sentEmails[0].code, newPassword: "AnotherOne!3" }),
      (error) => error.code === "AUTH_CODE_INVALID",
    );
  } finally {
    store.close();
  }
});

test("customer auth password reset does not enumerate unknown emails and enforces cooldown", async () => {
  const store = new SqliteReservationStore();
  const sentEmails = [];
  try {
    const auth = makeAuth(store, sentEmails);
    const unknown = await auth.requestPasswordReset({ email: "ghost@example.com" });
    assert.equal(unknown.accepted, true);
    assert.equal(sentEmails.length, 0);

    auth.createAccount({
      email: "client@example.com",
      firstName: "Nora",
      lastName: "Benali",
      phone: "+213555123456",
      residenceCommune: "Hydra",
      password: "OldPassword!1",
    });
    await auth.requestPasswordReset({ email: "client@example.com" });
    await assert.rejects(
      () => auth.requestPasswordReset({ email: "client@example.com" }),
      (error) => error.code === "AUTH_CODE_TOO_SOON",
    );
  } finally {
    store.close();
  }
});

test("customer auth locks out a password reset code after too many wrong attempts", async () => {
  const store = new SqliteReservationStore();
  const sentEmails = [];
  try {
    const auth = makeAuth(store, sentEmails);
    auth.createAccount({
      email: "client@example.com",
      firstName: "Nora",
      lastName: "Benali",
      phone: "+213555123456",
      residenceCommune: "Hydra",
      password: "OldPassword!1",
    });
    await auth.requestPasswordReset({ email: "client@example.com" });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.throws(
        () => auth.confirmPasswordReset({ email: "client@example.com", code: "000000", newPassword: "WhateverPass1" }),
        (error) => error.code === "AUTH_CODE_INVALID" || error.code === "AUTH_CODE_LOCKED",
      );
    }
    assert.throws(
      () => auth.confirmPasswordReset({ email: "client@example.com", code: sentEmails[0].code, newPassword: "WhateverPass1" }),
      (error) => error.code === "AUTH_CODE_LOCKED" || error.code === "AUTH_CODE_INVALID",
    );
  } finally {
    store.close();
  }
});

test("customer auth rejects an expired or too-weak password reset", async () => {
  const store = new SqliteReservationStore();
  const sentEmails = [];
  try {
    let currentTime = new Date(fixedDate);
    const auth = makeAuth(store, sentEmails, () => currentTime);
    auth.createAccount({
      email: "client@example.com",
      firstName: "Nora",
      lastName: "Benali",
      phone: "+213555123456",
      residenceCommune: "Hydra",
      password: "OldPassword!1",
    });
    await auth.requestPasswordReset({ email: "client@example.com" });

    assert.throws(
      () => auth.confirmPasswordReset({ email: "client@example.com", code: sentEmails[0].code, newPassword: "short" }),
      (error) => error.code === "AUTH_PASSWORD_INVALID",
    );

    currentTime = new Date(currentTime.getTime() + 11 * 60 * 1000); // past the 10-minute expiry
    assert.throws(
      () => auth.confirmPasswordReset({ email: "client@example.com", code: sentEmails[0].code, newPassword: "ValidPass1" }),
      (error) => error.code === "AUTH_CODE_INVALID",
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

test("HTTP password reset flow issues a new session and invalidates the old password", async (t) => {
  const store = new SqliteReservationStore();
  const sentEmails = [];
  const auth = makeAuth(store, sentEmails);
  const system = new ReservationSystem({ store, now: () => new Date(fixedDate) });
  const server = createApp({ system, customerAuth: auth, corsAllowedOrigin: "https://galatee.example" });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  t.after(() => store.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const jsonHeaders = { "Content-Type": "application/json", Origin: "https://galatee.example" };

  auth.createAccount({
    email: "client@example.com",
    firstName: "Nora",
    lastName: "Benali",
    phone: "+213555123456",
    residenceCommune: "Hydra",
    password: "OldPassword!1",
  });

  const requestResponse = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email: "client@example.com" }),
  });
  assert.equal(requestResponse.status, 202);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].mode, "reset");

  const confirmResponse = await fetch(`${baseUrl}/api/auth/confirm-password-reset`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      email: "client@example.com",
      code: sentEmails[0].code,
      newPassword: "NewPassword!2",
    }),
  });
  assert.equal(confirmResponse.status, 200);
  const cookie = cookieFrom(confirmResponse);
  assert.match(cookie, /^galatee_customer_session=/);

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie, Origin: "https://galatee.example" },
  });
  assert.equal((await meResponse.json()).account.email, "client@example.com");

  const oldLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email: "client@example.com", password: "OldPassword!1" }),
  });
  assert.equal(oldLoginResponse.status, 401);

  const newLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email: "client@example.com", password: "NewPassword!2" }),
  });
  assert.equal(newLoginResponse.status, 200);
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
