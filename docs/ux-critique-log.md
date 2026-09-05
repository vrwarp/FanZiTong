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
