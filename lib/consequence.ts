import type { ExperienceType } from "@/lib/types/database";

export const EXPERIENCE_TYPES: { value: ExperienceType; label: string }[] = [
  { value: "dinner", label: "Dinner" },
  { value: "tickets_event", label: "Tickets / event" },
  { value: "trip", label: "Trip" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" },
];

export function experienceTypeLabel(type: ExperienceType): string {
  return EXPERIENCE_TYPES.find((t) => t.value === type)?.label ?? "Other";
}

/**
 * Deliberately extravagant anchors shown before the free-text field, so
 * users calibrate against something that would actually sting rather than
 * something they'd happily pay for anyway.
 */
export const CONSEQUENCE_ANCHOR_EXAMPLES: string[] = [
  "A three-course dinner with wine for the whole family",
  "Front-row concert tickets",
  "A weekend at a nice hotel",
  "A full day at a spa, all-inclusive",
];

export const CONSEQUENCE_ANCHOR_COPY =
  "Don't pick something you'd happily pay for anyway. Pick something that makes you wince a little when you imagine actually paying for it. As a guide: over a 16-week challenge, that's roughly four paychecks for most people — if you can't imagine genuinely missing this money for one night, it's probably not big enough.";

export function formatBeneficiaries(beneficiaries: string[]): string {
  const names = beneficiaries.map((b) => b.trim()).filter(Boolean);
  if (names.length === 0) return "the people you name";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function parseBeneficiaries(raw: string): string[] {
  return raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * The one line of copy this whole feature hangs on: never framed as a
 * money transfer or payment to a recipient, always as an experience the
 * user misses out on.
 */
export function consequenceSentence({
  beneficiaries,
  experienceDescription,
}: {
  beneficiaries: string[];
  experienceDescription: string;
}): string {
  return `If you fail, you'll treat ${formatBeneficiaries(beneficiaries)} to ${experienceDescription} — you just won't be there.`;
}
