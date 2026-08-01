"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { releaseStake, captureStake } from "@/lib/payments/stake";
import type { ChallengeStatus, SelectableReportOutcome } from "@/lib/types/database";

const STATUS_BY_OUTCOME: Record<SelectableReportOutcome, ChallengeStatus> = {
  completed: "completed_success",
  failed_paid: "completed_failure_paid",
};

export async function submitFinalReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const challengeId = String(formData.get("challengeId"));
  const outcome = String(formData.get("outcome")) as SelectableReportOutcome;
  const whatHappened = String(formData.get("whatHappened") || "");
  const photo = formData.get("photo");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("beneficiaries, experience_type")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .single();

  if (!challenge) {
    throw new Error("Challenge not found");
  }

  let photoUrl: string | null = null;

  // Self-photos are only collected on success — a failure's Memory Lane
  // photo comes from the beneficiary after the gift card is delivered.
  if (outcome === "completed" && photo instanceof File && photo.size > 0) {
    const path = `${user.id}/${challengeId}-${Date.now()}-${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("challenge-photos")
      .upload(path, photo, { contentType: photo.type });

    if (!uploadError) {
      const { data } = supabase.storage.from("challenge-photos").getPublicUrl(path);
      photoUrl = data.publicUrl;
    }
  }

  const { error: reportError } = await supabase.from("final_reports").insert({
    challenge_id: challengeId,
    outcome,
    photo_url: photoUrl,
    photo_type: photoUrl ? "self" : null,
    what_happened: whatHappened.trim() || null,
  });

  if (reportError) {
    throw new Error(reportError.message);
  }

  const { error: updateError } = await supabase
    .from("challenges")
    .update({
      status: STATUS_BY_OUTCOME[outcome],
      completed_at: new Date().toISOString(),
    })
    .eq("id", challengeId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (outcome === "completed") {
    await releaseStake(challengeId);
  } else {
    await captureStake(challengeId, {
      beneficiaries: challenge.beneficiaries,
      experienceType: challenge.experience_type,
    });
  }

  redirect(`/report/result/${challengeId}`);
}
