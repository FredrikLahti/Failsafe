"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Native share sheet (SMS, WhatsApp, Messenger, etc.) via the Web Share API.
 * Feature-detected client-side — falls back to nothing (just the existing
 * "Copy invitation" button) on browsers/devices without support, e.g. most
 * desktop browsers.
 */
export function ShareInviteButton({ text, title }: { text: string; title?: string }) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!supported) return null;

  async function handleShare() {
    try {
      await navigator.share({ title, text });
    } catch {
      // User canceled the share sheet, or the browser rejected it — nothing to do.
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleShare} className="w-full sm:w-auto">
      Share
    </Button>
  );
}
