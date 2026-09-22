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
  /**
   * Two places the file can come from, checked in this order:
   *
   *   1. GOOGLE_SERVICES_JSON — set by EAS as a *file* environment variable,
   *      whose value is the path it wrote the file to on the build machine.
   *   2. The project root, for local builds.
   *
   * The env var is not an optional nicety. This repository is public, so
   * google-services.json is gitignored — and EAS Build derives its upload
   * from what git tracks, so an ignored file simply never reaches the
   * builder. Without the env var the build would succeed, take the warning
   * branch below, and ship a release with push silently disabled.
   */
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  const local   = path.resolve(__dirname, 'google-services.json');
  const resolved =
    fromEnv && fs.existsSync(fromEnv) ? fromEnv :
    fs.existsSync(local)              ? local  : null;

  if (resolved) {
    config.android = {
      ...config.android,
      googleServicesFile: resolved,
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
      '   For EAS builds it must also be registered as a file env var:\n' +
      '        eas env:create --scope project --name GOOGLE_SERVICES_JSON \\\n' +
      '          --type file --visibility secret --value ./google-services.json\n' +
      '   See docs/launch-checklist.md.\n',
    );
  }

  return config;
};
