/**
 * Commute screen — step 10 of 13.
 * "How long is your daily commute?" with a live days-in-transit wow fact.
 */
import React from 'react';
import { differenceInDays } from 'date-fns';
import { CounterQuestion } from '@/components/onboarding/CounterQuestion';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function CommuteScreen() {
  const { commuteMinutes, setCommuteMinutes, dateOfBirth } = useOnboardingStore();

  const daysAlive = Math.max(
    1,
    differenceInDays(new Date(), dateOfBirth ?? new Date(2000, 0, 1))
  );

  // Commuting counted from ~age 18 (same baseline as the stats engine)
  const commutingDays  = Math.max(0, daysAlive - 18 * 365.25);
  const lifetimeHours  = Math.floor((commutingDays * commuteMinutes) / 60);
  const lifetimeDays   = Math.floor(lifetimeHours / 24);

  return (
    <CounterQuestion
      step={10}
      icon="train"
      question={'How long is your\ndaily commute?'}
      hint="Both directions combined, school or work"
      value={commuteMinutes}
      onChange={setCommuteMinutes}
      min={0}
      max={180}
      stepSize={10}
      unitFor={() => 'minutes a day'}
      nextRoute="/onboarding/personality"
      decreaseLabel="Decrease minutes"
      increaseLabel="Increase minutes"
      wow={{
        icon:   'hourglass-outline',
        figure:
          commuteMinutes === 0
            ? '0'
            : lifetimeDays >= 2
              ? lifetimeDays.toLocaleString('en-US')
              : lifetimeHours.toLocaleString('en-US'),
        label:
          commuteMinutes === 0
            ? 'hours spent commuting. Rare.'
            : lifetimeDays >= 2
              ? 'full days of your adult life in transit'
              : 'hours of your adult life in transit',
        punch:
          commuteMinutes === 0
            ? 'You\'ve dodged one of life\'s biggest hidden time costs.'
            : `${lifetimeHours.toLocaleString('en-US')} hours between places. Imagine them as podcasts, naps, or albums.`,
      }}
    />
  );
}
