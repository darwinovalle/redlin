# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing codebase, already decided.

- **Backend:** Django 5.1 + DRF, Celery + Redis for async work (generation, transcription, evaluation, reports), faster-whisper for transcription, yt-dlp + youtube-transcript-api for video ingest. SQLite in dev.
- **Frontend:** React 18 + Vite, MUI v6 (Material), styled-components, GSAP + Lenis for motion/smooth scroll, pdfjs for PDF viewing. pnpm.
- **LLM:** Unified per-user provider dispatch over OpenAI, Anthropic, Gemini, and Ollama, with per-user encrypted API keys (Fernet). Bring-your-own-provider is a load-bearing product concept, not a convenience.
- **Ops:** Docker / docker-compose; backend ships as a pullable Docker image.

## Users

**Primary:** General lifelong learners. People who want to learn any topic quickly, easily, and in an engaging way, from whatever material they already have — their own PDFs, lecture transcripts, CSVs, or YouTube videos. No teacher, no imposed curriculum; the learner picks the topic and the source.

Two delivery tracks serve two sub-audiences:

- **Self-hosters (technical) — the MVP audience:** people comfortable pulling a Docker image and plugging in their own LLM provider/key. Free to download and use, fully unrestricted.
- **SaaS users (non-technical) — future audience, not this build:** people who want help set up and prefer a hosted, pay-monthly web app where redlin is the AI provider. Served later, not now.

## Product Purpose

Turn a learner's own source material into an interactive, gamified spaced-repetition loop so that concepts they have not yet mastered keep coming back until the learner genuinely feels secure in their knowledge. The product's reason to exist is the spaced-repetition-and-mastery system applied across every study mode — not any single study mode.

Success: a learner arrives with raw source material and a vague intention, and leaves having practiced it through MCQ, Cloze, and Feynman methods with AI feedback, retained it via spaced repetition, and visibly reached mastery — confirmed by the system and felt by the user as confidence.

## Positioning

The lead differentiator: **a unified spaced-repetition and mastery engine that applies across all study modes (MCQ, Cloze, Feynman) and across all content sources, presented as an interactive, gamified experience.** Specifically — every item the learner hasn't mastered yet keeps being revisited, with mastery earned (modeled on three consecutive passes), so the loop is closed around confidence, not a one-off quiz.

A neighboring product can truthfully copy one mode (Anki has SR cards; NotebookLM generates Q&A from your docs; Quizlet has MCQ/flashcards). They cannot truthfully claim the combination of: material generated from *the user's own* PDFs/CSVs/videos, open-form answers (Cloze, Feynman) *AI-evaluated* with a rubric, and all of it feeding one spaced-repetition/mastery engine — plus the option to bring your own model provider.

Supporting, secondary differentiators (part of the position, not the headline claim):

- **AI-generated study material from your own sources**, plus AI-evaluated open-form answers with response and rubric — not just pre-made flashcards.
- **Bring-your-own LLM provider with per-user keys**, including a fully self-hostable open Docker image — cost and privacy stay with the user; this is the MVP. A later hosted SaaS path (redlin as AI provider) opens the same engine to non-technical users.

## Operating Context

Two deployment tracks are two versions of the same product, **sequenced — not built together:**

1. **Self-hosted / Docker image — the current implementation (the MVP).** Open image anyone can pull and run; the runner sets their own LLM provider and key. **Unrestricted: no free tier, no paywall, no usage limits.** Bring your own model, use everything, no gating.
2. **Hosted SaaS — future scope, not this build.** For non-technical users; redlin is the AI provider. The later plan is a free trial, a free tier (≈2 generations/month), paid monthly subscription, and Stripe billing. **Open fact, not built:** the free monthly allowance resets at the start of each month, and on reset an unpaid user's prior data is cleared (a deliberate churn/retention design). All of this monetization is explicitly *later* and must not appear in the current implementation.

**Current build scope (MVP) = track 1 only:** the unrestricted self-hostable Docker app with bring-your-own LLM, the spaced-repetition/mastery + gamification core, and the study modes generated from the user's own material. **No free tier, no Stripe, no hosted-SaaS billing** until that later phase. The immediate goal of this build is also a standout **portfolio piece** — it must read as a remarkable, complete project on first impression, not as a half-finished monetization stub. Any pricing/subscription/free-tier surface in the current UI is placeholder and out of MVP scope.

Workflows the product must support:

- Ingest content: upload a PDF, import a CSV of study items, or add a YouTube video; the system transcribes/retrieves transcript and indexes the material.
- Generate study material: AI produces MCQs, Cloze items, Feynman prompts, and summaries from the ingested source.
- Study: the learner moves through a mix of modes in a quick or overall session; MCQ is auto-graded, Cloze/Feynman are AI-graded.
- Retain: every attempt feeds spaced repetition; due/unmastered items resurface; mastery is earned on consecutive passes.
- Gamify: XP, levels, and streaks reward completed sessions; build confidence and habit without enabling grind.
- Organize: Spaces group heterogeneous content (PDFs, videos, CSVs) into a personal course.
- Plan (planned): AI generates a paced study plan/path from a Space, tracked on a Kanban board (new/in-progress/done) with reports.

Real source material lives in `redlin_web/media` and a dev SQLite `redlin_web/db.sqlite3`; production uses Docker + (intended) Postgres/Redis. Animated public landing + auth live at `/`, `/login`, `/register`; the app shell (protected) holds Home, per-document/video/CSV study views, Classroom study sessions, Pricing, Checkout, and Settings.

## Capabilities and Constraints

Implemented (in code, working in dev):

- Ingest + AI generation of MCQ, Cloze, Feynman, and summaries from PDFs, CSVs, and YouTube videos (transcription via faster-whisper / youtube-transcript-api).
- Unified spaced-repetition and mastery: `CoreLearningProgress` (SM-2-style SR per user–item, generic FK to any item type), `CoreStudySession` (quick/overall × MCQ/Cloze/Feynman/Mixed), `CoreAttempt` (with `ai_score`, `ai_feedback`).
- Spaces: `Space` + `SpaceItem` (generic FK) to group heterogeneous content per user.
- Per-user LLM provider with encrypted keys: `UserLLMSettings` (Fernet-encrypted `api_key`), unified dispatch over **OpenAI, Anthropic, Gemini, Ollama**; the provider used is logged per generation call.
- XP/streak accounts (`CoreXpAccount`, `CoreXpAward`) — data model in place.

Out of MVP scope (later SaaS phase) — scaffolded or not built:

- **Subscriptions & billing:** `SUBSCRIPTIONS` app exists but is empty scaffolding — no Stripe, no tiers, no free-trial/free-tier logic, no monthly reset + data-clear rule. Frontend `Pricing` tiers ("Basic/Professional/Business", "projects/storage/devices", generic pricing) are placeholder copy, not redlin's plans and not part of the current build. Do not surface or imply monetization in the MVP.

In-scope but specified, not fully wired yet:

- **AI learning paths / Kanban planner:** documented in roadmap and `IDEA_1.md` (`StudyPlan`, `PlanTask`, `PlanReport`) but not implemented in models.
- **Mastery "three consecutive passes" finalization** and the full quick/overall selection algorithm described in the roadmap are specified, not fully wired.

Constraints to preserve:

- Return-*and*-confidence orientation: the loop must close on mastery, not just expose items once. Don't break the SR engine by short-circuiting mastery or skipping the "due" resurfacing.
- Open-form answers (Cloze/Feynman) must be AI-evaluated with a rubric and evidence — not merely string-matched — to avoid false positives. Keep the embedding/citation checks described in `IDEA_1.md`.
- Privacy: send the minimum necessary context to the LLM; per-user keys mean a self-hoster's content never touches redlin's infra.
- Existing model names and generic-FK design (`API_*`, `VIDEO_*`, `CORE/*`) are load-bearing; new features extend, not replace.

Terminology: user-facing copy and codebase mix **Español and English**. The UI ships in **English** as the primary product language; users may generate study content in Spanish today and more languages later. Internal docs (`docs/`) are largely Spanish.

## Brand Commitments

- **Name:** "redlin" (also written "RedLin" in the HTML title). Logo/wordmark assets live under `redlin-front/.../src/assets/redlin_logo/`.
- **Iconography:** Remix Icon (`ri-*`) is the committed icon set across the app; the brain-line motif (`ri-brain-line`) anchors the brand on the landing page.
- **Type:** Poppins + Titillium Web are the committed web font families (loaded in `index.html`). MUI theme currently sets Titillium Web / Poppins as `fontFamily`.
- **Motion:** The product has a real motion identity — GSAP + Lenis smooth scroll, neural-network canvas animation, click/card-flip sound cues, confetti on success. Motion is part of the brand, not decoration.
- **No binding visual world is pinned yet.** The current dark MUI theme (`#121212`/`#1e1e1e`, blue `#90caf9` primary, purple `#ce93d8` secondary) is the incumbent look and is treated as evidence, not authority — a visual world is established later, not during init.

## Evidence on Hand

- Live, runnable backend (`redlin_web/manage.py`, pytest config, running migrations) and frontend (`pnpm dev`).
- Real implemented models: `CORE/models.py` (Space, SpaceItem, CoreLearningProgress, CoreStudySession; XP models), `API/models.py` (User, Document, UserLLMSettings with encrypted keys), `VIDEO/models.py` (Video, VideoMCQ, VideoCloze, VideoFeynman, VideoSummary).
- Working LLM provider integration tested in `API/tests/test_llm_provider.py` and `test_llm_settings_api.py`.
- Design/product intent captured in `docs/`: `ROADMAP.md`, `IDEA_1.md` (`docs/IDEA_1.md`), `FEYNMAN.md`, `AI_CLOZE.md`, `VIDEO.md`, `CSV.md`, `IMPLEMENTATION_PDF.md`, `JWT.md`, `PHASE4_AUDIT.md`, `ISSUES.md`.

Absences future work must not fabricate:

- **No real customers, testimonials, case studies, or benchmarks exist.** Do not invent social proof.
- **No real pricing numbers are confirmed.** Any free-tier/free-trial/subscription/allowance numbers belong to the *future* hosted SaaS phase, not this build. The frontend's "Basic/Professional/Business" pricing is placeholder copy — do not present it as redlin's plans. The MVP is unrestricted and ungated.
- **No Stripe or billing implementation exists** — monetization is future scope, not a current feature.

## Product Principles

1. **The loop is the product.** Every mode and every source feeds one spaced-repetition-and-mastery engine. A feature that doesn't feed the loop (or lets the learner skip it) doesn't belong.
2. **Confidence over coverage.** Success is the learner *feeling secure* in their knowledge, earned through proven mastery (consecutive passes), not a one-time score. Surface that confidence; design against cram-and-forget.
3. **From the user's own material.** Generation starts from the learner's PDFs, CSVs, and videos — their context, their stakes — not a generic library.
4. **Two tracks, one engine.** The self-hostable open Docker track and the hosted SaaS track run the same core; the only difference is who provides the AI. Keep that difference this clean; don't fork the engine.
5. **Engaging without being childish.** Motion, sound, streaks, and XP exist to sustain thehabit and reward real effort. Gamify to build confidence, never to enable grind or gaming the numbers.

## Accessibility & Inclusion

No product-specific standard is established yet. General commitment: the interactive, gamified SR loop must remain usable by keyboard navigation and assistive tech despite its motion/animation identity. Defer any stricter standard until a requirement is set.
