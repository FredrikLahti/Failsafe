"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHabitCategory, DIFFICULTY_RANGES } from "@/lib/habits";
import type { HabitCategory } from "@/lib/types/database";

export interface CreateChallengeInput {
  category: HabitCategory;
  habitTitle: string;
  frequency: string;
  cueSituation: string;
  cueAction: string;
  consequenceDescription: string;
  recipientName: string;
}

export async function createChallenge(input: CreateChallengeInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
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
      consequence_description: input.consequenceDescription.trim(),
      recipient_name: input.recipientName.trim(),
    })
    .select()
    .single();

  if (error || !challenge) {
    throw new Error(error?.message ?? "Could not create challenge");
  }

  await supabase.from("recipients").insert({
    challenge_id: challenge.id,
    name: input.recipientName.trim(),
  });

  redirect(`/onboarding/invite/${challenge.id}`);
}
