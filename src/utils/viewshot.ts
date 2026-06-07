/**
 * Safe view-shot availability guard.
 *
 * Expo Go does not bundle the RNViewShot native module, so calling
 * captureRef() crashes at runtime. Check `isViewShotAvailable` before
 * any call to captureRef.
 *
 * In a production build or Expo Dev Client, this will be `true`.
 * In Expo Go, this will be `false` and share is gracefully disabled.
 */
import { NativeModules } from 'react-native';

/** True when the RNViewShot native module is registered (dev build / production). */
export const isViewShotAvailable: boolean = Boolean(NativeModules.RNViewShot);
