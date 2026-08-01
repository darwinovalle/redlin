---
name: RedLin
description: AI-powered spaced-repetition learning platform for lifelong learners — turn your own PDFs, CSVs, and videos into interactive, gamified mastery.
colors:
  eco-teal:
    value: "#20C997"
    role: primary
  electric-purple:
    value: "#7F63F4"
    role: secondary
  deep-navy:
    value: "#1A2A3A"
    role: dark-surface
  darker-navy:
    value: "#07141f"
    role: deepest-surface
  slate-blue:
    value: "#4A90E2"
    role: tertiary
  coral:
    value: "#FF7E67"
    role: warm-accent
  warm-amber:
    value: "#FFB400"
    role: warm-accent-alt
  cloud:
    value: "#F5F7FA"
    role: light-surface
  mist:
    value: "#E1E5EA"
    role: light-border
  pale-teal:
    value: "#E0F5EF"
    role: light-accent-surface
  charcoal:
    value: "#6C7A89"
    role: muted-text
  white:
    value: "#FFFFFF"
    role: text-on-dark
  app-bg:
    value: "#e9e9e9"
    role: app-shell-background
  surface-stroke:
    value: rgba(255, 255, 255, 0.06)
    role: dark-divider
  brand-gradient-135:
    value: "linear-gradient(135deg, #20C997, #7F63F4)"
    role: primary-gradient-angled
  brand-gradient-90:
    value: "linear-gradient(90deg, #20C997, #7F63F4)"
    role: primary-gradient-horizontal
typography:
  display:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 600
    letterSpacing: "normal"
    textTransform: "none"
  title:
    fontFamily: "Titillium Web, Poppins, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
  body:
    fontFamily: "Titillium Web, Poppins, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Titillium Web, Poppins, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.04em"
  mono:
    fontFamily: "monospace"
    fontSize: "0.875rem"
  landing-headline:
    fontFamily: "'SpaceGrotesk', sans-serif"
    fontSize: "28px"
    fontWeight: bold
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "15px"
  "2xl": "20px"
  "3xl": "30px"
  "4xl": "40px"
  pill: "50px"
  circle: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  "3xl": "64px"
  "4xl": "80px"
  container-px: "60px"
  section-gap: "80px"
  hero-gap: "120px"
components:
  button-primary:
    backgroundColor: "{colors.electric-purple}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
    padding: "12px 32px"
  button-primary-hover:
    backgroundColor: "#7F63F4"
    textColor: "{colors.white}"
  button-primary-landing:
    backgroundColor: "{colors.brand-gradient-135}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    typography: "{typography.title}"
    padding: "14px 36px"
  card:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  navbar-dark:
    backgroundColor: rgba(26, 42, 58, 0.8)
    textColor: rgba(255, 255, 255, 0.8)
    rounded: "0"
    typography: "{typography.display}"
  study-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.darker-navy}"
    height: "200px"
---

# Design System: RedLin — The Neural Lab

## Overview

**Creative North Star: "The Neural Lab"**

RedLin's visual system is a learning science laboratory where intelligence is being forged — not a sanitized dashboard that tracks it. It lives in deep, calm surfaces (navy `#1A2A3A`, near-black `#07141f`, light gray `#F5F7FA`) punctuated by the teal-to-purple gradient that is the product's brand signature. Teal (`#20C997`) is the dominant voice: it signals action, progress, correctness, and mastery. Purple (`#7F63F4`) is its equal partner in the gradient, and stands alone as a secondary accent in the study interface. Coral (`#FF7E67`) and amber (`#FFB400`) provide warmth and contrast in a system that would otherwise read as purely technical.

The system operates across two visual registers that share one palette and one motion identity:

1. **The Landing (Persuade):** a cinematic, motion-driven, semi-dark surface with hero gradient, floating blobs, and GSAP-staggered hero text. Deep navy background, frosted-glass navbar (backdrop-blur), and bold teal-purple accents fill the viewport.
2. **The App Shell (Operate):** a light-gray ground (`#e9e9e9`) with a dark-themed sidebar, light study cards, and teal-purple accents. Sharper and quieter — no radial gradients — the intelligence shows its work through clean structure and precise color rather than spectacle.

The motion identity is a settled fact: GSAP + Lenis smooth scroll, the WavyBackground ribbon, canvas-confetti on success milestones, and audio cues (button click, card flip, drop card, UI pop) give every interaction physical presence.

This system actively rejects three aesthetics: **no clinical** flat-minimal science-tool corporatism (white-box sterility), **no childish** gamification (bright candy colors and cartoon energy), and **no generic dark-mode-default** (the same dark floor every AI startup ships). The anti-reference is: *not an AI tool that looks like all the other AI tools.*

**Key Characteristics:**
- Teal-first: `#20C997` has the most surface presence across every screen — landing CTA, primary app button, selected state, mastery marker, XP indicator.
- Dark + light hybrid: the landing lives on deep navy; the app shell on light gray. Both pull from the same palette family, not a single tint direction.
- Gradient as signature: the `135deg` teal→purple gradient is the brand symbol — deployed at hero CTA, logo mark, progress bar, and mastery milestone, but never as a background wash across a full section.
- Colored shadows: shadows are sparse but they glow — teal glow shadows on landing hero buttons and card groups. Every shadow is deliberate, not ambient elevation stacking.
- Motion is a living quality: Lenis smooth scroll, GSAP text animation, and confetti on mastery are properties of the identity, not decoration. New surfaces must incorporate them.
- Sound presence: four cue mp3s (button click, card flip, drop, pop) plus the WavyBackground canvas wave. Removing the sound removes a measurable share of the system's immediate character.

## Colors

The palette is built around two core accent colors — teal (`#20C997`) and purple (`#7F63F4`) — that pair as a gradient. From there it branches into two deep navy surfaces for the landing, a set of light gray surfaces for the app shell, and a small set of warm accents for contrast.

### Primary
- **Teal** (`#20C997`): The dominant voice. Used as the landing CTA gradient start, selected and mastery states, progress indicators, success feedback, data-viz bars, and the active accent everywhere. Also present as lighter tints (`#8bf0bf`, `#6be0a6`) in charts and dashboards.
- **Electric Purple** (`#7F63F4`): The complementary brand color and the second half of the gradient. Used standalone as the primary button accent, sidebar selection, settings highlight, and the advanced tier color.

### Secondary
- **Slate Blue** (`#4A90E2`): Tertiary accent where an extra tone is needed — chart lines, hover states, secondary progress tracks. Sits between teal and purple in prominence.
- **Pale Teal** (`#E0F5EF`): A light teal-tinted surface — used as a result-page accent background, success-toast background, or a subtle accent carrier in study cards.

### Warm Accents
- **Coral** (`#FF7E67`): Warnings, errors, destructive actions, and alert clusters. Saturated enough to feel urgent against dark or light backgrounds.
- **Amber** (`#FFB400`): A bright, warm accent used for star-like icons, premium badges, and milestone marks. Used infrequently and always draws attention.

### Dark Surfaces
- **Deep Navy** (`#1A2A3A`): The landing page base — the hero region, feature sections, and the dark sections that carry the brand gradient.
- **Darker Navy** (`#07141f`): The deepest tone — used for the footer and as the fallback where a near-black is needed.

### Light Surfaces
- **App Shell Background** (`#e9e9e9`): The light gray that sits behind everything in the app (Dashboard, Home, CSV Study, Video Study, Classroom, Settings). Never appears on the landing.
- **Cloud** (`#F5F7FA`): Soft and near-white — used on the landing's light sections and as the study cards' background in the app.
- **Mist** (`#E1E5EA`): The light divider / border tone — just dark enough to separate cards and sections without drawing attention.
- **Charcoal** (`#6C7A89`): Muted secondary text on light backgrounds for labels and supporting text.

### White
- **White** (`#FFFFFF`): Text-on-dark standard. Used for hero heading text, landing card labels, and button text on dark backgrounds.

### Named Rules

**The Teal Reserve Rule.** Every screen in the product must carry at least one teal or purple accent element — a button, a marker, a badge, an icon, a divider. An entirely neutral screen should not exist in the codebase.

**The Gradient Moderation Rule.** The `135deg` teal→purple gradient is used in only three places: the landing hero CTA button, the logo mark, and the mastery-accomplishment badge. Its rarity is the point — never used as a background wash.

**The Two-Register Separation Rule.** Landing surfaces use navy, gradient, and glow. App (dashboard) surfaces use light gray with solid teal or purple — never the gradient. No app surface should contain a teal-to-purple gradient container.

## Typography

**Display:** Poppins (weight 600–700) for hero, section headings, and brand voice.
**Body:** Titillium Web (weight 400–600) for body text, cards, labels, and forms.
**Mono:** System monospace stack for AI transcripts, prompt blocks, and code.
**Landing:** `SpaceGrotesk` (bold, 28px) — loaded via @font-face for the navbar logo only.

**Character:** Poppins brings weight, confidence, and precision to the brand voice. Titillium Web (at 1rem / 1.6 line-height) carries the body and study content in a mode learners trust. The pair reads sharp, confident, and trustworthy.

### Hierarchy
- **Display / Hero** (Poppins, weight 700, `clamp(2rem, 5vw, 3.5rem)`, line-height 1.15): Landing hero heading — one per page.
- **Headline** (Poppins, weight 600, `clamp(1.5rem, 3vw, 2.25rem)`): Section titles ("Powerful Features", "Benefits"). Used on both landing and app section headers.
- **Title** (Titillium Web + Poppins, weight 600, 1.125rem): Card headings, question text, modal headers.
- **Body** (Titillium Web + Poppins, weight 400, 1rem, line-height 1.6): Paragraph content on the landing and within study areas. Max ~70ch per line.
- **Label** (Titillium Web + Poppins, weight 600, 0.75rem, letter-spacing 0.04em): Button text, form labels, badge text, streak/XP counters.
- **Mono** (system mono): AI-generated transcripts, prompt blocks, code previews — browser default stack.

### Named Rules

**The One Lead Font Rule.** Titillium Web leads the body inside the app; Poppins leads the voice on the landing. Each stays on its own stage; do not swap.

## Layout

The layout uses two distinct models:

- **Landing page:** full-viewport hero section followed by a scrolling sequence of block sections (features, benefits, how-it-works, pricing, footer). Each section is centered with `60px` container padding and spaced by `80px` section gaps. Interior tiles use CSS grid or flex-wrap.
- **App shell:** a horizontal flex root (`#e9e9e9` background) with a fixed left sidebar (MiniDrawer) plus a scrollable right content area. Card grids use 24–32px column gaps.
- **Navbar:** fixed, height 80px, `backdrop-filter: blur(10px)`, background `rgba(26,42,58,0.8)`, bottom border `1px solid rgba(255,255,255,0.06)`.

## Elevation & Depth

The system does not use classic material-design z-stacking layers. Instead:

- **Landing depth:** a single shadow plane — deep navy background is the base, cards float up with `0 20px 40px rgba(0,0,0,0.3)`, and CTA buttons receive colored glow (`0 6px 20px rgba(32,201,151,0.5)`). Glow is the dominant depth cue — every shadow here has a color, never a flat gray gradient.
- **App shell depth:** nearly flat — white/cloud cards against a light gray background use subtle borders (`rgba(255,255,255,0.06)` on dark, `#E1E5EA` on light) rather than stacking shadows.

### Shadow Vocabulary
- **Ambient-low:** `box-shadow: 0 10px 30px rgba(0,0,0,0.2)` — default card hover on light surfaces.
- **Teal-glow-loud:** `box-shadow: 0 6px 20px rgba(32,201,151,0.5)` — landing CTA button glow, mastery milestone badge.
- **Purple-glow-loud:** `box-shadow: 0 10px 20px rgba(127,99,244,0.3)` — secondary accent attractor for purple-card or pill instances.
- **Ambient-large:** `box-shadow: 0 30px 60px rgba(0,0,0,0.3)` — wider dark-card hover or active spread.

## Shapes

The form language is consistently curved — no zero-radius is used:

- **Cards:** `15px` to `20px` — the landing system uses 20px; the app cards use 15px.
- **Buttons:** `50px` (pill) — universally round-pill for CTAs and primary buttons in both registers.
- **Inputs / fields:** `15px` — for login/register input boxes.
- **Chips / badges:** `50px` or full-circle depending on usage.
- **Borders:** a thin divider on dark surfaces (`rgba(255,255,255,0.06)`) and `#E1E5EA` on light surfaces. No edge uses a sharp 90° corner.

## Components

Components are styled per-instance via MUI `sx` props, not via a centralized theme-variable system. The specs below describe what the codebase actually renders.

### Buttons
- **Primary (In-app):** `background: #7F63F4; color: #FFFFFF; border-radius: 50px; padding: 12px 32px; font-weight: 600; font-size: 0.75rem; text-transform: none; border: none`. The hover state has no distinct theme color — a slight lightness shift.
- **Landing CTA:** `background: linear-gradient(135deg, #20C997, #7F63F4); color: #FFFFFF; border-radius: 50px; padding: 14px 36px; font-weight: 600; border: none`. Hover adds `box-shadow: 0 6px 20px rgba(32,201,151,0.5)` and a ~2px upward translate, animated with `transition: all 0.3s ease`.
- **Landing Outline:** `background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #FFFFFF; border-radius: 50px; padding: 10px 24px; font-weight: 500`. Hover shifts to stronger visible text and a slightly brighter border.

### Cards
- **Shape:** border-radius `20px` (landing) / `15px` (app).
- **Landing card:** dark background, shadow `0 20px 40px rgba(0,0,0,0.3)`, inner padding 24px.
- **Study Card (app):** `#FFFFFF` background, border-radius 15px, 200px min-height, `#1A2A3A` text color, `0.5px #E1E5EA` border, no shadow.

### Inputs / Fields
- **Style (login/register only):** dark background `#2c2c2c`, text `#FFFFFF`, border `rgba(255,255,255,0.2)`, border-radius `15px`, padding `16px`.

### Navbar (Landing)
- Fixed, height 80px, `backdrop-filter: blur(10px)`, background `rgba(26,42,58,0.8)`, bottom border `1px solid rgba(255,255,255,0.06)`. Nav links are white 16px medium-weight; hover shifts to teal.

### Sidebar (App MiniDrawer)
- A dark-themed left collapsible drawer wrapped in `ThemeProvider theme={darkTheme}` + `CssBaseline`. Background uses the MUI dark theme's `paper` background (`#1e1e1e`). Navigation items expand with MUI Collapse; the active or selected item carries a teal overlay.

## Do's and Don'ts

### Do:
- **Do** use the teal→purple gradient only on the landing and at hero/milestone moments — never as a full-container fill in the app.
- **Do** carry teal or purple as a recurring accent on every screen in the product — buttons, active states, progress indicators.
- **Do** keep the two visual registers cleanly separate: the landing uses dark navy + gradient + backdrop blur; the app uses light gray + solid teal/purple.
- **Do** animate with attention — GSAP or CSS transitions for all interactive state changes and appearances.
- **Do** use the confetti explosion on success and milestone moments so the loop feels earned and rewarded.

### Don't:
- **Do not** use a flat, zero-shadow, zero-radius "sanitized lab" look anywhere. This system actively rejects that.
- **Do not** insert the gradient into the static in-app pages' solid main content area — it is reserved for hero moments only.
- **Do not** mix the two registers: landing colors do not belong in the app shell, and the app-shell gray is not used on the landing.
- **Do not** remove the frosted-glass blur from the landing navbar; it is a signature of the dark brand identity.
- **Do not** ship screens that lack a motion identity — even a static screen's hover, transition, tab, or expand state should carry the motion signature.
- **Do not** introduce a new high-frequency color to the palette without review — the teal/purple/slate family is the ceiling.
