/**
 * Numbers — the full catalogue.
 *
 * Every number is visible from day one. Sealed ones show a hook and, where the
 * figure is built from something the user told us, which answer drives it.
 * Opened ones show the user's own figure.
 *
 * This replaced a schedule-driven grid where anything not yet due was an
 * anonymous grey box and everything already earned was locked behind Pro. The
 * new rule is simpler and easier to trust: you get a key a day, you choose
 * what to spend it on, and what you open stays open.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { NumberTile, KeyStatus, UnlockSheet } from '@/components/numbers';
import { ProgressBar } from '@/components/ui';
import { useNumbers, type NumberCard } from '@/hooks/useNumbers';
import { useUserStore, useStatsStore } from '@/store/userStore';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';
import { useEntrance } from '@/hooks/useEntrance';

type Filter = 'all' | 'sealed' | 'open';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'sealed', label: 'Sealed' },
  { key: 'open',   label: 'Opened' },
];

// ─── Empty state (no profile yet) ─────────────────────────────
function NoProfile() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="stats-chart-outline" size={30} color={colors.green300} />
      </View>
      <Text style={styles.emptyTitle}>Your numbers are waiting</Text>
      <Text style={styles.emptyBody}>
        Finish setting up your profile and the whole catalogue opens up.
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function NumbersScreen() {
  const profile   = useUserStore((s) => s.profile);
  const redeemKey = useStatsStore((s) => s.redeemKey);
  const { cards, summary, empty } = useNumbers();

  const [filter, setFilter]   = useState<Filter>('all');
  const [sheetCard, setSheet] = useState<NumberCard | null>(null);
  const [revealed, setRevealed] = useState(false);

  // ── Header entrance ──
  const headerStyle = useEntrance({ duration: 360, translateY: -8 });

  const visible = useMemo(() => {
    if (filter === 'sealed') return cards.filter((c) => !c.unlocked);
    if (filter === 'open')   return cards.filter((c) => c.unlocked);
    // "All" leads with what is still sealed — that is the actionable half.
    return [...cards].sort((a, b) => Number(a.unlocked) - Number(b.unlocked));
  }, [cards, filter]);

  const handleTile = useCallback((card: NumberCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (card.unlocked) {
      router.push(`/(tabs)/numbers/${card.definition.id}`);
      return;
    }
    // Sealed: open the sheet either to confirm a spend, or to explain the wait.
    setRevealed(false);
    setSheet(card);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!sheetCard) return;
    const ok = redeemKey(sheetCard.definition.id, profile?.appJoinDate ?? null);
    if (ok) {
      // Re-render arrives through the store; flip the sheet to its reveal face.
      setRevealed(true);
    } else {
      // Out of keys, or already open — close rather than lie about what happened.
      setSheet(null);
    }
  }, [sheetCard, redeemKey, profile?.appJoinDate]);

  const handleSeeDetail = useCallback(() => {
    if (!sheetCard) return;
    const id = sheetCard.definition.id;
    setSheet(null);
    setRevealed(false);
    router.push(`/(tabs)/numbers/${id}`);
  }, [sheetCard]);

  // The sheet holds a snapshot; re-read from the live list so the revealed
  // figure is the current one.
  const liveSheetCard = useMemo(() => {
    if (!sheetCard) return null;
    return cards.find((c) => c.definition.id === sheetCard.definition.id) ?? sheetCard;
  }, [cards, sheetCard]);

  if (empty || !profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Your numbers</Text>
          <Text style={styles.screenSub}>One new number, every day</Text>
        </View>
        <NoProfile />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Your numbers</Text>
            <Text style={styles.screenSub}>
              {summary.unlocked} of {summary.total} opened
            </Text>
          </View>
          {summary.canUnlock && (
            <View style={styles.keyBadge}>
              <Ionicons name="key" size={13} color={colors.green700} />
              <Text style={styles.keyBadgeText}>{summary.available}</Text>
            </View>
          )}
        </View>
        <ProgressBar
          value={summary.total > 0 ? summary.unlocked / summary.total : 0}
          showLabel={false}
          height={5}
        />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <KeyStatus summary={summary} />

        {/* ── Filter ── */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count  = f.key === 'all'
              ? cards.length
              : f.key === 'sealed'
                ? summary.remaining
                : summary.unlocked;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(f.key);
                }}
                style={[styles.filterChip, active && styles.filterChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${f.label}, ${count}`}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f.label}
                </Text>
                <Text style={[styles.filterCount, active && styles.filterCountActive]}>
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Grid ── */}
        {visible.length > 0 ? (
          <View style={styles.grid}>
            {visible.map((card, i) => (
              <NumberTile
                key={card.definition.id}
                card={card}
                index={i}
                hasKey={summary.canUnlock}
                onPress={handleTile}
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={filter === 'open' ? 'key-outline' : 'trophy-outline'}
                size={28}
                color={colors.green300}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'open' ? 'Nothing opened yet' : 'Every number is open'}
            </Text>
            <Text style={styles.emptyBody}>
              {filter === 'open'
                ? 'Spend your first key on whichever one you are most curious about.'
                : 'You have the complete picture. They keep counting in the background.'}
            </Text>
          </View>
        )}

        <View style={{ height: spacing[10] }} />
      </ScrollView>

      <UnlockSheet
        card={liveSheetCard}
        keysLeft={summary.available}
        revealed={revealed}
        onConfirm={handleConfirm}
        onDismiss={() => { setSheet(null); setRevealed(false); }}
        onSeeDetail={handleSeeDetail}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingTop: spacing[2] },

  header: {
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[5],
    paddingBottom:     spacing[3],
    gap:               spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
  },
  screenTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      24.5,
    color:         colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom:  3,
  },
  screenSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
  },
  keyBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  keyBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize:   13,
    color:      colors.green700,
  },

  filterRow: {
    flexDirection:     'row',
    gap:               spacing[2],
    paddingHorizontal: spacing[5],
    marginBottom:      spacing[4],
  },
  filterChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[4],
    minHeight:         38,
    borderRadius:      radius.full,
    backgroundColor:   colors.white,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.green700,
    borderColor:     colors.green700,
  },
  filterText: {
    fontFamily: fontFamily.medium,
    fontSize:   12.5,
    color:      colors.textSecondary,
  },
  filterTextActive: { color: colors.white },
  filterCount: {
    fontFamily: fontFamily.semiBold,
    fontSize:   11,
    color:      colors.textMuted,
  },
  filterCountActive: { color: 'rgba(255,255,255,0.75)' },

  grid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    justifyContent:    'space-between',
    gap:               spacing[3],
    paddingHorizontal: spacing[5],
  },

  empty: {
    alignItems:       'center',
    marginHorizontal: spacing[5],
    marginTop:        spacing[6],
    padding:          spacing[8],
    backgroundColor:  colors.white,
    borderRadius:     radius.xl,
    borderWidth:      1,
    borderColor:      colors.border,
  },
  emptyIcon: {
    width:           64,
    height:          64,
    borderRadius:    radius.full,
    backgroundColor: colors.green50,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing[4],
  },
  emptyTitle: {
    fontFamily:   fontFamily.bold,
    fontSize:     16,
    color:        colors.textPrimary,
    textAlign:    'center',
    marginBottom: spacing[2],
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    lineHeight: 19.5,
    color:      colors.textMuted,
    textAlign:  'center',
  },
});
