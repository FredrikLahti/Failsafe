import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { LetterCard } from "@/components/LetterCard";
import { Button } from "@/components/ui";
import { BeneficiaryPhotoUpload } from "@/components/BeneficiaryPhotoUpload";
import { getHabitCategory } from "@/lib/habits";
import { currentWeekNumber } from "@/lib/streak";
import { experienceTypeLabel, formatBeneficiaries } from "@/lib/consequence";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: share } = await supabase
    .from("challenge_shares")
    .select("*")
    .eq("share_token", token)
    .single();

  if (!share) notFound();

  const category = getHabitCategory(share.category);
  const isActive = share.status === "active";
  const isSuccess = share.status === "completed_success";
  const isFailure = !isActive && !isSuccess;
  const variant = isActive ? "neutral" : isSuccess ? "gold" : "ember";
  const beneficiaryNames = formatBeneficiaries(share.beneficiaries);
  const experienceLabel = experienceTypeLabel(share.experience_type);

  const { data: deliveries } = isFailure
    ? await supabase
        .from("gift_card_delivery_shares")
        .select("*")
        .eq("challenge_id", share.id)
    : { data: null };

  const delivered = (deliveries ?? []).length > 0;

  return (
    <div className="flex-1 flex flex-col px-6 py-14">
      <LetterCard
        variant={variant}
        eyebrow={category.label}
        title={
          isActive
            ? `${experienceLabel} on the line, for ${beneficiaryNames}`
            : isSuccess
              ? "A promise kept"
              : `A promise made to ${beneficiaryNames}`
        }
      >
        <p className="mb-4">
          The commitment: <strong>{share.habit_title}</strong> ({share.frequency}).
        </p>
        {isActive ? (
          <p className="mb-4">
            I&rsquo;m {currentWeekNumber(share.start_date)} weeks into an{" "}
            {share.duration_weeks_min}-{share.duration_weeks_max} week
            challenge. If I don&rsquo;t pull it off, {beneficiaryNames} get{" "}
            {share.experience_description}. I&rsquo;m just not allowed to be
            there for it.
          </p>
        ) : isSuccess ? (
          <p className="mb-4">
            The habit was kept for the full commitment. {beneficiaryNames}{" "}
            never had to be treated.
          </p>
        ) : (
          <p className="mb-4">
            The habit wasn&rsquo;t kept this time. {beneficiaryNames} were
            treated to: {share.experience_description}.
            {delivered ? " It happened." : " It's on its way."}
          </p>
        )}
        {share.photo_url && (
          <div className="mt-6">
            <Image
              src={share.photo_url}
              alt="Photo shared with this challenge's result"
              width={640}
              height={480}
              className="w-full h-auto rounded"
              unoptimized
            />
          </div>
        )}
      </LetterCard>

      {isFailure && delivered && (
        <div className="max-w-xl mx-auto mt-8 text-center">
          <p className="text-sm text-parchment/80 mb-3">Your gift card{deliveries!.length > 1 ? "s" : ""}:</p>
          <div className="flex flex-col gap-2 mb-6">
            {deliveries!.map((d, i) => (
              <div key={i}>
                <a
                  href={d.claim_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold underline text-sm"
                >
                  Claim {d.beneficiary_name}&rsquo;s gift card
                </a>
                {d.expires_at && (
                  <p className="text-xs text-parchment/50 mt-0.5">
                    Claim by {formatExpiryDate(d.expires_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {!share.photo_url && (
            <>
              <p className="text-parchment/70 mb-4 text-sm">
                Please immortalize this
                {share.owner_display_name ? ` for ${share.owner_display_name}` : ""}, take lots
                of photos, and upload one through this link for their Memory Lane.
              </p>
              <BeneficiaryPhotoUpload shareToken={token} />
            </>
          )}
        </div>
      )}

      <div className="max-w-xl mx-auto mt-10 text-center">
        <p className="text-parchment/70 mb-4">
          Want to make the same kind of promise for someone you care about?
        </p>
        <Link href="/sign-up">
          <Button>Start your own challenge for someone you care about</Button>
        </Link>
      </div>
    </div>
  );
}

function formatExpiryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
