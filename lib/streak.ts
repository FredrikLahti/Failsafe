import type { CheckinStatus } from "@/lib/types/database";

export interface WeekStatus {
  week_number: number;
  status: CheckinStatus;
}

export function currentWeekNumber(startDate: string, today: Date = new Date()): number {
  const start = new Date(startDate + "T00:00:00");
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/**
 * Weeks that have fully elapsed (1..currentWeek-1) but have no check-in row
 * are backfilled as "missed" so streak/badge math sees them without
 * requiring a real DB row for every silent week.
 */
export function fillMissedWeeks<T extends WeekStatus>(
  checkins: T[],
  currentWeek: number
): WeekStatus[] {
  const byWeek = new Map(checkins.map((c) => [c.week_number, c] as const));
  const filled: WeekStatus[] = [];
  for (let week = 1; week < currentWeek; week++) {
    const existing = byWeek.get(week);
    filled.push(existing ? { week_number: week, status: existing.status } : { week_number: week, status: "missed" });
  }
  const currentEntry = byWeek.get(currentWeek);
  if (currentEntry) {
    filled.push({ week_number: currentWeek, status: currentEntry.status });
  }
  return filled;
}

/**
 * Streak counts consecutive "good"/"partial" weeks working back from the
 * most recent check-in. A missed week is neutral: it doesn't add to the
 * streak but doesn't zero it out either. A "bad" week ends the streak.
 */
export function computeStreak(checkins: WeekStatus[]): number {
  const byWeekDesc = [...checkins].sort((a, b) => b.week_number - a.week_number);
  let streak = 0;
  for (const checkin of byWeekDesc) {
    if (checkin.status === "good" || checkin.status === "partial") {
      streak += 1;
    } else if (checkin.status === "missed") {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Number of missed check-ins immediately preceding the latest one, in a row. */
export function consecutiveMissedStreak(checkins: WeekStatus[]): number {
  const byWeekDesc = [...checkins].sort((a, b) => b.week_number - a.week_number);
  let missed = 0;
  for (const checkin of byWeekDesc) {
    if (checkin.status === "missed") {
      missed += 1;
    } else {
      break;
    }
  }
  return missed;
}

/**
 * Reminder cadence (in days) eases off the longer a streak holds, so
 * consistent users get nudged less often.
 */
export function nextReminderCadenceDays(streak: number): number {
  if (streak >= 8) return 21;
  if (streak >= 4) return 14;
  return 7;
}
