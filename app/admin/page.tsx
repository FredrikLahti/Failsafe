import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getHabitCategory } from "@/lib/habits";
import { computeStreak, currentWeekNumber, fillMissedWeeks } from "@/lib/streak";
import { experienceTypeLabel, formatBeneficiaries } from "@/lib/consequence";
import type { ChallengeRow, CheckinStatus } from "@/lib/types/database";

interface CheckinLite {
  challenge_id: string;
  week_number: number;
  status: CheckinStatus;
}

interface ChallengeWithProfile extends ChallengeRow {
  profiles: { email: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  completed_success: "Completed",
  completed_failure_paid: "Failed (paid)",
  completed_failure_unpaid: "Failed (unpaid)",
};

export default async function AdminPage() {
  const authed = await isAdminAuthed();
  if (!authed) redirect("/admin/login");

  const supabase = createServiceRoleClient();

  const { data: challenges } = await supabase
    .from("challenges")
    .select("*, profiles(email)")
    .order("created_at", { ascending: false })
    .returns<ChallengeWithProfile[]>();

  const { data: allCheckins } = await supabase
    .from("checkins")
    .select("challenge_id, week_number, status")
    .returns<CheckinLite[]>();

  const checkinsByChallenge = new Map<string, CheckinLite[]>();
  for (const checkin of allCheckins ?? []) {
    const list = checkinsByChallenge.get(checkin.challenge_id) ?? [];
    list.push(checkin);
    checkinsByChallenge.set(checkin.challenge_id, list);
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-sage/20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display text-lg">Failsafe Admin</span>
          <form action="/admin/logout" method="post">
            <button type="submit" className="text-sm text-parchment/70 hover:text-parchment">
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <h1 className="font-display text-2xl mb-6">
          All participants ({challenges?.length ?? 0})
        </h1>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-sage/30 text-ash">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Habit / goal</th>
                <th className="py-2 pr-4">Beneficiaries</th>
                <th className="py-2 pr-4">Experience</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Progress</th>
                <th className="py-2 pr-4">Streak</th>
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Share</th>
              </tr>
            </thead>
            <tbody>
              {(challenges ?? []).map((c) => {
                const checkins = checkinsByChallenge.get(c.id) ?? [];
                const week = currentWeekNumber(c.start_date);
                const weeks = fillMissedWeeks(checkins, week);
                const streak = computeStreak(weeks);
                const email = c.profiles?.email ?? "—";
                return (
                  <tr key={c.id} className="border-b border-sage/10">
                    <td className="py-2 pr-4">{email}</td>
                    <td className="py-2 pr-4">{getHabitCategory(c.category).label}</td>
                    <td className="py-2 pr-4">{c.habit_title}</td>
                    <td className="py-2 pr-4">{formatBeneficiaries(c.beneficiaries)}</td>
                    <td className="py-2 pr-4">
                      {experienceTypeLabel(c.experience_type)}
                      {c.estimated_cost_cents != null && (
                        <span className="text-ash"> (~${(c.estimated_cost_cents / 100).toFixed(0)})</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{STATUS_LABEL[c.status] ?? c.status}</td>
                    <td className="py-2 pr-4 font-mono">
                      {c.status === "active"
                        ? `wk ${week} of ${c.duration_weeks_min}-${c.duration_weeks_max}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono">{streak}</td>
                    <td className="py-2 pr-4">{c.start_date}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/share/${c.share_token}`} className="text-gold">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(challenges?.length ?? 0) === 0 && (
          <p className="text-ash mt-6">No challenges yet.</p>
        )}
      </main>
    </div>
  );
}
