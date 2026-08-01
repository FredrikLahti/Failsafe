import type { WeekStatus } from "@/lib/streak";

/**
 * Threshold constants for calculateChallengeOutcome below. Adjust these to
 * change what counts as passing — nothing else needs to change.
 */
/** Fails once more than this many non-paused weeks are "bad" or "missed" in total. */
export const MAX_BAD_OR_MISSED_WEEKS = 2;
/** Fails once this many "bad"/"missed" weeks happen back to back (1 = two in a row fails). */
export const MAX_CONSECUTIVE_BAD_OR_MISSED_WEEKS = 1;

export type CalculatedOutcome = "completed" | "failed";

/**
 * The single source of truth for pass/fail, calculated from the challenge's
 * full week-by-week check-in history — never a user choice. Paused weeks
 * never appear in `weeks` in the first place (see lib/pause.ts,
 * currentWeekNumber in lib/streak.ts), so there's nothing to filter out
 * here: every entry is a week that genuinely came due.
 *
 * Rule: completed unless either
 *   (a) more than MAX_BAD_OR_MISSED_WEEKS weeks were "bad" or "missed" total, or
 *   (b) MAX_CONSECUTIVE_BAD_OR_MISSED_WEEKS+1 or more of those happened in a row.
 */
export function calculateChallengeOutcome(weeks: WeekStatus[]): CalculatedOutcome {
  const badOrMissedCount = weeks.filter((w) => w.status === "bad" || w.status === "missed").length;
  if (badOrMissedCount > MAX_BAD_OR_MISSED_WEEKS) return "failed";

  let consecutive = 0;
  for (const week of [...weeks].sort((a, b) => a.week_number - b.week_number)) {
    if (week.status === "bad" || week.status === "missed") {
      consecutive += 1;
      if (consecutive > MAX_CONSECUTIVE_BAD_OR_MISSED_WEEKS) return "failed";
    } else {
      consecutive = 0;
    }
  }

  return "completed";
}
