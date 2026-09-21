/**
 * Confirmation before spending a key.
 *
 * Deliberately a real decision point rather than a one-tap open. A key is the
 * scarce thing in the app; letting a mis-tap consume one and then telling the
 * user "come back tomorrow" is the kind of small betrayal that gets an app
 * deleted. It also does the honest work of restating the hook, so the choice
 * is made on information rather than on a title alone.
 *
 * Once opened, the same sheet becomes the reveal.
 */
import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CountUpText } from '@/components/ui';
import { getCategoryTheme, colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { NumberCard } from '@/hooks/useNumbers';
import { Text } from '@/components/ui/Text';

interface UnlockSheetProps {
  card:        NumberCard | null;
  keysLeft:    number;
  /** Set once the key has been spent and the figure is revealed. */
  revealed:    boolean;
  onConfirm:   () => void;
  onDismiss:   () => void;
  /** Opens the full detail screen for an already-open number. */
  onSeeDetail: () => void;
}

export function UnlockSheet({
  card, keysLeft, revealed, onConfirm, onDismiss, onSeeDetail,
}: UnlockSheetProps) {
  const visible = card !== null;

  const sheetY   = useSharedValue(320);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: 220 });
      sheetY.value   = withSpring(0, { stiffness: 240, damping: 26 });
    } else {
      backdrop.value = withTiming(0, { duration: 160 });
      sheetY.value   = withTiming(320, { duration: 200 });
    }
  }, [visible, backdrop, sheetY]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

  if (!card) return null;

  const cat = getCategoryTheme(card.definition.category);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.grabber} />

          <View style={[styles.iconWrap, { backgroundColor: cat.bg, borderColor: cat.border }]}>
            <Ionicons name={card.definition.icon as any} size={24} color={cat.deep} />
          </View>

          <Text style={styles.category}>{cat.label}</Text>
          <Text style={styles.title}>{card.definition.title}</Text>

          {revealed ? (
            <>
              <CountUpText
                value={card.value}
                precision={card.definition.precision}
                animateKey={`${card.definition.id}-reveal`}
                style={[styles.value, { color: cat.deep }]}
              />
              <Text style={styles.unit}>{card.definition.unit}</Text>
              <Text style={styles.body} numberOfLines={5}>
                {card.definition.description}
              </Text>

              <Pressable
                style={styles.primaryBtn}
                onPress={onSeeDetail}
                android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>See the full story</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={onDismiss} accessibilityRole="button">
                <Text style={styles.ghostText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.teaser}>{card.teaser}</Text>
              {card.source ? <Text style={styles.source}>{card.source}</Text> : null}

              <View style={styles.costRow}>
                <Ionicons name="key" size={13} color={colors.green700} />
                <Text style={styles.costText}>
                  Costs 1 key · {keysLeft === 1 ? '1 left' : `${keysLeft} left`}
                </Text>
              </View>

              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  onConfirm();
                }}
                android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                accessibilityRole="button"
                accessibilityLabel={`Open ${card.definition.title} using one key`}
              >
                <Text style={styles.primaryText}>Open this number</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={onDismiss} accessibilityRole="button">
                <Text style={styles.ghostText}>Not this one</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(20,32,26,0.45)' },

  sheet: {
    backgroundColor:     colors.background,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal:   spacing[6],
    paddingTop:          spacing[3],
    paddingBottom:       spacing[8],
    alignItems:          'center',
    gap:                 spacing[2],
    ...shadow.lg,
  },
  grabber: {
    width:           38,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
    marginBottom:    spacing[4],
  },

  iconWrap: {
    width:          58,
    height:         58,
    borderRadius:   radius.lg,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing[1],
  },

  category: {
    fontFamily:    fontFamily.medium,
    fontSize:      10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color:         colors.textMuted,
  },
  title: {
    fontFamily:    fontFamily.bold,
    fontSize:      21,
    color:         colors.textPrimary,
    textAlign:     'center',
    letterSpacing: -0.3,
  },

  teaser: {
    fontFamily: fontFamily.regular,
    fontSize:   13.5,
    lineHeight: 20,
    color:      colors.textSecondary,
    textAlign:  'center',
    marginTop:  spacing[1],
  },
  source: {
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      colors.green700,
    textAlign:  'center',
  },

  value: {
    fontFamily:    fontFamily.bold,
    fontSize:      44,
    letterSpacing: -1.2,
    marginTop:     spacing[2],
  },
  unit: {
    fontFamily: fontFamily.regular,
    fontSize:   12.5,
    color:      colors.textMuted,
    marginTop:  -spacing[1],
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    lineHeight: 20,
    color:      colors.textSecondary,
    textAlign:  'center',
    marginTop:  spacing[2],
  },

  costRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    marginTop:         spacing[3],
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius:      radius.full,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  costText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      colors.green700,
  },

  primaryBtn: {
    alignSelf:       'stretch',
    marginTop:       spacing[4],
    paddingVertical: spacing[4],
    borderRadius:    radius.xl,
    backgroundColor: colors.green700,
    alignItems:      'center',
    ...shadow.md,
  },
  primaryText: {
    fontFamily: fontFamily.bold,
    fontSize:   15,
    color:      colors.white,
  },
  ghostBtn: {
    alignSelf:       'stretch',
    paddingVertical: spacing[3],
    minHeight:       44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ghostText: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textMuted,
  },
});
