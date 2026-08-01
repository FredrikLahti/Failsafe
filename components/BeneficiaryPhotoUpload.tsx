"use client";

import { useState, type FormEvent } from "react";
import { Button, ErrorText } from "@/components/ui";
import { uploadBeneficiaryPhoto } from "@/app/share/[token]/actions";

export function BeneficiaryPhotoUpload({ shareToken }: { shareToken: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await uploadBeneficiaryPhoto(shareToken, formData);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not upload that photo.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return <p className="text-sm text-sage">Thank you — added to their Memory Lane.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
      <input
        name="photo"
        type="file"
        accept="image/*"
        required
        className="block w-full text-sm text-parchment/80 file:mr-4 file:rounded-md file:border-0 file:bg-sage file:px-4 file:py-2 file:text-ink file:text-sm"
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? "Uploading…" : "Upload photo"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
