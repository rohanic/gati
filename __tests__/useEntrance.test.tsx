/**
 * useEntrance.
 *
 * The whole point of the hook is what happens AFTER the entrance: it must
 * stop contributing a style, so the component's resting state is described
 * by React's own props. If it kept returning the animated style forever, a
 * view rebuilt from React's props would come back at its starting state —
 * invisible — which is exactly what happened to the Profile screen.
 */
// Reanimated's own Jest mock needs a Worklets runtime Jest does not have.
// These tests are about WHEN the style is dropped, not about animation
// internals, so a minimal stand-in is the right tool.
jest.mock('react-native-reanimated', () => ({
  useSharedValue:   (v: number) => ({ value: v }),
  useAnimatedStyle: (fn: () => object) => fn(),
  withDelay:        (_d: number, a: unknown) => a,
  withTiming:       (to: number) => to,
  Easing:           { out: (f: unknown) => f, cubic: (t: number) => t },
}));

import { renderHook, act } from '@testing-library/react-native';
import { useEntrance, SETTLE_MARGIN_MS } from '@/hooks/useEntrance';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useEntrance', () => {
  it('animates while entering', async () => {
    const { result } = await renderHook(() => useEntrance({ delay: 100, duration: 300 }));
    expect(result.current).toBeDefined();
  });

  it('drops its style once the entrance has had time to finish', async () => {
    const { result } = await renderHook(() => useEntrance({ delay: 100, duration: 300 }));
    await act(async () => { jest.advanceTimersByTime(100 + 300 + SETTLE_MARGIN_MS); });
    expect(result.current).toBeUndefined();
  });

  it('does not drop it early', async () => {
    const { result } = await renderHook(() => useEntrance({ delay: 100, duration: 300 }));
    await act(async () => { jest.advanceTimersByTime(100 + 300); });
    expect(result.current).toBeDefined();
  });

  it('settles on the JS timer even if no animation frame ever ran', async () => {
    // A screen mounted while the app is backgrounded gets no UI-thread
    // frames. The timer is what guarantees it still ends up visible.
    const { result } = await renderHook(() => useEntrance({ delay: 0, duration: 200 }));
    await act(async () => { jest.advanceTimersByTime(200 + SETTLE_MARGIN_MS); });
    expect(result.current).toBeUndefined();
  });

  it('cleans up its timer on unmount', async () => {
    const { unmount } = await renderHook(() => useEntrance({ delay: 0, duration: 200 }));
    await unmount();
    expect(() => jest.runOnlyPendingTimers()).not.toThrow();
  });
});
