module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@':           './src',
            '@theme':      './src/theme',
            '@components': './src/components',
            '@store':      './src/store',
            '@engine':     './src/engine',
            '@hooks':      './src/hooks',
            '@services':   './src/services',
            '@data':       './src/data',
          },
        },
      ],
      // Worklets plugin MUST be last.
      // Reanimated 4 delegates worklet compilation to react-native-worklets;
      // 'react-native-reanimated/plugin' was removed in that release.
      'react-native-worklets/plugin',
    ],
  };
};
