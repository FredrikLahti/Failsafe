import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatBeneficiaries } from "@/lib/consequence";
import { LetterCard } from "@/components/LetterCard";
import { Button } from "@/components/ui";

export default async function ReportResultPage({
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

  const { data: report } = await supabase
    .from("final_reports")
    .select("*")
    .eq("challenge_id", id)
    .single();

  const isSuccess = challenge.status === "completed_success";
  const variant = isSuccess ? "gold" : "ember";
  const beneficiaryNames = formatBeneficiaries(challenge.beneficiaries);

  return (
    <div className="flex-1 px-6 py-14">
      <LetterCard
        variant={variant}
        eyebrow={isSuccess ? "Promise Kept" : "The Consequence"}
        title={isSuccess ? "You kept your promise." : "You fell short."}
      >
        <p className="mb-4">
          {isSuccess
            ? `${challenge.habit_title}, completed. ${beneficiaryNames} never had to be treated. How rude of you.`
            : `${challenge.habit_title} didn't stick this time. ${beneficiaryNames} now get ${challenge.experience_description}, what a nice person!`}
        </p>
        {report?.what_happened && (
          <p className="text-sm italic border-t border-ink/10 pt-4 mt-4">&ldquo;{report.what_happened}&rdquo;</p>
        )}
        {report?.photo_url && (
          <div className="mt-6">
            <Image
              src={report.photo_url}
              alt="Photo submitted with the final report"
              width={640}
              height={480}
              className="w-full h-auto rounded"
              unoptimized
            />
          </div>
        )}
        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="text-sm mb-3">
            {isSuccess
              ? "Ready to raise the bar, or take on something new?"
              : "Now you know where it broke down. Want to try again?"}
          </p>
          {isSuccess ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/onboarding">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Make it harder
                </Button>
              </Link>
              <Link href="/onboarding">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Try something else
                </Button>
              </Link>
            </div>
          ) : (
            <Link href="/onboarding">
              <Button variant="secondary" className="w-full sm:w-auto">
                Start a new challenge
              </Button>
            </Link>
          )}
        </div>
      </LetterCard>

      <div className="max-w-xl mx-auto mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={`/share/${challenge.share_token}`}>
          <Button variant="secondary" className="w-full sm:w-auto">
            View public result page
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button className="w-full sm:w-auto">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
