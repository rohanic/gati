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
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
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
import { parseISO, differenceInDays, format } from 'date-fns';
import { useUserStore, useStatsStore, useWanderStore } from '@/store/userStore';
import { scheduleGatiNotifications } from '@/services/notifications';
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

// ─── Best streak helper ───────────────────────────────────────
function computeBestStreak(openHistory: string[]): number {
  if (openHistory.length === 0) return 0;
  const sorted = [...openHistory].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInDays(parseISO(sorted[i]), parseISO(sorted[i - 1]));
    if (diff === 1)    { current++; best = Math.max(best, current); }
    else if (diff > 1) { current = 1; }
  }
  return best;
}

// ─── Animated settings row ────────────────────────────────────
function SettingRow({
  icon,
  label,
  value,
  onPress,
  delay,
  highlight,
}: {
  icon:      string;
  label:     string;
  value?:    string;
  onPress?:  () => void;
  delay:     number;
  highlight?: boolean;
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
        android_ripple={{ color: colors.green50 }}
        style={({ pressed }) => [
          styles.settingRow,
          pressed && styles.settingRowPressed,
        ]}
      >
        <View style={[styles.settingIcon, highlight && styles.settingIconHighlight]}>
          <Ionicons
            name={icon as any}
            size={17}
            color={highlight ? colors.gold : colors.textSecondary}
          />
        </View>
        <View style={styles.settingRowText}>
          <Text style={[styles.settingLabel, highlight && styles.settingLabelHighlight]}>
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
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);

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
  const unlockedStats  = useStatsStore((s) => s.unlockedStats);
  const openHistory    = useStatsStore((s) => s.openHistory);
  const places         = useWanderStore((s) => s.places);

  // ── Live stats ──
  const daysAlive       = profile
    ? Math.max(1, differenceInDays(new Date(), parseISO(profile.dateOfBirth)))
    : 0;
  const bestStreak      = computeBestStreak(openHistory);
  const placesDiscovered = places.filter((p) => p.discoveredDate !== null).length;
  const savedPlaces     = places.filter((p) => p.isSaved).length;

  const memberSince = profile?.appJoinDate
    ? format(parseISO(profile.appJoinDate), 'MMMM yyyy')
    : 'today';

  // ── Billing toggle ──
  const [isMonthly, setIsMonthly] = useState(true);

  // ── Edit modals ──
  const [editingName, setEditingName]   = useState(false);
  const [editingDob,  setEditingDob]    = useState(false);
  const [editingSleep, setEditingSleep] = useState(false);
  const [editingCoffee, setEditingCoffee] = useState(false);
  const [editingPhone,  setEditingPhone]  = useState(false);
  const [editingTime,   setEditingTime]   = useState(false);
  const [pickerEx,      setPickerEx]      = useState(false);

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

  const saveProfileField = useCallback(
    (partial: Parameters<typeof updateProfile>[0]) => {
      updateProfile(partial);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [updateProfile]
  );

  const handleInterestToggle = useCallback(
    (cat: InterestCategory) => {
      if (!profile) return;
      const current = profile.interestCategories ?? [];
      const next = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      if (next.length === 0) return; // must keep at least one
      saveProfileField({ interestCategories: next });
    },
    [profile, saveProfileField]
  );

  const handleNotifTimeSave = useCallback(
    (raw: string) => {
      // Accept "HH:MM" format
      const trimmed = raw.trim();
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(':').map(Number);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          saveProfileField({ notificationTime: formatted });
          scheduleGatiNotifications(formatted).catch(() => {});
        } else {
          Alert.alert('Invalid time', 'Please enter a valid time (00:00–23:59)');
        }
      } else {
        Alert.alert('Invalid format', 'Use HH:MM, e.g. 08:00');
      }
    },
    [saveProfileField]
  );

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
            <Ionicons name="person" size={38} color={colors.green700} />
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
            value={profile?.firstName ?? '—'}
            onPress={() => setEditingName(true)}
            delay={120}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="calendar-outline"
            label="Date of birth"
            value={profile?.dateOfBirth
              ? format(parseISO(profile.dateOfBirth), 'dd MMM yyyy')
              : '—'}
            onPress={() => setEditingDob(true)}
            delay={160}
          />
        </SectionCard>

        {/* ── Habits ── */}
        <SectionCard title="Your habits" icon="bar-chart-outline" delay={200}>
          <SettingRow
            icon="moon-outline"
            label="Sleep per night"
            value={profile ? `${profile.sleepHoursPerNight} hours` : '—'}
            onPress={() => setEditingSleep(true)}
            delay={240}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="cafe-outline"
            label="Coffee per day"
            value={profile ? `${profile.coffeeCupsPerDay} cups` : '—'}
            onPress={() => setEditingCoffee(true)}
            delay={280}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="phone-portrait-outline"
            label="Phone per day"
            value={profile ? `${profile.phoneHoursPerDay} hours` : '—'}
            onPress={() => setEditingPhone(true)}
            delay={320}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="walk-outline"
            label="Exercise frequency"
            value={
              EXERCISE_OPTIONS.find((o) => o.value === profile?.exerciseFrequency)?.label ?? '—'
            }
            onPress={() => setPickerEx(true)}
            delay={360}
          />
        </SectionCard>

        {/* ── Preferences ── */}
        <SectionCard title="Preferences" icon="settings-outline" delay={380}>
          <SettingRow
            icon="notifications-outline"
            label="Daily notification"
            value={profile?.notificationTime ?? '—'}
            onPress={() => setEditingTime(true)}
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
        {!profile?.isPro && (
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

            {/* Feature list */}
            {[
              'All 22+ life stats, always unlocked',
              'Advanced what-if projections',
              'Full story timeline export',
              'Priority new features',
            ].map((feat) => (
              <View key={feat} style={styles.proFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.green700} />
                <Text style={styles.proFeatureText}>{feat}</Text>
              </View>
            ))}

            {/* Billing toggle */}
            <BillingToggle monthly={isMonthly} onToggle={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsMonthly((p) => !p);
            }} />

            {/* Price */}
            <View style={styles.priceRow}>
              <Text style={styles.priceMain}>
                {isMonthly ? '$4.99' : '$39.99'}
              </Text>
              <Text style={styles.priceUnit}>
                {isMonthly ? '/ month' : '/ year  ·  save 33%'}
              </Text>
            </View>

            {/* CTA */}
            <Pressable
              style={({ pressed }) => [styles.proCtaBtn, pressed && { opacity: 0.88 }]}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
              onPress={() => Alert.alert('Gati Pro', 'Purchase flow coming soon.')}
            >
              <Text style={styles.proCtaText}>
                Start 7-day free trial
              </Text>
            </Pressable>
            <Text style={styles.proCtaHint}>No charge until trial ends. Cancel anytime.</Text>
          </View>
        )}

        {/* ── About ── */}
        <SectionCard title="About" icon="information-circle-outline" delay={460}>
          <SettingRow
            icon="share-social-outline"
            label="Share Gati with a friend"
            onPress={() => Alert.alert('Share', 'Share sheet coming soon.')}
            delay={500}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="help-circle-outline"
            label="Help & feedback"
            onPress={() => Alert.alert('Feedback', 'Feedback form coming soon.')}
            delay={540}
          />
        </SectionCard>

        <Text style={styles.version}>Gati  ·  Version 1.0.0</Text>
      </ScrollView>

      {/* ── Modals ── */}
      <EditModal
        visible={editingName}
        title="Your name"
        placeholder="First name"
        value={profile?.firstName ?? ''}
        onSave={(v) => { if (v) saveProfileField({ firstName: v }); }}
        onClose={() => setEditingName(false)}
      />
      <EditModal
        visible={editingDob}
        title="Date of birth"
        placeholder="YYYY-MM-DD"
        value={profile?.dateOfBirth ?? ''}
        onSave={(v) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) saveProfileField({ dateOfBirth: v });
          else Alert.alert('Invalid', 'Use YYYY-MM-DD format');
        }}
        onClose={() => setEditingDob(false)}
      />
      <EditModal
        visible={editingSleep}
        title="Hours of sleep per night"
        placeholder="e.g. 7"
        value={String(profile?.sleepHoursPerNight ?? '')}
        onSave={(v) => {
          const n = Number(v);
          if (n >= 4 && n <= 12) saveProfileField({ sleepHoursPerNight: n });
        }}
        onClose={() => setEditingSleep(false)}
        keyboardType="number-pad"
      />
      <EditModal
        visible={editingCoffee}
        title="Cups of coffee per day"
        placeholder="e.g. 2"
        value={String(profile?.coffeeCupsPerDay ?? '')}
        onSave={(v) => {
          const n = Number(v);
          if (n >= 0 && n <= 12) saveProfileField({ coffeeCupsPerDay: n });
        }}
        onClose={() => setEditingCoffee(false)}
        keyboardType="number-pad"
      />
      <EditModal
        visible={editingPhone}
        title="Phone hours per day"
        placeholder="e.g. 4"
        value={String(profile?.phoneHoursPerDay ?? '')}
        onSave={(v) => {
          const n = Number(v);
          if (n >= 0 && n <= 16) saveProfileField({ phoneHoursPerDay: n });
        }}
        onClose={() => setEditingPhone(false)}
        keyboardType="number-pad"
      />
      <EditModal
        visible={editingTime}
        title="Daily notification time"
        placeholder="HH:MM  e.g. 08:30"
        value={profile?.notificationTime ?? ''}
        onSave={handleNotifTimeSave}
        onClose={() => setEditingTime(false)}
        keyboardType="number-pad"
      />
      <PickerModal
        visible={pickerEx}
        title="Exercise frequency"
        options={EXERCISE_OPTIONS}
        current={profile?.exerciseFrequency ?? 'sometimes'}
        onSelect={(v) => saveProfileField({ exerciseFrequency: v })}
        onClose={() => setPickerEx(false)}
      />
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
    fontSize:      26,
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
  displayName: {
    fontFamily:    fontFamily.bold,
    fontSize:      20,
    color:         colors.textPrimary,
    letterSpacing: -0.2,
  },
  memberSince: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
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
    fontSize:      18,
    color:         colors.green700,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   10,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 14,
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
    fontSize:      12,
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
  settingRowText: {
    flex: 1,
    gap:  2,
  },
  settingLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   15,
    color:      colors.textPrimary,
  },
  settingLabelHighlight: {
    color: colors.gold,
  },
  settingValue: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },
  rowDivider: {
    height:          1,
    backgroundColor: colors.borderLight,
    marginLeft:      spacing[4] + 36 + spacing[3],
  },

  // Interests
  interestsWrap: {
    paddingHorizontal: spacing[4],
    paddingTop:        spacing[3] + 2,
    paddingBottom:     spacing[4],
    gap:               spacing[3],
  },
  interestsHeading: {
    fontFamily: fontFamily.medium,
    fontSize:   15,
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
    fontSize:   13,
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
    fontSize:      17,
    color:         colors.textPrimary,
    letterSpacing: -0.2,
  },
  proCardDesc: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
    lineHeight: 19,
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
    fontSize:      11,
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
    fontSize:   14,
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
    fontSize:       13,
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
    fontSize:      28,
    color:         colors.textPrimary,
    letterSpacing: -0.5,
  },
  priceUnit: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
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
    fontSize:   16,
    color:      colors.white,
  },
  proCtaHint: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    textAlign:  'center',
    marginTop:  -spacing[1],
  },

  version: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
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
    fontSize:      17,
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
    fontSize:          16,
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
    fontSize:   15,
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
    fontSize:   15,
    color:      colors.white,
  },

  // Picker modal
  pickerContainer: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    fontSize:      16,
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
    fontSize:   15,
    color:      colors.textSecondary,
  },
  pickerLabelActive: {
    color:      colors.green700,
    fontFamily: fontFamily.semiBold,
  },
});
