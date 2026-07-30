import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { LetterCard } from "@/components/LetterCard";
import { Button } from "@/components/ui";
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
  const variant = isActive ? "neutral" : isSuccess ? "gold" : "ember";
  const beneficiaryNames = formatBeneficiaries(share.beneficiaries);
  const experienceLabel = experienceTypeLabel(share.experience_type);

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
            Currently in week {currentWeekNumber(share.start_date)} of a{" "}
            {share.duration_weeks_min}-{share.duration_weeks_max} week plan. If
            this isn&rsquo;t kept, {beneficiaryNames} get treated to:{" "}
            {share.experience_description}. The person making this promise
            just won&rsquo;t be there for it.
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
            {share.outcome === "failed_paid"
              ? " It happened."
              : share.outcome === "failed_unpaid"
                ? " It hasn't happened yet."
                : ""}
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
