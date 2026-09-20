/**
 * Story annotation store.
 *
 * Users can attach a personal note to any timeline event —
 * a stat unlock, a visited place, or a milestone — and optionally
 * pin it as a "chapter" moment.
 *
 * Pinned events get a gold accent in the timeline. Unpinned notes
 * show as a quiet quoted line beneath the event card.
 *
 * Annotations are keyed by the event's composite id:
 *   "stat-{statId}"         e.g. "stat-heartbeats"
 *   "place-{placeId}"       e.g. "place-place-001"
 *   "milestone-{id}"        e.g. "milestone-streak_7"
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

export interface StoryAnnotation {
  /** Matches event.id from the story timeline */
  itemId:    string;
  /** User's handwritten note — max 140 chars enforced in UI */
  text:      string;
  /** ISO date the note was written */
  createdAt: string;
  /** When true: gold dot + "chapter" treatment in the timeline */
  pinned:    boolean;
}

interface StoryState {
  /** Record<itemId, annotation> */
  annotations: Record<string, StoryAnnotation>;

  /** Create or update a note for a given event id */
  setAnnotation: (itemId: string, text: string, pinned?: boolean) => void;
  /** Remove a note entirely */
  removeAnnotation: (itemId: string) => void;
  /** Toggle pinned status without changing the text */
  togglePin: (itemId: string) => void;
  /** Convenience getter */
  getAnnotation: (itemId: string) => StoryAnnotation | undefined;
  /**
   * Bulk-import annotations from a backup JSON.
   * Merges with existing annotations — existing entries are NOT overwritten
   * unless the incoming record has a NEWER `createdAt` date. This prevents
   * accidental loss of notes written after the backup was made.
   */
  importAnnotations: (records: Record<string, StoryAnnotation>) => void;
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      annotations: {},

      setAnnotation: (itemId, text, pinned) =>
        set((s) => ({
          annotations: {
            ...s.annotations,
            [itemId]: {
              itemId,
              text:      text.trim(),
              createdAt: format(new Date(), 'yyyy-MM-dd'),
              pinned:    pinned ?? s.annotations[itemId]?.pinned ?? false,
            },
          },
        })),

      removeAnnotation: (itemId) =>
        set((s) => {
          const next = { ...s.annotations };
          delete next[itemId];
          return { annotations: next };
        }),

      togglePin: (itemId) =>
        set((s) => {
          const existing = s.annotations[itemId];
          if (!existing) return s;
          return {
            annotations: {
              ...s.annotations,
              [itemId]: { ...existing, pinned: !existing.pinned },
            },
          };
        }),

      getAnnotation: (itemId) => get().annotations[itemId],

      importAnnotations: (records) =>
        set((s) => {
          const merged = { ...s.annotations };
          for (const [id, incoming] of Object.entries(records)) {
            const existing = merged[id];
            // Keep the newer note (or the incoming one if no existing)
            if (!existing || incoming.createdAt > existing.createdAt) {
              merged[id] = incoming;
            }
          }
          return { annotations: merged };
        }),
    }),
    {
      name:    'gati-story',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
