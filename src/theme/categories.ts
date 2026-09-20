/**
 * Gati Design System — Category Theme
 * SINGLE SOURCE OF TRUTH for category colors, icons and labels.
 *
 * Previously four files (StatCard, StatAccordionItem, StatListItem,
 * TimelineRow, CategoryFilter, [statId]) each declared their own —
 * conflicting — category palettes. Everything must import from here.
 *
 * Palette logic:
 *   accent   — icon + small value text on white
 *   deep     — large numbers / headlines on tinted surfaces
 *   bg       — card tint surface
 *   bgSoft   — icon-pill fill on tinted surfaces
 *   border   — hairline border on tinted surfaces
 *   gradient — hero card wash, light → tint
 */

export type StatCategory = 'time' | 'body' | 'habits' | 'social';

export interface CategoryTheme {
  label:       string;
  icon:        string;   // filled Ionicon
  iconOutline: string;   // outline Ionicon
  accent:      string;
  deep:        string;
  bg:          string;
  bgSoft:      string;
  border:      string;
  gradient:    readonly [string, string];
}

export const categoryTheme: Record<StatCategory, CategoryTheme> = {
  time: {
    label:       'Time',
    icon:        'time',
    iconOutline: 'time-outline',
    accent:      '#5B6FD8',
    deep:        '#3D4DA8',
    bg:          '#EDEFFC',
    bgSoft:      '#DFE4FA',
    border:      '#D8DDF7',
    gradient:    ['#F2F4FE', '#E2E7FB'],
  },
  body: {
    label:       'Body',
    icon:        'heart',
    iconOutline: 'heart-outline',
    accent:      '#D95B52',
    deep:        '#A83A33',
    bg:          '#FCEDEB',
    bgSoft:      '#F9DEDA',
    border:      '#F5D8D3',
    gradient:    ['#FDF3F1', '#F9E1DC'],
  },
  habits: {
    label:       'Habits',
    icon:        'cafe',
    iconOutline: 'cafe-outline',
    accent:      '#C08A2A',
    deep:        '#8F6313',
    bg:          '#FBF2E0',
    bgSoft:      '#F6E7C8',
    border:      '#F0E0BC',
    gradient:    ['#FCF6E8', '#F6E8C9'],
  },
  social: {
    label:       'Social',
    icon:        'people',
    iconOutline: 'people-outline',
    accent:      '#8B5FCB',
    deep:        '#64409B',
    bg:          '#F3EDFB',
    bgSoft:      '#E9DFF7',
    border:      '#E4D8F5',
    gradient:    ['#F7F2FD', '#EBE0F9'],
  },
} as const;

/** Safe accessor — falls back to `time` for unknown categories. */
export function getCategoryTheme(category: string): CategoryTheme {
  return categoryTheme[category as StatCategory] ?? categoryTheme.time;
}
