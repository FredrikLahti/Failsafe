"use client";

import { useState, type FormEvent } from "react";
import { Button, ErrorText, Label, Textarea } from "@/components/ui";
import { submitFinalReport } from "@/app/report/actions";
import type { ReportOutcome } from "@/lib/types/database";

const OUTCOMES: { value: ReportOutcome; label: string; hint: string }[] = [
  {
    value: "completed",
    label: "I completed the full challenge",
    hint: "You kept the habit for the whole commitment.",
  },
  {
    value: "failed_paid",
    label: "I failed, and I carried out the consequence",
    hint: "You didn't keep the habit, but you paid for the experience as promised.",
  },
  {
    value: "failed_unpaid",
    label: "I failed, and I did not carry out the consequence",
    hint: "You didn't keep the habit and haven't paid for the experience.",
  },
];

export function FinalReportForm({ challengeId }: { challengeId: string }) {
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        {OUTCOMES.map((opt) => (
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

      <div className="mb-6">
        <Label htmlFor="photo">Photo (optional)</Label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-parchment/80 file:mr-4 file:rounded-md file:border-0 file:bg-sage file:px-4 file:py-2 file:text-ink file:text-sm"
        />
      </div>

      <div className="mb-6">
        <Label htmlFor="whatHappened">What happened, in your own words</Label>
        <Textarea id="whatHappened" name="whatHappened" rows={4} />
      </div>

      <div className="mb-6">
        <Label>Would a binding payment solution (charged automatically) have made a difference?</Label>
        <YesNo name="wouldBindingPaymentHelp" />
      </div>

      <div className="mb-8">
        <Label>Would you pay for an automated version of Failsafe that enforced this for you?</Label>
        <YesNo name="wouldPayForAutomated" />
      </div>

      <ErrorText>{error}</ErrorText>

      <Button type="submit" disabled={!outcome || submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit final report"}
      </Button>
    </form>
  );
}

function YesNo({ name }: { name: string }) {
  return (
    <div className="flex gap-3 mt-2">
      {["yes", "no"].map((v) => (
        <label
          key={v}
          className="flex-1 text-center rounded-md border border-sage/40 py-2 cursor-pointer has-[:checked]:border-gold has-[:checked]:bg-gold/10 capitalize"
        >
          <input type="radio" name={name} value={v} className="sr-only" required />
          {v}
        </label>
      ))}
    </div>
  );
}
