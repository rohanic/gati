const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force Babel to transpile private class fields (#field syntax) for Hermes compatibility.
// Without this, the hermes-stable profile skips the transform assuming native support,
// but Expo Go's Hermes build may not support it.
config.transformer = {
  ...config.transformer,
  unstable_transformProfile: 'default',
};

module.exports = config;
