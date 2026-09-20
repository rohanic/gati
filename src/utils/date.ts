/**
 * Date utilities.
 */
import { isValid, parseISO } from 'date-fns';

/**
 * Safely parses an ISO "YYYY-MM-DD" date string into a Date.
 * Falls back to `new Date()` (today) if the string is missing or invalid,
 * so callers never receive an `Invalid Date` that propagates as NaN.
 *
 * Usage:
 *   const joinDate = parseJoinDate(profile.appJoinDate);
 */
export function parseJoinDate(raw: string | undefined | null): Date {
  if (!raw) return new Date();
  // Append T00:00:00 so the date is interpreted in local time, not UTC.
  const d = new Date(raw + 'T00:00:00');
  return isValid(d) ? d : new Date();
}
