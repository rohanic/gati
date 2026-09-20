/**
 * Profile & Settings screen — Week 8 full build.
 *
 * Sections:
 *  1. Avatar + name + member since
 *  2. Stats widget (live from stores)
 *  3. Account  — name, date of birth
 *  4. Habits   — sleep, coffee, phone, exercise
 *  5. Preferences — notification time, interests
 *  6. Gati Pro upgrade card (shimmer badge, monthly/yearly toggle)
 *  7. About / version
 *
 * Animations:
 *  - Section headers: fade in staggered
 *  - Setting rows: slide from right staggered
 *  - Pro badge: continuous shimmer (LinearGradient sweep)
 *  - Toggle: spring pill slide
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Share,
  Linking,
  TextInput,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { parseISO, differenceInDays, format } from 'date-fns';
import { useUserStore, useStatsStore, useWanderStore, useProStatus, useTrialDaysLeft } from '@/store/userStore';
import { useAccess } from '@/hooks/useAccess';
import { useStoryStore } from '@/store/storyStore';
import { useAuthStore }  from '@/store/authStore';
import { computeBestStreakFromRanges } from '@/hooks/useStreak';
import { refreshNotificationsOnOpen } from '@/services/notifications';
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL } from '@/config';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { ExerciseFrequency, InterestCategory } from '@/types';

// ─── Constants ────────────────────────────────────────────────
const EXERCISE_OPTIONS: { value: ExerciseFrequency; label: string }[] = [
  { value: 'regular',   label: 'Regular (4+ days/wk)' },
  { value: 'sometimes', label: 'Sometimes (1-3 days/wk)' },
  { value: 'rarely',    label: 'Rarely or never' },
];

const INTEREST_OPTIONS: { value: InterestCategory; label: string; icon: string }[] = [
  { value: 'food',      label: 'Food',      icon: 'restaurant-outline'  },
  { value: 'cafe',      label: 'Cafes',     icon: 'cafe-outline'         },
  { value: 'history',   label: 'History',   icon: 'library-outline'      },
  { value: 'nature',    label: 'Nature',    icon: 'leaf-outline'         },
  { value: 'art',       label: 'Art',       icon: 'color-palette-outline'},
  { value: 'market',    label: 'Markets',   icon: 'storefront-outline'   },
  { value: 'nightlife', label: 'Nightlife', icon: 'moon-outline'         },
  { value: 'books',     label: 'Books',     icon: 'book-outline'         },
];

// ─── Habit picker options ─────────────────────────────────────
const SLEEP_OPTIONS: { value: string; label: string }[] = [
  { value: '4', label: '4 hours' }, { value: '5', label: '5 hours' },
  { value: '6', label: '6 hours' }, { value: '7', label: '7 hours' },
  { value: '8', label: '8 hours' }, { value: '9', label: '9 hours' },
  { value: '10', label: '10 hours' }, { value: '11', label: '11 hours' },
  { value: '12', label: '12 hours' },
];
const COFFEE_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'None'     }, { value: '1', label: '1 cup'    },
  { value: '2', label: '2 cups'   }, { value: '3', label: '3 cups'   },
  { value: '4', label: '4 cups'   }, { value: '5', label: '5 cups'   },
  { value: '6', label: '6 cups'   }, { value: '8', label: '8+ cups'  },
];
const PHONE_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 hour'    }, { value: '2', label: '2 hours'  },
  { value: '3', label: '3 hours'   }, { value: '4', label: '4 hours'  },
  { value: '5', label: '5 hours'   }, { value: '6', label: '6 hours'  },
  { value: '7', label: '7 hours'   }, { value: '8', label: '8 hours'  },
  { value: '10', label: '10 hours' }, { value: '12', label: '12+ hours'},
];
const WATER_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'None'       }, { value: '2', label: '2 glasses' },
  { value: '4', label: '4 glasses'  }, { value: '6', label: '6 glasses' },
  { value: '8', label: '8 glasses'  }, { value: '10', label: '10 glasses'},
  { value: '12', label: '12 glasses'}, { value: '15', label: '15+ glasses'},
];
const MUSIC_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'None'      }, { value: '1', label: '1 hour'   },
  { value: '2', label: '2 hours'   }, { value: '3', label: '3 hours'  },
  { value: '4', label: '4 hours'   }, { value: '6', label: '6 hours'  },
  { value: '8', label: '8 hours'   }, { value: '12', label: '12+ hours'},
];
const COMMUTE_OPTIONS: { value: string; label: string }[] = [
  { value: '0',   label: 'None'       }, { value: '15',  label: '15 min'  },
  { value: '30',  label: '30 min'     }, { value: '45',  label: '45 min'  },
  { value: '60',  label: '1 hour'     }, { value: '90',  label: '1.5 hours'},
  { value: '120', label: '2 hours'    }, { value: '180', label: '3+ hours' },
];
const MEALS_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 meal'  }, { value: '2', label: '2 meals' },
  { value: '3', label: '3 meals' }, { value: '4', label: '4 meals' },
  { value: '5', label: '5 meals' }, { value: '6', label: '6+ meals'},
];

// ─── Wheel picker data ────────────────────────────────────────
const ITEM_H     = 46;
const WHEEL_H    = ITEM_H * 5;   // 5 visible rows; center = selected
const WHEEL_PAD  = ITEM_H * 2;   // top/bottom padding centres first/last item

const _YEAR      = new Date().getFullYear();
const DOB_DAYS   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const DOB_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOB_YEARS  = Array.from(
  { length: (_YEAR - 10) - 1910 + 1 },
  (_, i) => String(_YEAR - 10 - i),
);
const TIME_HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const TIME_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

// ─── Wheel picker (D1) ────────────────────────────────────────
function WheelColumn({
  items,
  initIndex,
  onChange,
}: {
  items:     string[];
  initIndex: number;
  onChange:  (i: number) => void;
}) {
  const scrollRef   = useRef<ScrollView>(null);
  const [sel, setSel] = useState(initIndex);
  const cbRef       = useRef(onChange);
  cbRef.current     = onChange;

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initIndex * ITEM_H, animated: false });
      setSel(initIndex);
    }, 80);
    return () => clearTimeout(t);
  }, [initIndex]);

  const commit = (rawY: number) => {
    const next = Math.max(0, Math.min(Math.round(rawY / ITEM_H), items.length - 1));
    setSel(next);
    cbRef.current(next);
    Haptics.selectionAsync();
  };

  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={(e: any) => commit(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={(e: any)    => commit(e.nativeEvent.contentOffset.y)}
      style={{ height: WHEEL_H }}
      contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
    >
      {items.map((label, i) => (
        <View key={i} style={wStyles.wheelItem}>
          <Text style={[wStyles.wheelText, i === sel && wStyles.wheelTextSel]}>
            {label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function WheelPickerModal({
  visible,
  title,
  columns,
  onSave,
  onClose,
}: {
  visible:  boolean;
  title:    string;
  columns:  { items: string[]; initIndex: number; flex?: number }[];
  onSave:   (indices: number[]) => void;
  onClose:  () => void;
}) {
  const idxRef = useRef(columns.map((c) => c.initIndex));

  useEffect(() => {
    if (visible) idxRef.current = columns.map((c) => c.initIndex);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerContainer}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <View style={wStyles.wheelRow}>
            <View style={wStyles.wheelBand} pointerEvents="none" />
            {columns.map((col, ci) => (
              <View key={ci} style={{ flex: col.flex ?? 1 }}>
                <WheelColumn
                  items={col.items}
                  initIndex={col.initIndex}
                  onChange={(idx) => { idxRef.current[ci] = idx; }}
                />
              </View>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.modalSave}
              onPress={() => { onSave([...idxRef.current]); onClose(); }}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Animated settings row ────────────────────────────────────
function SettingRow({
  icon,
  label,
  value,
  onPress,
  delay,
  highlight,
  destructive,
}: {
  icon:      string;
  label:     string;
  value?:    string;
  onPress?:  () => void;
  delay:     number;
  highlight?: boolean;
  /** Red treatment for irreversible actions (account deletion). */
  destructive?: boolean;
}) {
  const tx = useSharedValue(24);
  const op = useSharedValue(0);

  useEffect(() => {
    tx.value = withDelay(delay, withSpring(0,  { stiffness: 220, damping: 22 }));
    op.value = withDelay(delay, withTiming(1,  { duration: 280 }));
  }, [delay]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <Animated.View style={rowStyle}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: destructive ? colors.errorBg : colors.green50 }}
        style={({ pressed }) => [
          styles.settingRow,
          pressed && styles.settingRowPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={[
          styles.settingIcon,
          highlight && styles.settingIconHighlight,
          destructive && styles.settingIconDestructive,
        ]}>
          <Ionicons
            name={icon as any}
            size={17}
            color={destructive ? colors.error : highlight ? colors.gold : colors.textSecondary}
          />
        </View>
        <View style={styles.settingRowText}>
          <Text style={[
            styles.settingLabel,
            highlight && styles.settingLabelHighlight,
            destructive && styles.settingLabelDestructive,
          ]}>
            {label}
          </Text>
          {value !== undefined && (
            <Text style={styles.settingValue} numberOfLines={1}>{value}</Text>
          )}
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Section wrapper with animated header ─────────────────────
function SectionCard({
  title,
  icon,
  delay,
  children,
}: {
  title:    string;
  icon:     string;
  delay:    number;
  children: React.ReactNode;
}) {
  const op = useSharedValue(0);
  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 360 }));
  }, [delay]);
  const headerStyle = useAnimatedStyle(() => ({ opacity: op.value }));

  return (
    <View style={styles.section}>
      <Animated.View style={[styles.sectionHeader, headerStyle]}>
        <Ionicons name={icon as any} size={13} color={colors.textMuted} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </Animated.View>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );
}

// ─── Pro badge with shimmer ───────────────────────────────────
function ProBadge() {
  const shimX = useSharedValue(-80);
  useEffect(() => {
    shimX.value = withRepeat(
      withSequence(
        withTiming(160, { duration: 1600, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
        withTiming(-80, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);
  const shimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimX.value }],
  }));

  return (
    <View style={styles.proBadge}>
      <Text style={styles.proBadgeText}>PRO</Text>
      <Animated.View style={[styles.shimmerWrap, shimStyle]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

// ─── Billing toggle ───────────────────────────────────────────
function BillingToggle({
  monthly,
  onToggle,
}: {
  monthly:  boolean;
  onToggle: () => void;
}) {
  const pillX = useSharedValue(monthly ? 0 : 1);

  useEffect(() => {
    pillX.value = withSpring(monthly ? 0 : 1, { stiffness: 300, damping: 22 });
  }, [monthly]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value * 88 }],
  }));

  return (
    <Pressable onPress={onToggle} android_ripple={{ color: colors.green50, borderless: true }}>
      <View style={styles.billingTrack}>
        <Animated.View style={[styles.billingPill, pillStyle]} />
        <Text style={[styles.billingLabel, monthly && styles.billingLabelActive]}>Monthly</Text>
        <Text style={[styles.billingLabel, !monthly && styles.billingLabelActive]}>Yearly</Text>
      </View>
    </Pressable>
  );
}

// ─── Simple text-edit modal ───────────────────────────────────
function EditModal({
  visible,
  title,
  placeholder,
  value,
  onSave,
  onClose,
  keyboardType,
}: {
  visible:      boolean;
  title:        string;
  placeholder:  string;
  value:        string;
  onSave:       (v: string) => void;
  onClose:      () => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  // Keyed on `value` by the parent, so the modal remounts with fresh state
  // when a different field is opened. Previously this synced with a
  // setState-in-effect, which rendered one frame of the *previous* field's
  // text every time the modal opened.
  const [text, setText] = useState(value);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.modalInput}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            autoFocus
            keyboardType={keyboardType ?? 'default'}
            returnKeyType="done"
            onSubmitEditing={() => { onSave(text.trim()); onClose(); }}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => { onSave(text.trim()); onClose(); }}
              style={styles.modalSave}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Action sheet (picker) ───────────────────────────────────
function PickerModal<T extends string>({
  visible,
  title,
  options,
  current,
  onSelect,
  onClose,
}: {
  visible:  boolean;
  title:    string;
  options:  { value: T; label: string }[];
  current:  T;
  onSelect: (v: T) => void;
  onClose:  () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerContainer}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>{title}</Text>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              style={styles.pickerRow}
              onPress={() => { onSelect(opt.value); onClose(); }}
              android_ripple={{ color: colors.green50 }}
            >
              <Text style={[styles.pickerLabel, opt.value === current && styles.pickerLabelActive]}>
                {opt.label}
              </Text>
              {opt.value === current && (
                <Ionicons name="checkmark" size={17} color={colors.green700} />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────
export default function ProfileScreen() {
  const profile        = useUserStore((s) => s.profile);
  const updateProfile  = useUserStore((s) => s.updateProfile);
  const unlockedStats       = useStatsStore((s) => s.unlockedStats);
  const openHistory         = useStatsStore((s) => s.openHistory);
  const openHistoryRanges   = useStatsStore((s) => s.openHistoryRanges);
  const maxStreakEver        = useStatsStore((s) => s.maxStreakEver);
  const places                = useWanderStore((s) => s.places);
  const resetInterestScores   = useWanderStore((s) => s.resetInterestScores);
  const categoryScores        = useWanderStore((s) => s.categoryScores);
  const importCategoryScores  = useWanderStore((s) => s.importCategoryScores);
  const annotations           = useStoryStore((s) => s.annotations);
  const importAnnotations     = useStoryStore((s) => s.importAnnotations);

  // ── Auth / cloud backup ──
  const proStatus      = useProStatus();
  const access         = useAccess();
  const trialDaysLeft  = useTrialDaysLeft();
  const authUserId     = useAuthStore((s) => s.userId);
  const authEmail      = useAuthStore((s) => s.userEmail);
  const isSyncing      = useAuthStore((s) => s.isSyncing);
  const lastSyncedAt   = useAuthStore((s) => s.lastSyncedAt);
  const syncError      = useAuthStore((s) => s.syncError);
  const syncNow        = useAuthStore((s) => s.syncNow);
  const signOut        = useAuthStore((s) => s.signOut);
  const deleteAccountAndSignOut = useAuthStore((s) => s.deleteAccountAndSignOut);
  // Server push handles the daily reminder once the user is signed in.
  const serverPushEnabled = authUserId !== null;
  const [deleting, setDeleting] = useState(false);

  // ── Live stats ──
  const daysAlive       = profile
    ? Math.max(1, differenceInDays(new Date(), new Date(profile.dateOfBirth + 'T00:00:00')))
    : 0;
  // Prefer ranges (never truncated); fall back to maxStreakEver which is
  // persisted and always reflects the all-time best even after flat history
  // rolls past 400 entries.
  const bestStreak = openHistoryRanges.length > 0
    ? Math.max(computeBestStreakFromRanges(openHistoryRanges), maxStreakEver)
    : maxStreakEver;
  const placesDiscovered = places.filter((p) => p.discoveredDate !== null).length;
  const savedPlaces     = places.filter((p) => p.isSaved).length;

  const memberSince = profile?.appJoinDate
    ? format(parseISO(profile.appJoinDate), 'MMMM yyyy')
    : 'today';

  const lastSyncLabel = lastSyncedAt
    ? `Last synced ${format(parseISO(lastSyncedAt), 'MMM d, h:mm a')}`
    : syncError
    ? 'Sync failed — tap to retry'
    : 'Not yet synced';

  // ── Billing toggle ──
  const [isMonthly, setIsMonthly] = useState(true);

  // ── Edit modals ──
  const [editingName,  setEditingName]  = useState(false);
  const [showDobWheel, setShowDobWheel] = useState(false);
  const [showTimeWheel,setShowTimeWheel]= useState(false);
  const [pickerSleep,    setPickerSleep]    = useState(false);
  const [pickerCoffee,   setPickerCoffee]   = useState(false);
  const [pickerPhone,    setPickerPhone]    = useState(false);
  const [pickerEx,       setPickerEx]       = useState(false);
  const [pickerWater,    setPickerWater]    = useState(false);
  const [pickerMusic,    setPickerMusic]    = useState(false);
  const [pickerCommute,  setPickerCommute]  = useState(false);
  const [pickerMeals,    setPickerMeals]    = useState(false);

  // ── Avatar animation ──
  const avatarScale = useSharedValue(0.8);
  const avatarOp    = useSharedValue(0);
  useEffect(() => {
    avatarScale.value = withSpring(1, { stiffness: 220, damping: 20 });
    avatarOp.value    = withTiming(1, { duration: 350 });
  }, []);
  const avatarStyle = useAnimatedStyle(() => ({
    opacity:   avatarOp.value,
    transform: [{ scale: avatarScale.value }],
  }));

  // ── #18: Habit-save toast ────────────────────────────────────
  const [toastText, setToastText]   = useState('');
  const toastOp                     = useSharedValue(0);
  const toastY                      = useSharedValue(12);
  const toastTimerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastStyle                  = useAnimatedStyle(() => ({
    opacity:   toastOp.value,
    transform: [{ translateY: toastY.value }],
  }));

  const showHabitToast = useCallback((text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(text);
    toastOp.value = withTiming(1, { duration: 200 });
    toastY.value  = withSpring(0, { stiffness: 260, damping: 22 });
    toastTimerRef.current = setTimeout(() => {
      toastOp.value = withTiming(0, { duration: 280 });
      toastY.value  = withTiming(12, { duration: 280 });
    }, 2000);
  }, []);

  const HABIT_KEYS = new Set([
    'sleepHoursPerNight', 'coffeeCupsPerDay', 'phoneHoursPerDay',
    'exerciseFrequency',  'waterGlassesPerDay', 'musicHoursPerDay',
    'commuteMinutesPerDay', 'mealsPerDay',
  ]);

  // ── #20/#21: Restore from backup ────────────────────────────
  const [showRestore, setShowRestore]     = useState(false);
  const [restoreText, setRestoreText]     = useState('');
  const [restoreError, setRestoreError]   = useState('');

  const saveProfileField = useCallback(
    (partial: Parameters<typeof updateProfile>[0]) => {
      updateProfile(partial);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Show a brief confirmation toast whenever a habit that affects stats is saved
      if (Object.keys(partial).some((k) => HABIT_KEYS.has(k))) {
        showHabitToast('Stats recalculated');
      }
    },
    [updateProfile, showHabitToast]
  );

  const handleInterestToggle = useCallback(
    (cat: InterestCategory) => {
      if (!profile) return;
      const current = profile.interestCategories ?? [];
      const next = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      if (next.length === 0) {
        // Notify user instead of silently ignoring the tap
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('At least one interest needed', 'Wander uses your interests to find places. Keep at least one selected.');
        return;
      }
      saveProfileField({ interestCategories: next });
      // Re-derive Wander category scores so new interests are immediately boosted
      // and removed interests return to neutral — bypasses the onboarding-only guard.
      resetInterestScores(next as InterestCategory[]);
    },
    [profile, saveProfileField, resetInterestScores]
  );

  // ── DOB wheel helpers ──
  const initDobIndices = useMemo((): [number, number, number] => {
    const dob = profile?.dateOfBirth;
    if (!dob) {
      const defYear = String(_YEAR - 25);
      return [0, 0, Math.max(0, DOB_YEARS.indexOf(defYear))];
    }
    const d  = new Date(dob + 'T00:00:00');
    const yi = DOB_YEARS.indexOf(String(d.getFullYear()));
    return [d.getDate() - 1, d.getMonth(), yi >= 0 ? yi : 0];
  }, [profile?.dateOfBirth]);

  const handleDobSave = useCallback((indices: number[]) => {
    const day   = indices[0] + 1;
    const month = indices[1] + 1;
    const year  = parseInt(DOB_YEARS[indices[2]], 10);
    const maxDay = new Date(year, month, 0).getDate();
    const d = String(Math.min(day, maxDay)).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    saveProfileField({ dateOfBirth: `${year}-${m}-${d}` });
  }, [saveProfileField]);

  // ── Time wheel helpers ──
  const initTimeIndices = useMemo((): [number, number] => {
    const t = profile?.notificationTime;
    if (!t) return [8, 0];
    const [h, mm] = t.split(':').map(Number);
    return [
      Math.max(0, Math.min(h, 23)),
      Math.max(0, Math.min(Math.round(mm / 5), 11)),
    ];
  }, [profile?.notificationTime]);

  const handleTimeSave = useCallback((indices: number[]) => {
    const formatted = `${TIME_HOURS[indices[0]]}:${TIME_MINUTES[indices[1]]}`;
    saveProfileField({ notificationTime: formatted });
    // Route through refreshNotificationsOnOpen rather than calling
    // scheduleGatiNotifications directly. For a signed-in user the server
    // sends the daily push, and scheduling a local one as well meant they got
    // the same reminder twice. This picks the right path and cancels the other.
    refreshNotificationsOnOpen(formatted, undefined, serverPushEnabled).catch(() => {});
    // Push the new time up so the server-side schedule follows it.
    if (serverPushEnabled) syncNow().catch(() => {});
  }, [saveProfileField, serverPushEnabled, syncNow]);

  const handleExport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const exportData = {
      exportedAt: new Date().toISOString(),
      version:    '1.0.0',
      profile,
      stats: {
        unlockedStats,
        openHistory,
      },
      wander: places
        .filter((p) => p.isSaved || p.isVisited || p.userRating !== null)
        .map((p) => ({
          name:        p.name,
          address:     p.address,
          category:    p.category,
          isSaved:     p.isSaved,
          isVisited:   p.isVisited,
          userRating:  p.userRating,
          visitedDate: p.visitedDate,
        })),
      storyAnnotations: Object.values(annotations),
      categoryScores,
    };
    Share.share({
      message:  JSON.stringify(exportData, null, 2),
      title:    'Gati data export',
    }).catch(() => {});
  }, [profile, unlockedStats, openHistory, places, annotations, categoryScores]);

  const handleRestore = useCallback(() => {
    setRestoreError('');
    let parsed: any;
    try {
      parsed = JSON.parse(restoreText.trim());
    } catch {
      setRestoreError('Invalid JSON — paste the full exported text.');
      return;
    }
    // Restore story annotations
    if (parsed.storyAnnotations && Array.isArray(parsed.storyAnnotations)) {
      const records: Record<string, any> = {};
      for (const a of parsed.storyAnnotations) {
        if (a?.itemId) records[a.itemId] = a;
      }
      importAnnotations(records);
    }
    // Restore category scores
    if (parsed.categoryScores && typeof parsed.categoryScores === 'object') {
      importCategoryScores(parsed.categoryScores);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowRestore(false);
    setRestoreText('');
    Alert.alert('Restored', 'Your notes and interest scores have been restored.');
  }, [restoreText, importAnnotations, importCategoryScores]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Profile</Text>
        </View>

        {/* ── Avatar ── */}
        <Animated.View style={[styles.avatarSection, avatarStyle]}>
          <View style={styles.avatar}>
            {profile?.firstName ? (
              <Text style={styles.avatarInitial}>
                {profile.firstName.trim()[0].toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="person" size={32} color={colors.green700} />
            )}
          </View>
          <Text style={styles.displayName}>
            {profile?.firstName ?? 'Your name'}
          </Text>
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
        </Animated.View>

        {/* ── Stats widget ── */}
        <View style={styles.statsRow}>
          {[
            { value: String(unlockedStats.length), label: 'Stats\nunlocked' },
            { value: String(bestStreak),           label: 'Best\nstreak'    },
            { value: String(savedPlaces),          label: 'Places\nsaved'   },
            { value: daysAlive.toLocaleString(),   label: 'Days\nalive'     },
          ].map((item, i) => (
            <React.Fragment key={item.label}>
              <View
                style={styles.statBox}
                accessible
                accessibilityLabel={`${item.value} ${item.label.replace('\n', ' ')}`}
              >
                <Text style={styles.statValue} maxFontSizeMultiplier={1.2}>{item.value}</Text>
                <Text style={styles.statLabel} maxFontSizeMultiplier={1.2}>{item.label}</Text>
              </View>
              {i < 3 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Account ── */}
        <SectionCard title="Account" icon="person-outline" delay={80}>
          <SettingRow
            icon="text-outline"
            label="Name"
            value={profile?.firstName ?? '-'}
            onPress={() => setEditingName(true)}
            delay={120}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="calendar-outline"
            label="Date of birth"
            value={profile?.dateOfBirth
              ? format(parseISO(profile.dateOfBirth), 'dd MMM yyyy')
              : '-'}
            onPress={() => setShowDobWheel(true)}
            delay={160}
          />
        </SectionCard>

        {/* ── Habits ── */}
        <SectionCard title="Your habits" icon="bar-chart-outline" delay={200}>
          <SettingRow
            icon="moon-outline"
            label="Sleep per night"
            value={profile ? `${profile.sleepHoursPerNight} hours` : '-'}
            onPress={() => setPickerSleep(true)}
            delay={240}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="cafe-outline"
            label="Coffee per day"
            value={profile ? `${profile.coffeeCupsPerDay} cups` : '-'}
            onPress={() => setPickerCoffee(true)}
            delay={280}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="phone-portrait-outline"
            label="Phone per day"
            value={profile ? `${profile.phoneHoursPerDay} hours` : '-'}
            onPress={() => setPickerPhone(true)}
            delay={320}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="walk-outline"
            label="Exercise frequency"
            value={
              EXERCISE_OPTIONS.find((o) => o.value === profile?.exerciseFrequency)?.label ?? '-'
            }
            onPress={() => setPickerEx(true)}
            delay={360}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="water-outline"
            label="Water per day"
            value={profile ? `${profile.waterGlassesPerDay ?? 6} glasses` : '-'}
            onPress={() => setPickerWater(true)}
            delay={400}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="musical-notes-outline"
            label="Music per day"
            value={profile ? `${profile.musicHoursPerDay ?? 2} hours` : '-'}
            onPress={() => setPickerMusic(true)}
            delay={440}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="car-outline"
            label="Daily commute"
            value={profile ? `${profile.commuteMinutesPerDay ?? 30} min` : '-'}
            onPress={() => setPickerCommute(true)}
            delay={480}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="restaurant-outline"
            label="Meals per day"
            value={profile ? `${profile.mealsPerDay ?? 3} meals` : '-'}
            onPress={() => setPickerMeals(true)}
            delay={520}
          />
        </SectionCard>

        {/* ── Preferences ── */}
        <SectionCard title="Preferences" icon="settings-outline" delay={380}>
          <SettingRow
            icon="notifications-outline"
            label="Daily notification"
            value={profile?.notificationTime ?? '-'}
            onPress={() => setShowTimeWheel(true)}
            delay={420}
          />
          <View style={styles.rowDivider} />
          {/* Interests multi-select */}
          <View style={styles.interestsWrap}>
            <Text style={styles.interestsHeading}>Interests</Text>
            <View style={styles.interestsGrid}>
              {INTEREST_OPTIONS.map((opt) => {
                const active = profile?.interestCategories?.includes(opt.value) ?? false;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleInterestToggle(opt.value)}
                    android_ripple={{ color: colors.green50, borderless: true }}
                    style={[styles.interestChip, active && styles.interestChipActive]}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={14}
                      color={active ? colors.green700 : colors.textMuted}
                    />
                    <Text style={[styles.interestChipText, active && styles.interestChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SectionCard>

        {/* ── Gati Pro upgrade card ── */}
        {/* Hidden entirely while the app is free for everyone — a "go Pro"
            pitch for features nobody is paying for is just noise. Gated on
            `useAccess` rather than the legacy `profile.isPro` field, which is
            written once at onboarding and never updated. */}
        {access.showUpgradePrompts && (
          <View style={styles.proCard}>
            {/* Header */}
            <View style={styles.proCardHeader}>
              <View style={styles.proCardTitles}>
                <ProBadge />
                <Text style={styles.proCardTitle}>Upgrade to Gati Pro</Text>
                <Text style={styles.proCardDesc}>
                  Unlock deeper insights, unlimited stats, and lifetime milestones.
                </Text>
              </View>
            </View>

            {/* Feature list — must match the gating that actually exists. */}
            {[
              'All 25 life stats, always open',
              'What-if projections',
              'Your full story timeline',
              'Unlimited saved places',
            ].map((feat) => (
              <View key={feat} style={styles.proFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.green700} />
                <Text style={styles.proFeatureText}>{feat}</Text>
              </View>
            ))}

            {/*
              No price is shown here any more.
              These were hard-coded as "$4.99 / $39.99", which is simply the
              wrong number for every user outside the US and breaches both
              stores' pricing rules. The /pro screen fetches the real localised
              price from the store, so this card links there instead of
              duplicating a second, unreliable paywall.
            */}

            <Pressable
              style={({ pressed }) => [styles.proCtaBtn, pressed && { opacity: 0.88 }]}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/pro');
              }}
              accessibilityRole="button"
              accessibilityLabel="See Gati Pro plans and pricing"
            >
              <Text style={styles.proCtaText}>
                {proStatus === 'trial' ? 'See plans' : 'See all Pro features'}
              </Text>
            </Pressable>
            <Text style={styles.proCtaHint}>
              {proStatus === 'trial'
                ? trialDaysLeft === 1
                  ? 'Last day of your free trial'
                  : `${trialDaysLeft} days left in your free trial`
                : 'Prices shown in your local currency · Cancel any time'}
            </Text>
          </View>
        )}

        {/* ── Cloud Backup ── */}
        <SectionCard title="Cloud Backup" icon="cloud-outline" delay={450}>
          {authUserId ? (
            <>
              {/* Signed-in state */}
              <View style={styles.syncStatus}>
                <View style={styles.syncStatusLeft}>
                  <View style={[styles.syncDot, syncError ? styles.syncDotError : styles.syncDotOk]} />
                  <View>
                    <Text style={styles.syncEmailText}>{authEmail}</Text>
                    <Text style={[styles.syncSubText, syncError && styles.syncSubTextError]}>
                      {lastSyncLabel}
                    </Text>
                  </View>
                </View>
                {isSyncing && <ActivityIndicator size="small" color={colors.green700} />}
              </View>
              <View style={styles.rowDivider} />
              <SettingRow
                icon="sync-outline"
                label="Sync now"
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  try { await syncNow(); } catch { }
                }}
                delay={452}
              />
              <View style={styles.rowDivider} />
              <SettingRow
                icon="log-out-outline"
                label="Sign out"
                onPress={() => {
                  Alert.alert('Sign out', 'Your data stays on this device. Sign in again on any device to restore it.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
                  ]);
                }}
                delay={454}
              />
              <View style={styles.rowDivider} />
              {/*
                Account deletion is mandatory: Google Play's User Data policy
                requires an in-app deletion route for any app that offers
                account creation, and App Store guideline 5.1.1(v) says the
                same. Two-step confirmation because it cannot be undone.
              */}
              <SettingRow
                icon="trash-outline"
                label={deleting ? 'Deleting account…' : 'Delete account'}
                destructive
                onPress={() => {
                  if (deleting) return;
                  Alert.alert(
                    'Delete your account?',
                    'This permanently erases your profile, streak, saved places and notes from Gati’s servers. ' +
                    'It cannot be undone, and it does not cancel an active subscription — cancel that in the Play Store first.',
                    [
                      { text: 'Keep my account', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          Alert.alert(
                            'Last chance',
                            'Everything is erased the moment you confirm. Are you sure?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete permanently',
                                style: 'destructive',
                                onPress: async () => {
                                  setDeleting(true);
                                  try {
                                    await deleteAccountAndSignOut();
                                    Alert.alert(
                                      'Account deleted',
                                      'Your server data is gone. Anything still on this phone can be cleared by uninstalling Gati.',
                                    );
                                  } catch (e) {
                                    Alert.alert(
                                      'Could not delete account',
                                      (e as Error)?.message ??
                                      'Something went wrong. Check your connection and try again.',
                                    );
                                  } finally {
                                    setDeleting(false);
                                  }
                                },
                              },
                            ],
                          );
                        },
                      },
                    ],
                  );
                }}
                delay={456}
              />
            </>
          ) : (
            /* Signed-out state */
            <SettingRow
              icon="person-circle-outline"
              label="Sign in to back up your data"
              onPress={() => router.push('/auth' as any)}
              delay={452}
            />
          )}
        </SectionCard>

        {/* ── About ── */}
        <SectionCard title="About" icon="information-circle-outline" delay={460}>
          <SettingRow
            icon="download-outline"
            label="Export your data"
            onPress={handleExport}
            delay={480}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="cloud-upload-outline"
            label="Restore from backup"
            onPress={() => { setRestoreText(''); setRestoreError(''); setShowRestore(true); }}
            delay={490}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="share-social-outline"
            label="Share Gati with a friend"
            onPress={() => {
              // Personalize with the user's own daysAlive if available
              const days = daysAlive > 0 ? daysAlive.toLocaleString() : null;
              const message = days
                ? `I've been alive ${days} days. Gati showed me that.\n\nYour number is waiting — what's yours?\nhttps://gati.app`
                : `I've been tracking my life with Gati — days alive, heartbeats, steps, coffee cups. The numbers are bigger than you'd expect.\n\nhttps://gati.app`;
              Share.share({ message, title: 'Gati — Your Life in Numbers' }).catch(() => {});
            }}
            delay={500}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="help-circle-outline"
            label="Help & feedback"
            onPress={() => {
              Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Gati%20Feedback`).catch(() => {
                Alert.alert('Feedback', `Send your thoughts to ${SUPPORT_EMAIL}`);
              });
            }}
            delay={540}
          />
          <View style={styles.rowDivider} />
          {/* A reachable privacy policy is required by both stores, and it has
              to be findable from inside the app, not only the store listing. */}
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy policy"
            onPress={() => { Linking.openURL(PRIVACY_POLICY_URL).catch(() => {}); }}
            delay={550}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="document-text-outline"
            label="Terms of service"
            onPress={() => { Linking.openURL(TERMS_URL).catch(() => {}); }}
            delay={560}
          />
        </SectionCard>

        <Text style={styles.version}>Gati  ·  Version 1.0.0</Text>
      </ScrollView>

      {/* ── Modals ── */}
      <EditModal
        // Remount whenever the field is reopened so the input starts from the
        // current stored value rather than stale local state.
        key={`name-${editingName}`}
        visible={editingName}
        title="Your name"
        placeholder="First name"
        value={profile?.firstName ?? ''}
        onSave={(v) => { if (v) saveProfileField({ firstName: v }); }}
        onClose={() => setEditingName(false)}
      />
      <WheelPickerModal
        visible={showDobWheel}
        title="Date of birth"
        columns={[
          { items: DOB_DAYS,   initIndex: initDobIndices[0], flex: 1 },
          { items: DOB_MONTHS, initIndex: initDobIndices[1], flex: 2 },
          { items: DOB_YEARS,  initIndex: initDobIndices[2], flex: 1 },
        ]}
        onSave={handleDobSave}
        onClose={() => setShowDobWheel(false)}
      />
      <WheelPickerModal
        visible={showTimeWheel}
        title="Daily notification"
        columns={[
          { items: TIME_HOURS,   initIndex: initTimeIndices[0], flex: 1 },
          { items: TIME_MINUTES, initIndex: initTimeIndices[1], flex: 1 },
        ]}
        onSave={handleTimeSave}
        onClose={() => setShowTimeWheel(false)}
      />
      <PickerModal
        visible={pickerSleep}
        title="Hours of sleep per night"
        options={SLEEP_OPTIONS}
        current={String(profile?.sleepHoursPerNight ?? '7')}
        onSelect={(v) => saveProfileField({ sleepHoursPerNight: parseInt(v, 10) })}
        onClose={() => setPickerSleep(false)}
      />
      <PickerModal
        visible={pickerCoffee}
        title="Cups of coffee per day"
        options={COFFEE_OPTIONS}
        current={String(profile?.coffeeCupsPerDay ?? '2')}
        onSelect={(v) => saveProfileField({ coffeeCupsPerDay: parseInt(v, 10) })}
        onClose={() => setPickerCoffee(false)}
      />
      <PickerModal
        visible={pickerPhone}
        title="Phone hours per day"
        options={PHONE_OPTIONS}
        current={String(profile?.phoneHoursPerDay ?? '4')}
        onSelect={(v) => saveProfileField({ phoneHoursPerDay: parseInt(v, 10) })}
        onClose={() => setPickerPhone(false)}
      />
      <PickerModal
        visible={pickerEx}
        title="Exercise frequency"
        options={EXERCISE_OPTIONS}
        current={profile?.exerciseFrequency ?? 'sometimes'}
        onSelect={(v) => saveProfileField({ exerciseFrequency: v })}
        onClose={() => setPickerEx(false)}
      />
      <PickerModal
        visible={pickerWater}
        title="Glasses of water per day"
        options={WATER_OPTIONS}
        current={String(profile?.waterGlassesPerDay ?? 6)}
        onSelect={(v) => saveProfileField({ waterGlassesPerDay: parseInt(v, 10) })}
        onClose={() => setPickerWater(false)}
      />
      <PickerModal
        visible={pickerMusic}
        title="Music hours per day"
        options={MUSIC_OPTIONS}
        current={String(profile?.musicHoursPerDay ?? 2)}
        onSelect={(v) => saveProfileField({ musicHoursPerDay: parseInt(v, 10) })}
        onClose={() => setPickerMusic(false)}
      />
      <PickerModal
        visible={pickerCommute}
        title="Daily commute (one way)"
        options={COMMUTE_OPTIONS}
        current={String(profile?.commuteMinutesPerDay ?? 30)}
        onSelect={(v) => saveProfileField({ commuteMinutesPerDay: parseInt(v, 10) })}
        onClose={() => setPickerCommute(false)}
      />
      <PickerModal
        visible={pickerMeals}
        title="Meals per day"
        options={MEALS_OPTIONS}
        current={String(profile?.mealsPerDay ?? 3)}
        onSelect={(v) => saveProfileField({ mealsPerDay: parseInt(v, 10) })}
        onClose={() => setPickerMeals(false)}
      />

      {/* ── Restore from backup modal (#20/#21) ── */}
      <Modal
        visible={showRestore}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestore(false)}
      >
        <View style={restoreStyles.overlay}>
          <View style={restoreStyles.sheet}>
            <Text style={restoreStyles.title}>Restore from backup</Text>
            <Text style={restoreStyles.hint}>
              Paste the full JSON text from a previous export. Notes and interest scores will be merged with your current data.
            </Text>
            <TextInput
              style={restoreStyles.input}
              multiline
              numberOfLines={8}
              placeholder='{ "exportedAt": "...", ... }'
              placeholderTextColor={colors.textMuted}
              value={restoreText}
              onChangeText={setRestoreText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {restoreError ? (
              <Text style={restoreStyles.error}>{restoreError}</Text>
            ) : null}
            <View style={restoreStyles.actions}>
              <TouchableOpacity
                style={[restoreStyles.btn, restoreStyles.btnCancel]}
                onPress={() => setShowRestore(false)}
              >
                <Text style={restoreStyles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[restoreStyles.btn, restoreStyles.btnConfirm]}
                onPress={handleRestore}
              >
                <Text style={restoreStyles.btnConfirmText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Habit-save toast (#18) ── */}
      <Animated.View style={[toastStyles.wrap, toastStyle]} pointerEvents="none">
        <Ionicons name="checkmark-circle" size={14} color={colors.green700} />
        <Text style={toastStyles.text}>{toastText}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  scroll:  { flex: 1 },
  content: { paddingBottom: spacing[12] },

  header: {
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[5],
    paddingBottom:     spacing[3],
  },
  screenTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      24.5,
    color:         colors.textPrimary,
    letterSpacing: -0.4,
  },

  // Avatar section
  avatarSection: {
    alignItems:      'center',
    paddingVertical: spacing[6],
    gap:             spacing[2],
  },
  avatar: {
    width:           84,
    height:          84,
    borderRadius:    radius.full,
    backgroundColor: colors.green50,
    borderWidth:     2,
    borderColor:     colors.green100,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing[2],
  },
  avatarInitial: {
    fontFamily:    fontFamily.bold,
    fontSize:      34,
    color:         colors.green700,
    letterSpacing: -0.5,
  },
  displayName: {
    fontFamily:    fontFamily.bold,
    fontSize:      19,
    color:         colors.textPrimary,
    letterSpacing: -0.2,
  },
  memberSince: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },

  // Stats row
  statsRow: {
    flexDirection:    'row',
    marginHorizontal: spacing[5],
    backgroundColor:  colors.white,
    borderRadius:     radius.xl,
    borderWidth:      1,
    borderColor:      colors.border,
    marginBottom:     spacing[6],
    paddingVertical:  spacing[4],
    ...shadow.xs,
  },
  statBox: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  statValue: {
    fontFamily:    fontFamily.bold,
    fontSize:      17,
    color:         colors.green700,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   9.5,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 13,
  },
  statDivider: {
    width:           1,
    height:          32,
    backgroundColor: colors.borderLight,
    alignSelf:       'center',
  },

  // Section
  section: {
    marginHorizontal: spacing[5],
    marginBottom:     spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  spacing[2] + 2,
  },
  sectionTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      11.5,
    color:         colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
    ...shadow.xs,
  },

  // Setting rows
  settingRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing[4],
    paddingHorizontal: spacing[4],
    gap:               spacing[3],
  },
  settingRowPressed: {
    backgroundColor: colors.surface2,
  },
  settingIcon: {
    width:           36,
    height:          36,
    borderRadius:    radius.md,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  settingIconHighlight: {
    backgroundColor: colors.goldBg,
  },
  settingIconDestructive: {
    backgroundColor: colors.errorBg,
  },
  settingRowText: {
    flex: 1,
    gap:  2,
  },
  settingLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textPrimary,
  },
  settingLabelHighlight: {
    color: colors.gold,
  },
  settingLabelDestructive: {
    color: colors.error,
  },
  settingValue: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
  },
  rowDivider: {
    height:          1,
    backgroundColor: colors.borderLight,
    marginLeft:      spacing[4] + 36 + spacing[3],
  },

  // Cloud Backup section
  syncStatus: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3] + 2,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
  },
  syncDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  syncDotOk:    { backgroundColor: colors.green700 },
  syncDotError: { backgroundColor: '#C0392B' },
  syncEmailText: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textPrimary,
  },
  syncSubText: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
    marginTop:  1,
  },
  syncSubTextError: { color: '#C0392B' },

  // Interests
  interestsWrap: {
    paddingHorizontal: spacing[4],
    paddingTop:        spacing[3] + 2,
    paddingBottom:     spacing[4],
    gap:               spacing[3],
  },
  interestsHeading: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textPrimary,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing[2],
  },
  interestChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 2,
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  interestChipActive: {
    backgroundColor: colors.green50,
    borderColor:     colors.green300,
  },
  interestChipText: {
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      colors.textMuted,
  },
  interestChipTextActive: {
    color: colors.green700,
  },

  // Pro card
  proCard: {
    marginHorizontal: spacing[5],
    marginBottom:     spacing[5],
    backgroundColor:  colors.white,
    borderRadius:     radius.xl,
    borderWidth:      1,
    borderColor:      colors.goldBorder,
    padding:          spacing[5],
    gap:              spacing[3],
    ...shadow.sm,
  },
  proCardHeader: {
    flexDirection: 'row',
    gap:           spacing[3],
  },
  proCardTitles: {
    flex: 1,
    gap:  spacing[1],
  },
  proCardTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.textPrimary,
    letterSpacing: -0.2,
  },
  proCardDesc: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
    lineHeight: 18,
  },

  // Pro badge + shimmer
  proBadge: {
    alignSelf:         'flex-start',
    overflow:          'hidden',
    borderRadius:      radius.sm,
    backgroundColor:   colors.gold,
    paddingVertical:   4,
    paddingHorizontal: spacing[2] + 2,
  },
  proBadgeText: {
    fontFamily:    fontFamily.bold,
    fontSize:      10.5,
    color:         colors.white,
    letterSpacing: 1.2,
  },
  shimmerWrap: {
    position: 'absolute',
    top:      0,
    bottom:   0,
    width:    60,
  },
  shimmerGradient: {
    flex: 1,
  },

  // Pro features
  proFeatureRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2] + 2,
  },
  proFeatureText: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
    flex:       1,
  },

  // Billing toggle
  billingTrack: {
    flexDirection:     'row',
    alignSelf:         'center',
    borderRadius:      radius.full,
    backgroundColor:   colors.surface2,
    borderWidth:       1,
    borderColor:       colors.border,
    padding:           3,
    position:          'relative',
    overflow:          'hidden',
    gap:               0,
  },
  billingPill: {
    position:        'absolute',
    top:             3,
    left:            3,
    width:           88,
    bottom:          3,
    borderRadius:    radius.full,
    backgroundColor: colors.green700,
  },
  billingLabel: {
    width:          88,
    textAlign:      'center',
    paddingVertical: spacing[2],
    fontFamily:     fontFamily.semiBold,
    fontSize:       12,
    color:          colors.textMuted,
    zIndex:         1,
  },
  billingLabelActive: {
    color: colors.white,
  },

  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing[2],
  },
  priceMain: {
    fontFamily:    fontFamily.bold,
    fontSize:      26.5,
    color:         colors.textPrimary,
    letterSpacing: -0.5,
  },
  priceUnit: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },

  // Pro CTA
  proCtaBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[4],
    alignItems:      'center',
    ...shadow.sm,
  },
  proCtaText: {
    fontFamily: fontFamily.bold,
    fontSize:   15,
    color:      colors.white,
  },
  proCtaHint: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
    textAlign:  'center',
    marginTop:  -spacing[1],
  },

  version: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
    textAlign:  'center',
    marginTop:  spacing[2],
    marginBottom: spacing[6],
  },

  // Edit modal
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         spacing[5],
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    padding:         spacing[5],
    width:           '100%',
    gap:             spacing[4],
  },
  modalTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.textPrimary,
    letterSpacing: -0.2,
  },
  modalInput: {
    borderWidth:       1,
    borderColor:       colors.border,
    borderRadius:      radius.md,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
    fontFamily:        fontFamily.regular,
    fontSize:          15,
    color:             colors.textPrimary,
    backgroundColor:   colors.surface2,
  },
  modalActions: {
    flexDirection:  'row',
    gap:            spacing[3],
    justifyContent: 'flex-end',
  },
  modalCancel: {
    paddingVertical:   spacing[2] + 2,
    paddingHorizontal: spacing[4],
  },
  modalCancelText: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textMuted,
  },
  modalSave: {
    backgroundColor:   colors.green700,
    borderRadius:      radius.md,
    paddingVertical:   spacing[2] + 2,
    paddingHorizontal: spacing[4],
  },
  modalSaveText: {
    fontFamily: fontFamily.bold,
    fontSize:   14,
    color:      colors.white,
  },

  // Picker modal
  pickerContainer: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    padding:         spacing[5],
    paddingBottom:   spacing[10],
    gap:             spacing[1],
  },
  pickerTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      15,
    color:         colors.textPrimary,
    marginBottom:  spacing[3],
  },
  pickerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pickerLabel: {
    flex:       1,
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textSecondary,
  },
  pickerLabelActive: {
    color:      colors.green700,
    fontFamily: fontFamily.semiBold,
  },
});

// ─── Wheel picker styles (uses ITEM_H constant) ───────────────
const wStyles = StyleSheet.create({
  wheelRow: {
    flexDirection:  'row',
    position:       'relative',
    marginVertical: spacing[3],
  },
  wheelBand: {
    position:        'absolute',
    top:             WHEEL_PAD,
    left:            spacing[3],
    right:           spacing[3],
    height:          ITEM_H,
    backgroundColor: colors.green50,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  wheelItem: {
    height:         ITEM_H,
    alignItems:     'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontFamily: fontFamily.regular,
    fontSize:   15,
    color:      colors.textMuted,
  },
  wheelTextSel: {
    fontFamily: fontFamily.semiBold,
    fontSize:   16.5,
    color:      colors.textPrimary,
  },

});

// ── Habit-save toast styles (#18) — separate sheet to avoid TSC inference limits ──
const toastStyles = StyleSheet.create({
  wrap: {
    position:          'absolute',
    bottom:            spacing[8],
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    backgroundColor:   colors.white,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.green100,
    paddingVertical:   spacing[2] + 2,
    paddingHorizontal: spacing[5],
    shadowColor:       '#1A2E22',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.08,
    shadowRadius:      14,
    elevation:         4,
  },
  text: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.green700,
  },
});

const restoreStyles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         spacing[5],
  },
  sheet: {
    width:           '100%',
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    padding:         spacing[5],
    gap:             spacing[3],
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize:   17,
    color:      colors.textPrimary,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
    lineHeight: 18,
  },
  input: {
    fontFamily:      fontFamily.regular,
    fontSize:        12,
    color:           colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[3],
    minHeight:       120,
    textAlignVertical: 'top',
  },
  error: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      '#C0392B',
  },
  actions: {
    flexDirection: 'row',
    gap:           spacing[3],
    marginTop:     spacing[1],
  },
  btn: {
    flex:           1,
    paddingVertical: spacing[3],
    borderRadius:   radius.md,
    alignItems:     'center',
  },
  btnCancel: {
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  btnCancelText: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textSecondary,
  },
  btnConfirm: {
    backgroundColor: colors.green700,
  },
  btnConfirmText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.white,
  },
});
