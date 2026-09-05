# 繁字通 FanZiTong — review context

## What the product is
A mobile-first, offline-capable PWA that teaches a heritage speaker of Mandarin (born in Taiwan, moved to English-speaking schooling after 2nd grade, ~3rd-grade listening/speaking, fully pinyin-literate, does NOT read Zhuyin) to READ Traditional Chinese. The learner already has the sound and meaning of most words in their head; the single bottleneck is orthographic mapping — binding the visual shape of the characters to that existing mental lexicon.

Vocabulary domains: (1) Taiwanese menus & food, (2) evangelical church terminology, (3) Taiwanese slang & internet colloquialisms, (4) anime/ACGN lingo. Daily commitment 15–30 minutes.

## The non-negotiable pedagogical rule
Pinyin must NEVER be shown by default while a character prompt is on screen. It is strictly tap-to-reveal (or auto-reveal after a user-set delay) or post-attempt feedback. Otherwise the learner's eyes read the Roman letters and skip the characters. (Exception by design: the visual-foil drill uses the sound + meaning as the CUE and asks for the shape.)

## Mechanics
- Spaced repetition via FSRS (ratings Again / Hard / Good / Easy, with the next interval shown on each button).
- Daily session = due reviews first, then new cards, capped by daily limits; every 5th card triggers a contextual drill for a card still being learned; "Again" cards come back within the same session.
- Four exercise modes: Rapid Recognition (flashcard), Cloze (fill-in-the-blank with 4 tiles), Menu Realia (a simulated Taiwanese 小吃店 order slip: tick what was ordered within 20 seconds), Visual Foil Discrimination (pick the correct character among look-alikes).
- Vocab tab: list, search, editor, CSV/JSON import with preview & duplicate flags, export. Stats tab: memory health, retention chart, domain mastery, leech list. Settings: retention target, limits, reveal delay, domains, theme, backup.

## Screenshots (Pixel 7 viewport, 2x) — round 4 set (29)
- 01-learn-first-launch: dashboard on first open (starter deck of 95 cards auto-loaded)
- 02-study-prompt-hidden: recognition card before the tap (pinyin/meaning hidden)
- 03-study-revealed: after the tap, with the sticky rating footer
- 03b-study-revealed-chip-and-word: the same reveal after tapping a character chip and one sentence word
- 04-study-drill-*: a drill interleaved mid-session (cloze / foil / menu)
- 05-session-paused: the summary after tapping Pause mid-session
- 06-learn-resume: the dashboard afterwards, session still in progress
- 07-session-complete: the summary after resuming and finishing every card
- 08-learn-after-session: the dashboard once the day is done
- 09-drills-tab: standalone drill launcher
- 10-drill-menu-slip / 11-drill-menu-result / 11b-drill-menu-wrong-size: order-slip simulation, its grading (one dish missed, one wrong tick), and a slip where the right dish was ticked in the wrong size column (full page; the sticky cue/verdict strip renders mid-page in a full-page capture — a capture artifact)
- 12-drill-foil / 13-drill-foil-wrong / 14-drill-foil-retry: foil discrimination, feedback after a wrong pick, and the reshuffled retry
- 15-drill-cloze / 16-drill-cloze-misread / 17-drill-cloze-correct: cloze, feedback after picking a real word that does not fit, and after the right answer
- 18-vocab-list, 19-card-editor (full page), 20-import-preview
- 21-stats (full page, after the session above plus two restored cards: a due 蚵仔煎 and one "leech")
- 21b-study-revealed-spoken: the reveal of a word people say the Taiwanese way (蚵仔煎)
- 21c-drill-foil-leech: Spot the Character launched from the leech row ("Practice this word")
- 22-settings (full page) / 22b-settings-dark-selected: Settings, then Settings with Dark chosen
- 23-learn-dark, 24-study-revealed-dark: dark theme (a resumed session; the leech card revealed)

## How to write your critique
Be concrete and honest; this is a working review, not praise. For every finding give:
`- [severity] [screen] Title — what is wrong, why it matters (from YOUR perspective), and a specific, implementable suggestion.`
Severity scale: **blocker** (would stop the target user from succeeding or violates the pedagogy rule), **major** (clearly hurts the experience or learning outcomes), **minor** (worth fixing), **nit** (polish).
End with:
- `Overall score: N/10` for the experience from your perspective, with one sentence of justification.
- A short "keep doing" list of what already works.
Do not propose features that need a network, accounts, or paid services; the app is offline-first and local-only. Do not propose showing pinyin next to characters in any prompt.
