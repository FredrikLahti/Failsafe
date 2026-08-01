import type { DifficultyTier, HabitCategory } from "@/lib/types/database";

export interface HabitCategoryDefinition {
  id: HabitCategory;
  label: string;
  tagline: string;
  difficulty: DifficultyTier;
  starterHabit: string;
  suggestedFrequency: string;
  exampleCue: string;
  /** Short noun phrase used in generated Memory Lane titles, e.g. "meditating". */
  memoryLanePhrase: string;
}

export const DIFFICULTY_RANGES: Record<
  DifficultyTier,
  { min: number; max: number; label: string }
> = {
  easy: { min: 3, max: 6, label: "Easy" },
  medium: { min: 6, max: 10, label: "Medium" },
  complex: { min: 10, max: 20, label: "Complex" },
};

export const HABIT_CATEGORIES: HabitCategoryDefinition[] = [
  {
    id: "mindfulness",
    label: "Mindfulness / meditation",
    tagline: "A few quiet minutes, on purpose.",
    difficulty: "easy",
    starterHabit: "Sit quietly and breathe for 3 minutes",
    suggestedFrequency: "5 times per week",
    exampleCue: "If I've just poured my morning coffee, then I sit for 3 minutes before drinking it",
    memoryLanePhrase: "meditating",
  },
  {
    id: "screen_time",
    label: "Screen time",
    tagline: "Put a little daylight between you and the phone.",
    difficulty: "easy",
    starterHabit: "One hour with your phone in another room",
    suggestedFrequency: "5 times per week",
    exampleCue: "If it's 8pm, then I put my phone in the kitchen for an hour",
    memoryLanePhrase: "cutting screen time",
  },
  {
    id: "sleep",
    label: "Sleep",
    tagline: "A wind-down you can actually keep.",
    difficulty: "medium",
    starterHabit: "Lights out within 30 minutes of a fixed bedtime",
    suggestedFrequency: "6 nights per week",
    exampleCue: "If it's 10:30pm, then I turn off every screen and get into bed",
    memoryLanePhrase: "sleeping better",
  },
  {
    id: "saving",
    label: "Saving / finances",
    tagline: "Small, boring, automatic — the habit that compounds.",
    difficulty: "medium",
    starterHabit: "Move a fixed small amount into savings",
    suggestedFrequency: "Once per week",
    exampleCue: "If it's Sunday evening, then I transfer this week's saving before I close my laptop",
    memoryLanePhrase: "saving",
  },
  {
    id: "diet",
    label: "Diet / cooking at home",
    tagline: "Eating well without overthinking it.",
    difficulty: "complex",
    starterHabit: "Cook one simple meal at home instead of ordering in",
    suggestedFrequency: "3 times per week",
    exampleCue: "If it's a weeknight and I haven't planned takeout, then I cook something simple at home",
    memoryLanePhrase: "cooking at home",
  },
  {
    id: "exercise",
    label: "Exercise / physical activity",
    tagline: "Movement that fits the week you actually have.",
    difficulty: "complex",
    starterHabit: "A 15-minute walk or light workout",
    suggestedFrequency: "3 times per week",
    exampleCue: "If I've just finished lunch, then I take a 15-minute walk",
    memoryLanePhrase: "exercising",
  },
];

export function getHabitCategory(id: HabitCategory): HabitCategoryDefinition {
  const found = HABIT_CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown habit category: ${id}`);
  return found;
}

/**
 * Expectation-setting copy shown during onboarding — framed as a normal
 * timeline, not a warning.
 */
export function expectationCopy(tier: DifficultyTier): string {
  const { min, max } = DIFFICULTY_RANGES[tier];
  return `Most people building this kind of habit see a real shift within about ${min}-${max} weeks. There are no quick fixes, it's completely normal for it to take time.`;
}

/** Generated Memory Lane card title, e.g. "When I crushed 18 weeks of exercising". */
export function memoryLaneTitle(
  category: HabitCategoryDefinition,
  weeks: number,
  isSuccess: boolean
): string {
  return isSuccess
    ? `When I crushed ${weeks} weeks of ${category.memoryLanePhrase}`
    : `When I failed to keep up ${category.memoryLanePhrase} for ${weeks} weeks`;
}
