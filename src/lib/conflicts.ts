/**
 * "Two places at once" detection.
 *
 *  - driver: the same person is responsible for two rides (pickup/drop-off)
 *    within WINDOW minutes of each other at different places.
 *  - person: someone is booked into two overlapping events at different places.
 *
 * Unknown locations never conflict — we only flag what we can be sure of.
 */
import { minutesOf } from "./dates.ts";
import type { Occurrence } from "./occurrences.ts";
import { isRide } from "./types.ts";

export const RIDE_WINDOW_MINUTES = 20;
const DEFAULT_EVENT_MINUTES = 30;

export interface Conflict {
  kind: "driver" | "person";
  personId: string;
  date: string;
  a: Occurrence;
  b: Occurrence;
}

function place(occurrence: Occurrence): string | null {
  const location = occurrence.item.location?.trim().toLowerCase();
  return location ? location : null;
}

function differentPlaces(a: Occurrence, b: Occurrence): boolean {
  const pa = place(a);
  const pb = place(b);
  return pa !== null && pb !== null && pa !== pb;
}

function span(occurrence: Occurrence): [number, number] {
  const start = minutesOf(occurrence.start!);
  const end = occurrence.end ? minutesOf(occurrence.end) : start + DEFAULT_EVENT_MINUTES;
  return [start, Math.max(end, start + 1)];
}

export function findConflicts(occurrences: Occurrence[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const timed = occurrences.filter((o) => o.start && o.item.kind === "event");

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.date !== b.date || !differentPlaces(a, b)) continue;

      const driverA = isRide(a.item.tag) ? a.item.responsible_person_id : null;
      const driverB = isRide(b.item.tag) ? b.item.responsible_person_id : null;
      if (driverA && driverA === driverB) {
        if (Math.abs(minutesOf(a.start!) - minutesOf(b.start!)) <= RIDE_WINDOW_MINUTES) {
          conflicts.push({ kind: "driver", personId: driverA, date: a.date, a, b });
          continue;
        }
      }

      // Rides describe the driver's movements, not the child's booking.
      if (isRide(a.item.tag) || isRide(b.item.tag)) continue;
      if (a.item.person_id && a.item.person_id === b.item.person_id) {
        const [s1, e1] = span(a);
        const [s2, e2] = span(b);
        if (s1 < e2 && s2 < e1) conflicts.push({ kind: "person", personId: a.item.person_id, date: a.date, a, b });
      }
    }
  }
  return conflicts;
}
