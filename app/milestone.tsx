/**
 * Milestone modal screen — /milestone
 *
 * Presented as a full-screen modal (see app/_layout.tsx).
 * Renders the first unseen pending milestone; if none, goes back immediately.
 *
 * Entry points:
 *  - router.push('/milestone') from any screen wanting to surface a milestone
 *  - Future: push notification deep-link
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MilestoneModal } from '@/components/milestone';
import { usePendingMilestone } from '@/hooks/useMilestone';
import { useStatsStore } from '@/store/userStore';
import { colors } from '@/theme';

export default function MilestoneScreen() {
  const pending            = usePendingMilestone();
  const markMilestoneSeen  = useStatsStore((s) => s.markMilestoneSeen);

  // No pending milestone → close immediately
  useEffect(() => {
    if (!pending) {
      router.back();
    }
  }, [pending]);

  const handleDismiss = () => {
    if (pending) markMilestoneSeen(pending.id);
    router.back();
  };

  if (!pending) return <View style={styles.blank} />;

  return (
    <View style={styles.root}>
      <MilestoneModal
        milestone={pending}
        onDismiss={handleDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent:  'center',
    alignItems:      'center',
  },
  blank: {
    flex:            1,
    backgroundColor: colors.transparent,
  },
});
