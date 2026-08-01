"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

export interface UploadBeneficiaryPhotoResult {
  ok: boolean;
  error?: string;
}

/**
 * Lets a beneficiary attach a Memory Lane photo without signing in, scoped
 * strictly to their own challenge's share_token. Uses the service-role
 * client (bypasses RLS the same way the admin dashboard does) so no anon
 * write policy is needed on final_reports/storage — the validation below
 * (status + "only once") is the actual gate.
 */
export async function uploadBeneficiaryPhoto(
  shareToken: string,
  formData: FormData
): Promise<UploadBeneficiaryPhotoResult> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, error: "Choose a photo first." };
  }

  const supabase = createServiceRoleClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, status")
    .eq("share_token", shareToken)
    .single();

  if (!challenge || challenge.status !== "completed_failure_paid") {
    return { ok: false, error: "This challenge isn't ready for a Memory Lane photo." };
  }

  const { data: report } = await supabase
    .from("final_reports")
    .select("id, photo_url")
    .eq("challenge_id", challenge.id)
    .single();

  if (!report) {
    return { ok: false, error: "No final report found for this challenge." };
  }
  if (report.photo_url) {
    return { ok: false, error: "A photo has already been added for this challenge." };
  }

  const path = `${challenge.id}/beneficiary-${Date.now()}-${photo.name}`;
  const { error: uploadError } = await supabase.storage
    .from("challenge-photos")
    .upload(path, photo, { contentType: photo.type });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: publicUrl } = supabase.storage.from("challenge-photos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("final_reports")
    .update({ photo_url: publicUrl.publicUrl, photo_type: "beneficiary" })
    .eq("id", report.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}
