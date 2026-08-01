"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Label, Textarea } from "@/components/ui";
import { pauseChallenge } from "@/app/dashboard/actions";

export function PauseChallengeButton({
  challengeId,
  canPause,
}: {
  challengeId: string;
  canPause: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canPause) {
    return (
      <p className="text-sm text-ash self-center">
        You&rsquo;ve used your full pause allowance for this challenge.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Pause this challenge
      </Button>
    );
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await pauseChallenge(challengeId, reason);
      router.refresh();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pause the challenge.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full rounded-md border border-sage/40 px-4 py-3">
      <Label htmlFor="pause-reason">Why are you pausing? (optional, just for your own record)</Label>
      <Textarea
        id="pause-reason"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Travel, illness, whatever's true right now"
      />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2 mt-3">
        <Button type="button" onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Pausing…" : "Confirm pause"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
