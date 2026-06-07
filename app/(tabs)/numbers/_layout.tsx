import { Stack } from 'expo-router';
import { colors } from '@/theme';

/**
 * Numbers section — stack navigator.
 * index.tsx = stat list, [statId].tsx = detail (Week 4).
 */
export default function NumbersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:     false,
        contentStyle:    { backgroundColor: colors.background },
        animation:       'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[statId]"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  );
}
