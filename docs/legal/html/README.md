# Legal pages — Elementor HTML fragments

Four self-contained fragments for the WordPress site. Each is a complete
drop-in: paste the whole file into an Elementor **HTML** widget.

| File | Suggested page | Used by |
|---|---|---|
| `privacy-policy.html` | `/privacy-policy` | Play listing (required), app Profile, paywall |
| `terms-of-service.html` | `/terms-of-service` | App Profile, paywall |
| `data-safety.html` | `/data-safety` | Public summary of the Play declaration |
| `account-deletion.html` | `/account-deletion` | **Play Console → Data safety → Account deletion URL** |

## How they are isolated from the theme

No `<html>`, `<head>` or `<body>` — fragment only, as Elementor expects.

Everything is scoped under a single `.gati-doc` wrapper, and every element
carries a `gtl-` class. That matters because of specificity: a theme rule like
`h2 { … }` is `(0,0,1)` while `.gati-doc .gtl-h2` is `(0,2,0)`, so ours wins
without needing `!important`.

A theme rule with a **universal selector** (`* { letter-spacing: 2px }`) targets
descendants *directly*, so inheritance from the wrapper does not stop it. The
`.gati-doc *` reset therefore neutralises every property a theme commonly
hijacks — `letter-spacing`, `text-transform`, `text-align`, `font-style`,
`background-color`, `border`, `box-shadow`, `text-decoration` — and each
`gtl-` class re-declares what it actually needs.

This was verified, not assumed: each page was rendered inside a deliberately
hostile stylesheet (Comic Sans uppercase headings, centred cyan paragraphs,
lime dashed tables, a global `*` letter-spacing) and checked visually. Three
leaks were found and fixed that way — uppercase titles, centred body text, and
table cell backgrounds.

Nothing leaks **out** either: no rule here matches anything outside `.gati-doc`.

## Before publishing

1. **Check the internal links.** Each page links to the others with root-relative
   paths (`/privacy-policy`, `/terms-of-service`, `/account-deletion`). Update
   them if your slugs differ.
2. **`support@gati.app` must be a real inbox** — Play checks the deletion route.
3. Once live, point the app at them:
   ```
   EXPO_PUBLIC_PRIVACY_URL=https://yourdomain.com/privacy-policy
   EXPO_PUBLIC_TERMS_URL=https://yourdomain.com/terms-of-service
   ```
4. The account-deletion page **must be reachable without logging in**. Do not
   put it behind a members-only area.

## Keeping them honest

`account-deletion.html` and `data-safety.html` make specific factual claims —
what is deleted, what is retained, how long, what is collected. They currently
match the app's behaviour. If that behaviour changes, change these too: a
public page that contradicts the Play Data Safety form is a policy violation.
