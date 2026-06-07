import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing } from '@/theme';

// ─── Tab configuration ────────────────────────────────────────
const TABS = [
  {
    name:         'today',
    href:         '/(tabs)/today',
    iconActive:   'sunny'         as const,
    iconInactive: 'sunny-outline' as const,
    label:        'Today',
  },
  {
    name:         'numbers',
    href:         '/(tabs)/numbers',
    iconActive:   'stats-chart'         as const,
    iconInactive: 'stats-chart-outline' as const,
    label:        'Numbers',
  },
  {
    name:         'wander',
    href:         '/(tabs)/wander',
    iconActive:   'compass'         as const,
    iconInactive: 'compass-outline' as const,
    label:        'Wander',
  },
  {
    name:         'story',
    href:         '/(tabs)/story',
    iconActive:   'time'         as const,
    iconInactive: 'time-outline' as const,
    label:        'Story',
  },
  {
    name:         'profile',
    href:         '/(tabs)/profile',
    iconActive:   'person'         as const,
    iconInactive: 'person-outline' as const,
    label:        'Profile',
  },
] as const;

// ─── Individual animated tab icon ─────────────────────────────
function TabIcon({
  tab,
  isFocused,
  onPress,
}: {
  tab:       (typeof TABS)[number];
  isFocused: boolean;
  onPress:   () => void;
}) {
  const scale        = useSharedValue(1);
  const focusValue   = useSharedValue(isFocused ? 1 : 0);

  // Animate pill fill when focus changes
  React.useEffect(() => {
    focusValue.value = withSpring(isFocused ? 1 : 0, {
      stiffness: 220,
      damping:   20,
    });
  }, [isFocused]);

  // Animated pill background
  const pillStyle = useAnimatedStyle(() => ({
    opacity:         focusValue.value,
    transform: [
      {
        scale: interpolate(
          focusValue.value,
          [0, 1],
          [0.6, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // Dot indicator below icon
  const dotStyle = useAnimatedStyle(() => ({
    opacity: focusValue.value,
    transform: [
      {
        scale: interpolate(
          focusValue.value,
          [0, 1],
          [0, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // Press spring
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.80, { stiffness: 500, damping: 18 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 300, damping: 25 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={pressStyle}>
        {/* Pill background — only visible when active */}
        <Animated.View style={[styles.pill, pillStyle]} />

        {/* Icon */}
        <Ionicons
          name={isFocused ? tab.iconActive : tab.iconInactive}
          size={24}
          color={isFocused ? colors.green700 : colors.textMuted}
        />
      </Animated.View>

      {/* Dot indicator */}
      <Animated.View style={[styles.dot, dotStyle]} />
    </Pressable>
  );
}

// ─── Custom Tab Bar ───────────────────────────────────────────
function CustomTabBar({
  state,
  navigation,
}: {
  state:      any;
  navigation: any;
}) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const getRouteName = (route: any): string => {
    // Expo Router nests names like "(tabs)/today" — extract last segment
    const parts = (route.name as string).split('/');
    return parts[parts.length - 1];
  };

  return (
    <View
      style={[
        styles.tabBar,
        { paddingBottom: Math.max(insets.bottom, spacing[3]) },
      ]}
    >
      {TABS.map((tab, index) => {
        const isFocused = state.index === index;

        const handlePress = () => {
          const event = navigation.emit({
            type:       'tabPress',
            target:     state.routes[index]?.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(state.routes[index]?.name ?? tab.name);
          }
        };

        return (
          <TabIcon
            key={tab.name}
            tab={tab}
            isFocused={isFocused}
            onPress={handlePress}
          />
        );
      })}
    </View>
  );
}

// ─── Layout export ────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="today"   options={{ title: 'Today' }} />
      <Tabs.Screen name="numbers" options={{ title: 'Numbers' }} />
      <Tabs.Screen name="wander"  options={{ title: 'Wander' }} />
      <Tabs.Screen name="story"   options={{ title: 'Story' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: {
    flexDirection:   'row',
    backgroundColor: colors.white,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
    paddingTop:      spacing[2],
    paddingHorizontal: spacing[2],
    ...shadow.sm,
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: spacing[1],
    gap:            5,
  },
  pill: {
    position:        'absolute',
    width:           44,
    height:          44,
    borderRadius:    radius.md,
    backgroundColor: colors.green50,
    top:             -10,
    left:            -10,
  },
  dot: {
    width:           4,
    height:          4,
    borderRadius:    radius.full,
    backgroundColor: colors.green700,
  },
});
