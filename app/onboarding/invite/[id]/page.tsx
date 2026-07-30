import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getHabitCategory } from "@/lib/habits";
import { LetterCard } from "@/components/LetterCard";
import { Button } from "@/components/ui";
import { CopyInviteButton } from "@/components/CopyInviteButton";

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

  const message = buildInviteMessage({
    recipientName: challenge.recipient_name,
    habitTitle: challenge.habit_title,
    frequency: challenge.frequency,
    consequenceDescription: challenge.consequence_description,
    shareUrl,
  });

  return (
    <div className="flex-1 px-6 py-14">
      <div className="max-w-xl mx-auto mb-8 text-center">
        <p className="text-sm text-parchment/70">
          Your challenge is set. Now send this to {challenge.recipient_name} yourself —
          Failsafe never emails them for you.
        </p>
      </div>

      <LetterCard variant="neutral" eyebrow="A Promise, Sealed" title={`For ${challenge.recipient_name}`}>
        <p className="whitespace-pre-line leading-relaxed">{message}</p>
      </LetterCard>

      <div className="max-w-xl mx-auto mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <CopyInviteButton text={message} />
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
  );
}

function buildInviteMessage({
  recipientName,
  habitTitle,
  frequency,
  consequenceDescription,
  shareUrl,
}: {
  recipientName: string;
  habitTitle: string;
  frequency: string;
  consequenceDescription: string;
  shareUrl: string;
}) {
  return `Dear ${recipientName},

I'm making you a promise — and putting something real behind it.

Starting today, I'm committing to: ${habitTitle} (${frequency}).

If I fail to keep this promise, I will pay for the following on your behalf, as the consequence of falling short:
${consequenceDescription}

I won't be there for it. It's yours, win or lose on my part.

You can follow how it goes here:
${shareUrl}

With intention,
Sent via Failsafe`;
}
