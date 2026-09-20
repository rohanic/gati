/**
 * NoteBottomSheet — personal annotation for a story event.
 *
 * Spring from bottom. Text input (140 char). Pin toggle.
 * Save / Delete / Dismiss.
 *
 * Design: forest green + warm off-white. No emoji. No purple. No orange.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { StoryAnnotation } from '@/store/storyStore';

const MAX_CHARS = 140;

interface NoteBottomSheetProps {
  /** The event this note belongs to — null means sheet is hidden */
  itemId:     string | null;
  /** Title of the event shown in the header */
  eventTitle: string;
  /** Existing annotation (if any) — used to populate text + pin state */
  existing:   StoryAnnotation | undefined;
  onSave:     (itemId: string, text: string, pinned: boolean) => void;
  onDelete:   (itemId: string) => void;
  onDismiss:  () => void;
}

export function NoteBottomSheet({
  itemId,
  eventTitle,
  existing,
  onSave,
  onDelete,
  onDismiss,
}: NoteBottomSheetProps) {
  const visible    = itemId !== null;
  const inputRef   = useRef<TextInput>(null);
  const [text,   setText]   = useState(existing?.text   ?? '');
  const [pinned, setPinned] = useState(existing?.pinned ?? false);

  // Adjust state during render when the sheet opens for a different item.
  // React's documented pattern for deriving state from props; doing it in an
  // effect rendered one frame of the previous note's text first.
  const openKey = visible ? itemId : null;
  const [lastOpenKey, setLastOpenKey] = useState(openKey);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (openKey !== null) {
      setText(existing?.text   ?? '');
      setPinned(existing?.pinned ?? false);
    }
  }

  // Focus after the entrance animation settles, so the keyboard does not
  // fight the spring.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [visible, itemId]);

  // ── Spring entrance ──
  const sheetY    = useSharedValue(500);
  const overlayOp = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      overlayOp.value = withTiming(1, { duration: 240 });
      sheetY.value    = withSpring(0, { stiffness: 220, damping: 24 });
    } else {
      // Reset off-screen when hidden so the next open always slides in — even
      // if the parent cleared `itemId` without going through animateOut.
      overlayOp.value = 0;
      sheetY.value    = 500;
    }
  }, [visible]);

  const animateOut = useCallback((cb: () => void) => {
    overlayOp.value = withTiming(0, { duration: 220 });
    sheetY.value    = withTiming(500, {
      duration: 260,
      easing:   Easing.bezier(0.11, 0, 0.5, 0),
    });
    setTimeout(cb, 280);
  }, []);

  const handleDismiss = useCallback(() => animateOut(onDismiss), [animateOut, onDismiss]);

  const handleSave = useCallback(() => {
    if (!itemId || text.trim().length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(itemId, text.trim(), pinned);
    animateOut(onDismiss);
  }, [itemId, text, pinned, onSave, animateOut, onDismiss]);

  const handleDelete = useCallback(() => {
    if (!itemId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete(itemId);
    animateOut(onDismiss);
  }, [itemId, onDelete, animateOut, onDismiss]);

  const handleTogglePin = useCallback(() => {
    Haptics.selectionAsync();
    setPinned((v) => !v);
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));
  const sheetStyle   = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const remaining   = MAX_CHARS - text.length;
  const nearLimit   = remaining <= 30;
  const overLimit   = remaining < 0;
  const canSave     = text.trim().length > 0 && !overLimit;
  const hasExisting = (existing?.text.trim().length ?? 0) > 0;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />

          <Animated.View style={[styles.sheet, sheetStyle]}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerLabel}>Add a note</Text>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {eventTitle}
                </Text>
              </View>
              <Pressable
                onPress={handleDismiss}
                style={styles.closeBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Text input */}
            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="What were you thinking that day?"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={MAX_CHARS + 10}   // soft cap enforced by counter
                returnKeyType="default"
                autoCorrect
                autoCapitalize="sentences"
                accessibilityLabel="Write a note for this moment"
              />
              {nearLimit && (
                <Text style={[styles.charCount, overLimit && styles.charCountOver]}>
                  {remaining}
                </Text>
              )}
            </View>

            {/* Pin toggle */}
            <Pressable
              onPress={handleTogglePin}
              style={styles.pinRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: pinned }}
              accessibilityLabel="Pin this moment as a chapter"
            >
              <View style={[styles.pinCheck, pinned && styles.pinCheckActive]}>
                {pinned && (
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                )}
              </View>
              <View style={styles.pinTextBlock}>
                <Text style={styles.pinLabel}>Pin as a chapter</Text>
                <Text style={styles.pinSub}>
                  Pinned moments stand out in your timeline
                </Text>
              </View>
              <Ionicons
                name={pinned ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={pinned ? colors.gold : colors.textMuted}
              />
            </Pressable>

            {/* Actions */}
            <View style={styles.actions}>
              {hasExisting && (
                <Pressable
                  onPress={handleDelete}
                  style={styles.deleteBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Delete note"
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleSave}
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityLabel="Save note"
              >
                <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
                  Save note
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(10, 24, 14, 0.50)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop:           spacing[3],
    paddingBottom:        Platform.OS === 'ios' ? spacing[10] : spacing[7],
    paddingHorizontal:    spacing[5],
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -3 },
    shadowOpacity:        0.07,
    shadowRadius:         12,
    elevation:            12,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.borderLight,
    alignSelf:       'center',
    marginBottom:    spacing[5],
  },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing[5],
  },
  headerLeft: { flex: 1, marginRight: spacing[3] },
  headerLabel: {
    fontFamily:   fontFamily.bold,
    fontSize:     17,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  eventTitle: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },
  closeBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Input
  inputWrap: {
    backgroundColor: colors.background,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[4],
    minHeight:       100,
    marginBottom:    spacing[4],
    position:        'relative',
  },
  input: {
    fontFamily:  fontFamily.regular,
    fontSize:    14,
    color:       colors.textPrimary,
    lineHeight:  21.5,
    minHeight:   72,
    textAlignVertical: 'top',
  },
  charCount: {
    position:   'absolute',
    right:      spacing[3],
    bottom:     spacing[2],
    fontFamily: fontFamily.regular,
    fontSize:   10.5,
    color:      colors.textMuted,
  },
  charCountOver: {
    color: '#C0392B',
  },

  // Pin toggle
  pinRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[3],
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.xl,
    backgroundColor:   colors.surface2,
    borderWidth:       1,
    borderColor:       colors.borderLight,
    marginBottom:      spacing[5],
  },
  pinCheck: {
    width:           20,
    height:          20,
    borderRadius:    6,
    borderWidth:     2,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.white,
  },
  pinCheckActive: {
    borderColor:     colors.gold,
    backgroundColor: colors.gold,
  },
  pinTextBlock: { flex: 1 },
  pinLabel: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     13,
    color:        colors.textPrimary,
    marginBottom: 1,
  },
  pinSub: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
  },

  // Actions
  actions: {
    flexDirection:  'row',
    gap:            spacing[3],
    alignItems:     'center',
  },
  deleteBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius:      radius.xl,
    backgroundColor:   colors.surface2,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  deleteBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.textMuted,
  },
  saveBtn: {
    flex:              1,
    alignItems:        'center',
    paddingVertical:   spacing[4],
    borderRadius:      radius.xl,
    backgroundColor:   colors.green700,
  },
  saveBtnDisabled: {
    backgroundColor: colors.green100,
  },
  saveBtnText: {
    fontFamily: fontFamily.bold,
    fontSize:   14,
    color:      colors.white,
  },
  saveBtnTextDisabled: {
    color: colors.green300,
  },
});
