import { Stack } from 'expo-router';
import { colors } from '@/theme';

/**
 * Wander section — stack navigator.
 * index    = place discovery home
 * [placeId] = place detail
 * map      = mini map / directions screen
 */
export default function WanderLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        contentStyle: { backgroundColor: colors.background },
        animation:    'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[placeId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="map"       options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
