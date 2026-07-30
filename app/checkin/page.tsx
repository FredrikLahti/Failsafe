import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { currentWeekNumber } from "@/lib/streak";
import { CheckinForm } from "@/components/CheckinForm";

export default async function CheckinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) redirect("/dashboard");

  const week = currentWeekNumber(challenge.start_date);

  const { data: existing } = await supabase
    .from("checkins")
    .select("id")
    .eq("challenge_id", challenge.id)
    .eq("week_number", week)
    .maybeSingle();

  if (existing) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col">
      <AppNav email={user.email} />
      <main className="flex-1 max-w-lg w-full mx-auto px-6 py-12">
        <h1 className="font-display text-2xl sm:text-3xl mb-2">Week {week} check-in</h1>
        <p className="text-parchment/70 mb-8">{challenge.habit_title}</p>
        <CheckinForm challengeId={challenge.id} weekNumber={week} />
      </main>
    </div>
  );
}
