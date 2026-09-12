# UX critique log

A visual critique loop run against the live build (mobile viewport). Each
iteration: capture the walkthrough (`node scripts/walkthrough.mjs <dir>`),
three independent persona reviews (product manager focused on user journeys,
language-learning expert, heritage learner), an ideation pass that ranks and
reconciles the findings, then implementation and re-verification. The loop
ends when a round produces no blocker/major findings and the scores stop
moving (or after 20 rounds).

## Iteration 1

**Scores:** PM 6/10 · Language expert 6/10 · Heritage learner 6/10.
Pedagogy rule verified on every prompt by all three.

**Consensus findings (2+ reviewers)**

1. Order slip: cue written in the very characters to be found (string matching, not reading); duplicate-looking row (a font-variant foil 蛋餠); untouched look-alike rows tinted red on a "perfect" result; order line, timer and Submit scroll away in a 20 s task.
2. 魯肉飯 (and 借口) are real Taiwan spellings trained as wrong answers — heritage learner rated this a blocker.
3. Example-sentence pinyin fully visible at reveal, so the eyes skip the characters; target word not highlighted.
4. Wrong-pick feedback names the answer but not the differing character.
5. Cloze options were the foil drill's look-alikes, so the sentence was decoration; blank length fixed at two.
6. Rating buttons carried no question or rubric; Again and Hard both read "<10m".
7. Numbers disagreed (session retention vs dashboard vs stats; new cards counted as reviews; "Time 2s").
8. SRS/teacher jargon on daily screens (FSRS, leeches, lapses, retrievability, realia, cloze).
9. First launch: offline toast covering the deck; "🔥 Day 0"; no explanation of why pinyin is hidden.
10. Session end was a dead end (no next step, no continue path, no consolidation).
11. Dark theme captured light (a walkthrough race, but it exposed a real flash-of-light-theme on launch).

**Decisions from ideation (conflicts resolved)**

- Order slip is cued by sound + meaning, the sanctioned exception already used by the foil drill; dish characters appear only after grading.
- New `variants` field ("also written"). Variants are never foils anywhere; the slip may print a variant as the correct row and says so after grading.
- No attested spelling in any convention (Taiwan, HK, simplified, Japanese) may be a foil; foils must be unambiguously wrong.
- Cloze = correct word + 2 readable same-domain deck words + 1 look-alike; deck-word options show pinyin and gloss after answering.
- Drill scoring is asymmetric: a miss is Again; a hit is Good only while the card is still learning; Review-state cards are untouched.
- Domain chip moves off the prompt face (it is a retrieval cue no sign carries) into the answer panel. This deviates from PRD §5.1's "domain tag at top right" on the initial view; recorded here for the product owner.
- Recall-now metric hidden until 7 distinct study days.
- Sentence pinyin is tap-only (never on the reveal-delay timer).
- Zhuyin-as-slang cards (ㄏㄏ, ㄎㄎ, 頗ㄏ) are allowed as content; Zhuyin never annotates other cards.
- 藉口 stays in the slang deck tagged "everyday"; no sixth domain.
- Reveal latency is measured and shown, not enforced.

**Changes shipped**

- Data: `variants` on cards (CSV/JSON/editor/import/export), `stateBefore` on review logs, per-character info table with visual "tells".
- Starter deck: variants for 滷肉飯/滷味/飯糰/豆干/鹹酥雞/藉口/阿們; attested-spelling and glyph-variant foils replaced; 劇透 → 爆雷 plus 有雷, 是在哈囉, 笑死, 傻眼貓咪, ㄏㄏ, ㄎㄎ, 頗ㄏ; slang domain labelled 流行語; more natural counter voice in 例句.
- Recognition card: whole-screen tap; NEW badge; no domain chip before reveal; target highlighted in the sentence; sentence reading behind a tap; "also written" line; per-character chips with readings and "also in"; rating question, reveal latency, coach rubric on the first three reveals with a "?" to reopen; exact-minute learning-step intervals.
- Cloze: readable distractors + one foil; blank sized to the answer; no spaces; glosses and character diff in feedback; options anchored to the bottom.
- Spot the Character: side-by-side diff with reading, gloss and tell; Continue only after tapping the correct tile.
- Order slip: sound + meaning cue pinned at the top with the timer; three shop templates (小吃店 / 早餐店 / 夜市攤) with prices and a 楷體/明體 font stack; ≤ 4 sections; honest result colouring (green/amber/red, neutral look-alike tag); variant rows graded correct with a note; after grading every row reveals its reading and can be added to the deck; Submit pinned at the bottom.
- Session: "End session" pauses with Continue / Done; summary shows words seen, answers incl. repeats, first-try fraction, real time, weak words for one more look, and tomorrow's due count; dashboard "Done for today" state with tomorrow's count and extra-practice link.
- Dashboard: first-run "How this works" card; "Start your streak today"; new vs review counts separated; answers-today line; recall gauge gated with explanation; backup nudge after 14 study days.
- Naming: Order Slip 點菜單 / Fill the Blank 填空 / Spot the Character 辨字 used everywhere; "Forgotten", "Keep slipping (leeches)", "Recall now"; one exit control per screen; "Card 3 of 10".
- Vocab: sort control (due / study order / newest), two-line definitions with a domain dot, variant sub-line, variant-aware search and duplicate detection, data tools collapsed, "Restore starter deck (adds N)".
- Editor/settings: delete as a text link with the word named; reset confirm names the counts; "Last backup"; memory panel hidden for unstudied cards.
- Theme: no flash of the light theme on launch for dark-mode users; offline-ready toast removed (the first-run card mentions offline).

**Deferred (from ideation section D):** realia for church/slang/anime surfaces; second example sentence per card; leech remediation view; "as heard" Taiwanese readings; latency-based nudges; generated foils for custom cards; per-character stats; variant as correct tile in Spot the Character; price-reading tasks; "learn 5 more" on the all-done dashboard.

## Iteration 2

**Scores:** PM 7/10 · Language expert 8/10 · Heritage learner 8/10.
Pedagogy rule verified on every prompt by all three; nobody found pinyin on a prompt face. All three called the Spot-the-Character miss card the best screen in the app, and all three named the same remaining blocker-class defect.

**Consensus findings (2+ reviewers)**

1. Fill the Blank marked a correct reading wrong: two "readable" distractors from the same domain fit the sentence too (餛飩湯大碗一碗 is a fine order), and a miss on such a false key can reset a Review card.
2. "End session" → "Session paused" → "Done for today" → a dashboard that forgot all of it ("Start Daily Session" again, no resume, no ✓); the completed-session and all-done states had never been captured.
3. The variant note was a food template on every card ("common on signs and menus" under 借口).
4. Anki-speak crept back in through the outcome lines ("graduating", "Already in review — schedule unchanged" contradicting the Drills tab).
5. Slip result: the rows that matter were colour-only, the verdict sat below an 11-row slip, the wrong tick was unglossed.
6. Character chips: "+2" unexplained, chips looked like tags, not connected to the sentence.
7. "How this works" never left the dashboard; the title wrapped under the streak chip; the 30-day chart overprinted its last two labels; "Hear the word" implied audio; "TIME 1s".
8. Stats still had two vocabularies for card states and a percentage computed from five answers.
9. Heritage learner: the friend orders "kē zǎi jiān" (nobody says that; it is ô-á-tsian); invented dishes with prices on a real-looking slip; the pinned cue strip ate half the screen; the slip font was only half real.

**Decisions from ideation (conflicts resolved)**

- Cloze keys are unique by construction AND graded by evidence: readable distractors come from authored `clozeDistractors` or other domains, never the same domain while another can supply them; picking a real word that does not fit is explained, retired and re-asked with no schedule change; only the look-alike (now named explicitly by the exercise) is a miss, and it is corrected the way Spot the Character corrects — contrast, then a reshuffled retry, capped at three misses.
- An in-session cloze is never built on a sentence revealed earlier that session; Fill the Blank takes learning cards outside today's queue, and seen cards get Spot the Character or the slip.
- Two intents, two persisted states: Pause (saved after every answer, resumable the same day with its counts and clock) and Done for today (a flag the dashboard honours even while cards remain). Three dashboard states: Resume · Done ✓ · Due.
- Size errors on the slip are verdict-only (overturns an iteration-1 rule): FSRS schedules the dish's shape → sound binding, not the 小/大 column.
- No invented string on the slip, ever; the discrimination demand comes from real same-section neighbours (滷肉飯 ↔ 焢肉飯, 牛肉麵 ↔ 牛肉湯麵, 蚵仔煎 ↔ 蚵仔麵線), guaranteed one per ordered dish, with a character contrast when a neighbour is ticked instead.
- One romanisation for as-heard readings (Tâi-lô); definitions carry meaning only.
- The rating question asks about the reading, not the word; the reassurance for new cards stays but the attempt comes first.
- Per-word sentence readings behind a tap, whole-sentence reveal second.

**Changes shipped**

- Data: `spoken` (as-heard reading), `variantNote`, `clozeDistractors` on cards (CSV/JSON/editor/import/export); bundled OFL Noto Serif TC subset for the slip; Tâi-lô readings (ô-á-tsian, bah-uân, uánn-kué, ô-te); slang additions and definition sweep.
- Recognition card: "How well did you _read_ it? 讀得如何？", "0.4s to answer", rubric above the question on the first reveals then a one-line reminder; sticky rating footer; `spoken` shown first; per-card variant line (也寫作 … · note) with per-domain defaults; chips "肉 ròu · 2 more words" that underline the character in the sentence; per-word tap readings + "Show all readings"; "keeps slipping" chip on the answer panel of a leech.
- Fill the Blank: explicit foil, other-domain distractors, misread → amber tile + "right reading, wrong word here" + hint, foil → contrast + reshuffled retry (cap 3) → Again, tap-to-check glosses, no cloze on a just-seen sentence.
- Spot the Character: reshuffled retry after a miss, cap at three then a copy-match gate.
- Order slip: sound + meaning cue one line per dish with "meaning 意思", timer in the header row, verdict strip replacing the cue on submit with the first flagged row scrolled into view, 漏點 / 點錯 / 份量 tags with readings auto-opened, wrong-size verdict-only, real neighbours per dish with character contrast, 內用／外帶 as printed text, 讀音 affordance on every row.
- Session: Pause (saved after every answer; "Resume session · N cards left" on the dashboard; counts and time carry on), Done for today honoured ("Done for today ✓ · N words studied today · Tomorrow: … · Study N more"), "🔥 Day 1 ✓", Time "< 1 min", "Start a fresh session instead".
- Dashboard: intro dismissed by starting a session, "Show the intro again" in Settings, iOS add-to-home-screen hint, "Shows after 7 study days · 1 so far".
- Stats: one state vocabulary (New 新 · Learning 學習中 · Review 複習中 · Relearning 重學) shared with Vocab and the editor, "Not enough answers yet (N/10)", chart labels never overprint, leech rows with per-character cues, variants, foils and "Practice this word".
- Drills: "Read the sound and meaning …", "N of M" progress, plain outcome lines ("Again — it comes back sooner", "Good — moves it toward long-term review", "Already learned — no change; a miss would bring it back sooner", "No change to its schedule — that was a reading of another word").
- Editor: delete as a text link, "Not studied yet 還沒學過" for new cards.
- Walkthrough: 24 captures including paused → resume, the completed summary, the all-done dashboard, the foil retry and the cloze misread.

**Deferred (from ideation section D):** realia for church/slang/anime on the slip engine; second example sentence per card; full leech remediation view (needs `chosen` logs); persisted neutral-answer logs; latency-based nudge; generated foils for custom cards; per-character stats; "learn 5 more" beyond the daily new limit; price-reading tasks; a `notes` field.

## Iteration 3

**Scores:** PM 8/10 · Language expert 8/10 · Heritage learner 8/10.
A verification round against the five statements from iteration 2. All three reviewers: the pinyin rule holds on every prompt face, the mechanics have converged (evidence-graded cloze, reading-focused rating, find-not-match retry, per-word readings, honest slip feedback, the pause/done handoff), and what remains is data and copy. Statements 1 and 4 passed; 2, 3 and 5 each failed on one clause.

**Consensus findings (2+ reviewers)**

1. "Cards left" was 7 on the paused summary and 6 on the resume card for the same session (the summary counted the interrupted drill).
2. 便當 printed under 小菜 at NT$35 with no neighbour at a 滷肉飯 counter; a friend ordering 豆漿 + 便當 + 珍珠奶茶 at one shop — the slip's rows were real but the shop was not.
3. 阿雜 was taught as "ā zá" with the real reading (a-tsa̍p, POJ) inside the definition; the editor hint still said ô-á-chian; definitions still carried non-meaning parentheticals ("Taiwanese staple", "bento classic").
4. The third foil of 藉口 (藉囗) rendered identically to the headword on the leech row.
5. The contrast card for 午/牛 and the look-alike tag for 正/證 had no reading or tell (the character table lacked them).
6. Two meanings of "learning" on the Stats page; the Stats gauge showed "—" without the reason the dashboard gives; "Next: 1 review due within a day — do them".
7. A missed item in a standalone drill did not come back; "Questions = 5" ran three items and one slip.

**Decisions (no conflicts; recorded in iter3/ideation.md)**

- Slips are one shop's order: dishes grouped by the shop that sells them before a slip is built; a 便當店 template with 便當類 (排骨便當／雞腿便當／焢肉便當 as neighbours); a dish without a same-section neighbour gets one from another section of the same shop; ≤ 14 rows; a per-dish price table; unstudied companion dishes on an in-session slip are recorded but never rated.
- No foil may render as its headword or a variant (NFC-equal or a 口／囗-only difference fails the build).
- One romanisation (Tâi-lô) in bundled data, meaning-only definitions, and a `notes` field for sound-spellings and origins (母湯＝毋通, 歸剛＝規工, 阿雜, 盤子, 蛤, 魯蛇, 吃土, 暈船, 爆雷).
- One remaining count (cards only) on the summary and the resume card; "words seen" counts cards whose schedule the session touched.
- A missed standalone item comes back once before the end, announced in the header; for the Order Slip "Questions" means slips.

**Changes shipped**

- Data: 305 character-table entries so every character a starter foil or a same-section menu neighbour differs by has a reading, gloss and tell (午／牛, 正／證, 蚵／蜆 …); the syllable counter treats an apostrophe as a boundary (zuì'ài); 反浱 → 反脈, 藉囗 → 蓆口; Tâi-lô readings (ô-á-tsian, a-tsa̍p, phân-á, m̄-thang, kui-kang); definitions swept; `notes` on cards (CSV/JSON/editor, 💡 after the reveal).
- Slip: 便當店 template, shop-first grouping (standalone and in-session), cross-section neighbours, row cap, price table, more real neighbours (乾拌麵, 鮪魚飯糰, 芋頭糕, 排骨酥, 雞排, 鹹水雞, 炸豆腐, 肉粽, 地瓜粥), a character contrast on a wrongly ticked neighbour, `, small／large` in the expanded gloss.
- Session: one count; "≈ N min" on the resume card; "Done for today 今天先這樣" / "Back to Learn 回首頁"; "Answers" split into cards and drill items; "Tomorrow 明天" with one window (due by the end of local tomorrow) and singular/plural agreement; "Reviews · 1 done today" when nothing was due; "PROGRESS" kicker.
- Drills: standalone re-queue of a missed item ("A missed word comes back before the end 等一下會再考一次"); each drill step keyed so a re-asked item starts fresh; "In review 複習中 — no change"; "Read a real sentence and pick the word that fits."; "each slip asks for up to 3 dishes"; bigger cue and taller tiles.
- Stats: "started · solid · not started"; the gauge's empty state; leech readings behind a tap and definitions that wrap; the card-state legend never wraps mid-word; the gauge is labelled "Recall now".
- Editor: "Reviews / forgotten (after learning)"; "Note 備註"; ô-á-tsian in the As-heard hint. Import preview rows tagged "already in deck" / "repeated in file".
- Integrity tests over the starter deck: sentence alignment, character-table coverage, foil visibility, one romanisation, a neighbour for every food word, one shop per slip, meaning-only definitions.
- Walkthrough: 29 captures — adds the tapped chip + sentence word, the wrong-size slip, the ô-á-tsian reveal, the leech foil drill, Settings with Dark selected; paced first reveal; Questions = 5.

**Exit criterion for round 4:** statements 2, 3 and 5 pass with no new major and no score below 8.

## Iteration 4 — converged

**Scores:** PM 8.5/10 · Language expert 9/10 · Heritage learner 9/10. All three: converged.
A verification round of statements 2, 3 and 5. Statement 2 (one definition of "left" and "due") passed for all three; statement 5 (the reveal and the rating speak to this learner; meaning-only definitions; one romanisation) passed on every captured clause; statement 3 (a real shop with real confusions) passed on realism, the wrong-size tick, the variant row and the ô-á-tsian reveal, and failed one clause for one dish (飯糰 had section-mates but none sharing a character). No new major finding; no score below 8. The exit criterion set in iteration 3 is met.

**What the reviewers still asked for (all shipped in the same pass)**

- A same-length neighbour sharing a character for every ordered dish, including two-character ones (飯糰 ↔ 飯捲; 蛋餅 ↔ 燒餅); real breakfast rows (燒餅, 飯捲, 饅頭, 漢堡).
- Honest beef-noodle prices (牛肉麵 130/160 above 牛肉湯麵 60/80) with a build-time rule: a broth-only bowl is cheaper than the meat bowl, 小 is cheaper than 大.
- An amber verdict when every dish was read right and only a size was wrong ("老闆娘：大碗還是小碗？ All read right — check the size column").
- The cloze look-alike tag names the character it is not, with the tell; the leech row lists each foil with its differing character's reading and tell, and hides pinyin until tapped.
- One pinyin house style for tapped sentence words (lǎo bǎn, not Lǎobǎn); "Reviews 1/2" as done over due; "10 words · 7 re-asked · 1 drill item" on the summary; the paused summary talks about today, not tomorrow.
- The grace verse quoted the way it is said (我們得救全是神的恩典，不是靠自己的行為) instead of a misquoted Ephesians 2:8; long descriptive parentheticals moved from definitions into notes (飯糰, 有雷, 是在哈囉, 泡麵番); definitions capped at 60 characters by test.
- Standalone drills state the re-ask rule before any miss; "Spelling note 寫法備註" and "Usage note 用法備註" told apart; the import preview scrolls instead of clipping its last column; the reveal scrolls the example sentence clear of the rating footer.

**One counter that was not a bug.** Both the PM and the learner saw "18 answers today" fail to move after a restored review. Reproduced in a browser probe: every answer persisted and counted; the walkthrough had navigated away in the same instant as the rating, before the write was visible to the next page load. The walkthrough now waits for the write; the app was correct.

**Final captures (31):** the two states the learner could not verify from earlier rounds are now on screen — the Slang filter of the vocab list, and a 母湯 reveal leading with m̄-thang and its 備註 note.

**Loop closed after four iterations** (the brief allowed up to twenty). Deferred for a later release, unchanged from the iteration-2 plan: realia for church, slang and anime on the slip engine; a second example sentence per card; the full leech remediation view with per-lapse history; persisted neutral-answer logs; latency-based nudges; generated foils for custom cards; per-character stats; a "learn 5 more" beyond the daily new limit; price-reading tasks.

## Analytics round, 2026-09-09

Not a visual round: the material was one device's
[analytics export](analytics-export.md) — three study days, 193 graded answers,
50 words — read through the language-expert lens
([`critique/analytics-2026-09-09/critique-language-expert.md`](critique/analytics-2026-09-09/critique-language-expert.md)).

**Findings**

1. Retention fell 83% → 66% → 55% over three days at 20 new words a day, with
   54% of new words unknown on first sight and 26 of the 50 words met still
   under a day of stability.
2. Same-day repeat loops drove six words to difficulty ≥ 9.5 in single
   sessions: FSRS-6 treats every same-day _Again_ as a fresh verdict, and a
   never-seen word retested sixty seconds after the reveal is failed by
   almost anyone.
3. A card could be re-served seconds after its reveal, and a pass earned that
   way graduated it (治癒系: two _Goods_ three seconds apart).
4. A standalone drill run twice charged the same miss as two lapses.

**Decisions**

- A word is knocked down at most once a day; later same-day misses and drill
  answers are retries that never reach FSRS. Recognition passes always count.
- A card is never shown within a minute of its last answer; the session waits
  in the open when nothing else is ready.
- New cards are held back while more than 20 (Settings) studied words are
  still settling.
- Existing histories are replayed under the rule once, only where the replay
  reproduces the stored state.
- The export reads retries from the event log and gains `same_day_retries`
  and `settling_hold`.

## Analytics round, 2026-09-12

The second export from the same phone — six study days, 356 graded answers,
81 words, 464 events across 18 recorded sessions, three of the days on the
build that shipped the previous round — read through a heritage-language
teacher's lens
([`critique/analytics-2026-09-12/critique-heritage-teacher.md`](critique/analytics-2026-09-12/critique-heritage-teacher.md)),
then an ideation–critique loop over every change the critique implied
([`critique/analytics-2026-09-12/ideation.md`](critique/analytics-2026-09-12/ideation.md)).

**What held.** Retention came back (58% → 80 / 70 / 78%); no card took over a
session; the 81 retries are all in the event log; the learner finished every
one of 18 sittings, median 5½ minutes. First-sight ratings are shaped by
domain (16 of 33 food words read on sight; 37 of 48 church, slang and anime
words failed) and the rating is honest: reveal time runs 2.1 s for _Easy_ up to
5.6 s for _Again_.

**Findings**

1. Every drill lapse in the file — ten — landed on a word the learner had read
   correctly the same day, or would read correctly within two minutes. 餛飩湯,
   the file's one card at maximum difficulty, has passed recognition on every
   day since it was first seen; both its lapses are drills.
2. The app's day was midnight, the scheduler's was 5 p.m. local (`ts-fsrs`
   counts whole UTC days), and 34% of the learner's answers fell after
   midnight. Eight overnight recalls were scored as same-day; a five-hour gap
   was scored as a day (歸剛, 0.21 → 1.89 days of stability).
3. A new word got three looks in five minutes and nothing until tomorrow, where
   the model itself predicted 73–79% recall; only two of 47 first-_Again_ words
   had a second sitting on the day they were met.
4. One card left on screen for 2 h 49 min was 77% of the file's time on task.
5. 149 characters met, 116 read in a real test, 33 only ever failed: almost
   every hard word fails on one character the learner has never read anywhere
   else (滷味 beside 滷肉飯, 意麵 beside 牛肉麵, 米粥 beside 米飯), and the
   reveal did not say which.

**Decisions**

- A word in Review is moved only by reading: a drill miss on it books a
  recognition look in the same session instead of charging a lapse, and any
  drill answer on a word already read that day is practice.
- One day for everything, starting at 4 a.m.: streak, caps, "done for today",
  the once-a-day rule, the analytics rows — and the scheduler is told the time
  in study days, so a night's sleep is a day and an hour across midnight is
  not.
- A third learning step at three hours (relearning: ten minutes, three hours),
  so a new word's third look lands in the next sitting; the summary says how
  many come back later today.
- At most two minutes counted per answer; the raw latency stays on the event.
- Each chip on the reveal says "read in 滷肉飯", "missed in 滷味" or "new
  here"; Stats gains _Read on sight_ and _Characters_; the export carries both
  tables.
- Histories replayed once more (`scheduleRepairV2`), each proved under the
  rule and steps of its day before being recomputed. On this device: 81 of 81
  cards verify, 40 change, total lapses 17 → 5, 餛飩湯 from 0.61 d / 9.57 / two
  lapses to 7.30 d / 6.35 / none.
- The export gains `drill_lapse_after_reading`, `scheduler_day_mismatch` and
  `backgrounded_answers`, practice and booked counts per day, lapse sources on
  saturated cards, and moves to report version 2.

**Reported by the learner after the round:** the same word turning up in two
drills in a row of different kinds. The log had it — 餛飩湯 as a Fill the
Blank target at 08:57 on 09-12 and on an Order Slip a minute later; a slip, a
foil drill and a second slip sharing 貢丸湯 within eighty seconds on 09-09 —
and the cause was that a slip prefers "seen" dishes as neighbours while a
card just drilled counts as seen and a neighbour never counted as drilled.
Now a studied dish on a slip counts as drilled, nothing on one drill is
offered on the next (filler dishes included), a cloze never offers a word
just drilled, and a queued word the learner has not met yet is kept off
slips and out of cloze options so its first sight is not spoiled. Standalone
runs keep each selected word out of the other items' options.

**Reported by the learner after that:** the same sentence turning up for the
same word until "it becomes really easy to know which word I should be looking
for by looking at a few key characters without reading the whole sentence".
Fill the Blank was tied to the one sentence authored on each card, and so was
the reveal: the log had 貢丸湯 clozed seven times in a week on the same frame,
燙青菜 six, 餛飩湯 five. The blank was also sized to the answer, and the
readable distractors rarely shared a character with it, so the length of the
gap and one recognised character each settled the question before any reading
happened. Now a word has several sentences: its own (`extraSentences`, in the
editor, CSV, JSON and the assistant, which adds rather than replaces) and any
other card's sentence the word stands on its own in. The reveal shows the one
seen least recently; a cloze takes one not clozed in the last seven days, not
the one from the last reveal if it can help it, and a word with nothing left to
show sits the drill out. The card remembers what it showed, the event log says
which sentence each cloze was cut from, and the export flags a sentence clozed
three times in a week (`cloze_sentence_repeats`). The blank is a fixed three
characters wide and distractors that share a character with the answer come
first. Every one of the 81 words this learner has met ships with two more
sentences, checked for the reading-alignment rule like the first, and two
primary sentences that repeated their word or hid it inside a longer one
(肉圓, 餛飩) were rewritten.
