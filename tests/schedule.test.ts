import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, todayISO, weekdayOf } from "../src/lib/dates.ts";
import { expandDates, nextOccurrence, weeklyDays, weeklyRule } from "../src/lib/recurrence.ts";
import { expandOccurrences, routineStreak } from "../src/lib/occurrences.ts";
import { findConflicts } from "../src/lib/conflicts.ts";
import type { Item } from "../src/lib/types.ts";

function item(overrides: Partial<Item>): Item {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    household_id: "h",
    pillar_key: "kids",
    person_id: null,
    responsible_person_id: null,
    kind: "event",
    tag: null,
    title: "x",
    details: null,
    location: null,
    starts_on: null,
    ends_on: null,
    start_time: null,
    end_time: null,
    recurrence: null,
    due_date: null,
    countdown: false,
    status: "open",
    priority: 2,
    next_action: null,
    waiting_on: null,
    budget: null,
    progress_done: null,
    progress_total: null,
    parent_id: null,
    template_id: null,
    sort_order: 0,
    source: "app",
    external_id: null,
    calendar_id: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("dates: weekday + timezone", () => {
  assert.equal(weekdayOf("2026-10-30"), "FR");
  assert.equal(weekdayOf("2026-11-01"), "SU");
  // 03:30 UTC on Oct 31 is still Oct 30 in New York
  assert.equal(todayISO("America/New_York", new Date("2026-10-31T03:30:00Z")), "2026-10-30");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("weekly school days skip Wednesday; Ali starts in December", () => {
  const rule = "FREQ=WEEKLY;BYDAY=MO,TU,TH,FR";
  assert.deepEqual(expandDates(rule, "2026-08-10", null, "2026-10-26", "2026-11-01"), [
    "2026-10-26",
    "2026-10-27",
    "2026-10-29",
    "2026-10-30",
  ]);
  assert.deepEqual(expandDates(rule, "2026-12-01", null, "2026-11-23", "2026-12-04"), [
    "2026-12-01",
    "2026-12-03",
    "2026-12-04",
  ]);
  assert.deepEqual(expandDates(rule, "2026-08-10", "2026-10-27", "2026-10-26", "2026-11-01"), [
    "2026-10-26",
    "2026-10-27",
  ]);
});

test("monthly first Saturday, daily, yearly", () => {
  assert.deepEqual(expandDates("FREQ=MONTHLY;BYDAY=1SA", "2026-01-01", null, "2026-10-01", "2026-12-31"), [
    "2026-10-03",
    "2026-11-07",
    "2026-12-05",
  ]);
  assert.equal(expandDates("FREQ=DAILY", "2026-10-01", null, "2026-10-28", "2026-11-03").length, 7);
  assert.equal(nextOccurrence("FREQ=YEARLY", "2026-12-25", null, "2027-01-02"), "2027-12-25");
});

test("weekly rule round-trips through chips in Monday order", () => {
  assert.equal(weeklyRule(["FR", "MO", "WE"]), "FREQ=WEEKLY;BYDAY=MO,WE,FR");
  assert.deepEqual(weeklyDays("FREQ=WEEKLY;BYDAY=MO,WE,FR"), ["MO", "WE", "FR"]);
  assert.deepEqual(weeklyDays("FREQ=MONTHLY;BYDAY=1SA"), []);
});

test("occurrences: overdue tasks surface today; routines carry done state", () => {
  const today = "2026-10-30";
  const task = item({ kind: "task", due_date: "2026-10-20", title: "late" });
  const routine = item({ id: "r", kind: "routine", recurrence: "FREQ=DAILY", starts_on: "2026-10-01" });
  const occurrences = expandOccurrences([task, routine], [{ item_id: "r", on_date: today }], today, addDays(today, 6), today);
  const todays = occurrences.filter((o) => o.date === today);
  assert.equal(todays[0].item.title, "late");
  assert.equal(todays[0].overdue, true);
  assert.equal(todays.find((o) => o.item.id === "r")?.done, true);
  assert.equal(occurrences.filter((o) => o.item.id === "r").length, 7);
});

test("routine streak counts back, ignoring an unfinished today", () => {
  const routine = item({ id: "r", kind: "routine", recurrence: "FREQ=WEEKLY;BYDAY=SA,SU", starts_on: "2026-09-01" });
  const completions = ["2026-10-24", "2026-10-25", "2026-10-18"].map((on_date) => ({ item_id: "r", on_date }));
  // Done Oct 25, 24, 18; Oct 17 was missed, so the streak stops at 3.
  assert.equal(routineStreak(routine, completions, "2026-10-30"), 3);
  assert.equal(routineStreak(routine, completions, "2026-10-31"), 3); // Saturday not done yet
});

test("conflicts: same driver, same time, different places", () => {
  const moni = "moni";
  const school = item({ tag: "pickup", responsible_person_id: moni, location: "School", start_time: "14:50", person_id: "gabi" });
  const dance = item({ tag: "pickup", responsible_person_id: moni, location: "Dance studio", start_time: "15:00", person_id: "ali" });
  const sameSchool = item({ tag: "pickup", responsible_person_id: moni, location: "school", start_time: "14:50", person_id: "ali" });
  const day = "2026-10-29";
  const occ = (i: Item) => ({ key: i.id, item: i, date: day, start: i.start_time, end: null, done: false, overdue: false });

  const found = findConflicts([occ(school), occ(dance), occ(sameSchool)]);
  assert.equal(found.length, 2);
  assert.ok(found.every((c) => c.kind === "driver" && c.personId === moni));
  assert.equal(findConflicts([occ(school), occ(sameSchool)]).length, 0);
});

test("conflicts: a child booked in two places at once", () => {
  const day = "2026-10-26";
  const a = item({ person_id: "gabi", location: "Gym", start_time: "15:00", end_time: "16:30" });
  const b = item({ person_id: "gabi", location: "Library", start_time: "16:00", end_time: "17:00" });
  const c = item({ person_id: "gabi", location: "Library", start_time: "16:30", end_time: "17:00" });
  const occ = (i: Item) => ({ key: i.id, item: i, date: day, start: i.start_time, end: i.end_time, done: false, overdue: false });
  assert.equal(findConflicts([occ(a), occ(b)]).length, 1);
  assert.equal(findConflicts([occ(a), occ(c)]).length, 0);
});
