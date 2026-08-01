import type { CheckinStatus } from "@/lib/types/database";

export interface WeekStatus {
  week_number: number;
  status: CheckinStatus;
}

/**
 * Which week of ACTIVE time `today` falls in. `pausedDays` (see
 * lib/pause.ts's totalPausedDaysAsOf) is subtracted from elapsed calendar
 * days first, so the week number freezes for the duration of a pause
 * instead of ticking forward — pausing costs no week and skips nothing.
 */
export function currentWeekNumber(startDate: string, pausedDays = 0, today: Date = new Date()): number {
  const start = new Date(startDate + "T00:00:00");
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000) - pausedDays;
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/**
 * Weeks that have fully elapsed (1..currentWeek-1) but have no check-in row
 * are backfilled as "missed" so streak/badge math sees them without
 * requiring a real DB row for every silent week. `currentWeek` itself is
 * only included if a real check-in exists for it — it's still in progress,
 * so no missed-week judgment is made yet.
 *
 * Pass `includeCurrentIfMissing: true` when `currentWeek` is actually the
 * challenge's final week and the evaluation deadline has already passed
 * (see lib/challenge-lifecycle.ts) — there, a missing final check-in is a
 * real miss, not a week still in progress.
 */
export function fillMissedWeeks<T extends WeekStatus>(
  checkins: T[],
  currentWeek: number,
  options: { includeCurrentIfMissing?: boolean } = {}
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
  } else if (options.includeCurrentIfMissing) {
    filled.push({ week_number: currentWeek, status: "missed" });
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
