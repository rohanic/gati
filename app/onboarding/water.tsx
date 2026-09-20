/**
 * Water screen — step 5 of 13.
 * "How many glasses of water a day?" with a live lifetime-litres wow fact.
 */
import React from 'react';
import { differenceInDays } from 'date-fns';
import { CounterQuestion } from '@/components/onboarding/CounterQuestion';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function WaterScreen() {
  const { waterGlasses, setWaterGlasses, dateOfBirth } = useOnboardingStore();

  const daysAlive = Math.max(
    1,
    differenceInDays(new Date(), dateOfBirth ?? new Date(2000, 0, 1))
  );

  const lifetimeGlasses = Math.floor(daysAlive * waterGlasses);
  const lifetimeLitres  = Math.floor(lifetimeGlasses * 0.25);
  const bathtubs        = Math.floor(lifetimeLitres / 150);

  return (
    <CounterQuestion
      step={5}
      icon="water"
      question={'How many glasses\nof water a day?'}
      hint="Rough average is fine"
      value={waterGlasses}
      onChange={setWaterGlasses}
      min={0}
      max={15}
      unitFor={(v) => (v === 1 ? 'glass' : 'glasses')}
      nextRoute="/onboarding/screentime"
      decreaseLabel="Decrease glasses"
      increaseLabel="Increase glasses"
      wow={{
        icon:   'water-outline',
        figure: lifetimeGlasses.toLocaleString('en-US'),
        label:  'glasses so far in your life',
        punch:
          waterGlasses === 0
            ? 'Your body still found water somewhere. It always does.'
            : `About ${lifetimeLitres.toLocaleString('en-US')} litres, roughly ${bathtubs.toLocaleString('en-US')} bathtubs full.`,
      }}
    />
  );
}
