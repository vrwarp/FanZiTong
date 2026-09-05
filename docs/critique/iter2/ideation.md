# 繁字通 FanZiTong — iter2 ideation: one plan from the round-2 critiques

Inputs: `critique-pm.md` (PM, 7/10), `critique-language-expert.md` (LE, 8/10), `critique-heritage-learner.md` (HL, 8/10), round-2 screenshots 01–20, the iter1 plan (sections B, D, E, F stay binding except where a finding below overturns them), and the working tree at the time of writing (30 modified files, 4 new, uncommitted). No reviewer found a pinyin-rule violation; all three call the foil-miss card the best screen in the app; all three name the same blocker-class defect: Fill the Blank marks a correct reading wrong. PM adds the post-session handoff (the dashboard forgets "Done for today"); HL adds content accuracy (the friend orders "kē zǎi jiān", invented dishes with prices, a food note pasted on 藉口).

Already decided by the implementer since the captures (not re-litigated): bundled OFL Noto Serif TC subset for the slip; slip distractors are real neighbouring dishes and invented look-alikes are reserved for Spot the Character; cards gained `spoken`, `variantNote` and `clozeDistractors`; the cloze generator prefers authored distractors and other-domain words; Stats labels; the duplicate progress line; import/export placement.

What the tree has landed beyond that list, which this plan treats as done and only refines: evidence-based cloze grading (a real-word pick is explained, retired and re-asked with no schedule change; only the look-alike is a miss), tap-to-check readings on cloze tiles, the foil drill's reshuffled retry after a miss, per-word sentence readings behind a tap with "Show all readings", `spoken` on the reveal and on every cue, per-domain variant defaults with `也寫作 … · note`, "How well did you _read_ it? 讀得如何？", the slip's verdict strip with 漏點／點錯／份量 tags, verdict-only size errors, `(xiǎo)/(dà)` in the cue, plain-text 內用／外帶, `n of N` drill progress, plain outcome lines, the chart-label rule and the import option copy. Written but not wired: `lib/session/pausedSession.ts` (same-day queue in localStorage) and the `doneForTodayDate` meta key; `lib/util/intro.ts` (`dismissIntro`, `resetIntro`) with `LearnPage` still on its own copy of the key and Settings not calling `resetIntro`.

Every backlog item below is therefore a delta: "In tree" states what exists, "Delta" what remains. Copy is `English 中文` in the app's bilingual pattern; effort S ≤ half a day, M ≈ 1–2 days, L > 2 days; "neutral" means an answer that is logged but changes no schedule.

---

## A. Consensus (raised by 2+ reviewers) — with tree status

1. Fill the Blank has false keys (餛飩湯大碗一碗, 我們牧師每週三…); the hint "Only one option fits…" and the tab promise are false; a false-key miss can reset a Review card — PM (major), LE (major), HL (major). [tree: grading and copy fixed; generator still falls back to same-domain words; in-session cloze still uses a just-revealed sentence]
2. "End session" → "Session paused" → "Done for today" → a dashboard that says "Start Daily Session"; the completed-session and all-done dashboard states have never been captured — PM (major); HL and LE could not verify the celebration or the re-queue. [tree: persistence module written, nothing wired]
3. "Also written 借口 — common on signs and menus" is a food template on every card — PM (minor), LE (minor), HL (major). [tree: fixed]
4. Outcome lines speak Anki ("graduating", "Already in review"); the Drills subtitle contradicts the asymmetry — PM (minor), HL (minor), LE (vaguer than planned). [tree: fixed]
5. Slip result: the rows that matter are colour-only, the wrong tick is unglossed, the verdict is below the slip — PM (minor), LE (minor). [tree: verdict strip, tags and scroll-to-row landed; neighbour contrast line open]
6. Character chips: "+2" unexplained, chips look like tags, chip facts not connected to the sentence — PM (minor), HL (minor), LE (nit). [tree: fixed — "· 2 more words", caption, underline in the sentence]
7. "How this works" never leaves after a session — PM (minor), HL (minor). [tree: helpers written, not called]
8. "Hear the word" implies audio — PM (nit), HL (nit). [tree: fixed]
9. The title wraps to "FanZiTong 繁 / 字通" under the streak chip — PM (minor), HL (nit). [open]
10. The 30-day chart overprints its last two labels — PM (nit), HL (nit). [tree: fixed]
11. Stats residuals: "Average retrievability", LAPSES/LEECHES, retention from five answers, a gauge "—" with no reason, two vocabularies for card states — PM (minor), HL (minor), LE (leech row). [tree: labels fixed; gauge reason, n < 10 rule, state vocabulary and gauge aria-label open]
12. Three progress formats — PM (minor), HL (nit). [tree: fixed — `Card 3 of 10`, `Order Slip · 1 of 1`]
13. A 700-px void between cue and bottom-anchored tiles; one-line hints in oversized cards — HL (nit), PM (nit). [open]
14. "TIME 1s" reads as a broken timer — HL (minor); LE and PM note the automated run. [open]
15. Converged, per all three: the pinyin rule everywhere including the sentence; the foil-miss contrast card; sound + meaning cue with honest colouring; the rating row's question, latency, rubric and "?"; one name per drill; dark mode; variants as data.

Single-reviewer findings that made the plan: rating question and new-card copy (LE major — question fixed in tree, reassurance dropped); corrective tap is a copy-match (LE — retry landed, no cap, no re-queue); slip miss feedback at word level and size errors (LE — size done, contrast open); correct-pick cloze feedback (LE — done); per-word readings (LE — done); leech cheap half (LE — open); ô-á-chian as the cue (HL major — wired; romanisation mixed); 湯類 block (HL — template prints it); strip height (HL — gloss now one truncated line with a "meaning 意思" toggle); rubric under the buttons and the in-flow rating row (PM — open); "due"/"left" definitions (PM — open); Import/Export entry (PM — moved; verify); import preview clipping (HL nit — option copy shortened).

---

## B. Conflicts and resolutions

**B1. Cloze grading when the learner picks a real deck word that fits — LE: no schedule change and re-ask; PM/HL: make the key unique.**
Resolution: both, in layers. Uniqueness by construction is what the learner should normally meet; grading by evidence is the safety net that protects the schedule when authoring misses a case.

- Uniqueness (PM/HL): readable distractors come from authored `clozeDistractors` or other domains, never from the same domain — the generator's two same-domain fallbacks are removed, and a card with too few candidates gets three other-domain words and no foil rather than a same-domain word. The starter deck authors two distractors for every sentence whose blank is a bare noun slot (subject or object without a fixed collocation — roughly 30 cards: 小組, 牧師, 見證, 蛋餅, 餛飩湯 …), chosen the way HL describes: break the measure word or the grammar (一碗 → 燙青菜／珍珠奶茶; subject of 聚會 → 讀經／奉獻／詩歌).
- Evidence (LE): as now in tree — a real-word pick is explained, retired and re-asked with the translation as a second cue and no schedule change; only the look-alike is a miss; finding the answer after a real-word pick is neutral. Two corrections: the exercise must say explicitly which option is the foil (`foil?: string`) instead of inferring "no `optionInfo` ⇒ foil", because an authored distractor that is not a deck word has no `optionInfo` and would today be graded as a shape miss; and a look-alike pick must be followed by the same reshuffled retry the foil drill uses, not by showing the answer.
- LE's (d) becomes a rule: an in-session cloze is never built on a sentence revealed earlier that session. Candidates are cards still being learned (Learning/Relearning or lapsed) that are not in today's queue at all; when none exist (day 1) the slot runs Spot the Character or the slip on a seen card. A missed cloze rates Again and so pulls the card into today's session through the existing learn-ahead re-queue.
  Reasoning: PM and HL are right that this learner must never be told they are wrong about a sentence they know is right, and prevention is cheaper than explanation; LE is right that when it happens anyway the schedule must not move, because the construct scheduled is shape → known word. Rejected: a pre-attempt "Show meaning" pill (E).

**B2. The foil drill's corrective step — LE: re-retrieval on reshuffled tiles; today (praised by HL and PM): gated copy-match.**
Resolution: LE's design, which the tree now has, with two refinements. The contrast card stays and the tiles reset unmarked with a sound-only instruction (`Now find ‘lǔ ròu fàn’ again. 再找一次`). Cap it: after a second miss the contrast is re-shown for the new difference and the tiles reset once more; after a third the answer is highlighted and today's copy-match gate applies so the screen cannot loop. In a standalone drill the missed item is appended once to the end of the queue with `You'll see this one again before the end 等一下會再考一次`; in the daily session the Again rating already brings the card back as a recognition card. Reasoning: HL's point was "make me touch the right shape rather than show it" — the retry still does that, but the learner has to find the shape among four rather than tap the one box already outlined green.

**B3. Should the slip keep any look-alike trap now that real neighbours are used — LE liked 鹽肉飯 above 滷肉飯; HL: invented dishes with prices turn the slip into "spot the fake".**
Resolution: no invented string on the slip, ever (the tree already stopped generating them); the discrimination demand comes from real neighbours, and the generator must guarantee one. A neighbour is a real dish in the same section sharing at least one character with the target other than the section's generic suffix (飯 麵 湯 茶 菜): 滷肉飯 ↔ 焢肉飯／肉燥飯／雞肉飯／鴨肉飯, 牛肉麵 ↔ 牛肉湯麵／榨菜肉絲麵, 蚵仔煎 ↔ 蚵仔麵線／蚵嗲, 珍珠奶茶 ↔ 鮮奶茶, 蛋餅 ↔ 蔥抓餅, 滷味 ↔ 滷蛋. Neighbours sit near their target because sections group by type — LE's adjacency without artifice. When a neighbour is ticked instead of the target, the row's feedback names the differing character from charInfo (焢 kòng vs 滷 lǔ; 煎 jiān vs 炸 zhá), so the character-level teaching LE wanted lands on a confusion that exists at a real counter. 蚵仔炸, 鹽肉飯, 半肉麵 stay in Spot the Character. The vestigial `foilOf` field and the 形近 tag leave the slip code.

**B4. "End session" semantics — pause vs done — and what the dashboard must show afterwards (PM).**
Resolution: two intents, two persisted states, three dashboard states.

- Header control `Pause 暫停`, opening the summary in paused mode: `Paused 先休息一下`, `還剩 7 張 · 7 cards waiting`, `Continue 繼續` (primary), `Done for today 今天先這樣` (outline). Leaving the study screen any other way is also a pause; nothing is lost because the session is saved after every answer.
- Resume: dashboard CTA `Resume session 繼續` with `7 cards left · ≈ 5 min` and a text link `Start over 重新開始`; the saved session expires at local midnight (the tree's `pausedSession.ts` already encodes the day).
- Done for today is a deliberate stop recorded in `doneForTodayDate`: the dashboard shows `Done for today ✓ 今天完成`, `5 words studied today 今天學了 5 個`, `Tomorrow 明天: 1 review · up to 10 new · ≈ 8 min`, an outlined `Study 5 more 再學 5 個` while the plan still has cards (clears the flag, resumes), and `Extra practice 額外練習 →`. Chip `🔥 Day 1 ✓` once any answer is logged today.
- Queue empty: complete summary (`Done for today 今天練完了` + praise) and the same done state without "Study N more".
- One definition each: "Due today" = due by the end of local today, with `1 more later today` when some are not due yet; "Tomorrow" = due from now to the end of local tomorrow (replaces the 24-hour window); "left" = remaining cards including the current one, drills excluded, identical on header and summary.
  Reasoning: the app had one screen for two intents; persisting both is the only way the dashboard can honour either.

**B5. Per-word sentence readings (LE) vs the whole-sentence pill (HL is content; PM fine).**
Resolution: per-word tap primary, whole-sentence reveal second — as the tree now does. Two refinements: the alignment test must run over all 95 starter sentences (fix any pinyin that fails to align rather than special-casing), and tapped words are logged as the cheapest leech signal available. Reasoning: HL's "I actually read the sentence this time" is the goal and one tap on the pill undoes it; the pill stays because sometimes the whole sentence is what you want.

**B6. Size errors on the slip — verdict-only (LE) vs graded wrong (iter1 item 1).**
Resolution: verdict-only; iter1's rule is overturned, and the tree already implements it (`sizeErrors`, `Wrong size 份量`, "no penalty"). Keep the cue character-free (`(xiǎo)/(dà)` — done) and add `small`/`large` to the expanded gloss so the English side carries the size too. Reasoning: FSRS schedules the dish's shape → sound binding; 小 and 大 are first-grade characters, and an Again for a column slip would push a stable card into relearning for a non-orthographic error. HL's "the wrong size costs money" is served by the verdict.

**B7. New-card prompt copy — LE: "a blank is expected, just tap" licenses skipping the attempt; HL: "first time an app told me it's fine not to know".**
Resolution: keep the reassurance and put the attempt first. The tree has the attempt (`New here — try to read it before you tap. 先試著唸出來`) and dropped the reassurance; restore it: `New here — try to read it first; a blank is fine. 先試著唸，唸不出來也沒關係`.

**B8. Rubric placement — PM: sticky rating footer with the rubric above the buttons; LE: one persistent anchor.**
Resolution: the tree chose LE's permanent one-line reminder (`Hard = slow, or only part of it · rate the reading, not the word`), which is cheap; keep it. Add PM's structure: question + buttons + reminder become a sticky footer, and on the three coach reveals the full rubric renders above the question so it is read before rating. Latency reads `0.4s to answer` (done).

**B9. Slip cue strip — HL: one line per dish with the English behind a tap; LE/PM: the gloss is half the sanctioned cue.**
Resolution: the tree's middle path is accepted — one line per dish, the gloss visible but truncated on the same line, `meaning 意思` expands it, the timer in the header row. The gloss is never fully hidden, and the strip lost roughly half its height.

**B10. Cloze correct-pick feedback — PM counted printed distractor readings as fixed; LE wanted tap-to-check.**
Resolution: tap-to-check per tile (in tree), a reading printed only for a tile the learner actually picked. A tap is a retrieval; a printout is not.

**B11. 藉口 in a 常用字 bucket (HL, again).** Stands as resolved in iter1 B12; not reopened.

---

## C. Ranked backlog for iteration 2 (deltas against the tree)

Bug and trust first, then impact per effort. Items 1–8 and 14 are the ship set for the verification round in F; 9–13 may trail.

### 1. Fill the Blank: single key by construction, explicit foil, corrective retry, never a just-seen sentence — M

Addresses A1, B1, B2 (cloze half); PM/LE/HL majors.

- In tree: `Which word goes here? 哪個詞填得進去？`; idle hint `Read the whole sentence first.`; real-word pick → amber tile, `That reads 牧師 mù shī "pastor" — not what this sentence is about. Try again.` + `Hint: <translation>`, tile retired, re-ask, `找到了！ Found it` neutral; foil pick → miss with the answer shown; tap-to-check on deck tiles; foil tile tagged `形近 look-alike · 阻 zǔ "block"`; `applyRating` on `DrillOutcome`; outcome line `No change to its schedule — that was a reading of another word.`
- Delta, generator (`lib/exercises/cloze.ts`): delete the two same-domain fallbacks (`sharesCharacter` and `others` pushes before the foil); if fewer than two readable distractors exist after authored + other-domain, fill with three other-domain words and no foil. Add `foil?: string` to `ClozeExercise` (set when the visual foil was used) and `spoken?` to `ClozeOptionInfo`. Unit test: for every starter card, no generated readable distractor shares the answer's domain unless authored.
- Delta, data: author `clozeDistractors` (two deck words each) for every starter sentence whose blank is a bare noun slot; test that no authored distractor is same-domain-and-same-section (food: `categorizeDish`).
- Delta, view: foil detection uses `exercise.foil`, not "no optionInfo"; after a foil pick, show the contrast card and run the reshuffled retry of item 7 (`Now find ‘xiǎo zǔ’ again. 再找一次`), result miss; add the zh half to the misread line: `唸對了，但不是這句要的。 That reads … — right reading, wrong word here. Try again.`
- Delta, engine (`makeDrill`): for a cloze, candidates = `pool` cards with `isDrillCandidate && hasClozeSentence` that are in neither `results` nor the remaining `queue`, sorted by lapses desc then stability asc; when none, fall through to foil / slip on seen cards with the existing recency preference. Standalone drills unchanged.
- Delta, logging: persist neutral and unapplied drill answers as `ReviewLog`s with new optional fields `applied?: boolean` (absent = true), `chosen?: string`, `attempts?: number`; analytics exclude `applied === false` from retention, reviews-today and the daily chart and include them in answers-today and the streak. `SessionResultEntry.neutral?: boolean` so `summarizeResults` does not count a "found it after a wrong word" as right on first try (a Review card's plain hit stays right).
- Drills-tab description stays `Read a real sentence and pick the word that fits.`; tiles carry `data-kind="answer|word|foil"` for the walkthrough.

### 2. Pause, Resume, Done for today, and one definition of due and left — M

Addresses A2, A14, B4; PM major and minor.

- In tree: `pausedSession.ts` (day-scoped queue in localStorage), `StudyEngine.remainingCardIds()`, meta key `doneForTodayDate`; none wired; summary still `Session paused` / `Continue session` / `Done for today`; dashboard still `plan.queue.length === 0 && answersToday > 0`.
- Delta, persistence: extend `PausedSession` with `answered`, `results` (the `SessionResultEntry[]`), `drilled`, `nextDrillAt`, `lastDrillType`, `startedAt`, `elapsedBeforePauseMs`; `StudyEngine.serialize()` / `restore(state, options)`; save after every `rate`/`answerDrill` and on pause; clear on complete, Start over and day change. A drill in progress is not persisted; a resumed session starts at the next card.
- Delta, study screen: header left `Card 3 of 10` (during a drill `Drill 練習 · Fill the Blank`); right ghost button `Pause 暫停` (update the e2e testid in the same change). Done for today → `setMeta(doneForTodayDate, today)` + clear paused session + navigate home.
- Delta, summary: paused `Paused 先休息一下` / `還剩 7 張 · 7 cards waiting` / `Continue 繼續` / `Done for today 今天先這樣`; complete `Done for today 今天練完了` + praise, primary `Back to Learn 回首頁`; Time `< 1 min` under 60 s.
- Delta, dashboard model: `resumable: { remaining, minutes } | null`, `doneFlag`. Order: resumable and no flag → `Resume session 繼續`, `7 cards left · ≈ 5 min`, link `Start over 重新開始`; flag, or queue empty with answers today → `Done for today ✓ 今天完成`, `5 words studied today 今天學了 5 個`, `Tomorrow 明天: 1 review · up to 10 new · ≈ 8 min`, outlined `Study 5 more 再學 5 個` only while the plan has cards, text link `Extra practice 額外練習 →`; else today's Start / Nothing due. Chip `🔥 Day 1 ✓` when answers today > 0.
- Delta, definitions: `dueByEndOfToday` for the DUE TODAY count with `1 more later today` when not yet due (the queue keeps its 20-min learn-ahead); `dueTomorrow` = due in (now, end of local tomorrow] everywhere; "left" = total − answered on header and summary; `Next: 1 review due tomorrow — do it to keep the streak` pluralised.
- `LearnPage` imports `readIntroDismissed`/`dismissIntro` from `lib/util/intro.ts` instead of its own key copy.

### 3. One romanisation, definitions carry meaning only, `spoken` on the remaining surfaces — S

Addresses HL major; LE residual.

- In tree: `spoken` on reveal (`ô-á-chian · kē zǎi jiān` + `Said the Taiwanese way; the Mandarin reading is what the characters spell.`), foil cue, slip cue and result lines, filler rows; `SPOKEN` map for 蚵仔煎 and 肉圓; fillers 碗粿 uánn-kué, 蚵仔麵線 ô-á-mī-suànn, 蚵嗲 ô-te.
- Delta: Tâi-lô everywhere in bundled data — 蚵仔煎 `ô-á-chian` → `ô-á-tsian` in `starterDeck.ts` and `menuTemplate.ts`; add `spoken` for any starter card among 蚵仔麵線, 蚵嗲, 碗粿, 黑輪 oo-lián, 刈包 kuah-pau that exists; none for dishes said in Mandarin (滷肉飯, 臭豆腐, 鹹酥雞). Strip reading parentheticals from definitions: 蚵仔煎 `Oyster omelette`, 肉圓 `Taiwanese meatball in translucent glutinous dough`. Summary "One more look" and the Vocab row's Show pinyin show `spoken · pinyin`; cloze `optionInfo` shows `spoken ?? pinyin`. Editor hint for As heard: `Tâi-lô or however you say it (e.g. ô-á-tsian, or é-á-jiān). Used as the drill cue.`

### 4. Notes field and a definition sweep — S

Addresses A3 residual; LE minor 8 (metadata in the definition).

- In tree: `variantNote` rendered with per-domain defaults (`Menus and signs use either spelling.` …) — accepted as is; 藉口 `Excuse, pretext` with its authored note.
- Delta: add `notes?: string` (iter1 item 3, never shipped): editor textarea `Note 備註` (`A mnemonic or a usage note, shown after the reveal.`), reveal line under the definition in grey with 💡, CSV/JSON round-trip. Sweep all 95 definitions for parentheticals that are not meaning and move them: 爆雷 → definition `To spoil a plot`, note `Taiwan says 爆雷／有雷; 劇透 is the China term you'll also see online`. Leech row and Vocab rows wrap the definition instead of truncating.

### 5. Rating row as a sticky footer, rubric above on coach reveals, the reassurance restored — S

Addresses B7, B8; LE major, PM minor.

- In tree: `How well did you read it? 讀得如何？`; `0.4s to answer · slow? that is Hard`; permanent reminder `Hard = slow, or only part of it · rate the reading, not the word`; new-card line without the reassurance.
- Delta: `RatingButtons` wrapper `sticky bottom-0 z-10 -mx-4 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] bg-cream/95 backdrop-blur dark:bg-ink/95`, still reserved-but-invisible before the reveal (no layout shift; whole-screen tap unchanged); answer panel bottom padding so its last line clears the footer. Coach reveals (first three ever): the full rubric renders above the question; afterwards `?` toggles it in the same place. New-card line `New here — try to read it first; a blank is fine. 先試著唸，唸不出來也沒關係`.

### 6. Order Slip: guaranteed neighbours with character contrast, no vestigial foils, readings pushed on error rows — S/M

Addresses A5, B3, B6; LE minors, PM minor, HL major.

- In tree: real fillers only; `cueReading`; `(xiǎo)/(dà)`; truncated gloss with `meaning 意思`; timer in the header row; verdict strip (`老闆娘：欸，你是不是點錯了？ Not quite.` · `2 of 3 read right · 1 wrong tick · 1 wrong size (no penalty) · tap a row for its reading`); scroll to the first problem row; tags `Missed 漏點` / `Wrong 點錯` / `Wrong size 份量`; `內用／外帶` as text; `MENU_ITEMS_PER_CATEGORY = 3`.
- Delta, generator: `isNeighbour(target, filler)` per B3; for each target place at least one neighbour in its section (random among candidates), then fillers to 3–4 rows in that section, ≤ 14 rows total; `neighbourOf?: string` on `MenuItem`; authored `neighbours?: string[]` on filler entries where the rule finds none; tests assert one neighbour per target and no repeated label. Remove `foilOf` from `MenuItem`, `gradeMenuExercise` and the view (the 形近 tag with it).
- Delta, feedback: rows tagged 漏點 / 點錯 / 份量 open their reading line automatically after grading; a 點錯 row that is a neighbour of a missed target adds a contrast line from charInfo when the strings are the same length (`焢 kòng "slow-braised" — not 滷 lǔ "soy-braised"`) and both glosses side by side otherwise (`牛肉湯麵 niú ròu tāng miàn · beef-broth noodles, no beef — you wanted 牛肉麵`). Expanded gloss carries `, small` / `, large`. Verdict zh for the perfect case gets `全對！` before the boss line.

### 7. Spot the Character: retry cap, standalone re-queue, shared with the cloze — S

Addresses B2; LE minor, HL/PM keep-doing.

- In tree: phases `pick → wrong → retry → done`; `Got it — try again 再找一次`; reshuffled unmarked tiles; `Now find ‘…’ again. 再找一次`; `找到了！ Found it` with Again; `spoken` cue; unlimited retries; no re-queue.
- Delta: after the second miss the contrast is re-shown for the new difference (`再看一次 Look again — 3rd character`) and the tiles reset; after the third the answer is highlighted and the copy-match gate applies (`The word is 滷肉飯 — tap it to continue 點一下正確答案`). `attempts` logged. Standalone runner: on a miss, append a rebuilt exercise for the same card once (`requeued` set), header count grows, notice `You'll see this one again before the end 等一下會再考一次`; the second run logs `applied:false`. Extract the retry into a component the cloze reuses (item 1).

### 8. One vocabulary for states and metrics, honest empty states — S

Addresses A11; PM minor, HL minor.

- In tree: `Recall now`, `Not-"Again" rate, 30 days`, Words / Forgotten / Keep slipping, `"Solid" = …`, `Words you keep forgetting (leeches)`, `forgotten ≥ 3×`.
- Delta: `CARD_STATE_LABELS` gains zh and is used by Vocab rows, the Stats legend and the editor: `New 新 · Learning 學習中 · Review 複習中 · Relearning 重學` ("Not started" and "Reviewing" go). Gauge aria-label `Recall now`; empty state inside the gauge card, visible above the tab bar on the dashboard: `Shows after 7 study days · 1 so far 練滿 7 天就會出現` (dashboard grid gets bottom padding equal to the tab bar). 30-day line under ten answers: `Not enough answers yet (5 of 10) 答題還不夠`. Leech button `Practice all 全部練` (per-row button in item 12).

### 9. Sentence readings: full-deck alignment test, taps logged, also-in words tappable — S

Addresses B5; LE minor, HL minor.

- In tree: `alignSentenceReadings` by syllable counting; `<button>` per word with hidden reading; `Tap a word for its reading · Show all readings 拼音`; chips `肉 ròu · 2 more words` with caption and sentence underline; charInfo gloss on the selected chip.
- Delta: test that every starter sentence aligns (list failures; fix the pinyin data, e.g. tokens glued to punctuation or erhua), with an explicit allow-list for the few that legitimately cannot (Latin tokens like SSR are already handled). Log `sentenceTaps?: string[]` and `showAllReadings?: boolean` on the session's `ReviewLog` for the card. The "also in 滷蛋、滷味" words become tap-to-check (reading on tap), consistent with the sentence.

### 10. charInfo coverage for every foil and neighbour character — S

Addresses LE minor 5; dependency of items 6 and 12.

- Delta: a test enumerates every character that differs positionally between a starter headword and its `visualFoils`, and between a filler and a same-length deck headword in the same section, and fails on a missing entry. Author the gaps, including 阻 (`阻 zǔ "block" — 阝; 組 zǔ "group" — 糹, same sound, only the radical tells them apart`), 祖, 少, 炸/煎 both directions, 半/牛, 鹽/滷, 湯/燙, 蜆/蚵, 剪, 混/餛, 鈍/飩, 場/湯, 徑/經, 讚/讀, 續, 耤, 囗, 焢, 燥, 雞, 鴨, 排, 咖, 陽, 春, 榨, 麻, 醬, 鍋, 炒, 線, 嗲, 圓. Homophone pairs say so in the tell.

### 11. First impression and the explainer's exit — S

Addresses A7, A9; PM minor, HL minor.

- In tree: `intro.ts` with `dismissIntro`/`resetIntro`; `LearnPage` still on its own key; no auto-dismiss; no Settings entry; Android install row only.
- Delta: `PageHeader` keeps `繁字通` unbreakable (`whitespace-nowrap`) and moves the streak chip to the subtitle row, right-aligned, so `🔥 Day 120` never wraps the title. Call `dismissIntro()` when the first summary (paused or complete) mounts. Settings › About: `Show intro again 再看一次說明` → `resetIntro()`. iOS Safari not in standalone: one-time dismissable row `📲 Add to Home Screen — Share → Add to Home Screen. Opens full-screen and keeps your progress safe.`

### 12. Leech remediation, the cheap half — M

Addresses LE minor 7.

- Delta: leech row expands on tap: chips (`藉 jiè · 口 kǒu`), `也寫作 借口 · …`, foils with tells (`籍 jí "register" — 藉 wears 艹`), `forgotten 4× 忘了 4 次`, `Last time you picked 籍口` when `chosen` exists, and a per-row `Practice this word 練這個字` → `/drills/foil_discrimination?count=3&cards=<id>` (three rounds, fresh shuffles). The review card of a card at or above the threshold opens its chips pre-expanded after the reveal and shows a small `常忘 keeps slipping` chip on the answer panel, never on the prompt face.

### 13. Layout and copy polish — S

Addresses A13; HL nits, PM residuals.

- Delta: foil and cloze columns use `justify-between` with the cue block grown (cloze sentence `text-3xl` when ≤ 16 characters, foil cue `text-3xl`) and tiles `min-h-28`, halving the void; the cloze idle hint sits as one line under the sentence with no card. Editor `Delete card 刪除` becomes a red text link at the bottom with the existing confirm; a New card's memory panel reads `Not studied yet 還沒學過` with stability/difficulty hidden (iter1 item 18, still open per PM).

### 14. Walkthrough coverage for the states nobody has seen — S

Addresses A2, A14 and every "not captured" note; ship with item 2.

- Delta, new captures: `05b-session-complete` (rate every card Good/Easy, drills answered), `06b-learn-all-done`, `06c-learn-resume` (pause, navigate home), `06d-learn-done-flag` (Done for today with cards remaining), `03b-study-revealed-spoken` (蚵仔煎), `11b-drill-foil-retry` (tiles reset), `13b-drill-cloze-wrong-word`, `13c-drill-cloze-wrong-foil` (via `data-kind`), `09b-drill-menu-variant-row` (seeded rng so 魯肉飯 prints), `09c-drill-menu-wrong-size`, `14b-vocab-slang-filter`, `18b-settings-dark-selected` (Dark button, then Settings). Pace answers ≥ 1 s apart so latency and Time read as real.

---

## D. Later (deferred, with why)

- Realia for church, slang and anime (週報 order of service, LINE thread, PTT post) on the slip engine — LE confirms the precondition is met; wait for item 6's neighbour model so the engine is not rebuilt twice.
- Second example sentence per card — would let seen cards get an in-session cloze on a fresh sentence; authoring for 95 cards after the deck sweep in items 3–4.
- Full leech remediation view (lapse history, foil chosen per lapse, recognise-only state) — needs the `chosen`/`attempts` logs shipping in item 1.
- Latency-based nudge — needs real `revealMs` distributions; the reminder line is the first step.
- Generated foils from the confusable table for custom cards — after item 10's coverage.
- Per-character stats — needs `sentenceTaps` (item 9) plus charInfo.
- "Learn 5 more" beyond the daily new limit — item 2's "Study N more" covers only the remaining plan.
- A syllable table (rather than the regex counter) for readings — only if the full-deck alignment test in item 9 exposes cases the counter cannot handle.
- Price-reading tasks; variant as the correct tile in Spot the Character — unchanged from iter1.
- A generic measure-word-aware distractor rule — only if authored distractors plus the other-domain rule prove insufficient in round 3.

## E. Rejected

- A `Show meaning` pill before an attempt on the cloze (LE option a) — the sentence is the meaning cue; the translation appears after a readable-but-wrong pick, and a pre-attempt pill would become the default path within a week.
- Keeping a real-word cloze pick as a miss — the app's premise inverted.
- Any invented string on the slip — Spot the Character owns invented look-alikes.
- Scheduling 小/大 errors — not the construct being scheduled.
- "End" semantics that discard the session, or a done state that does not survive navigation.
- Fully hiding the English gloss in the slip strip (HL) — meaning is half the sanctioned cue; truncation with a toggle is as far as it goes.
- Printing all distractor readings after a correct cloze pick — exposure, not retrieval.
- A 常用字 bucket for 藉口 — five domains fixed; tags.
- Audio, or copy that implies it.
- Mixed POJ/Tâi-lô in bundled data — one system; user cards remain free text.
- Enforced dwell, Zhuyin annotations, pinyin beside any prompt — unchanged from iter1.

## F. Convergence judgement

Scores 7 (PM), 8 (LE), 8 (HL). PM: "Not yet — one short round away; fix the distractor rule and the post-session handoff and I would ship." LE: "Yes for the daily loop, Spot the Character and the Order Slip; the remaining gap is Fill the Blank." HL: "Yes, I'd open it tomorrow; the one thing that would make me quit is being marked wrong for a right answer."

Judgement: one more round is warranted, but a short verification round, not a full open critique. The mechanics have converged — every remaining major is the cloze's key, the session handoff, or content wiring that the tree already half-contains — and none needs design beyond this document. Ship items 1–8 and 14 (9–13 may trail), re-run the walkthrough with the new captures, and ask each reviewer only to verify the five statements below through their own lens. Exit criterion: all five pass and no reviewer scores below 8; then declare converged and move to D without a further critique round. Round 3 should not reopen the pinyin rule, dark mode, variants, the slip's sound + meaning cue, or the foil-miss card.

Five testable statements for round 3:

1. **Fill the Blank never marks a correct reading wrong.** In the captured items and a generated sample of 50, every readable distractor is from another domain or is authored; picking a real deck word shows "right reading, wrong word here" with the translation, re-asks, and the outcome line reports no schedule change; picking the look-alike shows the contrast card, a reshuffled retry, and Again; the hint reads "Which word goes here?"; and no daily-session cloze uses a sentence revealed earlier in that session.
2. **The dashboard honours what the learner chose.** Pause → "Paused 先休息一下" → leaving and returning shows "Resume session · N cards left"; Done for today → "Done for today ✓" with the tomorrow line, "Study N more" and the chip "🔥 Day 1 ✓"; an emptied queue → the complete summary and the all-done dashboard; "due" and "left" read the same number on the header, the summary and the dashboard; Time reads "< 1 min" under a minute.
3. **The slip is a real shop with real confusions.** Every row is a real dish; each ordered dish has a same-section neighbour sharing a character; the strip contains no Han characters for ordered items, uses ô-á-tsian, and sizes read (xiǎo)/(dà); on submit the verdict strip replaces the cue with the first missed or wrong row in view; missed and wrongly ticked rows carry 漏點/點錯 tags with their readings open and a character contrast on a ticked neighbour; a wrong-size tick shows 份量 and an unchanged schedule; a variant-printed row is graded correct with the "= 滷肉飯" tag.
4. **A miss is corrected by finding, not matching.** After a wrong pick in Spot the Character, and after a look-alike pick in Fill the Blank, the contrast card shows, the tiles reset unmarked, the instruction gives only the sound, a correct retry turns green, a second miss re-shows the contrast, a third falls back to the gate, and a standalone drill shows the item once more before the end.
5. **The reveal and the rating speak to this learner.** ô-á-tsian leads for 蚵仔煎 with the Mandarin reading secondary and no reading inside the definition; the variant line is per card (藉口: typed online; 滷肉飯: menus and signs); tapping a sentence word shows only that word's reading with "Show all readings" second; chips read "肉 ròu · 2 more words" and underline the character in the sentence; the question is "How well did you read it?", the new-card line asks for an attempt and says a blank is fine, and the rating row is a sticky footer with the rubric above it on the coach reveals.
