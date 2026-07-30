"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStreak, nextReminderCadenceDays } from "@/lib/streak";
import type { CheckinStatus } from "@/lib/types/database";

export async function submitCheckin({
  challengeId,
  weekNumber,
  status,
  note,
}: {
  challengeId: string;
  weekNumber: number;
  status: CheckinStatus;
  note: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.from("checkins").insert({
    challenge_id: challengeId,
    week_number: weekNumber,
    status,
    note: note.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: checkins } = await supabase
    .from("checkins")
    .select("*")
    .eq("challenge_id", challengeId);

  const streak = computeStreak(checkins ?? []);

  await supabase
    .from("challenges")
    .update({ reminder_cadence_days: nextReminderCadenceDays(streak) })
    .eq("id", challengeId);

  redirect("/dashboard");
}
