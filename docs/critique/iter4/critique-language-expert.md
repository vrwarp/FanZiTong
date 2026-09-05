# 繁字通 FanZiTong — round-4 verification critique (language / learning-effectiveness lens)

Lens unchanged: does each screen force the shape → known sound/meaning link to be retrieved, is feedback delivered at the grain where the error lives (the character), what evidence does each answer give about that binding, and what does the scheduler do with it. Judged from the iter4 captures only. All 29 captures listed in `context.md` were present this time, including the two that were missing in round 3 (11b, 21b), so nothing in statements 3 and 5 is left to inference.

Pinyin rule: honoured on every prompt face — 02 (character only, no domain chip), 15 (cloze sentence and four character tiles, nothing romanised), 18 ("Show pinyin" unchecked by default), 24 (the leech's prompt half is bare; the 常忘 chip sits in the answer panel). The only romanisation before an attempt is the sanctioned sound + meaning cue of the Order Slip (04, 10) and Spot the Character (12, 14, 21c). Tile readings appear only for a picked tile or on tap (16, 17); the sentence reading is per word on tap (03b) or behind "Show all readings 拼音" (17, 21b, 24). No violation.

## (a) Round-3 ledger

Section (c) of `critique/iter3/critique-language-expert.md`, in order, then the clauses that failed in its section (b).

1. **[major] The character tell was missing on the foil card and the cloze look-alike tag — FIXED for the captured pairs.** 13: "不對 — look at the 1st character · you picked 貞丸湯 → the word is 貢丸湯 · 貞 zhēn "chaste" is not 貢 gòng "tribute" · 貢 is 工 over 貝" — readings, glosses and a component note, the shape of the line that made this the best screen in round 2. 17: 恩曲 is tagged "形近 look-alike · 曲 qū "bent; (qǔ) song"". The two pairs I named in round 3 (午/牛, 正/證) were not re-captured, and 21c is the prompt face only, so the leech pair's tell and the build-time coverage test for every `visualFoils` entry cannot be verified from screens.

2. **[major] 便當 without a neighbour, in the wrong section at the wrong price; 16 rows — FIXED as far as visible; the 便當店 template itself CANNOT VERIFY.** Slips are venue-first now: 阿婆小吃店 with 飯類 / 麵類 / 湯類 / 小菜, 小·大 columns only where sizes exist and a single √ for soups and sides (04, 11b); 阿姨早餐店 with 主食 / 飲料 and a single √ (10). 11b has at most 12 rows, 10 has 6, 04's first seven fit above the fold. Prices follow the per-dish table (珍珠奶茶 55, 鮮奶茶 60, 豆漿 25 as planned; 海帶 25, 嘴邊肉 70, 皮蛋豆腐 40 are the small dishes a real 小吃店 lists). 便當 is not ordered on any captured slip; 18 now glosses it "Bento / boxed lunch". The one neighbour that does not hold (飯糰, 10) and the beef-noodle prices are in (c).

3. **[major] The leech's third foil rendered as the headword — FIXED.** 21: "not 籍口 / 耤口 / 蓆口"; 21c: four distinct tiles 籍口 / 耤口 / 蓆口 / 藉口. Residual: the foils in the Stats row still carry no tells (nit in (c)).

4. **[minor] Mixed romanisation — FIXED on the captured surfaces; 阿雜 CANNOT VERIFY.** 19: "Only when people say it differently from the pinyin (e.g. ô-á-tsian for 蚵仔煎). Used as the drill cue." (Tâi-lô, was POJ); 21b: "ô-á-tsian · kē zǎi jiān". 阿雜's definition, which carried "(Taiwanese a-cha̍p)" in round 3, was not captured.

5. **[minor] Non-meaning parentheticals in definitions; no notes field — PARTIAL.** Fixed: "Braised minced pork over rice" (03, 04, 18, 19 — "staple" now lives in Tags), "Bento / boxed lunch" (18), "Excuse, pretext" (21, 21c, 24), "Oyster omelette" (21b); the slip cue is no longer truncated for 滷肉飯 (04); Note 備註 exists with the hint "A usage note or mnemonic, shown after the reveal (e.g. "spells the sound of Taiwanese 毋通")" (19); the leech definition wraps instead of truncating (21). Remaining: 飯糰's definition "Taiwanese rice roll (with youtiao, pickled radish and pork floss)" (18) truncates the cue on 10 to "Taiwanese rice roll (with youtiao, pickled r…" — the meaning half of the sanctioned cue is cut again, which is precisely the harm the finding was about; and 有雷 "Contains spoilers (the warning tag on PTT / Dcard threads)" (16, 17) carries a usage note that makes the retired tile three lines tall. Both parentheticals are content rather than orthographic metadata, but both belong in Note 備註 now that it exists.

6. **[minor] "Cards left" 7 on the summary, 6 on the dashboard — FIXED.** 05 "還剩 6 張 · 6 cards left in this session" and 06 "6 cards left … ≈ 5 min" agree; 23 "1 card left … ≈ 1 min" matches 24 "Card 2 of 2".

7. **[minor] Counts the learner cannot reconstruct — PARTIAL.** 05 "Answers 5 · 5 cards · 0 drill items", 07 "Answers 18 · 17 cards · 1 drill item" and 08 "Reviews · 1 done today" are the planned copy. But 23 shows "Reviews 1/30" again — the denominator is the daily cap on a day when two reviews were due — and 07's "17 cards" against "Words seen 10" still leaves seven second looks unnamed.

8. **[minor] Two meanings of "learning" on Stats — FIXED.** 21: "10 started · 0 solid · 12 not started" under the caption ""Solid" = you'd still read it after a month."

9. **[minor] "Your ear for grammar rules out the rest" — FIXED.** 09: "Read a real sentence and pick the word that fits."; the tab lead-in now reads "a hit only speeds up words not yet in review."

10. **[nit] Sticky footer over the example sentence on first paint — PARTIAL.** 03: 老闆，滷肉飯大碗一碗，加一顆滷蛋。 is clear of the footer; the translation and the tap-a-word line still sit under the fade. Not in the patch set.

11. **[nit] "1 review due within a day — do them" / "Done for today" without its zh half — FIXED.** 05, 07: "Tomorrow 明天: 1 review due — do it to keep the streak."; 05: "Done for today 今天先這樣"; 07: "Back to Learn 回首頁".

12. **[nit] The different-length neighbour line could name the shared tail — NOT FIXED** (11: "xiān nǎi chá · fresh milk tea / you wanted 珍珠奶茶 zhēn zhū nǎi chá · Bubble (pearl) milk tea"). Not in the patch set; accepted.

Residual from round-3 section (a): the promised notes field — FIXED (19).

Failed statement clauses from round-3 section (b):
- Statement 2, one definition of "left" — **FIXED** (05 = 06 = 6 cards).
- Statement 3, the neighbour guarantee — **FIXED for five of the six captured target placements** (04: 貢丸湯 ↔ 魚丸湯, 牛肉麵 ↔ 牛肉湯麵 / 大滷麵, 滷肉飯 ↔ 肉燥飯 / 排骨飯; 11b: 魯肉飯 ↔ 鴨肉飯, 牛肉麵 ↔ 榨菜肉絲麵 / 陽春麵, 貢丸湯 ↔ 魚丸湯; 10: 珍珠奶茶 ↔ 鮮奶茶, 蛋餅 ↔ 火腿蛋吐司), **NOT FIXED for 飯糰 on 10** (new finding, (c)).
- Statement 3, realism — **FIXED** (real shops, real sections, size columns only where sizes exist, ≤ 12 rows), except the beef-noodle price pair (new finding, (c)).
- Statement 3, 份量 — **VERIFIED** (11b, below).
- Statement 3, ô-á-tsian — **VERIFIED on the reveal** (21b); the cue side **CANNOT VERIFY** (蚵仔煎 is not ordered on 04, 10 or 11b and is not the cue on 12 or 21c).
- Statement 5, romanisation — **FIXED** (19, 21b); definitions — **FIXED for every case named in round 3**; one new truncation (飯糰, 10; ledger item 5).

## (b) Statements 2, 3 and 5

**Statement 2 — one definition of "left" / "due": PASS.** Pause → 05 "6 cards left in this session — saved, even if you leave." → 06 "In progress · 6 cards left · Paused earlier today — pick up where you stopped. ≈ 5 min", with five answers on both (05 "Answers 5", 06 "5 answers today"). The count includes the unanswered current card and the Again card — 5 unseen + 滷肉飯 coming back, which 07 confirms under "One more look" and 19 confirms with three reviews on the card. "Due" is one number wherever it appears: 01 "0 reviews, 10 new cards · ≈ 8 min", 05/07 "Tomorrow 明天: 1 review due", 08 "Tomorrow 明天: 1 review · up to 10 new · ≈ 8 min". Residual nit: 23 "Reviews 1/30" is done-over-cap, not done-over-due.

**Statement 3 — the slip is a real shop with real confusions, a neighbour per ordered dish, a wrong-size tick with no penalty, ô-á-tsian in the cue/reveal: PASS on realism, on the wrong-size tick and on the reveal; PASS on the neighbour clause for five of six placements and FAIL for one; the cue-side ô-á-tsian and the 便當店 template CANNOT VERIFY.**
- Real shop: 阿婆小吃店 (04, 11b) — 飯類 / 麵類 / 湯類 / 小菜, 小·大 for rice and noodles, √ only for soups and sides, 內用／外帶 · 桌號 3; 阿姨早餐店 (10) — 主食 / 飲料, √ only. Every row is a dish a heritage eater has seen on a real slip (地瓜粥, 鴨肉飯, 榨菜肉絲麵, 陽春麵, 嘴邊肉, 皮蛋豆腐, 火腿蛋吐司). Blemish: 牛肉湯麵 70/85 above 牛肉麵 55/70 (04).
- Real confusions per ordered dish: 04 — 貢丸湯 beside 魚丸湯 (only 貢/魚 differs); 牛肉麵 beside 牛肉湯麵 and 大滷麵; 滷肉飯 beside 肉燥飯 and 排骨飯. 11b — 魯肉飯 beside 鴨肉飯; 牛肉麵 beside 榨菜肉絲麵 and 陽春麵; 貢丸湯 beside 魚丸湯. 10 — 珍珠奶茶 beside 鮮奶茶 (and the learner did tick 鮮奶茶 in 11: the neighbour works); 蛋餅 beside 火腿蛋吐司. But 飯糰 (printed 飯團) has no row sharing 飯 or 糰／團, and the only non-target in 主食 is five characters long — (c).
- The variant row, uncaptured in round 3, is now verified: 10/11 print 飯團 and grade "✅ 飯糰 fàn tuán — printed as 飯團 on this menu"; 11b prints 魯肉飯 with a "= 滷肉飯" chip and grades "printed as 魯肉飯 on this menu".
- Wrong size, no penalty: 11b — the 魯肉飯 row tagged "Wrong size 份量" with its reading opened ("lǔ ròu fàn · Braised minced pork over rice"), the strip "3 of 3 read right · 1 wrong size (no penalty) · tap a row for its reading", the summary "✅ 滷肉飯 (大) lǔ ròu fàn — printed as 魯肉飯 on this menu — right dish, wrong size column · In review 複習中 — no change; a miss would bring it back sooner." PASS; the headline copy is a finding in (c).
- Feedback at the character's grain on a real miss: 11 — 珍珠奶茶 "Missed 漏點" with its reading pushed open; 鮮奶茶 "Wrong 點錯 · xiān nǎi chá · fresh milk tea / you wanted 珍珠奶茶 zhēn zhū nǎi chá · Bubble (pearl) milk tea" with "+ Add to deck 加入"; per-target schedule lines ("In review 複習中 — no change; a miss would bring it back sooner." / "❌ 珍珠奶茶 … Again — it comes back sooner."); "Ticked by mistake: 鮮奶茶". PASS.
- ô-á-tsian: reveal PASS — 21b leads with "ô-á-tsian · kē zǎi jiān", then "Said the Taiwanese way; the Mandarin reading is what the characters spell.", and the definition is a plain "Oyster omelette". Cue CANNOT VERIFY — 蚵仔煎 is not ordered or cued on any capture, though the editor states the As-heard field is "Used as the drill cue" (19).

**Statement 5 — the reveal and the rating speak to this learner with meaning-only definitions, one romanisation, notes after the reveal: PASS on every captured clause; the 💡 note rendering CANNOT VERIFY.**
- Rating: "How well did you *read* it? 讀得如何？" with the latency (03 "2.2s to answer", 21b/24 "0.5s"), the full rubric above the question on the coach reveal (03) and the one-line reminder with ? afterwards (21b, 24: "Hard = slow, or only part of it · rate the reading, not the word"); "New here — try to read it first; a blank is fine. 先試著唸，唸不出來也沒關係" (02).
- Meaning-only definitions: "Braised minced pork over rice" (03, 04, 18, 19), "Bento / boxed lunch" (18), "Excuse, pretext" (21, 21c, 24), "Oyster omelette" (21b), "Pork meatball soup" (04, 12), "Grace" (17). The spelling fact lives only in the variant line now — 24 "也寫作 借口 · 藉口 is the Taiwan standard spelling; 借口 is what most people type online." with nothing repeated in the definition. Residuals: 飯糰 (10, 18) and 有雷 (16, 17) — descriptive, but the first one truncates the cue (ledger item 5).
- One romanisation: Tâi-lô leads on 21b and in the editor hint (19); Hanyu Pinyin everywhere else, and every reading I checked is right (kē zǎi jiān for 蚵仔煎 per MOE, gòng wán tāng, fàn tuán, dàn bǐng, ēn diǎn, jiè kǒu, zhēn "chaste", gòng "tribute", qū / qǔ for 曲). Nit: the tapped sentence word is "Lǎobǎn" (joined, capitalised) while headwords are "lǔ ròu fàn" (03b vs 03).
- Notes after the reveal: Note 備註 is in the editor with the promised hint (19); no captured card carries one, so the 💡 rendering cannot be verified. The two after-reveal notes that were captured — 21b's "Said the Taiwanese way…" and 24's spelling note — both sit below the reading and never on the prompt face.
- Chips: 03b "肉 ròu "meat" · also in 肉圓、牛肉麵" with 肉 underlined in the sentence; 21b/24 chips drop the "N more words" clause when there are none.

**Foil contrast cards (13, 21c) and the cloze look-alike tag (17).** 13: readings, glosses and a component tell — yes. 17: the look-alike tile reads and glosses the foil character (曲 qū "bent; (qǔ) song") — reading yes, tell half, because it never names 典 (nit in (c)). 21c: the leech's foil set is now four distinct words (籍口 / 耤口 / 蓆口 / 藉口); only the prompt face was captured, so the contrast card's tell for 籍 / 耤 / 蓆 cannot be verified, and the Stats row (21) still lists those foils without tells.

## (c) New findings

- [minor] [10-drill-menu-slip] **飯糰 is found by length, not by reading** — 主食 holds three rows: 飯團 (target), 蛋餅 (target) and 火腿蛋吐司. Nothing shares 飯 or 糰／團 with the first target, and the only non-target is five characters long, so both two-character rows can be ticked without either being read. That answer gives no evidence about the binding; the item is wasted for the two review-state cards in the capture, and for a card still in learning the false hit would advance it ("a hit only speeds up words not yet in review", 09). The neighbour test evidently passes on "another row in the section". Fix: require, per target, a non-target row of the same character count that shares a character — or failing that at least two non-target rows of the target's length in its section; fill the breakfast 主食 block from a real 早餐店 list (燒餅 shares 餅 with 蛋餅 at the same length; 蘿蔔糕, 饅頭, 漢堡, 吐司, 蔥抓餅; 紫米飯糰 or 飯捲 beside 飯糰); floor a slip at nine rows. Test: build a few hundred slips and assert the rule for every target.

- [minor] [04-study-drill-menu / 11b-drill-menu-wrong-size] **Beef-noodle prices break the shop** — 牛肉湯麵 (broth, no beef) is 70/85 while 牛肉麵 is 55/70, and 55 for a bowl of 牛肉麵 is a price from thirty years ago. The rest of the table is credible (滷肉飯 45/60, 陽春麵 35/45, 貢丸湯 30, 蛋餅 35), which is why this pair stands out. The drill's only cover story is "a real shop", and a heritage eater reads prices as fluently as anyone. Fix in the per-dish table: 牛肉麵 120/150, 牛肉湯麵 60/80; test two invariants — X湯麵 < X麵, 小 < 大.

- [minor] [11b-drill-menu-wrong-size] **The verdict grades the order while the details grade the reading** — the strip says "老闆娘：欸，你是不是點錯了？ Not quite." and the summary opens "Not quite. The order was …" above "3 of 3 read right · 1 wrong size (no penalty)" and three green ticks. The first thing the learner reads is that they failed, which is false for the skill the drill measures and for the number the scheduler used. Fix: when every dish is read right and only sizes differ, strip "老闆娘：大碗還是小碗？ All read right — check the size column" and summary "Read right — the size column was wrong"; keep "Not quite" for a missed or wrong dish.

- [nit] [17-drill-cloze-correct] **Half a tell on the look-alike tile** — "曲 qū "bent; (qǔ) song"" reads and glosses the foil character but never says what it is not; the learner has to work out that 典 is the character that differs. Use the foil card's sentence shape: "曲 qū "bent" is not 典 diǎn — 典 stands on 八".

- [nit] [21-stats] **The leech row's foils are bare** — "not 籍口 / 耤口 / 蓆口" with nothing after them, on the word the learner forgets most; the row is where they look after a lapse, before any drill. Add the tells the contrast card presumably holds: "籍 jí "register" — 竹 on top · 耤 jí — no radical · 蓆 xí "mat"".

- [nit] [03b-study-revealed-chip-and-word / 19-card-editor] **Two pinyin house styles** — headwords are syllable-spaced ("lǔ ròu fàn") while the tapped sentence word is joined and sentence-capitalised ("Lǎobǎn", straight from the sentence pinyin "Lǎobǎn, lǔròufàn dà wǎn yī wǎn, …"). Lowercase the tap label and space its syllables ("lǎo bǎn"); the spaced form is what lets the eye pair each syllable with its character.

- [nit] [23-learn-dark] **"Reviews 1/30"** — done over the daily cap while two reviews were due; 08 already uses "Reviews · 1 done today" for the nothing-due case. Show done over due ("Reviews 1/2") when something is due.

- [nit] [09-drills-tab / 10-drill-menu-slip] **Questions 5, header "1 of 4"** — if the selector was left at 5, the slip drill silently built four. Say what it built ("4 slips from your food words") or relabel the selector "Slips" for this drill.

## (d) Score and convergence

Overall score: 9/10 — every item in the round-4 patch set that a capture can show has landed and behaves as designed (the tell is back on the foil card, the leech's foils are four distinct words, definitions are meaning-only on every card captured, Tâi-lô leads on 蚵仔煎, the count agrees across the pause, the slips are venue-first with same-section confusables and a no-penalty size column), and what remains is one weak neighbour, one price pair and one verdict headline — lint, not learning design.

Converged? Mechanics: yes. Data: yes, narrowly — the single remaining gap is that the neighbour test passes on "another row in the section" rather than "a same-length row sharing a character" (飯糰 on 10), with two lints to add to the same build-time suite: X湯麵 < X麵 in the price table, and a length cap on definitions so the cue never truncates (飯糰). None of it needs another design pass or another critique round; a capture of the 母湯 reveal (the 💡 note) and a slip that orders 蚵仔煎 would close the two clauses I could not verify.

## (e) Keep doing

- The foil contrast card as it now reads (13): position, readings, glosses, a component tell, then the reshuffled, unmarked, sound-only retry (14). The foil set itself is exemplary — one substitution per tile, each a classic confusion (貞/貢, 九/丸, 場/湯; 籍/耤/蓆 for 藉).
- Evidence-graded cloze: "right reading, wrong word here" with the tile retired and the translation as the second cue (16); "No change to its schedule — that was a reading of another word." (17); other-domain real words as distractors (15).
- The slip as a shop: venue-first sections, size columns only where sizes exist, variant spellings printed and graded as the same dish (10/11, 11b), the 份量 tag with no penalty (11b), readings pushed open on 漏點 / 點錯 rows with "you wanted …" and "+ Add to deck" (11).
- The reveal for this learner: "How well did you *read* it?" with latency and rubric (03, 21b, 24); "ô-á-tsian · kē zǎi jiān" with its one-line note (21b); variant lines that are true per card and definitions that are only meaning (24); chips that show a character's other words on tap and underline it in the sentence (03b).
- One count across pause and resume, "≈ N min" on the resume card, "N cards · M drill items" on the summaries (05, 06, 07), and the lapse rule holding (19: 3 / 0; 21: Forgotten 4 is the leech alone).
- Pinyin-rule compliance on every prompt face, including the Vocab list default (18) and the leech card (24).
