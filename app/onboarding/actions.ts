"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHabitCategory, DIFFICULTY_RANGES } from "@/lib/habits";
import { parseBeneficiaries } from "@/lib/consequence";
import { hasActiveSubscription, reserveStake } from "@/lib/payments/stake";
import type { ExperienceType, HabitCategory } from "@/lib/types/database";

export interface CreateChallengeInput {
  category: HabitCategory;
  habitTitle: string;
  frequency: string;
  cueSituation: string;
  cueAction: string;
  beneficiaries: string;
  beneficiaryEmail: string;
  experienceType: ExperienceType;
  experienceDescription: string;
  stakeAmountCents: number;
}

export async function createChallenge(input: CreateChallengeInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!(await hasActiveSubscription(user.id))) {
    throw new Error("An active subscription is required to start a challenge.");
  }

  const definition = getHabitCategory(input.category);
  const range = DIFFICULTY_RANGES[definition.difficulty];

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      user_id: user.id,
      category: input.category,
      difficulty_tier: definition.difficulty,
      habit_title: input.habitTitle.trim(),
      frequency: input.frequency.trim(),
      duration_weeks_min: range.min,
      duration_weeks_max: range.max,
      cue_situation: input.cueSituation.trim(),
      cue_action: input.cueAction.trim(),
      beneficiaries: parseBeneficiaries(input.beneficiaries),
      beneficiary_email: input.beneficiaryEmail.trim() || null,
      experience_type: input.experienceType,
      experience_description: input.experienceDescription.trim(),
      stake_amount_cents: input.stakeAmountCents,
    })
    .select()
    .single();

  if (error || !challenge) {
    throw new Error(error?.message ?? "Could not create challenge");
  }

  const stake = await reserveStake(challenge.id, user.id, input.stakeAmountCents);
  if (!stake.ok) {
    await supabase.from("challenges").delete().eq("id", challenge.id);
    throw new Error(stake.reason);
  }

  redirect(`/onboarding/invite/${challenge.id}`);
}
