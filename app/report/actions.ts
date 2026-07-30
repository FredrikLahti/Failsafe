"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ChallengeStatus, ReportOutcome } from "@/lib/types/database";

const STATUS_BY_OUTCOME: Record<ReportOutcome, ChallengeStatus> = {
  completed: "completed_success",
  failed_paid: "completed_failure_paid",
  failed_unpaid: "completed_failure_unpaid",
};

export async function submitFinalReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const challengeId = String(formData.get("challengeId"));
  const outcome = String(formData.get("outcome")) as ReportOutcome;
  const whatHappened = String(formData.get("whatHappened") || "");
  const wouldBindingPaymentHelp = formData.get("wouldBindingPaymentHelp") === "yes";
  const wouldPayForAutomated = formData.get("wouldPayForAutomated") === "yes";
  const photo = formData.get("photo");

  let photoUrl: string | null = null;

  if (photo instanceof File && photo.size > 0) {
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
    what_happened: whatHappened.trim() || null,
    would_binding_payment_help: wouldBindingPaymentHelp,
    would_pay_for_automated: wouldPayForAutomated,
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

  redirect(`/report/result/${challengeId}`);
}
