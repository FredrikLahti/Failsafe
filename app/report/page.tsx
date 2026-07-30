import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { FinalReportForm } from "@/components/FinalReportForm";

export default async function ReportPage() {
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

  return (
    <div className="flex-1 flex flex-col">
      <AppNav email={user.email} />
      <main className="flex-1 max-w-lg w-full mx-auto px-6 py-12">
        <h1 className="font-display text-2xl sm:text-3xl mb-2">Final report</h1>
        <p className="text-parchment/70 mb-8">
          Be honest with yourself here — this is the whole point of the exercise.
        </p>
        <FinalReportForm challengeId={challenge.id} />
      </main>
    </div>
  );
}
