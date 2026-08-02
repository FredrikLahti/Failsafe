"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const POLL_INTERVAL_MS = 1500;
const AUTO_RETRY_BUDGET_MS = 15000;

export function SubscriptionConfirming() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    startedAtRef.current = Date.now();

    async function poll() {
      try {
        const res = await fetch("/api/subscription/status", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { subscribed: boolean };
          if (data.subscribed) {
            if (!cancelled) router.refresh();
            return;
          }
        }
      } catch {
        // Network hiccup — treat like "not yet" and try again on the next tick.
      }
      if (cancelled) return;
      if (Date.now() - (startedAtRef.current ?? Date.now()) >= AUTO_RETRY_BUDGET_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  function handleManualRefresh() {
    setTimedOut(false);
    startedAtRef.current = Date.now();
    router.refresh();
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl sm:text-3xl mb-4">Confirming your subscription…</h1>
        <p className="text-parchment/70 mb-8">
          {timedOut
            ? "Stripe confirmed the payment, but activation is taking longer than usual. It should catch up shortly."
            : "Stripe just confirmed your payment. Finishing setup takes a few seconds."}
        </p>
        {timedOut ? (
          <Button onClick={handleManualRefresh} type="button">
            Refresh
          </Button>
        ) : (
          <div
            role="status"
            aria-label="Confirming subscription"
            className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent"
          />
        )}
      </div>
    </div>
  );
}
