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
      {/* 9 individual lifestyle screens */}
      <Stack.Screen name="sleep" />
      <Stack.Screen name="coffee" />
      <Stack.Screen name="water" />
      <Stack.Screen name="screentime" />
      <Stack.Screen name="music" />
      <Stack.Screen name="meals" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="commute" />
      <Stack.Screen name="personality" />
      {/* Rest of flow */}
      <Stack.Screen name="interests" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="processing" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="complete"    options={{ gestureEnabled: false }} />
    </Stack>
  );
}
