/**
 * Transient onboarding state — NOT persisted.
 * Committed to userStore on completion.
 */
import { create } from 'zustand';
import { InterestCategory, ExerciseFrequency } from '@/types';

interface OnboardingState {
  firstName:         string;
  dateOfBirth:       Date | null;
  sleepHours:        number;          // 4–10, default 7
  coffeeCups:        number;          // 0–8, default 1
  phoneHours:        number;          // 1–12, default 4
  exercise:          ExerciseFrequency;
  interests:         InterestCategory[];
  notificationTime:  string;          // "HH:MM"
}

interface OnboardingActions {
  setFirstName:        (v: string) => void;
  setDateOfBirth:      (d: Date) => void;
  setLifestyle:        (sleep: number, coffee: number, phone: number, exercise: ExerciseFrequency) => void;
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
  interests:        [],
  notificationTime: '08:00',
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>((set, get) => ({
  ...DEFAULTS,

  setFirstName:        (firstName) => set({ firstName }),
  setDateOfBirth:      (dateOfBirth) => set({ dateOfBirth }),
  setLifestyle:        (sleepHours, coffeeCups, phoneHours, exercise) =>
    set({ sleepHours, coffeeCups, phoneHours, exercise }),
  toggleInterest: (i) => {
    const curr = get().interests;
    set({
      interests: curr.includes(i) ? curr.filter((x) => x !== i) : [...curr, i],
    });
  },
  setNotificationTime: (notificationTime) => set({ notificationTime }),
  reset:               () => set(DEFAULTS),
}));
