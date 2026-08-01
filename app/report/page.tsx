import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { ChallengeSummaryForm } from "@/components/ChallengeSummaryForm";
import { formatBeneficiaries } from "@/lib/consequence";
import { fillMissedWeeks } from "@/lib/streak";
import { finalizeChallengeIfDue } from "@/lib/challenge-lifecycle";
import type { ReportOutcome } from "@/lib/types/database";

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Safety net: finalize an active challenge that's past due even if the
  // dashboard hasn't been visited since the deadline passed.
  const { data: activeChallenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeChallenge) {
    await finalizeChallengeIfDue(supabase, activeChallenge);
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["completed_success", "completed_failure_paid", "completed_failure_unpaid"])
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) redirect("/dashboard");

  const { data: report } = await supabase
    .from("final_reports")
    .select("*")
    .eq("challenge_id", challenge.id)
    .single();

  // Already has its detail filled in — nothing left to do here.
  if (report?.what_happened || report?.photo_url) {
    redirect(`/report/result/${challenge.id}`);
  }

  const { data: checkins } = await supabase
    .from("checkins")
    .select("week_number, status, note")
    .eq("challenge_id", challenge.id)
    .order("week_number", { ascending: true });

  const weeks = fillMissedWeeks(checkins ?? [], challenge.duration_weeks_max, {
    includeCurrentIfMissing: true,
  });

  const outcome: Extract<ReportOutcome, "completed" | "failed_paid"> =
    challenge.status === "completed_success" ? "completed" : "failed_paid";

  return (
    <div className="flex-1 flex flex-col">
      <AppNav email={user.email} />
      <main className="flex-1 max-w-lg w-full mx-auto px-6 py-12">
        <h1 className="font-display text-2xl sm:text-3xl mb-2">Challenge summary</h1>
        <p className="text-parchment/70 mb-8">
          Here&rsquo;s how it went, calculated from your weekly check-ins.
        </p>
        <ChallengeSummaryForm
          challengeId={challenge.id}
          habitTitle={challenge.habit_title}
          beneficiaryNames={formatBeneficiaries(challenge.beneficiaries)}
          outcome={outcome}
          weeks={weeks}
          notesByWeek={Object.fromEntries((checkins ?? []).map((c) => [c.week_number, c.note]))}
        />
      </main>
    </div>
  );
}
