const fs = require('fs');
const path = require('path');

/**
 * Dynamic Expo config.
 *
 * `app.json` stays the source of truth for everything static; this file only
 * adds the pieces that depend on whether a local credential file exists.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Android push is delivered through Firebase Cloud Messaging, which needs
 * `google-services.json`. Two bad options if that were hard-coded in app.json:
 *
 *   • Reference it unconditionally → every build fails until the file exists,
 *     including builds by anyone who only wants to run the app locally.
 *   • Leave it out → push silently never arrives. `registerPushToken` still
 *     succeeds, a token is still stored, and nothing is ever delivered. That
 *     failure is invisible until someone notices they get no notifications.
 *
 * So: wire it up automatically when the file is present, and say clearly when
 * it is not.
 */
module.exports = ({ config }) => {
  const googleServices = path.resolve(__dirname, 'google-services.json');
  const hasFirebase = fs.existsSync(googleServices);

  if (hasFirebase) {
    config.android = {
      ...config.android,
      googleServicesFile: './google-services.json',
    };
  } else {
    // Printed on every config resolve (start, prebuild, eas build) so it
    // cannot be missed while setting the project up.
    console.warn(
      '\n⚠️  google-services.json not found — Android push notifications will NOT be delivered.\n' +
      '   The app will still register a push token and report success; nothing will arrive.\n' +
      '   Fix: Firebase console → add an Android app with package com.gati.numberswanders →\n' +
      '        download google-services.json to the project root →\n' +
      '        eas credentials → Android → Push Notifications → upload the FCM V1 key.\n' +
      '   See docs/launch-checklist.md.\n',
    );
  }

  return config;
};
