"use client";

import { useState, type FormEvent } from "react";
import { Button, ErrorText, Label, Textarea } from "@/components/ui";
import { submitFinalReport } from "@/app/report/actions";
import type { ReportOutcome } from "@/lib/types/database";

type SelectableOutcome = Extract<ReportOutcome, "completed" | "failed_paid">;

export function FinalReportForm({
  challengeId,
  habitTitle,
  beneficiaryNames,
}: {
  challengeId: string;
  habitTitle: string;
  beneficiaryNames: string;
}) {
  const [outcome, setOutcome] = useState<SelectableOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outcomes: { value: SelectableOutcome; label: string; hint: string }[] = [
    {
      value: "completed",
      label: "I completed the full challenge",
      hint: `${habitTitle} stuck. ${beneficiaryNames} never had to be treated. Nicely done, and a little rude of you, they were looking forward to it.`,
    },
    {
      value: "failed_paid",
      label: "I failed, and the consequence went through",
      hint: `${habitTitle} didn't stick, but you took the consequence like a champ. That wallet does look a bit thin now.`,
    },
  ];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!outcome) return;
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await submitFinalReport(formData);
    } catch (err) {
      if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
        setError(err.message);
        setSubmitting(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="challengeId" value={challengeId} />

      <Label>What actually happened?</Label>
      <div className="space-y-3 mb-6">
        {outcomes.map((opt) => (
          <label
            key={opt.value}
            className={`block rounded-md border px-4 py-3 cursor-pointer transition-colors ${
              outcome === opt.value ? "border-gold bg-gold/10" : "border-sage/40 hover:border-sage"
            }`}
          >
            <input
              type="radio"
              name="outcome"
              value={opt.value}
              className="sr-only"
              checked={outcome === opt.value}
              onChange={() => setOutcome(opt.value)}
              required
            />
            <p className="font-medium">{opt.label}</p>
            <p className="text-xs text-ash mt-1">{opt.hint}</p>
          </label>
        ))}
      </div>

      {outcome === "completed" && (
        <div className="mb-6">
          <Label htmlFor="photo">
            Almost there. Take a photo to remember this by, you&rsquo;ll want it for your Memory Lane.
          </Label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            className="block w-full text-sm text-parchment/80 file:mr-4 file:rounded-md file:border-0 file:bg-sage file:px-4 file:py-2 file:text-ink file:text-sm"
          />
        </div>
      )}

      {outcome === "failed_paid" && (
        <p className="mb-6 text-xs text-ash">
          We&rsquo;ll ask {beneficiaryNames} for a photo once the gift card lands, it&rsquo;ll show up in your Memory Lane.
        </p>
      )}

      <div className="mb-6">
        <Label htmlFor="whatHappened">What happened, in your own words</Label>
        <Textarea id="whatHappened" name="whatHappened" rows={4} />
      </div>

      <ErrorText>{error}</ErrorText>

      <Button type="submit" disabled={!outcome || submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit final report"}
      </Button>
    </form>
  );
}
