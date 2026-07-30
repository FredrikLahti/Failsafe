"use client";

import { useState } from "react";
import { Button, ErrorText, Label, Textarea } from "@/components/ui";
import { submitCheckin } from "@/app/checkin/actions";
import type { CheckinStatus } from "@/lib/types/database";

const OPTIONS: { value: CheckinStatus; label: string; hint: string }[] = [
  { value: "good", label: "Good", hint: "Kept the habit as planned" },
  { value: "partial", label: "Partial", hint: "Did some of it, not all" },
  { value: "bad", label: "Bad", hint: "Didn't keep it this week" },
];

export function CheckinForm({
  challengeId,
  weekNumber,
}: {
  challengeId: string;
  weekNumber: number;
}) {
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!status) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitCheckin({ challengeId, weekNumber, status, note });
    } catch (e) {
      if (e instanceof Error && e.message !== "NEXT_REDIRECT") {
        setError(e.message);
        setSubmitting(false);
      }
    }
  }

  return (
    <div>
      <Label>How did this week go?</Label>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className={`rounded-md border px-3 py-4 text-center transition-colors ${
              status === opt.value
                ? "border-gold bg-gold/10"
                : "border-sage/40 hover:border-sage"
            }`}
          >
            <p className="font-medium">{opt.label}</p>
            <p className="text-xs text-ash mt-1">{opt.hint}</p>
          </button>
        ))}
      </div>

      <Label htmlFor="note">Anything you want to note (optional)</Label>
      <Textarea
        id="note"
        rows={4}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What helped, what got in the way, how you're feeling about it…"
      />

      <ErrorText>{error}</ErrorText>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!status || submitting}
        className="w-full mt-6"
      >
        {submitting ? "Saving…" : "Submit check-in"}
      </Button>
    </div>
  );
}
