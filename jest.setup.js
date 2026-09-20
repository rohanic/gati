/**
 * Test environment shims.
 *
 * Only native modules the pure layers pull in transitively are mocked; the
 * logic under test is untouched.
 */

// AsyncStorage — backs the Zustand persist middleware.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-constants: the store and services read `executionEnvironment` to decide
// whether native billing / notifications are available.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'standalone',
    expoConfig: { extra: { eas: { projectId: 'test-project' } } },
  },
}));

// expo-iap pulls in a native module at import time.
jest.mock('expo-iap', () => ({
  initConnection:         jest.fn().mockResolvedValue(true),
  endConnection:          jest.fn().mockResolvedValue(undefined),
  fetchProducts:          jest.fn().mockResolvedValue([]),
  requestPurchase:        jest.fn().mockResolvedValue(undefined),
  finishTransaction:      jest.fn().mockResolvedValue(undefined),
  getAvailablePurchases:  jest.fn().mockResolvedValue([]),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener:   jest.fn(() => ({ remove: jest.fn() })),
  deepLinkToSubscriptions: jest.fn().mockResolvedValue(undefined),
}));

// Supabase client — network is never exercised in unit tests.
jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession:          jest.fn().mockResolvedValue({ data: { session: null } }),
      getUser:             jest.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange:   jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select:      jest.fn().mockReturnThis(),
      upsert:      jest.fn().mockResolvedValue({ error: null }),
      update:      jest.fn().mockReturnThis(),
      delete:      jest.fn().mockReturnThis(),
      eq:          jest.fn().mockReturnThis(),
      in:          jest.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: { invoke: jest.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));

// Silence the Reanimated / gesture-handler warnings that the component tree
// emits on import. Logic tests do not render anything.
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});
