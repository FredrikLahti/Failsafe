"use client";

import { useState, type FormEvent } from "react";
import { Button, ErrorText, Label, Textarea } from "@/components/ui";
import { submitReportDetails } from "@/app/report/actions";
import type { CheckinStatus, ReportOutcome } from "@/lib/types/database";

interface WeekEntry {
  week_number: number;
  status: CheckinStatus;
}

const STATUS_LABEL: Record<CheckinStatus, string> = {
  good: "Good",
  partial: "Partial",
  bad: "Bad",
  missed: "Missed",
};

export function ChallengeSummaryForm({
  challengeId,
  habitTitle,
  beneficiaryNames,
  outcome,
  weeks,
  notesByWeek,
}: {
  challengeId: string;
  habitTitle: string;
  beneficiaryNames: string;
  outcome: Extract<ReportOutcome, "completed" | "failed_paid">;
  weeks: WeekEntry[];
  notesByWeek: Record<number, string | null>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSuccess = outcome === "completed";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await submitReportDetails(formData);
    } catch (err) {
      if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
        setError(err.message);
        setSubmitting(false);
      }
    }
  }

  return (
    <div>
      <div
        className={`rounded-md border px-4 py-3 mb-6 ${
          isSuccess ? "border-gold/50 bg-gold/10" : "border-ember/50 bg-ember/10"
        }`}
      >
        <p className="font-medium">{isSuccess ? "Completed — the habit stuck." : "Not completed this time."}</p>
        <p className="text-xs text-ash mt-1">
          {isSuccess
            ? `${habitTitle} stuck. ${beneficiaryNames} never had to be treated.`
            : `${habitTitle} didn't stick. ${beneficiaryNames} get the consequence.`}
        </p>
      </div>

      <Label>Week by week</Label>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-6">
        {weeks.map((w) => {
          const isGood = w.status === "good" || w.status === "partial";
          return (
            <div
              key={w.week_number}
              title={notesByWeek[w.week_number] ?? undefined}
              className={`rounded-md border px-2 py-2 text-center text-xs ${
                isGood ? "border-sage/50 bg-sage/10" : "border-ember/50 bg-ember/10"
              }`}
            >
              <p className="text-ash">W{w.week_number}</p>
              <p className="font-medium">{STATUS_LABEL[w.status]}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        <input type="hidden" name="challengeId" value={challengeId} />

        {isSuccess ? (
          <div className="mb-6">
            <Label htmlFor="photo">
              Take a photo to remember this by, you&rsquo;ll want it for your Memory Lane.
            </Label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-parchment/80 file:mr-4 file:rounded-md file:border-0 file:bg-sage file:px-4 file:py-2 file:text-ink file:text-sm"
            />
          </div>
        ) : (
          <p className="mb-6 text-xs text-ash">
            We&rsquo;ll ask {beneficiaryNames} for a photo once the gift card lands, it&rsquo;ll show up in your
            Memory Lane.
          </p>
        )}

        <div className="mb-6">
          <Label htmlFor="whatHappened">What happened, in your own words</Label>
          <Textarea id="whatHappened" name="whatHappened" rows={4} />
        </div>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Save and continue"}
        </Button>
      </form>
    </div>
  );
}
