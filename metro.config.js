const { getDefaultConfig } = require('expo/metro-config');

/**
 * Default Expo Metro config.
 *
 * NOTE: the previous `unstable_transformProfile: 'default'` override has been
 * removed. It existed to work around Expo Go's Hermes build lacking private
 * class-field support, but it forced the non-Hermes transform profile across the
 * whole bundle — losing Hermes-targeted optimisations in release builds. Gati
 * ships as a dev-client / release build (IAP and push both require it), so the
 * default 'hermes-stable' profile is correct and faster.
 */
const config = getDefaultConfig(__dirname);

module.exports = config;
