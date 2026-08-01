"use client";

import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";

export function SubscribeButton({ label = "Subscribe and continue" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not reach billing. Try again in a moment.");
      setLoading(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={handleClick} disabled={loading}>
        {loading ? "Starting checkout…" : label}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
