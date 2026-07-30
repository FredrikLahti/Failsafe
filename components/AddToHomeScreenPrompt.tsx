"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

const DISMISSED_KEY = "failsafe_a2hs_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | null;

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function detectPlatform(): Platform {
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return null;
}

function subscribeNoop() {
  return () => {};
}

/** True once mounted on the client — server and pre-hydration renders are false. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

/**
 * Guides the user to add Failsafe to their home screen right after
 * onboarding, since reliable push notifications and a native-feeling app
 * only work once it's installed. iOS has no install API — it's Share →
 * Add to Home Screen — while Android Chrome exposes a real install prompt
 * via `beforeinstallprompt`.
 */
export function AddToHomeScreenPrompt() {
  const hydrated = useHydrated();
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setManuallyDismissed(true);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function dismiss() {
    setManuallyDismissed(true);
    window.localStorage.setItem(DISMISSED_KEY, "1");
  }

  async function handleAndroidInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") dismiss();
  }

  if (!hydrated) return null;

  const previouslyDismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
  if (manuallyDismissed || previouslyDismissed || isStandalone()) return null;

  const platform = detectPlatform();
  if (platform !== "ios" && !installEvent) return null;

  return (
    <div className="rounded-md border border-gold/50 bg-gold/10 px-4 py-4 mb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium mb-1">Add Failsafe to your home screen</p>
          {platform === "ios" ? (
            <p className="text-sm text-parchment/80">
              Tap the <strong>Share</strong> icon in Safari, then choose{" "}
              <strong>Add to Home Screen</strong>. This keeps check-in
              reminders reliable and makes Failsafe feel like a real app.
            </p>
          ) : (
            <p className="text-sm text-parchment/80">
              Install Failsafe for reliable reminders and a faster, full-screen experience.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-ash hover:text-parchment text-lg leading-none"
        >
          ×
        </button>
      </div>
      {platform === "android" && installEvent && (
        <Button type="button" onClick={handleAndroidInstall} className="mt-3">
          Install app
        </Button>
      )}
    </div>
  );
}
