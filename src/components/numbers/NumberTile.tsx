/**
 * One number in the catalogue grid.
 *
 * Two states, and the difference between them is the whole product:
 *
 *   SEALED — title, category and a one-line hook, plus (where relevant) which
 *            of the user's own answers the figure is built from. Enough to
 *            want it; not enough to have it.
 *   OPEN   — the user's own figure, counted up.
 *
 * A sealed card is never a grey box with a padlock. It is a legible, tappable
 * thing with a reason to choose it over the other sealed ones — otherwise
 * "pick today's number" is not a decision, it is a shrug.
 */
import React, { memo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CountUpText } from '@/components/ui';
import { getCategoryTheme } from '@/theme';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { NumberCard } from '@/hooks/useNumbers';
import { Text } from '@/components/ui/Text';
import { useEntrance } from '@/hooks/useEntrance';

interface NumberTileProps {
  card:      NumberCard;
  index:     number;
  /** True when the user has a key to spend. Drives the sealed-card CTA. */
  hasKey:    boolean;
  onPress:   (card: NumberCard) => void;
}

function NumberTileBase({ card, index, hasKey, onPress }: NumberTileProps) {
  const cat = getCategoryTheme(card.definition.category);

  // Cap the stagger: a 25-tile grid would otherwise take three seconds to
  // finish appearing.
  const entrance = useEntrance({ delay: Math.min(index, 8) * 45, duration: 260, translateY: 10 });

  // Press feedback lives on its own view. Sharing one `transform` with the
  // entrance meant a style array where the later transform REPLACES the
  // earlier one rather than combining with it — so splitting them onto one
  // view would silently have dropped the slide-in.
  const press      = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const accessibilityLabel = card.unlocked
    ? `${card.definition.title}, opened. Tap to see the full number.`
    : hasKey
      ? `${card.definition.title}, sealed. ${card.teaser} Tap to open with today's key.`
      : `${card.definition.title}, sealed. ${card.teaser} No keys left today.`;

  return (
    <Animated.View style={[styles.wrap, entrance]}>
      <Animated.View style={pressStyle}>
      <Pressable
        onPress={() => onPress(card)}
        onPressIn={()  => { press.value = withSpring(0.97, { stiffness: 480, damping: 24 }); }}
        onPressOut={() => { press.value = withSpring(1,    { stiffness: 300, damping: 22 }); }}
        android_ripple={{ color: cat.bgSoft }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.tile,
          card.unlocked
            ? { backgroundColor: cat.bg, borderColor: cat.border }
            : styles.tileSealed,
        ]}
      >
        {/* Category row */}
        <View style={styles.topRow}>
          <View style={[
            styles.iconPill,
            { backgroundColor: card.unlocked ? cat.bgSoft : colors.surface2 },
          ]}>
            <Ionicons
              name={card.definition.icon as any}
              size={14}
              color={card.unlocked ? cat.deep : colors.textMuted}
            />
          </View>
          <Text
            style={[styles.category, { color: card.unlocked ? cat.accent : colors.textMuted }]}
            numberOfLines={1}
          >
            {cat.label}
          </Text>
          {card.openedToday && (
            <View style={styles.newDot} accessibilityLabel="Opened today" />
          )}
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {card.definition.title}
        </Text>

        {card.unlocked ? (
          <>
            <CountUpText
              value={card.value}
              precision={card.definition.precision}
              animateKey={card.definition.id}
              style={[styles.value, { color: cat.deep }]}
            />
            <Text style={styles.unit} numberOfLines={1}>{card.definition.unit}</Text>
          </>
        ) : (
          <>
            <Text style={styles.teaser} numberOfLines={3}>{card.teaser}</Text>
            {/* Why this number is personal, when it is. */}
            {card.source ? (
              <Text style={styles.source} numberOfLines={1}>{card.source}</Text>
            ) : null}
            <View style={[styles.cta, hasKey ? styles.ctaReady : styles.ctaWaiting]}>
              <Ionicons
                name={hasKey ? 'key' : 'lock-closed-outline'}
                size={11}
                color={hasKey ? colors.green700 : colors.textMuted}
              />
              <Text style={[styles.ctaText, hasKey && styles.ctaTextReady]}>
                {hasKey ? 'Open this' : 'Sealed'}
              </Text>
            </View>
          </>
        )}
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Memoised: the grid holds 25 tiles and the parent re-renders on every clock
 * tick. Only the fields the tile actually draws are compared.
 */
export const NumberTile = memo(NumberTileBase, (a, b) =>
  a.card.definition.id === b.card.definition.id &&
  a.card.unlocked      === b.card.unlocked &&
  a.card.value         === b.card.value &&
  a.card.openedToday   === b.card.openedToday &&
  a.card.source        === b.card.source &&
  a.hasKey             === b.hasKey &&
  a.index              === b.index,
);

const styles = StyleSheet.create({
  wrap: {
    width: '48%',
  },
  tile: {
    minHeight:     168,
    borderRadius:  radius.xl,
    borderWidth:   1,
    padding:       spacing[4],
    gap:           spacing[1] + 2,
  },
  tileSealed: {
    backgroundColor: colors.white,
    borderColor:     colors.border,
    borderStyle:     'dashed',
  },

  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  iconPill: {
    width:          24,
    height:         24,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  category: {
    flex:          1,
    fontFamily:    fontFamily.medium,
    fontSize:      10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  newDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: colors.gold,
  },

  title: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      13,
    color:         colors.textPrimary,
    letterSpacing: -0.1,
    lineHeight:    17,
  },

  value: {
    fontFamily:    fontFamily.bold,
    fontSize:      23,
    letterSpacing: -0.6,
    marginTop:     'auto',
  },
  unit: {
    fontFamily: fontFamily.regular,
    fontSize:   10.5,
    color:      colors.textMuted,
  },

  teaser: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    lineHeight: 15.5,
    color:      colors.textSecondary,
  },
  source: {
    fontFamily: fontFamily.medium,
    fontSize:   10,
    color:      colors.green500,
  },

  cta: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    alignSelf:         'flex-start',
    marginTop:         'auto',
    paddingVertical:   4,
    paddingHorizontal: spacing[2],
    borderRadius:      radius.full,
    borderWidth:       1,
  },
  ctaReady: {
    backgroundColor: colors.green50,
    borderColor:     colors.green100,
  },
  ctaWaiting: {
    backgroundColor: colors.surface2,
    borderColor:     colors.borderLight,
  },
  ctaText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   10.5,
    color:      colors.textMuted,
  },
  ctaTextReady: {
    color: colors.green700,
  },
});
