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

/** The only two outcomes the final-report form can submit — capture is automatic now. */
export type SelectableReportOutcome = Extract<ReportOutcome, "completed" | "failed_paid">;

export type ExperienceType = "dinner" | "tickets_event" | "trip" | "activity" | "other";

export type SubscriptionStatus = "incomplete" | "active" | "past_due" | "canceled" | "trialing";

export type StakePaymentStatus =
  | "pending_card"
  | "reserved"
  | "released"
  | "captured"
  | "capture_failed";

export type GiftCardDeliveryStatus = "pending" | "sent" | "failed";

export type PhotoType = "self" | "beneficiary";

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  stripe_customer_id: string | null;
  created_at: string;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  currency: string;
  base_price_cents: number;
  localized_price_cents: number | null;
  country_code: string | null;
  created_at: string;
  updated_at: string;
};

export type StakePaymentRow = {
  id: string;
  challenge_id: string;
  amount_cents: number;
  currency: string;
  fee_cents: number | null;
  stripe_setup_intent_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_payment_intent_id: string | null;
  status: StakePaymentStatus;
  captured_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GiftCardDeliveryRow = {
  id: string;
  challenge_id: string;
  beneficiary_name: string;
  amount_cents: number;
  experience_type: ExperienceType;
  tremendous_order_id: string | null;
  tremendous_reward_id: string | null;
  claim_url: string | null;
  status: GiftCardDeliveryStatus;
  delivered_at: string | null;
  created_at: string;
};

export type GiftCardDeliveryShareRow = {
  challenge_id: string;
  beneficiary_name: string;
  claim_url: string | null;
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
  beneficiaries: string[];
  experience_type: ExperienceType;
  experience_description: string;
  /** The real stake: saved as a payment method at creation, captured only if the challenge fails. */
  stake_amount_cents: number | null;
  start_date: string;
  status: ChallengeStatus;
  share_token: string;
  reminder_cadence_days: number;
  last_reminder_at: string | null;
  created_at: string;
  completed_at: string | null;
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
  photo_type: PhotoType | null;
  what_happened: string | null;
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
  beneficiaries: string[];
  experience_type: ExperienceType;
  experience_description: string;
  start_date: string;
  status: ChallengeStatus;
  completed_at: string | null;
  outcome: ReportOutcome | null;
  photo_url: string | null;
  photo_type: PhotoType | null;
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
          beneficiaries: string[];
          experience_type: ExperienceType;
          experience_description: string;
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
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow> & {
          user_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          status: SubscriptionStatus;
        };
        Update: Partial<SubscriptionRow>;
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stake_payments: {
        Row: StakePaymentRow;
        Insert: Partial<StakePaymentRow> & {
          challenge_id: string;
          amount_cents: number;
        };
        Update: Partial<StakePaymentRow>;
        Relationships: [
          {
            foreignKeyName: "stake_payments_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: true;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_card_deliveries: {
        Row: GiftCardDeliveryRow;
        Insert: Partial<GiftCardDeliveryRow> & {
          challenge_id: string;
          beneficiary_name: string;
          amount_cents: number;
          experience_type: ExperienceType;
        };
        Update: Partial<GiftCardDeliveryRow>;
        Relationships: [
          {
            foreignKeyName: "gift_card_deliveries_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
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
      gift_card_delivery_shares: {
        Row: GiftCardDeliveryShareRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
};
