"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The outcome itself is no longer decided here — it's already been written
 * by finalizeChallengeIfDue (lib/challenge-lifecycle.ts) by the time the
 * user reaches this form. This only saves the optional photo and
 * "what happened" notes onto the existing final_reports row.
 */
export async function submitReportDetails(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const challengeId = String(formData.get("challengeId"));
  const whatHappened = String(formData.get("whatHappened") || "");
  const photo = formData.get("photo");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("status")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .single();

  if (!challenge) {
    throw new Error("Challenge not found");
  }

  let photoUrl: string | null = null;

  // Self-photos are only collected on success — a failure's Memory Lane
  // photo comes from the beneficiary after the gift card is delivered.
  if (challenge.status === "completed_success" && photo instanceof File && photo.size > 0) {
    const path = `${user.id}/${challengeId}-${Date.now()}-${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("challenge-photos")
      .upload(path, photo, { contentType: photo.type });

    if (!uploadError) {
      const { data } = supabase.storage.from("challenge-photos").getPublicUrl(path);
      photoUrl = data.publicUrl;
    }
  }

  const { error } = await supabase
    .from("final_reports")
    .update({
      what_happened: whatHappened.trim() || null,
      photo_url: photoUrl,
      photo_type: photoUrl ? "self" : null,
    })
    .eq("challenge_id", challengeId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/report/result/${challengeId}`);
}
