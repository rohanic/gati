import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import type { UserProfile, StatUnlock, DailyContent, WanderPlace } from '@/types';

// ─── User Store ──────────────────────────────────────────────
interface UserState {
  profile:             UserProfile | null;
  onboardingComplete:  boolean;

  setProfile:          (profile: UserProfile) => void;
  updateProfile:       (partial: Partial<UserProfile>) => void;
  setOnboardingDone:   () => void;
  reset:               () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile:            null,
      onboardingComplete: false,

      setProfile: (profile) => set({ profile }),

      updateProfile: (partial) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...partial } : null,
        })),

      setOnboardingDone: () => set({ onboardingComplete: true }),

      reset: () => set({ profile: null, onboardingComplete: false }),
    }),
    {
      name:    'gati-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─── Stats Store ─────────────────────────────────────────────
interface StatsState {
  unlockedStats:     StatUnlock[];
  dailyContent:      DailyContent[];
  openHistory:       string[];           // ISO date strings of app opens
  seenMilestoneIds:  string[];           // milestone IDs the user has dismissed

  unlockStat:        (statId: string) => void;
  markStatViewed:    (date: string) => void;
  markStatShared:    (statId: string) => void;
  recordOpen:        () => void;
  markMilestoneSeen: (id: string) => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      unlockedStats:    [],
      dailyContent:     [],
      openHistory:      [],
      seenMilestoneIds: [],

      unlockStat: (statId) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const already = get().unlockedStats.find((s) => s.statId === statId);
        if (already) return;
        set((s) => ({
          unlockedStats: [
            ...s.unlockedStats,
            { statId, unlockedDate: today, hasBeenShared: false },
          ],
        }));
      },

      markStatViewed: (date) =>
        set((s) => ({
          dailyContent: s.dailyContent.map((d) =>
            d.date === date ? { ...d, statViewed: true } : d
          ),
        })),

      markStatShared: (statId) =>
        set((s) => ({
          unlockedStats: s.unlockedStats.map((u) =>
            u.statId === statId ? { ...u, hasBeenShared: true } : u
          ),
        })),

      recordOpen: () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const history = get().openHistory;
        if (!history.includes(today)) {
          set((s) => ({ openHistory: [...s.openHistory, today] }));
        }
      },

      markMilestoneSeen: (id) =>
        set((s) => {
          if (s.seenMilestoneIds.includes(id)) return s;
          return { seenMilestoneIds: [...s.seenMilestoneIds, id] };
        }),
    }),
    {
      name:    'gati-stats',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─── Wander Store ────────────────────────────────────────────
interface WanderState {
  places:          WanderPlace[];
  categoryScores:  Record<string, number>;

  addPlace:        (place: WanderPlace) => void;
  savePlace:       (placeId: string) => void;
  unsavePlace:     (placeId: string) => void;
  markVisited:     (placeId: string) => void;
  ratePlace:       (placeId: string, rating: WanderPlace['userRating']) => void;
  updateScore:     (category: string, rating: string) => void;
}

const DEFAULT_SCORES: Record<string, number> = {
  food: 1.0, cafe: 1.0, history: 1.0, nature: 1.0,
  art:  1.0, market: 1.0, nightlife: 1.0, books: 1.0,
};

export const useWanderStore = create<WanderState>()(
  persist(
    (set) => ({
      places:         [],
      categoryScores: DEFAULT_SCORES,

      addPlace: (place) =>
        set((s) => {
          const exists = s.places.find((p) => p.placeId === place.placeId);
          if (exists) return s;
          return { places: [...s.places, place] };
        }),

      savePlace: (placeId) =>
        set((s) => ({
          places: s.places.map((p) =>
            p.placeId === placeId ? { ...p, isSaved: true } : p
          ),
        })),

      unsavePlace: (placeId) =>
        set((s) => ({
          places: s.places.map((p) =>
            p.placeId === placeId ? { ...p, isSaved: false } : p
          ),
        })),

      markVisited: (placeId) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        set((s) => ({
          places: s.places.map((p) =>
            p.placeId === placeId ? { ...p, isVisited: true, visitedDate: today } : p
          ),
        }));
      },

      ratePlace: (placeId, rating) =>
        set((s) => ({
          places: s.places.map((p) =>
            p.placeId === placeId ? { ...p, userRating: rating } : p
          ),
        })),

      // Taste learning: weighted scoring from ratings
      updateScore: (category, rating) =>
        set((s) => {
          const current = s.categoryScores[category] ?? 1.0;
          const multiplier =
            rating === 'loved'      ? 1.3 :
            rating === 'good'       ? 1.1 :
            rating === 'not_for_me' ? 0.6 : 1.0;
          return {
            categoryScores: {
              ...s.categoryScores,
              [category]: Math.min(3.0, Math.max(0.1, current * multiplier)),
            },
          };
        }),
    }),
    {
      name:    'gati-wander',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
