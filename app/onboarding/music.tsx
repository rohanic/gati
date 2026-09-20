/**
 * Music screen — step 7 of 13.
 * "How many hours of music a day?" with a live lifetime-songs wow fact.
 */
import React from 'react';
import { differenceInDays } from 'date-fns';
import { CounterQuestion } from '@/components/onboarding/CounterQuestion';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function MusicScreen() {
  const { musicHours, setMusicHours, dateOfBirth } = useOnboardingStore();

  const daysAlive = Math.max(
    1,
    differenceInDays(new Date(), dateOfBirth ?? new Date(2000, 0, 1))
  );

  // Listening counted from ~age 10 (same baseline as the stats engine)
  const listeningDays  = Math.max(0, daysAlive - 10 * 365.25);
  const lifetimeHours  = Math.floor(listeningDays * musicHours);
  const lifetimeSongs  = Math.floor(lifetimeHours * 17);   // ~3.5 min per song

  return (
    <CounterQuestion
      step={7}
      icon="musical-notes"
      question={'How much music\ndo you listen to?'}
      hint="Hours per day, headphones or background"
      value={musicHours}
      onChange={setMusicHours}
      min={0}
      max={12}
      unitFor={(v) => (v === 1 ? 'hour a day' : 'hours a day')}
      nextRoute="/onboarding/meals"
      decreaseLabel="Decrease hours"
      increaseLabel="Increase hours"
      wow={{
        icon:   'musical-note',
        figure: lifetimeSongs.toLocaleString('en-US'),
        label:  'songs heard since you were ten',
        punch:
          musicHours === 0
            ? 'Even silence has a soundtrack: elevators, shops, film scores.'
            : `That's ${lifetimeHours.toLocaleString('en-US')} hours. Some of those songs rewired you.`,
      }}
    />
  );
}
