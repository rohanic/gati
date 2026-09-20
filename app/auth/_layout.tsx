import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="verify"   options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="welcome"  options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
