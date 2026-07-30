export type HabitCategory =
  | "exercise"
  | "diet"
  | "sleep"
  | "screen_time"
  | "saving"
  | "mindfulness";

export type DifficultyTier = "easy" | "medium" | "complex";

export type ChallengeStatus =
  | "active"
  | "completed_success"
  | "completed_failure_paid"
  | "completed_failure_unpaid";

export type CheckinStatus = "good" | "partial" | "bad" | "missed";

export type ReportOutcome = "completed" | "failed_paid" | "failed_unpaid";

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

export type ChallengeRow = {
  id: string;
  user_id: string;
  category: HabitCategory;
  difficulty_tier: DifficultyTier;
  habit_title: string;
  frequency: string;
  duration_weeks_min: number;
  duration_weeks_max: number;
  cue_situation: string;
  cue_action: string;
  consequence_description: string;
  recipient_name: string;
  start_date: string;
  status: ChallengeStatus;
  share_token: string;
  reminder_cadence_days: number;
  last_reminder_at: string | null;
  created_at: string;
  completed_at: string | null;
};

export type RecipientRow = {
  id: string;
  challenge_id: string;
  name: string;
  invite_message: string | null;
  created_at: string;
};

export type CheckinRow = {
  id: string;
  challenge_id: string;
  week_number: number;
  status: CheckinStatus;
  note: string | null;
  created_at: string;
};

export type FinalReportRow = {
  id: string;
  challenge_id: string;
  outcome: ReportOutcome;
  photo_url: string | null;
  what_happened: string | null;
  would_binding_payment_help: boolean | null;
  would_pay_for_automated: boolean | null;
  created_at: string;
};

export type ChallengeShareRow = {
  id: string;
  share_token: string;
  category: HabitCategory;
  habit_title: string;
  frequency: string;
  difficulty_tier: DifficultyTier;
  duration_weeks_min: number;
  duration_weeks_max: number;
  consequence_description: string;
  recipient_name: string;
  start_date: string;
  status: ChallengeStatus;
  completed_at: string | null;
  outcome: ReportOutcome | null;
  photo_url: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string; email: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      challenges: {
        Row: ChallengeRow;
        Insert: Partial<ChallengeRow> & {
          user_id: string;
          category: HabitCategory;
          difficulty_tier: DifficultyTier;
          habit_title: string;
          frequency: string;
          duration_weeks_min: number;
          duration_weeks_max: number;
          cue_situation: string;
          cue_action: string;
          consequence_description: string;
          recipient_name: string;
        };
        Update: Partial<ChallengeRow>;
        Relationships: [
          {
            foreignKeyName: "challenges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recipients: {
        Row: RecipientRow;
        Insert: Partial<RecipientRow> & { challenge_id: string; name: string };
        Update: Partial<RecipientRow>;
        Relationships: [
          {
            foreignKeyName: "recipients_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
        ];
      };
      checkins: {
        Row: CheckinRow;
        Insert: Partial<CheckinRow> & {
          challenge_id: string;
          week_number: number;
          status: CheckinStatus;
        };
        Update: Partial<CheckinRow>;
        Relationships: [
          {
            foreignKeyName: "checkins_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
        ];
      };
      final_reports: {
        Row: FinalReportRow;
        Insert: Partial<FinalReportRow> & {
          challenge_id: string;
          outcome: ReportOutcome;
        };
        Update: Partial<FinalReportRow>;
        Relationships: [
          {
            foreignKeyName: "final_reports_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: true;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      challenge_shares: {
        Row: ChallengeShareRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
};
