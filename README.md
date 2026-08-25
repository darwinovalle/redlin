<div align="center">
  
<img width="60%" height="180" alt="Image" src="https://github.com/user-attachments/assets/c54d0279-cd8c-462a-b7cd-5e69d64aa415" />
</div>

<br>

**AI-powered spaced-repetition learning platform** — turn your own PDFs, CSVs, and YouTube videos into interactive, gamified study material (MCQ, Cloze, Feynman) that keeps coming back to you until you've truly mastered it.

RedLin is a **self-hostable web app**: you bring your own LLM provider and API key, and your content and learning data stay on your machine. No subscription, no usage limits, no account tied to RedLin's infrastructure.

---

## Table of contents

- [What is RedLin?](#what-is-redlin)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Quick start with Docker](#quick-start-with-docker)
  - [1. Clone](#1-clone)
  - [2. Create the `.env` files](#2-create-the-env-files)
  - [3. What to put in `SECRET_KEY`](#3-what-to-put-in-secret_key)
  - [4. Build and start](#4-build-and-start)
  - [5. Open the app](#5-open-the-app)
  - [6. Configure your LLM provider](#6-configure-your-llm-provider)
  - [7. Start studying](#7-start-studying)
- [Configuration reference](#configuration-reference)
- [Run without Docker (local dev)](#run-without-docker-local-dev)
- [How it works](#how-it-works)
- [Common tasks](#common-tasks)
- [Project documentation](#project-documentation)

---

## What is RedLin?

RedLin takes a learner's **own source material** — a PDF, a CSV of study items, or a YouTube video — and turns it into an interactive, gamified spaced-repetition loop:

1. **Ingest** — upload or link your material.
2. **Generate** — AI produces **MCQ**, **Cloze**, and **Feynman** items (plus summaries) from that material.
3. **Study** — MCQ is auto-graded; Cloze and Feynman are **AI-graded against a rubric**, not string-matched.
4. **Retain** — every attempt feeds a spaced-repetition / mastery engine: unmastered items resurface until the learner earns mastery (modeled on consecutive passes).
5. **Gamify** — XP, streaks, and confetti reward completed sessions and build confidence — without encouraging grind.

The reason the product exists is the **mastery loop that spans every study mode and every content source** — not any single quiz format.

### Who it's for

- **Self-hosters (current MVP audience):** pull the repo or Docker image, plug in your own LLM provider/key, use everything freely.
- **Hosted SaaS (future):** not built yet. There is no billing, no free-tier logic, and no paywall in the current codebase. The MVP is unrestricted and ungated.

---

## Features

- **Bring-your-own LLM provider** — OpenAI, Anthropic, Gemini, OpenRouter, or Ollama. Per-user API keys, stored **encrypted (Fernet)** in the database and set from the UI — not in `.env`.
- **Study subjects & Kanban boards** — organize your learning into subjects, each with a board of study-material cards (new → in-progress → done).
- **AI study material from your own sources** — PDFs, CSVs, and YouTube videos (transcription via faster-whisper / youtube-transcript-api).
- **Three study modes** — MCQ (auto-graded), Cloze (AI-graded), Feynman (AI-graded open-form with rubric + evidence checks).
- **Spaced repetition & mastery** — SM-2-style scheduling per user–item; due/unmastered items resurface; mastery earned on consecutive passes.
- **Gamification** — XP accounts, streaks, motion (GSAP + Lenis), sound cues, and confetti on success.
- **Spaces** — group heterogeneous content (PDFs, videos, CSVs) into a personal course.
- **Two delivery tracks, one engine** — the self-hostable track and the future SaaS track share the same core; the only difference is who provides the AI.

---

## Tech stack

| Layer | Tech |
| --- | --- |
| **Backend** | Django 5.1 + Django REST Framework, Celery + Redis (async generation / transcription / evaluation / reports), SQLite in dev |
| **Ingestion** | faster-whisper, yt-dlp + youtube-transcript-api, pdfjs |
| **Frontend** | React 18 + Vite, MUI v6 (Material), styled-components, GSAP + Lenis (motion / smooth scroll) |
| **LLM** | Unified per-user provider dispatch over OpenAI, Anthropic, Gemini, OpenRouter, Ollama; per-user Fernet-encrypted API keys |
| **Ops** | Docker / docker-compose (Redis, backend, Celery worker, Celery beat, frontend) |

> **Note:** user-facing copy and internal docs mix **English and Spanish**. The UI ships in **English**; study content can be generated in Spanish (and more languages later). Internal docs under `docs/` are largely Spanish.

---

## Repository structure

```
redlin/
├── docker-compose.yml        # Redis, backend, worker, beat, frontend
├── PRODUCT.md                # product vision, scope, constraints
├── DESIGN.md                 # design system ("The Neural Lab")
├── redlin_web/               # Django backend
│   ├── redlin_web/           #   project settings
│   ├── API/                  #   users, documents, LLM provider settings
│   ├── CORE/                 #   spaces, spaced repetition, study sessions, XP
│   ├── VIDEO/                #   video ingest, transcription, AI generation
│   ├── SUBSCRIPTIONS/        #   placeholder for future SaaS (not built)
│   ├── entrypoint.sh         #   migrate → (optional collectstatic) → runserver
│   └── requirements.txt
├── redlin-front/
│   └── redlin-front/         # React 18 + Vite + MUI frontend
└── docs/                     # roadmap, design, feature docs (mostly Spanish)
```

---

## Quick start with Docker

Requires **Docker** with **Docker Compose v2** installed (Docker Desktop covers both on macOS/Windows; use the native `docker compose` command on Linux).

### 1. Clone

```bash
git clone <repo-url>
cd redlin
```

### 2. Create the `.env` files

`docker-compose.yml` references two environment files via `env_file:`. If either file is **missing, `docker compose up` refuses to start** — this is the error you'll hit on a fresh clone. So you must create them (they can be minimal).

**Backend** — `redlin_web/.env`:

```bash
SECRET_KEY=<long-random-string>
```

**Frontend** — `redlin-front/redlin-front/.env`:

```bash
VITE_API_URL=http://127.0.0.1:8000/api
```

`VITE_API_URL` is the only variable the frontend reads, and it already **defaults** to `http://127.0.0.1:8000/api` — so an empty file is fine unless your backend lives elsewhere.

### 3. What to put in `SECRET_KEY`

Any **long, random string**. It's used by Django to sign sessions and derive the Fernet key that encrypts your LLM API keys. Generate one with either command:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

```bash
openssl rand -base64 50
```

Paste the output into the file. If you leave it blank, the backend boots with an **insecure built-in default** — fine for local tinkering, but set your own for anything shared or public. Do not reuse a real secret, and don't commit `.env` files to git.

### 4. Build and start

```bash
docker compose up --build
```

This builds and starts five services:

| Service | Purpose | Port |
| --- | --- | --- |
| `redis` | Celery broker + result backend | 6379 |
| `backend` | Django + DRF API (`migrate` runs automatically) | 8000 |
| `worker` | Celery worker — async AI generation, transcription, evaluation, reports | — |
| `beat` | Celery beat — scheduled tasks | — |
| `frontend` | Vite React dev server | 5173 |

First build takes a while (Python + Node images, ffmpeg, npm deps). Later runs are fast. Useful commands:

```bash
docker compose logs -f          # follow logs (add the service name to filter, e.g. ... -f backend)
docker compose up -d            # run detached
docker compose down             # stop containers (data is kept)
```

Your data persists on the host in `redlin_web/db.sqlite3` (SQLite) and `redlin_web/media/` (uploaded documents, transcripts) because the compose file mounts `./redlin_web:/app`.

### 5. Open the app

- **App (frontend):** http://localhost:5173
- **API root:** http://localhost:8000/api/

First time: register a user at http://localhost:5173/register (there's also a `/login` page).

### 6. Configure your LLM provider

LLM API keys are **not** environment variables — they're entered in the UI:

1. Open the **API Settings** modal (from the app's settings).
2. Pick a provider: **OpenAI, Anthropic, Gemini, OpenRouter, or Ollama**.
3. Paste your key (or configure your Ollama endpoint) and save.

The key is sent to the backend (`PUT /settings/llm/`), stored **encrypted** with a key derived from `SECRET_KEY`, and used per-user for generation. Content sent to the LLM is minimized; a self-hoster's content never touches RedLin infrastructure.

### 7. Start studying

1. Create a **subject** (pick a name, color, and icon).
2. Add study material to its board — upload a **PDF**, import a **CSV**, or add a **YouTube video**.
3. **Generate** study material (MCQ / Cloze / Feynman / summary).
4. **Study** — answer questions; MCQ is auto-graded, Cloze/Feynman are AI-graded.
5. Return to the **Due for review** list — the spaced-repetition engine reschedules what you haven't mastered yet.

---

## Configuration reference

### Mandatory (file must exist, values mostly optional)

| File | Variable | Required? | Notes |
| --- | --- | --- | --- |
| `redlin_web/.env` | `SECRET_KEY` | Recommended | Django signs sessions; derives the LLM-key encryption key. Insecure default if unset. |
| `redlin-front/redlin-front/.env` | `VITE_API_URL` | No | Defaults to `http://127.0.0.1:8000/api`. |

### Optional / feature-specific (backend)

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLM_ENCRYPTION_KEY` | derived from `SECRET_KEY` | Explicit Fernet key for stored API keys. Set it if you plan to rotate `SECRET_KEY`. |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` / `REDIS_URL` | `redis` / `6379` / `0` | Redis broker/result backend. |
| `SESSION_IDLE_TIMEOUT_SECONDS` | `1800` | Idle session timeout. |
| `GOOGLE_API_KEY` | — | Only used by an internal script (`check_models.py`), not the running app. For Gemini, use the UI instead. |
| `DJANGO_WAIT_FOR_DB` / `DB_HOST` / `DB_PORT` | off | Set `DJANGO_WAIT_FOR_DB=1` to wait for an external DB on startup. |
| `DJANGO_COLLECTSTATIC` | off | Set to `1` to run `collectstatic` on startup. |
| `TRANSCRIPT_DEBUG` / `TRANSCRIPT_MIN_INTERVAL` / `TRANSCRIPT_CLIENT_VARIANTS` | set in compose | YouTube transcript tuning. |
| `VIDEO_FEYNMAN_FULL` / `VIDEO_FEYNMAN_DEBUG` | `0` | Feynman-generation flags. |

---

## Run without Docker (local dev)

**Backend** (Python 3.12):

```bash
cd redlin_web
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

You'll also need **Redis** running (for Celery), and if you want async generation/transcription:

```bash
celery -A redlin_web worker -l info
```

**Frontend** (Node 18+, pnpm or npm):

```bash
cd redlin-front/redlin-front
pnpm install   # or: npm install
pnpm dev       # or: npm run dev
```

---

## How it works

At its core, RedLin closes one loop: **material → practice → feedback → mastery**.

- **One engine, many modes.** Every study mode (MCQ, Cloze, Feynman) and every content source (PDF, CSV, video) feeds a single spaced-repetition + mastery engine (`CoreLearningProgress`, `CoreStudySession`, `CoreAttempt`). There is no separate scheduler per feature.
- **Confidence over coverage.** Success is the learner *feeling secure* — proven by consecutive passes, not a one-off score. Due items resurface; mastery is earned, not achieved.
- **Your material, your model.** Generation starts from the learner's own content, and the AI is the learner's own chosen provider. RedLin never sees your keys or your content on its own infrastructure.

The future hosted SaaS track will run the same engine with RedLin as the AI provider; the current MVP is entirely self-hosted and unrestricted.

---

## Common tasks

```bash
# Django superuser (admin) inside the running backend container
docker compose exec backend python manage.py createsuperuser

# Run backend tests
docker compose exec backend python manage.py test

# Follow one service's logs
docker compose logs -f backend

# Stop everything
docker compose down
```

---

## Project documentation

- `PRODUCT.md` — product vision, scope, constraints, brand commitments.
- `DESIGN.md` — the design system ("The Neural Lab").
