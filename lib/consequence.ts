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
export const CONSEQUENCE_ANCHOR_EXAMPLES: { description: string; experienceType: ExperienceType }[] = [
  { description: "A three-course dinner with wine for the whole family", experienceType: "dinner" },
  { description: "Front-row concert tickets", experienceType: "tickets_event" },
  { description: "A weekend at a nice hotel", experienceType: "trip" },
  { description: "A full day at a spa, all-inclusive", experienceType: "activity" },
];

export const CONSEQUENCE_ANCHOR_COPY =
  "Don't pick something you'd gladly pay for anyway. This should genuinely hurt to lose. Harder habits deserve bigger stakes, a daily meditation slip and a missed gym routine shouldn't cost the same. If it doesn't feel like real money to you, go bigger. Worst case, your loved ones also get dessert!";

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
 * user misses out on. This is the only place in the app that spells out
 * the full "not allowed to be there" phrasing — everywhere else shortens
 * or drops it once the context already makes it clear.
 */
export function consequenceSentence({
  beneficiaries,
  experienceDescription,
}: {
  beneficiaries: string[];
  experienceDescription: string;
}): string {
  return `If you fail, ${formatBeneficiaries(beneficiaries)} get ${experienceDescription}. You're just not allowed to be there.`;
}
