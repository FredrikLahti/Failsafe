import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui";
import { getHabitCategory } from "@/lib/habits";
import { computeStreak, consecutiveMissedStreak, currentWeekNumber, fillMissedWeeks } from "@/lib/streak";
import { computeBadges } from "@/lib/badges";
import { AddToHomeScreenPrompt } from "@/components/AddToHomeScreenPrompt";
import type { ChallengeRow } from "@/lib/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: challenges } = await supabase
    .from("challenges")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const active = challenges?.find((c) => c.status === "active") ?? null;
  const past = (challenges ?? []).filter((c) => c.status !== "active");

  return (
    <div className="flex-1 flex flex-col">
      <AppNav email={user.email} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <AddToHomeScreenPrompt />
        {active ? (
          <ActiveChallengePanel challenge={active} />
        ) : (
          <EmptyState />
        )}

        {past.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">Past challenges</h2>
              <Link href="/dashboard/memory-lane" className="text-sm text-gold">
                Memory Lane
              </Link>
            </div>
            <div className="space-y-3">
              {past.map((c) => (
                <PastChallengeRow key={c.id} challenge={c} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

async function ActiveChallengePanel({ challenge }: { challenge: ChallengeRow }) {
  const supabase = await createClient();
  const { data: checkins } = await supabase
    .from("checkins")
    .select("*")
    .eq("challenge_id", challenge.id)
    .order("week_number", { ascending: true });

  const category = getHabitCategory(challenge.category);
  const week = currentWeekNumber(challenge.start_date);
  const weeks = fillMissedWeeks(checkins ?? [], week);
  const streak = computeStreak(weeks);
  const missedInARow = consecutiveMissedStreak(weeks);
  const badges = computeBadges(weeks, challenge.duration_weeks_min);
  const alreadyCheckedInThisWeek = (checkins ?? []).some((c) => c.week_number === week);
  const progressPct = Math.min(
    100,
    Math.round((week / challenge.duration_weeks_min) * 100)
  );

  return (
    <section>
      <p className="text-xs uppercase tracking-wide text-ash mb-1">{category.label}</p>
      <h1 className="font-display text-3xl mb-6">{challenge.habit_title}</h1>

      {missedInARow >= 2 && (
        <div className="mb-6 rounded-md border border-gold/50 bg-gold/10 px-4 py-3 text-sm">
          It&rsquo;s been two weeks since your last check-in. No judgment — just
          pick back up when you can. Even a short note helps you see the shape
          of the week.
        </div>
      )}
      {missedInARow === 1 && (
        <div className="mb-6 rounded-md border border-sage/40 bg-sage/10 px-4 py-3 text-sm text-parchment/80">
          You missed last week&rsquo;s check-in. That happens — just pick it back up this week.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatTile label="Streak" value={`${streak}`} suffix="weeks" />
        <StatTile label="Week" value={`${week}`} suffix={`of ${challenge.duration_weeks_min}-${challenge.duration_weeks_max}`} />
        <StatTile label="Frequency" value={challenge.frequency} mono={false} />
      </div>

      <div className="mb-8">
        <div className="flex justify-between text-xs text-ash mb-1.5 font-mono">
          <span>Progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-sage/20 overflow-hidden">
          <div
            className="h-full bg-gold transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        {alreadyCheckedInThisWeek ? (
          <p className="text-sm text-sage self-center">You&rsquo;ve checked in for week {week}. Nice.</p>
        ) : (
          <Link href="/checkin">
            <Button>Check in for week {week}</Button>
          </Link>
        )}
        <Link href="/report">
          <Button variant="ghost">Finish this challenge</Button>
        </Link>
      </div>

      <div>
        <h2 className="font-display text-xl mb-3">Milestones</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`rounded-md border px-3 py-3 text-center ${
                b.earned ? "border-gold/50 bg-gold/10" : "border-sage/20 opacity-40"
              }`}
              title={b.description}
            >
              <p className="text-sm font-medium">{b.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-sage/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-ash mb-1">{label}</p>
      <p className="font-mono text-2xl">{value}</p>
      {suffix && <p className="text-xs text-ash mt-0.5">{suffix}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <h1 className="font-display text-2xl mb-3">No active challenge yet</h1>
      <p className="text-parchment/70 mb-6">Start one — pick a habit and a consequence.</p>
      <Link href="/onboarding">
        <Button>Start a challenge</Button>
      </Link>
    </div>
  );
}

function PastChallengeRow({ challenge }: { challenge: ChallengeRow }) {
  const statusLabel: Record<string, string> = {
    completed_success: "Completed",
    completed_failure_paid: "Failed — consequence paid",
    // Reached only via a declined capture (e.g. card decline), never a user choice.
    completed_failure_unpaid: "Failed — payment couldn't be processed",
  };
  return (
    <div className="flex items-center justify-between rounded-md border border-sage/20 px-4 py-3">
      <div>
        <p className="font-medium">{challenge.habit_title}</p>
        <p className="text-xs text-ash">{statusLabel[challenge.status] ?? challenge.status}</p>
      </div>
      <Link href={`/share/${challenge.share_token}`} className="text-sm text-gold">
        View result
      </Link>
    </div>
  );
}
