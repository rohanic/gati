/**
 * Gati — User & Profile Types
 */

export type ExerciseFrequency = 'regular' | 'sometimes' | 'rarely';
export type TalkLevel        = 'quiet' | 'balanced' | 'chatty';

export type InterestCategory =
  | 'food'
  | 'cafe'
  | 'history'
  | 'nature'
  | 'art'
  | 'market'
  | 'nightlife'
  | 'books';

export interface UserProfile {
  firstName:            string;
  dateOfBirth:          string;         // ISO "YYYY-MM-DD"
  sleepHoursPerNight:   number;         // 4–10
  coffeeCupsPerDay:     number;         // 0–8
  phoneHoursPerDay:     number;         // 1–12
  exerciseFrequency:    ExerciseFrequency;
  mealsPerDay:          number;         // 1–4, default 3
  talkLevel:            TalkLevel;      // affects words + laughs stats
  // Optional — added later; engine falls back to sensible defaults
  waterGlassesPerDay?:  number;         // 0–15, default 6
  musicHoursPerDay?:    number;         // 0–12, default 2
  commuteMinutesPerDay?: number;        // 0–180, default 30
  interestCategories:   InterestCategory[];
  notificationTime:     string;         // "HH:MM"
  isPro:                boolean;
  appJoinDate:          string;         // ISO "YYYY-MM-DD"
}

export type StatCategory = 'time' | 'body' | 'habits' | 'money' | 'social';

export interface StatDefinition {
  id:          string;
  category:    StatCategory;
  title:       string;
  description: string;           // Template — use replaceStatTokens()
  formulaKey:  string;           // Maps to LifeStatsOutput key
  unit:        string;           // "years" | "steps" | "$" | etc.
  icon:        string;           // Ionicons name
  precision:   number;           // Decimal places to show
  whatIfKeys?: string[];          // Optional linked What-If scenario keys
}

export interface StatUnlock {
  statId:        string;
  unlockedDate:  string;         // ISO "YYYY-MM-DD"
  hasBeenShared: boolean;
}

export interface DailyContent {
  date:           string;        // "YYYY-MM-DD"
  statId:         string;
  wanderPlaceId:  string | null;
  statViewed:     boolean;
  wanderViewed:   boolean;
}

export type UserRating = 'loved' | 'good' | 'not_for_me';

export interface WanderPlace {
  placeId:        string;
  name:           string;
  address:        string;
  latitude:       number;
  longitude:      number;
  rating:         number;
  reviewCount:    number;
  redditMentions: number;
  aiSummary:      string;
  category:       InterestCategory;
  tags:           string[];
  thumbnailUrl:   string | null;
  isSaved:        boolean;
  isVisited:      boolean;
  userRating:     UserRating | null;
  discoveredDate: string | null;
  visitedDate:    string | null;
  distanceKm:     number;
  openNow:        boolean | null;
  /** Crowd-sourced Gati quality score from place_quality_scores (0–1). Null if < 1 rating exists. */
  gatiScore:      number | null;
  /**
   * True for the built-in demo places shown when a real search is
   * unavailable. These are illustrative, not real recommendations, and their
   * coordinates are fixed — so `distanceKm` on them is meaningless and must
   * never be presented as a distance from the user.
   */
  isSample?:      boolean;
}

export interface TimelineEntry {
  id:      string;
  type:    'stat' | 'place' | 'milestone';
  date:    string;                // ISO
  title:   string;
  subtitle?: string;
  refId?:  string;               // statId or placeId
}

export interface MilestoneDefinition {
  id:          string;
  title:       string;
  description: string;
  emoji:       string;
  check:       (ctx: MilestoneContext) => boolean;
}

export interface MilestoneContext {
  ageInDays:         number;
  streakDays:        number;
  placesDiscovered:  number;
  daysInApp:         number;
}
