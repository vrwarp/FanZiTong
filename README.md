# 繁字通 FanZiTong

**Traditional Chinese reading acquisition for heritage speakers.** An offline-first Progressive Web App that binds the _shapes_ of Traditional characters to the sounds and meanings a heritage learner already knows, using the FSRS spaced-repetition scheduler and four exercise modalities built around authentic Taiwanese usage: menus & night-market food, evangelical church vocabulary, Taiwanese slang, and ACGN/anime lingo.

> **The one rule the whole app is built around:** Pinyin is _never_ displayed alongside the characters during a prompt. It is revealed only on tap (or after an optional delay) and in post-attempt feedback, so the learner's eyes cannot skip the Hanzi and read the Roman letters instead (PRD §1.2, AC-2).

## Features

| PRD area                                | What's implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Daily micro-session** (Journey 1)     | Dashboard with due reviews, new cards, estimated minutes, streak and memory-health gauge. One-tap session: due FSRS reviews first, then new cards, both capped by daily limits — and new cards held back while too many studied words are still settling. Every 5th card triggers a contextual drill for a card still in (re)learning. Cards rated _Again_ come back within the same session, never within a minute of the last look, and a word is knocked down at most once a day. Celebration summary with cards reviewed, retention, time and streak. |
| **Mode 1 · Rapid recognition** (§5.1)   | Large Traditional prompt, domain tag, tap-to-reveal pinyin/definition/example sentence, four FSRS rating buttons showing the exact next interval computed by `ts-fsrs`. Keyboard shortcuts (space, 1–4). Optional auto-reveal delay.                                                                                                                                                                                                                                                                                                                      |
| **Mode 2 · Cloze** (§5.2)               | Realistic sentence with the target blanked, 4 tiles (target + readable words from the target's own domain, preferring shared tags, plus one same-sound misspelling). Picking the misspelling rates _Again_; picking a real word that does not fit is explained and retired without touching the schedule.                                                                                                                                                                                                                                                 |
| **Mode 3 · Menu realia** (§5.3)         | Simulated red-on-cream 小吃店 order slip organised into 飯類 / 麵類 / 湯類 / 燙青菜 / 小菜 / 小吃 / 飲料 with 小/大 sizes, look-alike foils printed next to the targets, a 20-second timer and per-dish grading.                                                                                                                                                                                                                                                                                                                                          |
| **Mode 4 · Foil discrimination** (§5.4) | Sound + meaning cue over a _balanced_ option set: same-sound, wrong-character spellings (豆漿 / 逗漿 / 豆醬 / 逗醬 — what an IME offers), falling back to look-alike shapes. Two positions are crossed so every glyph appears in half the tiles, which is what stops the answer being findable by counting rather than reading. Leeches can be drilled directly from the Stats tab.                                                                                                                                                                       |
| **Character composition**               | On the reveal, in the look-alike drills and in the leech list: which component of a character carries the meaning, which one still carries the reading, and the other deck characters built on the same sound part (青 → 清 情 請 晴 鯖). Offline, derived from evidence rather than from folk etymology, with a link out to [Chinese Etymology 字源](https://hanziyuan.net) for the oracle-bone, bronze and seal forms. See [`docs/etymology-sources.md`](docs/etymology-sources.md).                                                                    |
| **Vocab management** (Journey 2)        | Searchable, domain-filtered card list (pinyin hidden by default), inline editor with pinyin tone-number conversion, CSV/JSON import with preview table, duplicate flagging (against the deck and within the file), domain override and skip/overwrite policy. JSON/CSV export. Starter deck of 88 curated cards.                                                                                                                                                                                                                                          |
| **Diagnostics** (Journey 3, §8)         | Average retrievability gauge vs. target, 30-day reviews/retention chart, card-state distribution, domain-mastery bars (stability > 30 d), lapse counter and leech list (≥ threshold) with "Practice Difficult Characters".                                                                                                                                                                                                                                                                                                                                |
| **Settings** (§3.3, §6)                 | Target retention slider, daily review/new limits, the settling hold on new words, leech threshold, pinyin reveal delay, active domains, light/dark/system theme, full JSON backup (cards + FSRS state + review history + settings), restore, reset, and a separate [analytics export](docs/analytics-export.md) for diagnosis.                                                                                                                                                                                                                            |
| **PWA / offline** (§9, AC-4)            | Workbox precache of the whole app (CacheFirst), navigation fallback, install prompt, update banner, offline indicator, persistent-storage request, iOS/Android home-screen metadata and generated icons.                                                                                                                                                                                                                                                                                                                                                  |

## Tech stack

React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS 4 · Dexie 4 (IndexedDB) · ts-fsrs 5 · react-router 7 · zod · papaparse · vite-plugin-pwa (Workbox) — tested with Vitest 4, Testing Library, fake-indexeddb, Playwright 1.56 and axe-core.

## Getting started

```bash
nvm use            # Node 22 (see .nvmrc)
npm ci             # install (the repo's .npmrc pins legacy-peer-deps, see below)
npm run dev        # http://localhost:5173
```

| Script                                      | Purpose                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                               | Vite dev server (service worker disabled in dev).                                  |
| `npm run build`                             | Typecheck + production build with service worker and manifest into `dist/`.        |
| `npm run preview`                           | Serve the production build on http://localhost:4173.                               |
| `npm run lint` / `lint:fix`                 | ESLint (typescript-eslint, react-hooks incl. React Compiler rules, react-refresh). |
| `npm run format` / `format:check`           | Prettier.                                                                          |
| `npm run typecheck`                         | `tsc -b` over app, config and e2e projects.                                        |
| `npm test` / `test:watch` / `test:coverage` | Vitest unit + component tests (jsdom, fake IndexedDB).                             |
| `npm run test:e2e` / `test:e2e:ui`          | Playwright end-to-end tests against the production build (Pixel 7 emulation).      |
| `npm run icons`                             | Regenerate PWA icons from the brand mark with headless Chromium.                   |
| `npm run etymology`                         | Rebuild `src/data/etymology.json`, the character-composition table.                |
| `npm run validate`                          | lint + format check + typecheck + unit tests + build.                              |

Install to a phone: open the deployed URL, then **Add to Home Screen** (Android prompts automatically; on iOS use Share → _Add to Home Screen_). After the first visit the app works with no network at all.

## Architecture

```
src/
  types/            Domain models (VocabCard, ReviewLog, UserSettings, DeckExport) — mirror PRD §3
  db/               Dexie schema + repository (all IndexedDB access goes through here)
  lib/
    fsrs/           ts-fsrs wrapper: state conversion, previews, rating application, retrievability
    queue/          Daily queue builder, daily limits, learn-ahead re-queue rule, drill selection
    exercises/      Pure generators: cloze, foil discrimination, menu realia (+ grading)
    session/        StudyEngine — framework-agnostic session state machine; drill planner
    io/             CSV (papaparse) / JSON (zod) parsing, import analysis & materialisation, export
    stats/          Analytics: retention, streaks, domain mastery, leeches, retrievability
    etymology/      Character composition: meaning part, sound part, sound families
    util/           uuid, seeded RNG, dates/intervals, pinyin tone marks
  data/             Starter deck, the order-slip template, per-character glosses
                    and the character-composition table
  hooks/            Live Dexie queries, settings, theme, dashboard model, engine binding
  components/       UI primitives, layout, study views (4 modes), vocab, stats
  pages/            Learn · Study · Drills · DrillRunner · Vocab · CardEditor · Stats · Settings
  pwa/              Service-worker prompt, install prompt, online status
e2e/                Playwright specs (dashboard, session, drills, vocab I/O, stats/settings, offline, a11y)
scripts/            Icon generator
.github/workflows/  CI (lint/typecheck, unit, build, e2e) and GitHub Pages deploy
```

Key design decisions:

- **`StudyEngine` is pure.** It owns the queue, reveal/rate cycle, in-session re-queueing and drill interleaving and returns `{card, log}` pairs for the caller to persist. React binds to it through `useSyncExternalStore`, so the whole session logic is unit-tested without a DOM.
- **FSRS fidelity (AC-1).** Scheduling is delegated entirely to `ts-fsrs` (FSRS-6 weights, short-term learning steps on, target retention from settings, 365-day cap): the app never computes an interval or a memory state itself. What it does decide is _which answers the scheduler hears_ — the next three points. The interval printed on a rating button is the schedule that gets applied when the button is pressed within 60 s of the reveal; afterwards it is recomputed at rating time.
- **A word is knocked down at most once a day.** The first _Again_ tells FSRS what it needs: stability falls, difficulty rises, the word goes back to its first step. Failing it again ten minutes later, after five other new words, says nothing more about the word — it says the learner has not slept on it — but FSRS-6 treats every same-day _Again_ as a fresh verdict (stability × ~0.4, difficulty + 3 × (10 − D) / 9), and three misses in three minutes on a never-seen word left cards pinned at difficulty 9.9 for good. So after the first _Again_ of the day, further _Again_ / _Hard_ answers are retries: recorded in the event log, the word comes back, the scheduler is not consulted. A recognition pass always counts, because that is how the word climbs back out of its step; a drill hit on a word already knocked down that day counts for nothing, because a four-tile pick minutes after the reveal is a memory of the screen. (`lastAgainAt` on the card; `isRetry` in `lib/queue`.) Devices that studied before this rule replay their review history under it once, at startup, and only for cards whose history reproduces their stored state exactly (`lib/fsrs/repair`).
- **Learn-ahead re-queue, with a minute between looks.** After a rating, a card whose next due time falls within 20 minutes (i.e. still in a learning/relearning step) is pushed to the back of the session queue, so _Again_ really does come back in the same session — up to three re-queues per card, after which the word is left for the next session rather than taking over this one. A card is never shown within a minute of its last answer: another card goes first, a drill on a different word fills the gap, and when nothing else is ready the session waits it out in the open with a countdown rather than serve a reading that is still on the learner's retina.
- **New words wait for old ones to settle.** A studied word is _settling_ until its stability reaches a day. While more than the hold (default 20, _Settings_) are settling, new cards are held back however high the daily limit is, and the dashboard says so. A heritage reader meets a never-seen word by failing it, so every unknown word is a day or three of retries before it sticks; twenty a day on top of yesterday's twenty is how retention slides while the learner does everything asked of them.
- **New cards round-robin the domains.** The deck is authored in per-domain blocks, so introducing new cards in creation order alone would spend weeks of daily limits on one domain. New cards keep their order within a domain and take turns across the active ones.
- **Drill interleaving.** After every 5th answered card the engine looks for a card seen this session that is in Learning/Relearning or has lapses, rotates the modality (cloze → menu → foil) for variety, and never drills the same card twice per session.
- **Visual foils.** Foils are authored as full-length look-alikes (`魯肉飯`) or single characters (`魯`); single characters are substituted into the head position of the word (`滷肉飯 → 魯肉飯`), which is where the confusable radical lives in all the PRD examples.
- **Two claims about a character, and one silence.** The composition layer says which component the script files a character under, and which component's _modern_ reading still predicts it — the second computed by comparing the readings rather than read off a table, which is why 麵 comes out as 麥 (wheat) plus the sound 面 and not the reverse, as its upstream source has it. Where a character came from is not claimed at all: the popular origin stories are mostly folk etymology, so the app shows the parts and links to 字源 for the history. Bare-stroke decompositions (肉 "is" `⿻冂仌`) are dropped rather than shown.
- **Local-first data sovereignty.** Everything lives in IndexedDB; JSON export is the PRD §7.1 format plus optional `reviewLogs` and `settings` for a complete backup; CSV export uses the PRD §7.2 columns plus two optional trailing columns (`example_pinyin`, `example_translation`) so sentences round-trip. Files are UTF-8 (CSV with BOM for spreadsheet compatibility; the importer strips it).

## Data formats

**JSON** (`version: "1.0"`): exactly PRD §7.1 (`cards[]` with the `fsrs` block), plus optional `reviewLogs[]` and `settings` for backups. A bare array of cards is also accepted. Missing `fsrs` → card starts as New; missing/unknown `domain` → `custom` (or the domain chosen at import).

**CSV** header: `traditional,pinyin,definition,domain,tags,example_sentence,foils[,example_pinyin,example_translation]`. Lists use `|`. Header aliases (`hanzi`, `meaning`, `category`, `繁體`, …) and tone-number pinyin (`lu3 rou4 fan4`) are accepted.

**Analytics export** (`schema: "fanzitong.analytics"`): a separate, much smaller diagnostic file — only the cards that have been studied, what happened while they were studied, and the patterns the app found in its own data. Not a backup, and never read back. Format and diagnostic codes: [`docs/analytics-export.md`](docs/analytics-export.md).

## Testing strategy

- **Unit / component** (`src/**/*.test.ts[x]`, 380+ tests): character composition (the meaning/sound split, the guards that stop a rhyming stroke or the meaning component from claiming the reading, the silence where nothing is known); FSRS state transitions and interval ordering against ts-fsrs itself; queue building, daily limits and the settling hold; every exercise generator (uniqueness, correctness, no pinyin in prompts); CSV/JSON round trips with Traditional characters; import analysis and duplicate policies; analytics; the full `StudyEngine` (reveal, rate, re-queue, the one-Again-a-day rule, the minute between looks, drill interleave, standalone drills); the schedule repair against a real loop; Dexie repository on fake-indexeddb; React components for all four modes (including timers), the wait step and the import dialog. Coverage thresholds are enforced in `vitest.config.ts`.
- **End-to-end** — the full-session and wait-step specs install Playwright's clock so the minute a card waits is jumped, not slept.
- **End-to-end** (`e2e/`, Playwright, mobile Chromium): first-launch seeding and dashboard; a complete daily session with AC-2 assertions (no tone marks or pinyin text anywhere before the tap), drill interleaving, re-queue and summary; each standalone drill; CSV import with duplicate flags and domain override; JSON/CSV export download contents; editor CRUD; settings persistence; leech inspection → focused drill; the PWA manifest; and a **fully offline session** after the service worker has precached the app (`context.setOffline(true)` + reload). An axe-core pass guards every tab against serious/critical WCAG 2.1 A/AA violations.
- **CI** (`.github/workflows/ci.yml`): lint + format + typecheck, unit tests with coverage artifact, production build with PWA asset verification, and the Playwright suite with browser caching and HTML report artifact. `deploy-pages.yml` publishes `main` to GitHub Pages (enable _Settings → Pages → Source: GitHub Actions_; the build uses `VITE_BASE_PATH=/<repo>/`).

### Acceptance criteria (PRD §10)

| AC                        | Where it is verified                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** FSRS logic       | `src/lib/fsrs/scheduler.test.ts` compares `applyRating` with `ts-fsrs` `next()` output and checks state transitions; `engine.test.ts` checks previews match applied schedules, that only the first _Again_ of a day reaches the scheduler, and that a card waits its minute; `repair.test.ts` proves a replayed history reproduces the stored state before anything is changed. |
| **AC-2** No pinyin crutch | `RecognitionCard.test.tsx`, `Drills.test.tsx`, exercise generator tests, and `e2e/study-session.spec.ts` / `e2e/drills.spec.ts` assert no pinyin before reveal in recognition, cloze and menu prompts. (In the foil drill the pinyin _is_ the cue by design, PRD §5.4.)                                                                                                         |
| **AC-3** Import/export    | `csv.test.ts`, `json.test.ts`, `importer.test.ts`, `ImportDialog.test.tsx`, and `e2e/vocab.spec.ts` (download contents, BOM, re-import).                                                                                                                                                                                                                                        |
| **AC-4** PWA offline      | `e2e/pwa-offline.spec.ts` validates the manifest, waits for the service worker, goes offline, reloads, and completes a session and navigates between routes.                                                                                                                                                                                                                    |

## Staying up to date

A precached PWA can quietly serve an old build forever, so updates are made
visible and always applicable:

- **Build identity.** Every bundle carries the commit it was built from
  (`__BUILD_ID__`, from `GITHUB_SHA` in CI or `git rev-parse` locally). The
  package version is identical across deploys and cannot answer "is my copy
  current?" — _Settings › App version_ shows the commit and the build date.
- **When it checks.** A timer alone never fires on a phone, where the app is
  backgrounded long before an hour passes. Checks run when the app returns to
  the foreground and when connectivity comes back, throttled to one every five
  minutes, with an hourly backstop for long-lived tabs.
- **How it is offered.** `registerType: 'prompt'` with `skipWaiting: false`, so
  a new worker never swaps assets under a running session. A banner offers the
  reload; the study and drill routes sit outside the shell that renders it, so
  a timed drill is never interrupted. Dismissing it only hides the banner —
  _Settings_ still offers "Install update", because a waiting worker does not
  announce itself twice.
- **Applying it actually reloads.** The app owns the reload rather than leaving
  it to the registration helper: with `clientsClaim` the helper's one-shot
  controller listener is already spent, so the worker would activate while the
  tab kept rendering the old build. It listens for `controllerchange` and
  reloads, with a short fallback timer.
- **Recovering from a half-updated tab.** Routes are separate chunks and
  activation drops the old precache, so a tab open across a deploy can request
  a chunk that no longer exists. `ChunkErrorBoundary` recognises that failure
  and reloads once per tab (never a loop), then explains the situation instead
  of showing a blank screen.
- **Escape hatch.** _Settings › Reset app cache_ unregisters the worker and
  clears the asset caches, leaving IndexedDB — the learner's words, history and
  settings — untouched.

## Assistant (optional)

An optional in-app assistant can write example sentences and foils, add words
on request, read a menu photo into cards and talk through what keeps slipping.
It runs on the Claude Agent SDK in a small sidecar process, which is what lets
it use your own Claude Code login rather than an API key; the deck never leaves
the browser, since the sidecar forwards every tool call back to the app. Its
edits apply immediately and are journaled, so any batch can be undone, and it
is held to the pinyin rule: while a study card is unrevealed it is not shown
the card at all.

```bash
cd agent && npm install
npm run agent      # http://127.0.0.1:8787, uses your Claude Code login
```

The sidecar borrows the login already on the machine, but the socket still
wants a credential of its own: sign in once from _Settings › Assistant_, or set
`FZT_ALLOW_ANONYMOUS=true` for a loopback development run.

For a phone, run it in Docker behind Caddy on a domain you own, then open
_Settings › Assistant_ and press **Sign in with Claude**: it hands you a link,
you approve access on Claude's own site, and you paste the code back. That
sign-in is also what locks the assistant to you — the first one claims it, and
afterwards only a signed-in device can start another. Setup, the wire protocol
and the content rules it is held to: [`docs/assistant.md`](docs/assistant.md).

## Notes

- `.npmrc` sets `legacy-peer-deps=true` because npm 10's resolver crashes on an optional peer (`jsdom → canvas`); the lockfile is generated in that mode, so `npm ci` must use it too.
- Data is per browser profile. Export a backup from _Settings_ before clearing site data or switching devices.
- "Export study analytics", next to the backup button, is for asking someone why
  the app is behaving the way it is — it is a fraction of the size and carries
  no card you have not studied.
- Reset in _Settings_ wipes the database and reloads the starter deck. "Reset app
  cache", next to it, is a different thing: it reinstalls the app files only and
  never touches what you have studied.
- The first launch after the one-Again-a-day rule replays each studied card's
  history under it and says on the dashboard which words changed. A word whose
  history does not reproduce its stored state (a restore without logs, an
  assistant merge) is left exactly as it was.
- Why the analytics export exists, and what one round of reading it changed:
  [`docs/critique/analytics-2026-09-09/critique-language-expert.md`](docs/critique/analytics-2026-09-09/critique-language-expert.md).
