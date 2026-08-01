import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { getHabitCategory, memoryLaneTitle } from "@/lib/habits";
import type { ChallengeRow, FinalReportRow } from "@/lib/types/database";

interface ChallengeWithReport extends ChallengeRow {
  final_reports: FinalReportRow[] | null;
}

function weeksElapsed(startDate: string, completedAt: string | null): number {
  if (!completedAt) return 0;
  const ms = new Date(completedAt).getTime() - new Date(startDate).getTime();
  return Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
}

export default async function MemoryLanePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: challenges } = await supabase
    .from("challenges")
    .select("*, final_reports(*)")
    .eq("user_id", user.id)
    .neq("status", "active")
    .order("completed_at", { ascending: false })
    .returns<ChallengeWithReport[]>();

  const cards = (challenges ?? [])
    .map((c) => ({ challenge: c, report: c.final_reports?.[0] ?? null }))
    .filter((entry): entry is { challenge: ChallengeWithReport; report: FinalReportRow } =>
      Boolean(entry.report?.photo_url)
    );

  return (
    <div className="flex-1 flex flex-col">
      <AppNav email={user.email} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl">Memory Lane</h1>
          <Link href="/dashboard" className="text-sm text-gold">
            Back to dashboard
          </Link>
        </div>

        {cards.length === 0 ? (
          <p className="text-parchment/70">
            Nothing here yet — completed challenges with a photo will show up as framed cards.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {cards.map(({ challenge, report }) => {
              const category = getHabitCategory(challenge.category);
              const isSuccess = challenge.status === "completed_success";
              const weeks = weeksElapsed(challenge.start_date, challenge.completed_at);
              const title = memoryLaneTitle(category, weeks, isSuccess);
              const frameClass = isSuccess
                ? "border-gold/60 shadow-[0_10px_40px_-10px_rgba(212,175,55,0.4)]"
                : "border-ember/60 shadow-[0_10px_40px_-10px_rgba(196,90,58,0.4)]";

              return (
                <div
                  key={challenge.id}
                  className={`deckle-edge bg-parchment text-ink border ${frameClass} p-4`}
                >
                  <div className="relative w-full aspect-[4/3] mb-3 overflow-hidden rounded">
                    <Image
                      src={report.photo_url!}
                      alt={title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <p className="font-display text-sm leading-snug mb-1">{title}</p>
                  <p className="text-xs text-ash">
                    {category.label} · {weeks} weeks
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
