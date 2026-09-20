/**
 * Feature access — one source of truth for "can this user do X".
 *
 * Gating used to be scattered: `proStatus === 'free'` checks in the Numbers
 * grid, the Story timeline, WhatIfSection and the save-place action, plus a
 * stale `profile.isPro` flag in Profile. Four call sites meant four chances to
 * disagree, and they did.
 *
 * Everything now goes through `useAccess()`. Flipping `LAUNCH_MODE` to `'free'`
 * opens every capability at once, with no gating code left behind to rot.
 */
import { useMemo } from 'react';
import { IS_FREE_LAUNCH } from '@/config';
import { useProStatus, type ProStatus } from '@/store/userStore';

export interface Access {
  /** Underlying entitlement, regardless of launch mode. */
  status: ProStatus;
  /** True when the paywall is switched off entirely for this build. */
  freeLaunch: boolean;
  /** True when the user has paid or is in trial (ignores launch mode). */
  entitled: boolean;

  // ── Capabilities ───────────────────────────────────────────
  /** Open numbers beyond the daily key allowance. Reserved for a future tier. */
  canSkipTheQueue: boolean;
  /** See what-if projections on an opened number. */
  canUseWhatIf: boolean;
  /** See the Story timeline beyond the recent window. */
  canSeeFullStory: boolean;
  /** Save places without the free-tier cap. */
  canSaveUnlimited: boolean;
  /** Get an AI "why this place" blurb in Wander. */
  canUseAiPicks: boolean;
  /** Show upgrade prompts at all. */
  showUpgradePrompts: boolean;
}

export function useAccess(): Access {
  const status = useProStatus();

  return useMemo(() => {
    const entitled = status === 'pro' || status === 'trial';
    // In a free launch every capability is granted and no upsell is shown.
    const granted  = IS_FREE_LAUNCH || entitled;

    return {
      status,
      freeLaunch: IS_FREE_LAUNCH,
      entitled,

      canSkipTheQueue:  false,   // nobody skips the daily key, by design
      canUseWhatIf:     granted,
      canSeeFullStory:  granted,
      canSaveUnlimited: granted,
      canUseAiPicks:    granted,

      showUpgradePrompts: !IS_FREE_LAUNCH && !entitled,
    };
  }, [status]);
}
