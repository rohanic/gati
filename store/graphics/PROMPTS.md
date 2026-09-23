# Gati — store graphics

## Where each icon lives

| File | Size | Used for | Status |
|---|---|---|---|
| `store/graphics/icon-512.png` | 512² | **Play Store listing** — the one you upload | ✅ ready |
| `assets/adaptive-icon.png` | 1024² | Android launcher foreground | ✅ rescaled |
| `assets/monochrome-icon.png` | 1024² | Android 13+ themed icons | ✅ regenerated |
| `assets/icon.png` | 1024² | source for the store icon, legacy launcher | unchanged |
| `assets/splash-icon.png` | 480² | splash, drawn at 120dp | unchanged |
| `assets/notification-icon.png` | 96² | status bar, white-on-transparent | unchanged |

**Upload `store/graphics/icon-512.png` to Play.** It is already 512×512,
opaque (Play composites on light and dark surfaces, so alpha would show as a
hole) and 176 KB against a 1 MB limit.

The launcher icon was the one rescaled — its artwork reached 66.7% of the
canvas against Android's 61.1% safe zone, which is why it looked oversized in
the frame. The store icon is never masked, so it keeps its tighter crop.

---

## Feature graphic — REQUIRED

**Exactly 1024 × 500 px.** PNG or JPEG, under 15 MB. Not optional: Play will
not let you publish without it, and it is the only graphic shown on some
surfaces.

### Before you generate anything

- **Keep everything that matters inside the middle 80% horizontally and the
  middle 70% vertically.** Play crops the edges differently per surface, and
  if you ever add a promo video it overlays a ▶ button dead centre.
- **Do not ask the model for text.** Image generators produce garbled
  letterforms, and misspelled text on a feature graphic is an instant
  quality-review flag. Add the wordmark yourself afterwards — instructions
  below.
- Brand colours, verbatim, in every prompt:
  `#1E4D2B` deep green · `#2A7D4F` primary green · `#F8F5EF` cream ·
  `#E0A42E` gold

### Prompt A — topographic leaf ⭐ recommended

The idea: a leaf's veins and a map's contour lines are the same shape. One
image that is both halves of the product at once — your life measured, and
somewhere to go.

> A 1024x500 horizontal banner. Deep forest green background, hex #1E4D2B.
> Across the whole banner, elegant thin topographic contour lines in cream,
> hex #F8F5EF, at about 25 percent opacity, flowing left to right like a
> map of hills — densely nested on the left, opening out toward the right.
> The contour lines gradually form the unmistakable outline of a large leaf
> occupying the centre-left, its central vein reading as a ridgeline. A
> single small solid gold circle, hex #E0A42E, sits where the contours are
> densest, like a location pin marking a summit. Thin gold dotted trail
> leading to it. Generous empty space in the right half. Flat vector
> cartography style, elegant, precise, minimal, no gradients, no 3D, no
> photography, no shading. Absolutely no text, no letters, no numbers.

### Prompt B — the ascent

The staircase from the logo, promoted from a detail to the hero. Reads as
progress, days accumulating, one step at a time.

> A 1024x500 horizontal banner. Warm cream background, hex #F8F5EF. A bold
> geometric staircase of seven even steps ascends from the lower left to the
> upper right, drawn as solid flat shapes in deep forest green, hex #1E4D2B,
> with each successive step a slightly lighter green, moving toward hex
> #2A7D4F at the top. Resting on the highest step, a single solid gold
> circle, hex #E0A42E, with a soft cream halo. A large simplified leaf
> silhouette sits behind the staircase in a barely visible lighter green,
> partly cropped by the right edge, like a watermark. Everything well
> inside the frame with clear margins. Flat vector, crisp edges, no
> gradients, no drop shadows, no 3D, no photography. Calm, confident,
> editorial. Absolutely no text, no letters, no numbers.

### Prompt C — two halves

Literal but effective: numbers on one side, a place on the other, the leaf
bridging them. This is the app in one picture.

> A 1024x500 horizontal banner, split composition. Left half: a warm cream
> field, hex #F8F5EF, scattered with a loose constellation of small solid
> circles in deep green, hex #1E4D2B, of varying sizes, connected by
> hairline green threads like a star chart. Right half: the same cream
> field with a minimal flat-vector map — three or four gently curving
> streets in pale green, hex #2A7D4F at 30 percent opacity, and one solid
> gold location pin, hex #E0A42E. Spanning the seam between the two halves,
> a single large flat leaf in deep forest green, hex #1E4D2B, tilted 30
> degrees, with a negative-space staircase cut through it in cream. The leaf
> visually bridges the constellation and the map. Flat vector, minimal,
> elegant, no gradients, no 3D, no photography. Absolutely no text, no
> letters, no numbers.

### Prompt D — with a real screenshot

The highest-converting format, and the one to use if you want the app
itself visible. **Generate only the background; composite a real capture
into it.** A generated or invented app screen on a feature graphic is
misleading metadata and a rejection risk.

Step 1, the backdrop:

> A 1024x500 horizontal banner. Warm cream background, hex #F8F5EF, with a
> very subtle paper grain. On the right half, one oversized leaf silhouette
> in pale sage green at about 12 percent opacity, tilted 30 degrees, bleeding
> off the right edge. A few small solid gold dots, hex #E0A42E, scattered
> sparsely like distant markers. The left two thirds is clean empty cream
> space. Soft, calm, editorial, flat vector, no gradients, no 3D, no
> photography, no devices, no phones, no hands. Absolutely no text.

Step 2, composite over it:

- A real screenshot of **Today**, inside a simple dark phone frame, angled
  slightly or upright, occupying the right third and cropped by the bottom
  edge so it feels like it continues past the banner
- The wordmark on the left, per the spec below

**What Today shows, so you capture the right moment.** Open the app with at
least one key available and at least one number already opened, so the
screen is full rather than empty:

| Element | Why it should be in frame |
|---|---|
| Greeting and date | says the app is personal and daily |
| Day-of-year card with its progress bar | the local-context card, unique to Gati |
| "Open a number today" hero with a key badge | the core loop, visible at a glance |
| A suggested number with its teaser | shows the catalogue without spoiling it |
| Streak badge, if you have one | proof it is a habit, not a one-off |

Scroll so the day-of-year card and the key card are both visible. That pair
is the product.

### Then add the wordmark yourself

In Figma, Canva or any editor, over the empty area:

| | |
|---|---|
| Line 1 | **Gati** — Plus Jakarta Sans ExtraBold, ~96 px, `#1E4D2B` (or `#F8F5EF` on prompt C) |
| Line 2 | **Life numbers & wanders** — Plus Jakarta Sans Medium, ~34 px, `#2A7D4F` (or `#F8F5EF` at 80% on C) |
| Position | left-aligned, starting ~90 px from the left edge, vertically centred |

Plus Jakarta Sans is the app's own typeface and is free on Google Fonts, so
the graphic matches the product.

### Before uploading, check

- [ ] Exactly 1024 × 500
- [ ] Nothing important within 100 px of the left/right edge or 75 px of top/bottom
- [ ] Text spelled correctly and not clipped
- [ ] Legible as a thumbnail — shrink it to 320 px wide and look again
- [ ] No screenshots, no device frames, no fake UI inside it
- [ ] No "Free", "Best", "#1", no star ratings, no review quotes — all are
      metadata-policy violations on a feature graphic

---

## Phone screenshots — REQUIRED, minimum 2, upload 6

> **Do not generate these with an image model.** Play's metadata policy
> requires screenshots to represent actual app content. Invented screens risk
> rejection now and a takedown later.

**1080 × 1920** is the safe choice. 16:9 or 9:16, each side 320–3840 px,
under 8 MB each.

```bash
adb shell screencap -p /sdcard/s.png && adb pull /sdcard/s.png
```

Capture these six, in this order — the first two are what most people see:

| # | Screen | What it must show |
|---|---|---|
| 1 | Today | a key available, the day's decision waiting, the day-of-year card |
| 2 | Numbers | the grid, some tiles open and some sealed |
| 3 | A number detail | one big figure — heartbeats or breaths reads best |
| 4 | Wander | a real nearby place with its distance, rating and the radius chips |
| 5 | Story | a timeline with a streak running |
| 6 | Unlock sheet | the moment of spending a key |

You may add a caption band and a device frame around each capture — that is
allowed and lifts conversion — as long as the screen content itself is
unaltered.

> A vertical 1080x1920 background for a phone screenshot mockup. Solid warm
> cream, hex #F8F5EF, with one oversized leaf silhouette in a barely visible
> lighter green bleeding off the bottom-right corner. Clean, flat, minimal,
> with a large empty area across the top third for a caption. No text, no
> device, no phone, no hands.

Captions, Plus Jakarta Sans Bold, `#1E4D2B`, 6–8 words:

1. "One key. Twenty-five numbers. Your choice."
2. "Unlock one a day, not all at once."
3. "Two billion heartbeats. Give or take."
4. "Every number points somewhere near you."
5. "A year of discoveries, in order."
6. "Spend a key. See what you get."

---

## Skip these

**Tablet screenshots** — this build is `platforms: ['android']` and
phone-only. Play shows a "not optimised for tablets" note, which is fine for
a first release.

**Promo video** — optional, a YouTube URL. Adding one overlays a ▶ button on
the centre of your feature graphic, which is why the composition above keeps
the centre clear.

**Promo graphic (180×120)** — deprecated by Play. Ignore it.
