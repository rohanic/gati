// @ts-check
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,

  {
    ignores: [
      'dist/*',
      'android/*',
      'ios/*',
      'node_modules/*',
      '.expo/*',
      // Deno edge functions: URL imports and the Deno global are not
      // resolvable by the React Native ESLint setup. They are typechecked by
      // `deno check` instead — see supabase/functions/README.md.
      'supabase/functions/**',
    ],
  },

  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      /**
       * React Compiler rules (new in eslint-config-expo 57).
       *
       * `immutability` fires on `sharedValue.value = …`, which is the
       * canonical and only way to drive a Reanimated animation. The compiler
       * cannot see that a shared value is a mutable box by design, so it
       * reports ~44 false positives across the animated UI. Downgraded to a
       * warning rather than contorting correct Reanimated code.
       *
       * Note the React Compiler itself is off (see `experiments.reactCompiler`
       * in app.json), so these rules are advisory here, not load-bearing.
       */
      'react-hooks/immutability': 'warn',
      /** Reads a ref during render — used for stable shuffled decks. */
      'react-hooks/refs': 'warn',
      /** `Date.now()` during render, for relative-time labels. */
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      /** These stay errors: each one is a real bug class. */
      'react-hooks/rules-of-hooks':   'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/exhaustive-deps':  'warn',

      /** Typographic apostrophes are fine in JSX text. */
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },

  {
    // Test files and the Jest setup run under Jest, not React Native: they use
    // the Jest globals and legitimately reach for `require`.
    files: [
      '**/__tests__/**/*.{ts,tsx,js}',
      '**/*.test.{ts,tsx}',
      'jest.setup.js',
      'jest.config.js',
    ],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
