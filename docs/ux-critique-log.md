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
