# 繁字通 FanZiTong — PM / user-journey verification critique (iter4)

Lens: senior PM, mobile learning apps. Judged from the 29 round-4 screenshots only — journeys, first impressions, numbers that reconcile, the loop closing, copy consistency. Full-page captures (11, 11b, 19, 21, 22) render their sticky bars mid-page; that is a capture artifact and is not counted against the app.

Pedagogy-rule check: no character prompt shows pinyin before the tap or the answer (02 hidden; 15 cloze without readings; 12/14/21c and 04/10 cue with sound + meaning while the tiles and slip rows are characters, by design; Vocab ships with "Show pinyin" off on 18). Sentence readings stay behind a per-word tap or "Show all readings 拼音" (03b, 17, 21b, 24). No violation, no blocker on that ground.

## (a) Round-3 ledger

Majors from round 3:

- **[major] 05/06 "7 cards left" vs "6 cards left" — FIXED.** 05 "先休息一下 · 還剩 6 張 · 6 cards left in this session — saved, even if you leave."; 06 "IN PROGRESS · 6 cards left · Paused earlier today — pick up where you stopped. ≈ 5 min". The arithmetic holds from the screen: 10 cards − 5 seen + 1 re-queued (滷肉飯 under "One more look") = 6, and the pending slip is not counted, as the plan said. The pattern repeats later: 23 "1 card left ≈ 1 min" against 24 "Card 2 of 2 · resumed". The "≈ N min" landed on the resume card (06, 23).
- **[major] 21 leech row "藉口 … not 籍口 / 耤口 / 藉口" — FIXED.** 21 now reads "也寫作 借口 · not 籍口 / 耤口 / 蓆口"; 21c (launched from "Practice this word") shows four distinguishable tiles 籍口 / 耤口 / 蓆口 / 藉口 under "Spot the Character · 1 of 1", so the remedy for the hardest word is answerable.

Minors from round 3:

- **便當 as a 小菜 at NT$35 with no neighbour — CANNOT VERIFY.** 便當 is on none of the three slips captured. What is visible is the venue-first template the patch promised: 阿姨早餐店 with 主食／飲料 for 飯糰／蛋餅／珍珠奶茶 (10, 11) and 阿婆小吃店 with 飯類／麵類／湯類／小菜 and 小／大 columns for rice/noodles/soup (04, 11b); slips of 6 and ~12 rows (≤ 14). The neighbour guarantee itself has a new hole on the breakfast template — 飯糰 on 10, see (b) and (c).
- **13 contrast card lost its teaching (午／牛) — FIXED on the captured pair.** 13: "不對 — look at the 1st character", both words with the differing character boxed, "貞 zhēn "chaste" is not 貢 gòng "tribute"", tell "貢 is 工 over 貝", "Got it — try again 再找一次"; 14 reshuffles the tiles under "Now find 'gòng wán tāng' again. 再找一次". 午／牛 itself is not captured this round.
- **03/24 sticky footer clips the answer panel — NOT FIXED** (not in the patch set). 03 cuts the translation at "and add a"; 24 halves the "Show all readings 拼音" pill. 21b shows the panel fitting when it is short enough.
- **"Next: 1 review due within a day — do them" — FIXED.** 05 and 07 "Tomorrow 明天: 1 review due — do it to keep the streak."; 08 "Tomorrow 明天: 1 review · up to 10 new · ≈ 8 min — do it to keep the streak."; 06 "No reviews due yet." is today's figure. The other half (a done state that hides a card due now, last round's 23) is not captured this round — 23 is now an in-progress state.
- **Questions = 5 runs 3 — PARTIAL.** 12 "Spot the Character · 1 of 5" and 15 "Fill the Blank · 1 of 5" honour the launcher; 10/11/11b "Order Slip · 1 of 4" do not, and 09 says nothing about a cap — see (c).
- **"Forgotten" has two definitions — PARTIAL.** 19 labels the editor row "Reviews / forgotten (after learning) 3 / 0", so the 0 on the card that was missed today is explained there; the Stats tile is still bare "FORGOTTEN 4" (21) on a day whose one miss (07 "9/10", "One more look 滷肉飯") is not in it.
- **"10 learning" under "Learning 0" — FIXED.** 21 "10 started · 0 solid · 12 not started" (Food) and the other three rows; each row sums to its deck count (22/22/29/22) and "started" no longer collides with the state name.
- **Stats gauge "—" without the reason — FIXED.** 21 "Shows after 7 study days · 1 so far" under the gauge, the same line as 06/08/23.
- **"Reviews 1/30" when nothing was due — PARTIAL.** 08 reads "Reviews · 1 done today", the planned copy; but the "1" on a day that opened with "0 reviews" due (01) still has no visible source, and 23 — a review restored as due — is back to "Reviews 1/30", a 3 % bar against the daily cap rather than "1 due · 1 done".
- **"Already learned — no change" — FIXED.** 11 and 11b "In review 複習中 — no change; a miss would bring it back sooner."; 09 "a hit only speeds up words not yet in review."
- **Legend breaks Chinese labels mid-word — FIXED.** 21 "New 新 84 · Learning 學習中 0 · Review 複習中 11 · Relearning 重學 0" on clean lines, summing to 95.

Nits from round 3:

- "your ear for grammar rules out the rest" — FIXED (09 "Read a real sentence and pick the word that fits.").
- Non-meaning parentheticals — PARTIAL. 03 "Braised minced pork over rice", 24 "Excuse, pretext", 18 "Bento / boxed lunch" are clean, and no reading appears inside a definition on any screen; 16 still carries "(the warning tag on PTT / Dcard threads)" inside the definition of 有雷, and 10 truncates "Taiwanese rice roll (with youtiao, pickled r…" on the cue strip. a-cha̍p is not captured.
- "As heard" hint says "ô-á-chian" — FIXED (19 "e.g. ô-á-tsian for 蚵仔煎"), matching the reveal on 21b.
- Half-bilingual buttons — FIXED (05 "Continue 繼續" / "Done for today 今天先這樣"; 07 "Back to Learn 回首頁").
- "Answers (incl. repeats) 18" unexplained — FIXED as specified (07 "18 · 17 cards · 1 drill item"; 05 "5 · 5 cards · 0 drill items"), with a wording wrinkle in (c).
- "TODAY" kicker twice — FIXED (08: "TODAY" on the done card, "PROGRESS" on the small one).
- Import duplicate rows colour-only — NOT FIXED (20: the 滷肉飯 row is yellow with no tag; not in the patch set).
- Leech row truncates its definition — FIXED (21 "Excuse, pretext" wraps; the reading sits behind a "reading" pill — but see (c)).
- Dark button's selected state undemonstrated — FIXED (22b: "Dark" filled, page dark; 23/24 dark).

Round-3 statement clauses that failed:

- **S2, numbers clause** (7 vs 6; "within a day" vs "Tomorrow") — FIXED (05/06/07/08 above).
- **S3, neighbour clause** (便當) — CANNOT VERIFY for 便當; a different target (飯糰) fails the same clause on 10 — see (b).
- **S5, definitions clause** (a reading inside "阿雜 (Taiwanese a-cha̍p)"; "(Taiwan standard form)") — FIXED on every captured reveal (03, 03b, 21b, 24); the usage parenthetical on 16 is the residue.

## (b) Statements 2, 3 and 5

**2. The dashboard honours the learner's choice with one definition of "left"/"due" — PASS.** Pause → 05 "Paused · 先休息一下 · 還剩 6 張"; dashboard → 06 "IN PROGRESS · 6 cards left · ≈ 5 min · Resume session · Start a fresh session instead": the same 6 on both, and the same 1 on 23/24 later ("1 card left" / "Card 2 of 2 · resumed"). "Due" now means one thing across the loop: 06 "No reviews due yet." is today; 05/07/08 "Tomorrow 明天: 1 review" is the 滷肉飯 that 18 lists as "Review 複習中 · in 24h"; 08 "Done for today ✓ · 10 words studied today 今天學了 10 個" closes the day with "Extra practice" as the only call to action; the chip is "🔥 Day 1 ✓" on 06/08/23; Time "< 1 min" on 05 and 07; "Daily goal reached 辛苦了！" on 07. The one residual is not a definition but a counter — 23's "18 answers today" — logged in (c).

**3. The slip is a real shop with real confusions, including a wrong-size tick and ô-á-tsian — PASS on the wrong-size, 份量, variant and ô-á-tsian clauses; FAIL on the neighbour clause for one target; 便當 CANNOT VERIFY.** Evidence for the passes: one shop per slip (阿姨早餐店 on 10/11; 阿婆小吃店 on 04/11b, with 內用／外帶 · 桌號 3 printed, 小／大 columns on 飯類／麵類 and a single √ column on 湯類／小菜); 11b: 魯肉飯 ticked 小 for a 大 order → row tag "Wrong size 份量", chip "= 滷肉飯", strip "3 of 3 read right · 1 wrong size (no penalty)", summary "滷肉飯 (大) lǔ ròu fàn — printed as 魯肉飯 on this menu — right dish, wrong size column"; 11: "2 of 3 read right · 1 wrong tick", 鮮奶茶 tagged "Wrong 點錯" with "you wanted 珍珠奶茶 zhēn zhū nǎi chá" and "+ Add to deck 加入", 珍珠奶茶 tagged "Missed 漏點", "飯糰 fàn tuán — printed as 飯團 on this menu", every row with "▸ 讀音"; 21b: "ô-á-tsian · kē zǎi jiān · Said the Taiwanese way; the Mandarin reading is what the characters spell." and 19's hint uses ô-á-tsian. Neighbours: 04 and 11b give every target a same-section, same-length neighbour sharing a character (滷肉飯／魯肉飯 – 肉燥飯／鴨肉飯, 牛肉麵 – 大滷麵／陽春麵／榨菜肉絲麵, 貢丸湯 – 魚丸湯). 10 does not: 主食 is 飯團 · 火腿蛋吐司 · 蛋餅, so 飯糰 shares no character with anything in its section; worse, the two 2-character 主食 rows are exactly the two 2-syllable targets and the only 4-character drink is the 4-syllable target, so the whole 6-row slip can be ticked 3/3 without reading a character — the round-1 shape-matching hole, reopened on the breakfast template. 便當 appears on no slip.

**5. The reveal and rating speak to this learner with meaning-only definitions and one romanisation — PASS on every captured clause; the 💡 note CANNOT VERIFY.** 03 "lǔ ròu fàn · Braised minced pork over rice · 🍜 Food / 飲食 · 也寫作 魯肉飯 · Menus and signs use either spelling."; 03b: chip tap → "肉 ròu "meat" · also in 肉圓、牛肉麵" (the promised "2 more words"), word tap → "Lǎobǎn" over 老闆 with the word underlined; 21b: Tâi-lô only for the Taiwanese reading with the Mandarin beside it, "Oyster omelette"; 24: "Excuse, pretext", the "常忘 keeps slipping · forgotten 4×" badge that tells the learner why this card is back, "藉口 is the Taiwan standard spelling; 借口 is what most people type online."; rating: "How well did you *read* it? 讀得如何？" with the full rubric on the coach reveal (03) and "Hard = slow, or only part of it · rate the reading, not the word" plus "?" afterwards (21b, 24); the first reveal is paced ("2.2s to answer" on 03). No card with a 備註 note is revealed, so the 💡 line is unseen; the field exists (19 "Note 備註 — A usage note or mnemonic, shown after the reveal").

## (c) New findings (ordered by severity)

- [minor] [10-drill-menu-slip, 11-drill-menu-result] The breakfast slip can be solved without reading — 主食 holds 飯團 50 · 火腿蛋吐司 40 · 蛋餅 35 and 飲料 holds 珍珠奶茶 55 · 豆漿 25 · 鮮奶茶 60; "fàn tuán" shares no character with either neighbour, the two 2-character 主食 rows are the two 2-syllable targets, and the one 4-character drink is the 4-syllable target. A learner counting syllables scores 3/3 under the 20-second timer and the app tells them "In review — no change" as if they had read. The venue-first design is right; the template is thin. Suggest: give the 早餐店 template a character-sharing and a same-length non-target for every target (紫米飯糰 or 鮪魚飯糰; 漢堡／饅頭／吐司 as 2-character non-targets; 冬瓜奶茶 as a 4-character drink; 起司蛋餅／蘿蔔糕／蔥抓餅), floor slips at 8 rows, and make the neighbour test iterate over every template's targets with a same-length check, not only the 小吃店 ones.

- [minor] [23-learn-dark, 08-learn-after-session, 24-study-revealed-dark] "18 answers today" does not move after a resumed session answers a card — 08 shows "18 answers today · Reviews · 1 done today"; 23, after the 2-card session has answered 蚵仔煎 (23 "1 card left", 24 "Card 2 of 2 · resumed"), still shows "18 answers today" while Reviews became "1/30". Either the answer count is stale or "1 card left" counts an unanswered card; and the "1 done" on 08, on a day that opened with "0 reviews" due (01), still has no visible source. It is the fourth round with a counter that drifts between adjacent screens, and even if the hand-restored cards in the walkthrough caused it, a learner cannot tell. Suggest: derive `answersToday()` and `reviewsDoneToday()` from the review log alone (a "review" = a rating on a card that was due at session start, never an in-session repeat), consume them on the summary and the dashboard, and add the e2e assertion "after every pause, dashboard answers == summary answers" for a resumed session too; when something was due, show "Reviews · 1 due · 1 done" instead of "/30".

- [minor] [09-drills-tab, 10/11/11b] Questions = 5, the Order Slip runs 4 — the launcher's number is now honoured by Spot the Character and Fill the Blank ("1 of 5") but the slip says "1 of 4", presumably ⌈10 studied dishes ÷ 3⌉, and 09 gives no hint of a cap ("Food words only · each slip asks for up to 3 dishes."). The first number the learner chose is still contradicted by the second screen, on one drill of three. Suggest: under the Order Slip card, "10 dishes ready · 4 slips" (or relabel the control "Slips" when the slip is chosen), and honour 5 whenever the pool allows.

- [minor] [11b-drill-menu-wrong-size] "Not quite." for a slip read 3 of 3 right — the strip says "3 of 3 read right · 1 wrong size (no penalty)" under "老闆娘：欸，你是不是點錯了？ Not quite.", and the summary is headed, in red, "Not quite. The order was …" over three green ticks. The learner did the reading task perfectly and the verdict tone says they failed; the one moment that decides whether they trust the grading sends a mixed message. Suggest: a third verdict tier in amber — "讀對了，份量點錯 · Read right, wrong size (no penalty)" — keep the 老闆娘 line, and head the summary "All read right — check the size column".

- [minor] [21-stats] The leech row's "reading" pill hides "jiè kǒu" while the next line prints "藉 jiè … 口 kǒu" — the reading the pill withholds is on screen anyway, so the try-to-read-it-first intent of plan item 7 is defeated the moment the eye drops one line. Not a prompt, so not a rule violation, but a contradiction on the one row built for the learner's hardest word. Suggest: show the character glosses without pinyin until the pill is tapped (藉 "to rely on; excuse" · 口 "mouth"), then reveal both.

- [nit] [07-session-complete] "ANSWERS 18 · 17 cards · 1 drill item" under "WORDS SEEN 10" — "17 cards" reads as seventeen cards on a ten-card session. Suggest: "17 on cards (10 words + 7 repeats) · 1 drill".

- [nit] [04-study-drill-menu] Prices invert reality on 麵類 — 牛肉湯麵 70/85 costs more than 牛肉麵 55/70, and 大滷麵 65 more than 牛肉麵; on any real 小吃店 slip the meatless 湯麵 is the cheap row. A heritage reader who knows the shops will notice before they notice the characters. Suggest: 牛肉麵 120/150, 牛肉湯麵 60/80, 大滷麵 60/75 in the per-dish price table.

- [nit] [05-session-paused] "Tomorrow 明天: 1 review due" is forecast mid-session — 6 cards, including the re-queued 滷肉飯, are still to be rated and their ratings will change tomorrow's number (07 and 08 agree with 05 only because the session was then finished). Suggest: "So far, tomorrow: 1 review" on the paused summary, or keep the forecast for the complete summary only.

- [nit] [16-drill-cloze-misread, 10-drill-menu-slip, 11-drill-menu-result] Copy residue in definitions — 16 keeps "(the warning tag on PTT / Dcard threads)" inside the 有雷 definition although a 備註 field now exists for exactly that; 10 truncates "Taiwanese rice roll (with youtiao, pickled r…" on the cue strip; 11's filler gloss is lower-case "fresh milk tea" beside the deck's capitalised glosses. Suggest: move the PTT/Dcard note to Note; a short gloss for the cue ("Rice roll"); capitalise filler glosses.

- [nit] [03-study-revealed, 24-study-revealed-dark] The rating footer still clips the panel — carried from round 3, not in the patch set: 03 cuts the translation, 24 halves the "Show all readings 拼音" pill; 21b shows the intended layout. Suggest as before: bottom padding equal to the measured footer height and scroll the example into view on reveal.

- [nit] [20-import-preview] Duplicate and repeated rows are still colour-only — carried; an inline "already in deck" / "repeated in file" tag would match the slip's tagged rows.

## (d) Score and judgement

Overall score: 8.5/10 — Both round-3 majors are gone and the loop's numbers now reconcile on the screens a learner actually walks (6/6 on pause and resume, 18 = 17 + 1, 95 = 84 + 11, 22/22/29/22, 94 % = 17/18, "Flag after 3" = "forgotten ≥ 3×" = "forgotten 4×" = "1 keep slipping"), the slip is venue-first with wrong-size grading and a variant chip, the leech remedy is answerable, definitions are meaning-only and Taiwanese is Tâi-lô everywhere it appears; what remains is data (a breakfast template solvable by syllable count), one stale counter on a resumed session and copy tone.

Converged? **Yes** — I would ship tomorrow. Nothing new changes what ships: 飯糰's neighbours, the slip count and the 11b verdict are same-day data/copy fixes, and none touches a design. The one pre-release check I would insist on, short of a blocker, is 23's "18 answers today": run the pause → dashboard assertion on a resumed session and confirm the count moves; if it is a walkthrough artifact, note it in the log, and if not, it is a one-function fix.

## (e) Keep doing

- Pinyin behind a tap everywhere, including per-word sentence readings (03b "Lǎobǎn" only after the tap); the Settings line "Pinyin is never shown with the prompt" reads as a principle.
- The loop's spine with numbers that agree: Pause (6 left) → Resume (6 left, ≈ 5 min) → Daily goal reached (18 = 17 + 1) → Done for today ✓ (Tomorrow: 1 review · up to 10 new · ≈ 8 min) → "🔥 Day 1 ✓".
- The slip result: verdict where the learner is looking, 漏點／點錯／份量 tags with readings open, "= 滷肉飯" on a variant row, "you wanted 珍珠奶茶", "+ Add to deck", and "In review — no change; a miss would bring it back sooner."
- Spot the Character's contrast card with readings, glosses and a tell ("貢 is 工 over 貝"), then a reshuffled retry under a sound-only instruction; the leech row's "Practice this word" now lands on four tiles that can be told apart.
- Fill the Blank's "right reading, wrong word here" with the translation as a second cue and "No change to its schedule".
- The reveal for this learner: meaning-only definitions, the variant line, "肉 ròu · 2 more words" that expands to the two words, ô-á-tsian with the Mandarin beside it, and the "常忘 keeps slipping · forgotten 4×" badge on the card that keeps coming back.
- One bilingual state vocabulary across Vocab rows, the editor and the Stats legend; "started · solid · not started" for mastery; "Shows after 7 study days · 1 so far" under both gauges; "Dark" that is visibly selected.
