/**
 * Total pause days allowed across a single challenge's lifetime. Once
 * `paused_days_total` reaches this, "Pause this challenge" is disabled —
 * see components/PauseChallengeButton.tsx and app/dashboard/actions.ts.
 * A single pause is not itself capped at this length; the cap only blocks
 * *starting another* pause once the cumulative total (from completed
 * pauses) has reached it.
 */
export const MAX_TOTAL_PAUSE_DAYS = 14;

export interface PauseState {
  paused_at: string | null;
  paused_days_total: number;
}

/**
 * Total paused days as of `asOf`, including any pause currently in
 * progress. This is the number subtracted from elapsed calendar time
 * everywhere the "active time" clock matters — week numbering
 * (lib/streak.ts) and the automatic end-of-challenge check
 * (lib/challenge-lifecycle.ts) — so pausing freezes both rather than
 * costing a week or shortening the challenge.
 */
export function totalPausedDaysAsOf(challenge: PauseState, asOf: Date = new Date()): number {
  if (!challenge.paused_at) return challenge.paused_days_total;
  const pauseStart = new Date(challenge.paused_at);
  const ongoingDays = Math.max(0, Math.ceil((asOf.getTime() - pauseStart.getTime()) / 86_400_000));
  return challenge.paused_days_total + ongoingDays;
}

/** Whether a new pause can be started — only completed pause days count against the cap. */
export function canStartPause(challenge: { status: string; paused_days_total: number }): boolean {
  return challenge.status === "active" && challenge.paused_days_total < MAX_TOTAL_PAUSE_DAYS;
}

/**
 * "Effective" duration_weeks_max for display purposes — the original
 * contract plus whole weeks' worth of pause time (rounded up), so
 * "Week N of X-Y" reflects the extension. The exact-day figure
 * (`pausedDays`) remains the source of truth for the actual evaluation
 * deadline; this is only for the rounded, human-facing range.
 */
export function effectiveDurationWeeksMax(durationWeeksMax: number, pausedDays: number): number {
  return durationWeeksMax + Math.ceil(pausedDays / 7);
}
