import assert from "node:assert/strict";
import test from "node:test";
import { ClubError, ClubSystem } from "./clubSystem.js";
import { SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = () => new Date("2026-09-16T18:00:00.000Z");

test("Pasta Lover Club keeps editable presentation and event programming", (t) => {
  const store = new SqliteReservationStore();
  t.after(() => store.close());
  const club = new ClubSystem({ db: store.db, now: fixedNow });
  const initial = club.getContent();
  assert.equal(initial.settings.active, true);
  assert.match(initial.settings.title, /Pasta Lover/);
  assert.deepEqual(initial.events, []);

  club.updateSettings({ title: "Pasta Lover Club Hydra", benefits: "Soirées\nCaps et vêtements" });
  const event = club.createEvent({ title: "Dîner des membres", eventDate: "2026-10-10", location: "Hydra", description: "Une table, une playlist, beaucoup de pasta." });
  assert.equal(club.getContent().events[0].title, "Dîner des membres");
  assert.equal(club.getContent().events[0].eventDate, "2026-10-10");
  club.updateEvent(event.id, { active: false });
  assert.deepEqual(club.getContent().events, []);
  assert.equal(club.getContent({ includeInactive: true }).events[0].active, false);
  assert.throws(() => club.createEvent({ title: "Erreur", eventDate: "10/10/2026" }), (error) => error instanceof ClubError && error.code === "CLUB_EVENT_DATE_INVALID");
  club.deleteEvent(event.id);
  assert.deepEqual(club.getContent({ includeInactive: true }).events, []);
});
