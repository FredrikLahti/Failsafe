import { computeStreak, type WeekStatus } from "@/lib/streak";

export interface Badge {
  id: string;
  label: string;
  description: string;
  earned: boolean;
}

export function computeBadges(
  checkins: WeekStatus[],
  durationWeeksMin: number
): Badge[] {
  const totalCheckins = checkins.filter((c) => c.status !== "missed").length;
  const streak = computeStreak(checkins);
  const halfway = Math.ceil(durationWeeksMin / 2);

  return [
    {
      id: "first-checkin",
      label: "First Check-in",
      description: "Showed up for week one.",
      earned: totalCheckins >= 1,
    },
    {
      id: "streak-4",
      label: "Four in a Row",
      description: "Four consecutive good or partial weeks.",
      earned: streak >= 4,
    },
    {
      id: "halfway",
      label: "Halfway Point",
      description: `Reached week ${halfway} of the plan.`,
      earned: checkins.some((c) => c.week_number >= halfway),
    },
    {
      id: "streak-8",
      label: "Eight in a Row",
      description: "Eight consecutive good or partial weeks.",
      earned: streak >= 8,
    },
  ];
}
