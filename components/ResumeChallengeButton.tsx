"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText } from "@/components/ui";
import { resumeChallenge } from "@/app/dashboard/actions";

export function ResumeChallengeButton({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      await resumeChallenge(challengeId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resume the challenge.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={handleClick} disabled={submitting}>
        {submitting ? "Resuming…" : "Resume challenge"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
