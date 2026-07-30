"use client";

import { useMemo, useState } from "react";
import { Button, ErrorText, Input, Label, Textarea } from "@/components/ui";
import { HABIT_CATEGORIES, expectationCopy, DIFFICULTY_RANGES } from "@/lib/habits";
import type { HabitCategory } from "@/lib/types/database";
import { createChallenge } from "@/app/onboarding/actions";

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<HabitCategory | null>(null);
  const [habitTitle, setHabitTitle] = useState("");
  const [frequency, setFrequency] = useState("");
  const [cueSituation, setCueSituation] = useState("");
  const [cueAction, setCueAction] = useState("");
  const [consequenceDescription, setConsequenceDescription] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const definition = useMemo(
    () => HABIT_CATEGORIES.find((c) => c.id === category) ?? null,
    [category]
  );

  function selectCategory(id: HabitCategory) {
    const def = HABIT_CATEGORIES.find((c) => c.id === id)!;
    setCategory(id);
    setHabitTitle(def.starterHabit);
    setFrequency(def.suggestedFrequency);
    setStep(2);
  }

  async function handleFinish() {
    if (!category) return;
    setSubmitting(true);
    setError(null);
    try {
      await createChallenge({
        category,
        habitTitle,
        frequency,
        cueSituation,
        cueAction,
        consequenceDescription,
        recipientName,
      });
    } catch (e) {
      if (e instanceof Error && e.message !== "NEXT_REDIRECT") {
        setError(e.message);
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="flex-1 px-6 py-12">
      <div className="max-w-xl mx-auto">
        <ProgressDots step={step} />

        {step === 1 && <CategoryStep onSelect={selectCategory} />}

        {step === 2 && definition && (
          <StepShell
            title="Your starting point"
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            nextDisabled={!habitTitle.trim() || !frequency.trim()}
          >
            <p className="text-sm text-parchment/70 mb-6">{expectationCopy(definition.difficulty)}</p>
            <div className="space-y-5">
              <div>
                <Label htmlFor="habit">Minimal starter habit</Label>
                <Input
                  id="habit"
                  value={habitTitle}
                  onChange={(e) => setHabitTitle(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Input
                  id="frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                />
              </div>
              <div className="rounded-md border border-sage/40 px-4 py-3 text-sm text-parchment/80 font-mono">
                Difficulty: {DIFFICULTY_RANGES[definition.difficulty].label} · Typical range: {DIFFICULTY_RANGES[definition.difficulty].min}-{DIFFICULTY_RANGES[definition.difficulty].max} weeks
              </div>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="Your personal cue"
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            nextDisabled={!cueSituation.trim() || !cueAction.trim()}
          >
            <p className="text-sm text-parchment/70 mb-6">
              A cue ties your habit to a moment that already happens in your
              day. Example: &ldquo;{definition?.exampleCue}&rdquo;
            </p>
            <div className="space-y-5">
              <div>
                <Label htmlFor="cue-situation">If… (situation, time, or place)</Label>
                <Input
                  id="cue-situation"
                  placeholder="it's 8pm on a weeknight"
                  value={cueSituation}
                  onChange={(e) => setCueSituation(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cue-action">Then… (action)</Label>
                <Input
                  id="cue-action"
                  placeholder="I do my starter habit"
                  value={cueAction}
                  onChange={(e) => setCueAction(e.target.value)}
                />
              </div>
              <p className="text-sm text-parchment/60 font-mono">
                &ldquo;If {cueSituation || "…"}, then {cueAction || "…"}&rdquo;
              </p>
            </div>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Choose your consequence"
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
            nextDisabled={!consequenceDescription.trim() || !recipientName.trim()}
          >
            <p className="text-sm text-parchment/70 mb-6">
              If you fail, you pay for this experience on someone else&rsquo;s
              behalf. You don&rsquo;t get to attend it.
            </p>
            <div className="space-y-5">
              <div>
                <Label htmlFor="consequence">The experience</Label>
                <Textarea
                  id="consequence"
                  rows={3}
                  placeholder="A weekend trip to the coast, a cooking class, tickets to a show…"
                  value={consequenceDescription}
                  onChange={(e) => setConsequenceDescription(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="recipient">Who receives it if you fail</Label>
                <Input
                  id="recipient"
                  placeholder="Recipient's name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
            </div>
          </StepShell>
        )}

        {step === 5 && definition && (
          <StepShell
            title="Review your challenge"
            onBack={() => setStep(4)}
            onNext={handleFinish}
            nextLabel={submitting ? "Creating…" : "Create challenge"}
            nextDisabled={submitting}
          >
            <dl className="space-y-4 text-sm">
              <ReviewRow label="Habit" value={`${habitTitle} · ${frequency}`} />
              <ReviewRow label="Cue" value={`If ${cueSituation}, then ${cueAction}`} />
              <ReviewRow label="Timeline" value={`${DIFFICULTY_RANGES[definition.difficulty].min}-${DIFFICULTY_RANGES[definition.difficulty].max} weeks (${DIFFICULTY_RANGES[definition.difficulty].label})`} />
              <ReviewRow label="Consequence" value={consequenceDescription} />
              <ReviewRow label="Recipient" value={recipientName} />
            </dl>
            <ErrorText>{error}</ErrorText>
          </StepShell>
        )}
      </div>
    </div>
  );
}

function ProgressDots({ step }: { step: Step }) {
  return (
    <div className="flex justify-center gap-2 mb-10">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            s === step ? "w-8 bg-gold" : s < step ? "w-1.5 bg-sage" : "w-1.5 bg-sage/30"
          }`}
        />
      ))}
    </div>
  );
}

function CategoryStep({ onSelect }: { onSelect: (id: HabitCategory) => void }) {
  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl text-center mb-2">
        What do you want to build?
      </h1>
      <p className="text-center text-parchment/70 mb-8">Choose the habit that matters most right now.</p>
      <div className="grid gap-3">
        {HABIT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="text-left rounded-lg border border-sage/40 px-5 py-4 hover:border-gold hover:bg-parchment/5 transition-colors"
          >
            <p className="font-display text-lg">{c.label}</p>
            <p className="text-sm text-parchment/60">{c.tagline}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepShell({
  title,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
}: {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl text-center mb-6">{title}</h1>
      {children}
      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={onBack} type="button">
          Back
        </Button>
        <Button onClick={onNext} disabled={nextDisabled} type="button">
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-sage/20 pb-3">
      <dt className="text-xs uppercase tracking-wide text-ash mb-1">{label}</dt>
      <dd className="text-parchment/90">{value}</dd>
    </div>
  );
}
