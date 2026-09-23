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

### Prompt A — the mark, with room for the wordmark (recommended)

> A 1024x500 horizontal banner graphic. Warm cream background, hex #F8F5EF,
> with a very subtle paper grain texture. On the left third, a single large
> flat-vector leaf in deep forest green, hex #1E4D2B, tilted roughly 30
> degrees clockwise, occupying about 60 percent of the banner height and
> fully inside the frame with generous margin on all sides. Inside the leaf,
> a clean geometric staircase ascends diagonally as a negative-space cut-out
> in the cream background colour, five even steps. One small solid circle in
> gold, hex #E0A42E, sits at the top step. The right two thirds of the banner
> is empty cream space. Flat vector illustration style, crisp edges, no
> gradients, no drop shadows, no 3D, no photography, no outlines. Calm,
> editorial, minimal. Absolutely no text, no letters, no words, no numbers
> anywhere in the image.

### Prompt B — days passing, if A reads too empty

> A 1024x500 horizontal banner. Warm cream background, hex #F8F5EF, subtle
> paper grain. The same flat-vector deep green leaf, hex #1E4D2B, tilted 30
> degrees, repeated five times across the banner from left to right at
> steadily decreasing opacity — 100, 55, 30, 15 and 7 percent — like days
> passing. The leftmost leaf is the most detailed and contains a
> negative-space staircase cut-out with a small gold circle, hex #E0A42E, at
> its top step. The rest are plain silhouettes. Even rhythmic spacing,
> everything well inside the frame. Flat vector, no gradients, no shadows, no
> 3D. No text, no letters, no words anywhere.

### Prompt C — number-led, leaning into what the app does

> A 1024x500 horizontal banner. Deep forest green background, hex #1E4D2B.
> Scattered across it, a loose constellation of small cream circles, hex
> #F8F5EF, of varying sizes, connected by thin cream lines, like a
> constellation map — sparse on the left, denser toward the right. One
> circle, slightly larger than the rest, is gold, hex #E0A42E. Large empty
> area in the left half for a title. Flat vector, minimal, elegant, no
> gradients, no 3D, no photography. No text, no letters, no numbers anywhere
> in the image.

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
