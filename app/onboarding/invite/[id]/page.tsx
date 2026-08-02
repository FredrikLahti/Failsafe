import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getHabitCategory } from "@/lib/habits";
import { formatBeneficiaries, formatStakeAmount } from "@/lib/consequence";
import { LetterCard } from "@/components/LetterCard";
import { Button } from "@/components/ui";
import { AppNav } from "@/components/AppNav";
import { CopyInviteButton } from "@/components/CopyInviteButton";
import { ShareInviteButton } from "@/components/ShareInviteButton";
import { AddToHomeScreenPrompt } from "@/components/AddToHomeScreenPrompt";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!challenge) notFound();

  const category = getHabitCategory(challenge.category);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const shareUrl = `${siteUrl}/share/${challenge.share_token}`;
  const beneficiaryNames = formatBeneficiaries(challenge.beneficiaries);

  const message = buildInviteMessage({
    beneficiaryNames,
    habitTitle: challenge.habit_title,
    frequency: challenge.frequency,
    durationWeeksMin: challenge.duration_weeks_min,
    durationWeeksMax: challenge.duration_weeks_max,
    experienceDescription: challenge.experience_description,
    stakeAmountCents: challenge.stake_amount_cents,
    shareUrl,
  });

  return (
    <div className="flex-1 flex flex-col">
      <AppNav email={user.email} />
      <div className="flex-1 px-6 py-14">
        <div className="max-w-xl mx-auto mb-8 text-center">
          <p className="text-sm text-parchment/70">
            {`Your challenge is set. Now send this to ${beneficiaryNames} yourself. Kinwin won’t reach out to them for you.`}
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <AddToHomeScreenPrompt />
        </div>

        <LetterCard variant="neutral" eyebrow="A Promise, Sealed" title={`For ${beneficiaryNames}`}>
          <p className="whitespace-pre-line leading-relaxed">{message}</p>
        </LetterCard>

        <div className="max-w-xl mx-auto mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <CopyInviteButton text={message} />
          <ShareInviteButton text={message} title="Kinwin challenge invite" />
          <Link href="/dashboard">
            <Button variant="secondary" className="w-full sm:w-auto">
              Go to my dashboard
            </Button>
          </Link>
        </div>

        <p className="max-w-xl mx-auto mt-6 text-center text-xs text-ash">
          {category.label} · share link: {shareUrl}
        </p>
      </div>
    </div>
  );
}

function buildInviteMessage({
  beneficiaryNames,
  habitTitle,
  frequency,
  durationWeeksMin,
  durationWeeksMax,
  experienceDescription,
  stakeAmountCents,
  shareUrl,
}: {
  beneficiaryNames: string;
  habitTitle: string;
  frequency: string;
  durationWeeksMin: number;
  durationWeeksMax: number;
  experienceDescription: string;
  stakeAmountCents: number | null;
  shareUrl: string;
}) {
  const stakeClause =
    stakeAmountCents != null ? `, worth ${formatStakeAmount(stakeAmountCents)}` : "";

  return `Hey ${beneficiaryNames},

I've started a challenge to build a habit: ${habitTitle} (${frequency}), over the next ${durationWeeksMin}-${durationWeeksMax} weeks.

If I fail, you get: ${experienceDescription}${stakeClause}.

If I make it... well, you won't get that. Wish me luck!

Follow along here: ${shareUrl}

Sent via Kinwin`;
}
