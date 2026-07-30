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
        title={
          isSuccess
            ? "You kept your promise."
            : challenge.status === "completed_failure_paid"
              ? "You fell short — and paid it forward."
              : "You fell short."
        }
      >
        <p className="mb-4">
          {isSuccess
            ? `${challenge.habit_title} — completed. ${beneficiaryNames} never had to be treated.`
            : `${challenge.habit_title} didn't stick this time. If you fail, you treat ${beneficiaryNames} to ${challenge.experience_description} — you just aren't there for it.`}
        </p>
        {challenge.status === "completed_failure_paid" && (
          <p className="mb-4 text-sm">
            You followed through — {beneficiaryNames} got the experience, and you weren&rsquo;t there.
          </p>
        )}
        {challenge.status === "completed_failure_unpaid" && (
          <p className="mb-4 text-sm">
            That treat hasn&rsquo;t happened yet. That&rsquo;s between you and {beneficiaryNames}.
          </p>
        )}
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
