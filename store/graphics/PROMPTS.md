# Image prompts — Gati store graphics

Brand constants. Put these in every prompt; an image generator will drift
otherwise.

| | |
|---|---|
| Deep green | `#1E4D2B` |
| Primary green | `#2A7D4F` |
| Cream / paper | `#F8F5EF` |
| Gold accent | `#E0A42E` |
| Mark | A single leaf, tilted, with a staircase ascending inside it as a cut-out, and a small gold dot at the top of the stairs |
| Feel | Calm, editorial, paper-like. Not a fitness app, not a dashboard, not neon. |

---

## 1. Feature graphic — REQUIRED — 1024 × 500 px, PNG or JPEG, under 15 MB

This sits at the top of your store page and is the only graphic Play shows
on some surfaces. **Keep everything important inside the middle 60%** — Play
crops the edges on different screens, and overlays a ▶ play button dead
centre if you ever add a promo video.

> A 1024x500 horizontal banner. Warm cream background, hex #F8F5EF, with
> a very subtle paper grain. On the left third, a large flat-vector leaf
> shape in deep forest green, hex #1E4D2B, tilted about 30 degrees, with a
> clean staircase ascending inside it as a negative-space cut-out, and one
> small gold circle, hex #E0A42E, resting at the top step. The right two
> thirds is open cream space. Flat vector illustration, no gradients, no
> drop shadows, no 3D, no photography, generous margins, centred
> composition, editorial and calm. No text, no lettering, no words
> anywhere in the image.

Then add the wordmark **yourself** in a design tool, not in the prompt —
generators produce garbled letterforms and misspelled text is an instant
quality-review flag. Set "Gati" in your app's Plus Jakarta Sans ExtraBold,
around 96 px, in `#1E4D2B`, with "Your life in numbers" under it at about
36 px in `#2A7D4F`.

Variant to try if the above reads too empty:

> Same brief, but the leaf is repeated four times across the banner at
> decreasing opacity — 100%, 40%, 20%, 10% — marching left to right like
> days passing, as a rhythmic pattern on the cream ground. Flat vector, no
> text.

---

## 2. App icon — 512 × 512 px, 32-bit PNG, under 1 MB

**Already generated for you** at `store/graphics/icon-512.png` — it is your
existing app icon downscaled with a box filter and flattened onto white, so
it has no alpha. Play composites the icon on both light and dark surfaces
and any transparency renders as a hole, which is why it is flattened.

Upload that file as-is. You only need a prompt if you want to redraw it:

> A 512x512 app icon. Perfectly centred flat-vector leaf in deep forest
> green, hex #1E4D2B, on a warm cream background, hex #F8F5EF, filling
> about 70% of the canvas. A staircase ascends inside the leaf as a
> negative-space cut-out in the background colour. A single small gold
> circle, hex #E0A42E, sits at the top step. Flat vector, no gradient, no
> shadow, no bevel, no border, no text. Square canvas, full bleed
> background.

---

## 3. Phone screenshots — REQUIRED — minimum 2, upload 6

> **Do not generate these with AI.** Play's metadata policy requires
> screenshots to represent actual app content. Invented screens are a
> rejection risk and, once live, an "inappropriate metadata" takedown risk.
> Capture the real app.

Specification: 16:9 or 9:16, each side between 320 px and 3840 px, PNG or
JPEG, under 8 MB each. **1080 × 1920** is the safe choice.

Capture from a real device or the emulator:

```bash
adb shell screencap -p /sdcard/s.png && adb pull /sdcard/s.png
```

Capture these six, in this order — the first two are what most people
actually see:

| # | Screen | What it has to show |
|---|---|---|
| 1 | Today | A key available and the day's decision waiting |
| 2 | Numbers | The grid, with some tiles locked and some open |
| 3 | A number detail | One big figure — heartbeats or breaths reads best |
| 4 | Wander | A real nearby place with its distance and rating |
| 5 | Story | A timeline with a streak running |
| 6 | Unlock sheet | The moment of spending a key |

You may add a caption band and a device frame around each capture — that is
allowed and lifts conversion — as long as the screen content itself is
unaltered. Backdrop prompt for those:

> A vertical 1080x1920 background for a phone screenshot mockup. Solid warm
> cream, hex #F8F5EF, with a soft oversized leaf silhouette in a barely
> visible lighter green bleeding off the bottom-right corner. Clean, flat,
> minimal, lots of empty space in the upper third for a caption. No text,
> no device, no phone, no hands.

Caption per shot, set in Plus Jakarta Sans Bold, `#1E4D2B`, 6–8 words:
1. "One key. Twenty-five numbers. Your choice."
2. "Unlock one a day, not all at once."
3. "Two billion heartbeats. Give or take."
4. "Every number points somewhere real."
5. "A year of discoveries, in order."
6. "Spend a key. See what you get."

---

## 4. Optional extras

**Tablet screenshots** — skip. This build is `platforms: ['android']` and
phone-only; Play will show a "not optimised for tablets" note, which is
acceptable for a first release.

**Promo video** — optional, a YouTube URL. Skip for launch. If you add one
later it must not autoplay ads and must show real app footage.

**Promo graphic (180×120)** — deprecated by Play. Ignore it.
