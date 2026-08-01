import type { createClient } from "@/lib/supabase/server";
import { fillMissedWeeks } from "@/lib/streak";
import { totalPausedDaysAsOf } from "@/lib/pause";
import { calculateChallengeOutcome } from "@/lib/outcome";
import { releaseStake, captureStake } from "@/lib/payments/stake";
import type { ChallengeRow, ChallengeStatus, ReportOutcome } from "@/lib/types/database";

type SupabaseSessionClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Checks whether an active challenge's scheduled active period — its
 * duration in weeks, extended day-for-day by any pauses (lib/pause.ts) —
 * has fully elapsed, and if so calculates the outcome from its check-in
 * history and finalizes it: writes final_reports, flips challenges.status,
 * and triggers the stake release/capture. This is now the ONLY place the
 * pass/fail determination and the Stripe capture-on-failure trigger happen —
 * there is no more user-submitted outcome (see app/report).
 *
 * There's no cron in this app, so this runs lazily: called at the top of
 * whichever page (dashboard, checkin, report) the user visits first after
 * the deadline passes. Idempotent — a no-op once the challenge is no longer
 * 'active' (a 'paused' challenge's clock is frozen, so it can never be due),
 * so calling it repeatedly on every page load is safe.
 *
 * Returns true if it just finalized the challenge (callers should refetch).
 */
export async function finalizeChallengeIfDue(
  supabase: SupabaseSessionClient,
  challenge: ChallengeRow
): Promise<boolean> {
  if (challenge.status !== "active") return false;

  const pausedDays = totalPausedDaysAsOf(challenge);
  const start = new Date(challenge.start_date + "T00:00:00");
  const activeElapsedDays = Math.floor((Date.now() - start.getTime()) / 86_400_000) - pausedDays;
  const isDue = activeElapsedDays >= challenge.duration_weeks_max * 7;
  if (!isDue) return false;

  const { data: checkins } = await supabase
    .from("checkins")
    .select("week_number, status")
    .eq("challenge_id", challenge.id);

  // The fixed roster of weeks the challenge actually required — not
  // whatever currentWeekNumber() says "now" (that could be several weeks
  // past duration_weeks_max if nobody visited the app in the meantime).
  const weeks = fillMissedWeeks(checkins ?? [], challenge.duration_weeks_max, {
    includeCurrentIfMissing: true,
  });

  const outcome = calculateChallengeOutcome(weeks);
  const reportOutcome: ReportOutcome = outcome === "completed" ? "completed" : "failed_paid";
  const newStatus: ChallengeStatus =
    outcome === "completed" ? "completed_success" : "completed_failure_paid";

  const { error: reportError } = await supabase.from("final_reports").insert({
    challenge_id: challenge.id,
    outcome: reportOutcome,
  });
  if (reportError) {
    console.error(`[outcome] failed to write final_reports for challenge ${challenge.id}:`, reportError.message);
    return false;
  }

  const { error: updateError } = await supabase
    .from("challenges")
    .update({ status: newStatus, completed_at: new Date().toISOString() })
    .eq("id", challenge.id);
  if (updateError) {
    console.error(`[outcome] failed to update challenge ${challenge.id} status:`, updateError.message);
    return false;
  }

  if (outcome === "completed") {
    await releaseStake(challenge.id);
  } else {
    await captureStake(challenge.id, {
      beneficiaries: challenge.beneficiaries,
      experienceType: challenge.experience_type,
      beneficiaryEmail: challenge.beneficiary_email,
    });
  }

  return true;
}
