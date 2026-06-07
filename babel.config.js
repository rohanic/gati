module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated plugin MUST be last
      'react-native-reanimated/plugin',
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
    ],
  };
};
