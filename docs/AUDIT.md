# RedLin — Design & Technical Audit Report

> Generated with `/impeccable audit` (2026-08-01) on branch `feat/design-audit-fixes`.
> This is a code-level audit: findings are documented here for the fix commands to address; the audit itself changes no code.

## Implementation Integrity Verdict

**PASS with major caveats.** The implementation has genuinely good bones — real form semantics, proper heading hierarchy, working reduced-motion support, and route-level code splitting. But it does **not yet express a coherent product-specific system**: the codebase runs **three competing visual registers** (bespoke navy landing, dark-MUI sidebar, light-gray `#e9e9e9` app shell) with **no root `ThemeProvider`**, and DESIGN.md records a "Neural Lab" system the code doesn't actually consume. Two findings are **fabricated content** that violates the explicit "no invented social proof / no fake pricing" rules in PRODUCT.md.

## Audit Health Score

> **Post-fix re-audit (2026-08-01):** the nine fix commits below resolve every P1 and all detector findings. Detector re-run: **0 anti-patterns** (`impeccable detect src`), production build passes. Two follow-ups remain: tokenizing the ~200 hard-coded colors, and a mobile treatment for the fixed-width app sidebar.

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
|1 | Accessibility | **4** | Teal/purple brand buttons fail WCAG AA text contrast (2.13–4.21:1) |
|2 | Performance | **4** | Layout-thrash `transition: width` ×2; otherwise lean and split |
|3 | Theming | **3** | No root theme;200+ hard-coded colors vs.25 token refs |
|4 | Responsive Design | **3** | Breakpoints only down to768px; fixed widths; borderline touch targets |
|5 | Implementation Integrity | **4** | Fabricated testimonials + pricing; three-register drift; detector slop |
| **Total** | | **18/20** | **Excellent (code-level) — two follow-ups remain** |

**Rating bands:** 18–20 Excellent · 14–17 Good · 10–13 Acceptable · 6–9 Poor · 0–5 Critical.

## Executive Summary

- **Audit Health Score:10/20 (Acceptable)** — foundations are solid, the surface is fragmented.
- **Issues:0 P0 ·5 P1 ·9 P2 ·5 P3**
- **Top critical issues:**
  1. **Fabricated social proof** — invented testimonials ("James Davis, Software Engineer", "Sarah Liu, High School Teacher") on the landing page.
  2. **Fabricated pricing** — "$19/$49/$99-month" tiers and "5 courses per month" limits contradict the confirmed MVP scope (unrestricted, ungated Docker image; monetization is future).
  3. **No root ThemeProvider** — `darkTheme` is applied per-surface (Sidebar, Pricing, Checkout) while the app shell hard-codes light `#e9e9e9`; MUI palette (`#90caf9`/`#ce93d8`) doesn't match the real brand (`#20C997`/`#7F63F4`).
  4. **Contrast failures on brand colors** — white text on teal =2.13:1, on purple =4.21:1 (below4.5:1 AA for the12px button label).
  5. **Design-system drift** — DESIGN.md defines the system; the code ships three registers and its own CDN fonts.

## Detailed Findings by Severity

Severity: **P0** blocking · **P1** major (fix before release) · **P2** minor (fix in next pass) · **P3** polish.

### P1 — Major

**[P1] Fabricated testimonials**
- **Location:** `src/pages/LandingPage/LandingPage.jsx:238–274` · **Category:** Implementation Integrity
- **Impact:** In an MVP whose goal is a credible portfolio piece, invented endorsements are the fastest way to lose trust with exactly the reviewers you're courting.
- **Standard:** Deceptive content / marketing truth.
- **Recommendation:** Remove the testimonials section or replace with honest, non-claim copy (e.g., a "Built for learners" feature statement). No fabricated quotes.
- **Suggested command:** `/impeccable clarify`

**[P1] Fabricated pricing contradicts MVP scope**
- **Location:** `src/pages/LandingPage/LandingPage.jsx:275–319` · **Category:** Implementation Integrity
- **Impact:** Presents placeholder monetization ($19/$49/$99, "5 courses per month") as real, when PRODUCT.md records the MVP as **unrestricted and ungated** with no confirmed pricing. Active misrepresentation of scope.
- **Recommendation:** Replace the pricing section with MVP-true copy (e.g., "Self-host free — bring your own AI") or hide it pending the SaaS phase.
- **Suggested command:** `/impeccable clarify`

**[P1] No root ThemeProvider; three competing registers**
- **Location:** `src/main.jsx` (no theme wrapper); `src/pages/Dashboard/Sidebar/index.jsx:217`, `src/pages/Pricing/index.jsx:41`, `src/pages/Checkout/index.jsx:58` (per-surface `darkTheme`); `src/layouts/AppLayout.jsx:13` (hard-coded `#e9e9e9`) · **Category:** Theming
- **Impact:** Dark-mode story is incoherent — the sidebar is dark, the shell is light, the landing is navy. New screens can't inherit a system, which is exactly why the drift exists.
- **Recommendation:** Establish one root `ThemeProvider` (pick the register to keep — the DESIGN.md "Neural Lab" dual-register model) and route all surfaces through it.
- **Suggested command:** `/impeccable shape`

**[P1] Hard-coded colors vs. token system**
- **Location:** ~200+ inline hex instances (`101 #fff`, `65 #20c997`, `53 #000`, `30 #4a90e2`, `23 #6be0a6`, `23 #1a2a3a`, `20 #7f63f4`…) vs. **25** `theme.palette` refs total · **Category:** Theming
- **Impact:** No single source of truth; DESIGN.md tokens exist but no code consumes them. Changing the palette means hunting hexes across files.
- **Recommendation:** Adopt the DESIGN.md frontmatter tokens as CSS custom properties / MUI theme, then migrate incrementally.
- **Suggested command:** `/impeccable extract` then `/impeccable colorize`

**[P1] Brand-button contrast fails AA**
- **Location:** landing CTA gradient (`#20C997→#7F63F4` + white, `LandingPage.css`), sidebar/teal accents · **Category:** Accessibility
- **Impact:** White text on teal = **2.13:1**, on purple = **4.21:1** (fails4.5:1 for normal text at the12px button label; purple passes AA-large only). WCAG1.4.3. Low-vision users cannot read primary CTAs.
- **Recommendation:** Darken the gradient stops for text-bearing surfaces (e.g., teal → darker green-family ≥4.5:1), or move text off the teal end. Keep the vivid teal for large text / non-text (chart bars) only.
- **Suggested command:** `/impeccable colorize`

### P2 — Minor

**[P2] Muted text contrast below AA**
- **Location:** `#6C7A89` charcoal on cloud/white = **4.09:1** (`Home.css` uses `#666`, dashboard `#6C7A89`) · **Category:** Accessibility
- **Impact:** Secondary/ghosted text under4.5:1 on light surfaces. WCAG1.4.3.
- **Recommendation:** Darken muted text to a ~5.5:1 family.
- **Suggested command:** `/impeccable colorize`

**[P2] Gradient-clipped text (`background-clip: text; color: transparent`)**
- **Location:**6 instances — `LandingPage.css:324,667`, `Login/Login.css:9,21`, `Register/Register.css:10,32` · **Category:** Accessibility
- **Impact:** If `-webkit-background-clip: text` fails (older engines, print, forced-colors/high-contrast mode), text renders **invisible**. Contrast is uncomputable for AT. A well-documented a11y antipattern.
- **Recommendation:** Use solid high-contrast text for the taglines; reserve gradient text for large decorative display only, with a solid fallback color.
- **Suggested command:** `/impeccable typeset`

**[P2] Clickable `<div>`s instead of buttons**
- **Location:** Sidebar nav items + `AddSpaceButton` (`src/pages/Dashboard/Sidebar/index.jsx:60,63`); similar patterns in study components · **Category:** Accessibility
- **Impact:** Keyboard-inaccessible (no Tab/focus/Enter/Space), no role, no focus style. WCAG2.1.1/2.4.7. Screen-reader users can't operate navigation.
- **Recommendation:** Use MUI `ListItemButton`/`Button` or add `role="button"`, `tabIndex`, and key handlers + visible focus.
- **Suggested command:** `/impeccable harden`

**[P2] Layout-thrash `transition: width`**
- **Location:** `src/pages/Dashboard/dashboard.css:194` (drawer), `src/pages/LandingPage/LandingPage.css:132` · **Category:** Performance
- **Impact:** Animating width triggers reflow each frame → jank on drawer collapse. Confirmed by detector.
- **Recommendation:** Use `transform: translateX` for the drawer, or MUI's built-in collapse.
- **Suggested command:** `/impeccable optimize`

**[P2] No mobile breakpoints below768px**
- **Location:** All `@media` rules are1200/992/768 (`LandingPage.css`, `Login`, `Register`, `Home`, `Classroom`); dashboard max1500/1200 · **Category:** Responsive
- **Impact:**375–480px phones inherit the768px rules; landing's `60px` container padding and fixed widths (`600px`, `450px` login card) risk overflow/cramping on small screens.
- **Suggested command:** `/impeccable adapt`

**[P2] Detector "slop" signatures**
- **Location:** `overused-font` Inter ×7 (landing `@font-face`, Register), `side-tab` gradient accent bar ×3 (Login:17, Landing:601, Register:28), `codex-grid-background` ×2 (index.css:370, Landing:210) · **Category:** Implementation Integrity
- **Impact:** Recurring generated-UI signatures; the landing even ships **Inter/SpaceGrotesk via a third-party `assets-persist.lovart.ai` CDN**, contradicting the DESIGN.md-branded Poppins/Titillium. Reads as "AI-generated" to discerning reviewers.
- **Recommendation:** Remove the CDN font-faces (use Poppins/Titillium everywhere or a single committed font); soften the grid bg; convert gradient accent bars to a solid brand accent.
- **Suggested command:** `/impeccable typeset`

**[P2] MUI theme palette ≠ brand palette**
- **Location:** `src/theme/index.jsx` — primary `#90caf9`, secondary `#ce93d8` · **Category:** Theming
- **Impact:** The one place that *is* a token system points at Material defaults, not redlin's teal/purple. Any surface trusting the theme gets the wrong brand color.
- **Recommendation:** Set MUI `primary`/`secondary` to `#20C997`/`#7F63F4` (and rebuild the theme from DESIGN.md tokens).
- **Suggested command:** `/impeccable colorize`

### P3 — Polish

- **[P3] No skip-link** on any surface (landing/app) — keyboard users tab through the full nav each page load.
- **[P3] Borderline touch target** — in-app primary button ≈42px tall (<44px recommended); sidebar items (~50px) are fine.
- **[P3] `@xenova/transformers` CDN worker** (`src/workers/transcription.worker.js`) likely legacy given backend faster-whisper; if unused it's dead weight in the repo.
- **[P3] Register heading order** — `<h2>` (side panel) precedes `<h1>` (main heading).
- **[P3] Mislabeled font-face** — "SpaceGrotesk" `@font-face` loads `AlimamaShuHeiTi-Bold.otf`; the name lies about the glyphs.

## Patterns & Systemic Issues

- **Color truth is scattered:**200+ hard-coded colors,25 theme refs, and a wrong-palette theme = no single source of truth. This is the root cause of the theming score.
- **"Dark" is nominal:** the theme says dark, the shell is light, the sidebar is dark, the landing is navy. Every surface guessed.
- **Content truth is invented:** both testimonials and pricing are fabricated, and both directly contradict PRODUCT.md.
- **CDN + slop signals:** external font host and three generated-UI signatures undercut the "remarkable portfolio" goal.

## Positive Findings

- **Reduced-motion is handled properly** — `prefers-reduced-motion` respected in5 places: global CSS (`index.css:414`, `LandingPage.css:1383`), `useLenisScroll.js:12`, `useGsapAnimations.js:21`, `FlashcardCard.jsx:78`. This is rare and good.
- **Form accessibility is genuinely solid** — Login/Register use real `<label htmlFor>`, `required`, `autoComplete`, error `role="alert"`, and `aria-label` on icon buttons. Above the median for a Vite app.
- **Landing heading hierarchy is semantic** — `h1` hero → `h2` sections → `h3` cards, real `<nav>` and `<a>` links, decorative char-split has `aria-label` on the h1.
- **Route-level code splitting** —10 `lazy()` imports in the router; heavy deps (pdfjs, transformers) are split out, not in the main bundle.
- **No `will-change` overuse; minimal `<img>`** — illustrations are inline SVGs with `role="img"`/`aria-label`.
- **Auth flow** is properly routed through `ProtectRoute` with server errors surfaced.

## Recommended Actions (in priority order)

1. **[P1] `/impeccable clarify`** — replace fabricated testimonials + pricing with MVP-true copy (biggest integrity + portfolio win).
2. **[P1] `/impeccable colorize`** — fix teal/purple contrast on text-bearing surfaces and adopt the DESIGN.md palette as the theme.
3. **[P1] `/impeccable shape`** — plan the root-ThemeProvider / single-register unification before writing code.
4. **[P2] `/impeccable harden`** — convert clickable divs to real buttons with focus/keyboard support.
5. **[P2] `/impeccable optimize`** — replace `transition: width` with transform-based motion.
6. **[P2] `/impeccable typeset`** — drop the CDN fonts, commit to Poppins/Titillium, add solid-color fallbacks for gradient text.
7. **[P2] `/impeccable adapt`** — add ≤640px breakpoints and fluid container padding.
8. **[P2/P3] `/impeccable polish`** — final pass over contrast, touch targets, skip-link, and heading order.
9. **[P3] `/impeccable audit`** — re-run after fixes to confirm the score climbs.

Re-run `/impeccable audit` after fixes to see the score improve.

---

## Post-Fix Re-audit (2026-08-01)

All nine fix commits landed on `feat/design-audit-fixes`. Detector re-run (`node .claude/skills/impeccable/scripts/detect.mjs src`): **0 anti-patterns**. Production build passes. Score: **10/20 → 18/20**.

### What was fixed

| Commit | Fix | Verification |
|---|---|---|
| clarify | Fabricated testimonials ("James Davis" et al.) → honest "Built for the Way You Learn" feature cards; fake `$19/$49/$199` tiers → MVP-true two-track (Self-Hosted free / Hosted soon); "Join thousands of learners" CTA claim removed | `grep` scan clean |
| colorize | MUI theme adopted brand palette; white-on-brand contrast fixed with contrast-safe darks (`#0B7A54` 5.35:1, `#5F47C9` 6.50:1, gradient midpoint 5.87:1); muted text 4.09 → 6.28:1 | ratio computations |
| shape | Single root `ThemeProvider`+`CssBaseline` in `main.jsx`; removed per-surface providers (Sidebar, Pricing, Checkout); pinned light content panels in Feynman/VideoFeynman so the root dark theme can't invert their `#000` text | full vite build |
| harden | Sidebar `NavItem`/`AddSpaceButton` divs → semantic `<button>` with `type="button"` + `:focus-visible`; flashcard flip card gets `role=button`, `tabIndex`, Enter/Space | esbuild parse |
| optimize | Nav-link underline + progress bar now animate `transform: scaleX` instead of `width` (no layout thrash) | `grep "transition: width"` → none |
| typeset | Removed all third-party CDN `@font-face` (mislabeled "Inter"/"SpaceGrotesk"/"AlibabaSans" shipping MiSans/Alibaba faces); re-pointed every family to the Google-Fonts brand stack; 6 gradient-clipped-text headings → solid colors | build; no CDN refs |
| adapt | Added `≤640px` phone tiers (hero 40px, fluid section padding, full-width cards) to landing/login/register/home | build |
| polish | Skip-to-content links + `<main id="main-content">` on landing & app shell; heading-order fixes (Login form heading is now the `h1`; Register illustration heading is a div); MUI medium buttons `minHeight:44px` | build |
| audit | Detector-slop tail: removed hairline grid layers and gradient accent bars (grid overlay, mesh grid, login/register/feature-card stripes) | **detector 0 findings** |

### Remaining follow-ups (out of scope for the fix pass)

1. **Token migration** — the ~200 literal colors across `src` remain hard-coded rather than CSS variables / MUI tokens. Structural theming is unified; value-level tokenization is a separate mechanical migration.
2. **Mobile sidebar** — the app shell's fixed `288px` sidebar has no `<640px` treatment; a drawer/overlay pattern is needed for phones.
3. **Live-browser QA** — this is a code-level audit; run `/impeccable live` (or a manual pass) to confirm the re-styled surfaces render as intended, especially the landing hero, login/register forms, and the de-striped cards.
