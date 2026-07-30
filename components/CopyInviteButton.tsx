"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyInviteButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" onClick={handleCopy} className="w-full sm:w-auto">
      {copied ? "Copied!" : "Copy invitation"}
    </Button>
  );
}
