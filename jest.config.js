/**
 * Jest configuration.
 *
 * The suite focuses on the pure layers — the stats/wander/milestone engines,
 * the streak range maths, entitlement derivation, and the Zustand store
 * actions. Those hold every rule that decides what a user sees and what they
 * pay for, and they were previously untested despite the source calling them
 * "pure functions — fully testable".
 */
// expo/fetch's lazy polyfill chain resolves outside Jest's module scope and
// throws "trying to import a file outside of the scope of the test code" at
// setup. Tests never exercise fetch, so keep React Native's own polyfill.
process.env.EXPO_PUBLIC_USE_RN_FETCH = '1';

// date-fns calendar helpers work in LOCAL time, so any test that asserts a
// day boundary is timezone-dependent. Pin the runner to UTC so results are
// identical on a laptop in IST and in CI.
process.env.TZ = 'UTC';

module.exports = {
  preset: 'jest-expo/android',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Mirrors the `paths` in tsconfig.json and the aliases in babel.config.js.
  moduleNameMapper: {
    '^@/(.*)$':          '<rootDir>/src/$1',
    '^@theme$':          '<rootDir>/src/theme/index',
    '^@theme/(.*)$':     '<rootDir>/src/theme/$1',
    '^@components$':     '<rootDir>/src/components/ui/index',
    '^@components/(.*)$':'<rootDir>/src/components/$1',
    '^@store/(.*)$':     '<rootDir>/src/store/$1',
    '^@engine/(.*)$':    '<rootDir>/src/engine/$1',
    '^@hooks/(.*)$':     '<rootDir>/src/hooks/$1',
    '^@services/(.*)$':  '<rootDir>/src/services/$1',
    '^@data/(.*)$':      '<rootDir>/src/data/$1',
  },

  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-worklets|expo-iap)',
  ],

  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],

  collectCoverageFrom: [
    'src/engine/**/*.ts',
    'src/hooks/**/*.ts',
    'src/store/**/*.ts',
    'src/services/placesService.ts',
    '!**/*.d.ts',
  ],

  // The Deno edge functions are checked with `deno check`, not Jest.
  // `testPathIgnorePatterns` rather than `modulePathIgnorePatterns`: the
  // latter narrows the module scope and breaks jest-expo's winter runtime.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/supabase/'],

  clearMocks: true,
};
