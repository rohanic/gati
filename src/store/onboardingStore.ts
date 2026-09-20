/**
 * Transient onboarding state — NOT persisted.
 * Committed to userStore on completion.
 */
import { create } from 'zustand';
import { InterestCategory, ExerciseFrequency, TalkLevel } from '@/types';

interface OnboardingState {
  firstName:         string;
  dateOfBirth:       Date | null;
  sleepHours:        number;          // 4–10, default 7
  coffeeCups:        number;          // 0–8, default 1
  phoneHours:        number;          // 1–12, default 4
  exercise:          ExerciseFrequency;
  mealsPerDay:       number;          // 1–4, default 3
  talkLevel:         TalkLevel;       // quiet | balanced | chatty
  waterGlasses:      number;          // 0–15, default 6
  musicHours:        number;          // 0–12, default 2
  commuteMinutes:    number;          // 0–180, default 30
  interests:         InterestCategory[];
  notificationTime:  string;          // "HH:MM"
}

interface OnboardingActions {
  setFirstName:        (v: string) => void;
  setDateOfBirth:      (d: Date) => void;
  // Individual lifestyle setters (used by split screens)
  setSleepHours:       (n: number) => void;
  setCoffeeCups:       (n: number) => void;
  setPhoneHours:       (n: number) => void;
  setExercise:         (e: ExerciseFrequency) => void;
  setMealsPerDay:      (n: number) => void;
  setTalkLevel:        (t: TalkLevel) => void;
  setWaterGlasses:     (n: number) => void;
  setMusicHours:       (n: number) => void;
  setCommuteMinutes:   (n: number) => void;
  // Batch setters kept for compatibility
  setLifestyle:        (sleep: number, coffee: number, phone: number, exercise: ExerciseFrequency) => void;
  setMealsAndTalk:     (meals: number, talk: TalkLevel) => void;
  toggleInterest:      (i: InterestCategory) => void;
  setNotificationTime: (t: string) => void;
  reset:               () => void;
}

const DEFAULTS: OnboardingState = {
  firstName:        '',
  dateOfBirth:      null,
  sleepHours:       7,
  coffeeCups:       1,
  phoneHours:       4,
  exercise:         'sometimes',
  mealsPerDay:      3,
  talkLevel:        'balanced',
  waterGlasses:     6,
  musicHours:       2,
  commuteMinutes:   30,
  interests:        [],
  notificationTime: '08:00',
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>((set, get) => ({
  ...DEFAULTS,

  setFirstName:        (firstName) => set({ firstName }),
  setDateOfBirth:      (dateOfBirth) => set({ dateOfBirth }),
  setSleepHours:       (sleepHours) => set({ sleepHours }),
  setCoffeeCups:       (coffeeCups) => set({ coffeeCups }),
  setPhoneHours:       (phoneHours) => set({ phoneHours }),
  setExercise:         (exercise) => set({ exercise }),
  setMealsPerDay:      (mealsPerDay) => set({ mealsPerDay }),
  setTalkLevel:        (talkLevel) => set({ talkLevel }),
  setWaterGlasses:     (waterGlasses) => set({ waterGlasses }),
  setMusicHours:       (musicHours) => set({ musicHours }),
  setCommuteMinutes:   (commuteMinutes) => set({ commuteMinutes }),
  setLifestyle:        (sleepHours, coffeeCups, phoneHours, exercise) =>
    set({ sleepHours, coffeeCups, phoneHours, exercise }),
  setMealsAndTalk:     (mealsPerDay, talkLevel) => set({ mealsPerDay, talkLevel }),
  toggleInterest: (i) => {
    const curr = get().interests;
    set({
      interests: curr.includes(i) ? curr.filter((x) => x !== i) : [...curr, i],
    });
  },
  setNotificationTime: (notificationTime) => set({ notificationTime }),
  reset:               () => set(DEFAULTS),
}));
