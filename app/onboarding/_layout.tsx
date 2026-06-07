import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        contentStyle: { backgroundColor: colors.background },
        animation:    'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="name" />
      <Stack.Screen name="birthday" />
      <Stack.Screen name="lifestyle" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="processing" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="complete" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
