/**
 * The daily key banner.
 *
 * Answers, at a glance, the only two questions a user has on this screen:
 * can I open something right now, and if not, when can I?
 *
 * The countdown is stated in the user's LOCAL time even though keys are
 * granted on a UTC boundary. Telling someone in Delhi that their next number
 * arrives "at 00:00 UTC" is technically accurate and practically useless;
 * "5:30 AM" is the thing they can act on.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { UnlockSummary } from '@/engine/unlockEngine';
import { formatTimeUntilNextKey } from '@/engine/unlockEngine';
import { Text } from '@/components/ui/Text';
import { useEntrance } from '@/hooks/useEntrance';

interface KeyStatusProps {
  summary: UnlockSummary;
}

/** Local wall-clock time the next key lands, e.g. "5:30 AM". */
function localResetTime(nextKeyAt: Date): string {
  try {
    return nextKeyAt.toLocaleTimeString(undefined, {
      hour:   'numeric',
      minute: '2-digit',
    });
  } catch {
    return '00:00 UTC';
  }
}

export function KeyStatus({ summary }: KeyStatusProps) {
  const style = useEntrance({ duration: 320, translateY: -6 });

  // ── Everything opened ───────────────────────────────────────
  if (summary.allComplete) {
    return (
      <Animated.View style={[styles.banner, styles.bannerDone, style]}>
        <View style={[styles.iconWrap, styles.iconWrapDone]}>
          <Ionicons name="trophy" size={16} color={colors.gold} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Every number opened</Text>
          <Text style={styles.sub}>
            All {summary.total} of them. They keep counting in the background.
          </Text>
        </View>
      </Animated.View>
    );
  }

  // ── Key available ───────────────────────────────────────────
  if (summary.canUnlock) {
    return (
      <Animated.View style={[styles.banner, styles.bannerReady, style]}>
        <View style={[styles.iconWrap, styles.iconWrapReady]}>
          <Ionicons name="key" size={16} color={colors.green700} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, styles.titleReady]}>
            {summary.available === 1
              ? '1 key to spend'
              : `${summary.available} keys to spend`}
          </Text>
          <Text style={styles.sub}>
            Pick any sealed number below. {summary.remaining} left to discover.
          </Text>
        </View>
      </Animated.View>
    );
  }

  // ── Waiting for the next key ────────────────────────────────
  return (
    <Animated.View style={[styles.banner, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>
          Next key in {formatTimeUntilNextKey()}
        </Text>
        <Text style={styles.sub}>
          Arrives at {localResetTime(summary.nextKeyAt)} your time
          {summary.unlocked > 0 ? ` · ${summary.unlocked} of ${summary.total} opened` : ''}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing[3],
    marginHorizontal: spacing[5],
    marginBottom:     spacing[4],
    paddingVertical:  spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius:     radius.xl,
    backgroundColor:  colors.surface2,
    borderWidth:      1,
    borderColor:      colors.borderLight,
  },
  bannerReady: {
    backgroundColor: colors.green50,
    borderColor:     colors.green100,
  },
  bannerDone: {
    backgroundColor: colors.goldBg,
    borderColor:     colors.goldBorder,
  },

  iconWrap: {
    width:           34,
    height:          34,
    borderRadius:    radius.md,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.white,
    borderWidth:     1,
    borderColor:     colors.borderLight,
  },
  iconWrapReady: { borderColor: colors.green100 },
  iconWrapDone:  { borderColor: colors.goldBorder },

  text: { flex: 1 },
  title: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     13.5,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  titleReady: { color: colors.green700 },
  sub: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    lineHeight: 16,
    color:      colors.textSecondary,
  },
});
