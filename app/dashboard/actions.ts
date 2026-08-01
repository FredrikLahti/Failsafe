"use server";

import { createClient } from "@/lib/supabase/server";
import { MAX_TOTAL_PAUSE_DAYS } from "@/lib/pause";

export async function pauseChallenge(challengeId: string, reason: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, status, paused_days_total")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .single();

  if (!challenge) throw new Error("Challenge not found.");
  if (challenge.status !== "active") {
    throw new Error("This challenge can't be paused right now.");
  }
  if (challenge.paused_days_total >= MAX_TOTAL_PAUSE_DAYS) {
    throw new Error("You've used your full pause allowance for this challenge.");
  }

  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("challenge_pauses").insert({
    challenge_id: challengeId,
    started_at: now,
    reason: reason.trim() || null,
  });
  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from("challenges")
    .update({ status: "paused", paused_at: now })
    .eq("id", challengeId);
  if (updateError) throw new Error(updateError.message);
}

export async function resumeChallenge(challengeId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, status, paused_at, paused_days_total")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .single();

  if (!challenge) throw new Error("Challenge not found.");
  if (challenge.status !== "paused" || !challenge.paused_at) {
    throw new Error("This challenge isn't paused.");
  }

  const now = new Date();
  const pauseStart = new Date(challenge.paused_at);
  const daysPaused = Math.max(0, Math.ceil((now.getTime() - pauseStart.getTime()) / 86_400_000));

  const { data: openPause } = await supabase
    .from("challenge_pauses")
    .select("id")
    .eq("challenge_id", challengeId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openPause) {
    const { error } = await supabase
      .from("challenge_pauses")
      .update({ ended_at: now.toISOString() })
      .eq("id", openPause.id);
    if (error) throw new Error(error.message);
  }

  const { error: updateError } = await supabase
    .from("challenges")
    .update({
      status: "active",
      paused_at: null,
      paused_days_total: challenge.paused_days_total + daysPaused,
    })
    .eq("id", challengeId);
  if (updateError) throw new Error(updateError.message);
}
