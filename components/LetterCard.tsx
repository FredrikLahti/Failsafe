import type { ReactNode } from "react";
import { WaxSeal } from "@/components/WaxSeal";

type LetterVariant = "neutral" | "gold" | "ember";

const BORDER_BY_VARIANT: Record<LetterVariant, string> = {
  neutral: "border-sage/40",
  gold: "border-gold/60",
  ember: "border-ember/60",
};

const SEAL_BY_VARIANT: Record<LetterVariant, "ember" | "gold" | "sage"> = {
  neutral: "sage",
  gold: "gold",
  ember: "ember",
};

/**
 * The signature letter/card motif: parchment surface, deckle edge, wax
 * seal. Reserved for emotional peak moments — challenge creation, sharing
 * with the recipient, and the final result screen.
 */
export function LetterCard({
  variant = "neutral",
  eyebrow,
  title,
  children,
  showSeal = true,
  className = "",
}: {
  variant?: LetterVariant;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  showSeal?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`deckle-edge relative mx-auto max-w-xl bg-parchment text-ink shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border ${BORDER_BY_VARIANT[variant]} px-8 py-10 sm:px-12 sm:py-14 ${className}`}
    >
      {showSeal && (
        <div className="flex justify-center mb-6">
          <WaxSeal variant={SEAL_BY_VARIANT[variant]} />
        </div>
      )}
      {eyebrow && (
        <p className="text-center font-mono text-xs tracking-[0.2em] uppercase text-ash mb-3">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="text-center font-display text-2xl sm:text-3xl mb-6 text-ink">
          {title}
        </h2>
      )}
      <div className="font-body text-ink/90">{children}</div>
    </div>
  );
}
