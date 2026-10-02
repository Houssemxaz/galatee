import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { RESERVATION_TABLES, archiveDigest, writeReservationArchive } from "./postgres/archiveReservations.mjs";

test("reservation archive is written with a verifiable digest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "galatee-reservation-archive-"));
  try {
    const tables = Object.fromEntries(RESERVATION_TABLES.map((table) => [table, { columns: [], rows: [] }]));
    tables.reservations = { columns: ["id", "status"], rows: [{ id: "legacy-1", status: "confirmed" }] };
    const result = await writeReservationArchive({ tables, analyticsEvents: [] }, join(directory, "archive.json"), new Date("2026-09-28T12:00:00.000Z"));
    const archive = JSON.parse(await readFile(result.path, "utf8"));
    const { sha256, ...payload } = archive;

    assert.equal(result.tableCounts.reservations, 1);
    assert.equal(result.analyticsEventCount, 0);
    assert.equal(sha256, archiveDigest(payload));
    assert.equal(archive.tables.reservations.rows[0].id, "legacy-1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
