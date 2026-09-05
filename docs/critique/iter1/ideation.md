# 繁字通 FanZiTong — iter1 ideation: one plan from three critiques

Inputs: `critique-pm.md` (PM), `critique-language-expert.md` (LE), `critique-heritage-learner.md` (HL), screenshots 01–20. All three scored 6/10 and none found a pinyin-rule violation on a prompt. All three independently hit the same three failures: the order slip (character cue, duplicate row, red rows on a perfect result), the reveal (whole-sentence pinyin), and wrong-answer feedback (verification only). Those are fixed first, then trust (numbers, dark mode, naming), then content.

Conventions below: "traditional" = the card's canonical headword; "variants" = the new `variants[]` field; "charInfo" = the new bundled per-character table (item 6). Copy is given as `English 中文`; the app keeps its existing bilingual pattern (English first, Chinese after) unless stated.

---

## A. Consensus (raised by 2+ reviewers)

1. Order slip prints 蛋餅 twice and grades the second copy as wrong; untouched look-alike rows turn red under a "Perfect order" verdict — PM, LE, HL.
2. Order slip cue is written in the very characters to be found, so it is string-matching, not reading — PM, LE (HL praises the slip but does not defend the cue).
3. Order line, timer and Submit scroll out of view on a 20-second task — PM, HL.
4. 魯肉飯 (and 借口) are real Taiwan spellings trained as wrong answers — LE (major), HL (blocker).
5. Example-sentence pinyin is fully visible at reveal, so the eyes skip the characters; target word not highlighted there — LE, HL.
6. Wrong-pick feedback names the answer but not the differing character (內 vs 肉) — PM, LE, HL.
7. Cloze options are the foil drill's look-alikes, so the sentence is decoration; blank is always two slots; "Pick the character" for multi-character words — PM, LE, HL.
8. Rating buttons carry no question and no rubric; Again and Hard both show "<10m" — PM, LE, HL.
9. Dark theme renders in the light palette — PM, HL (LE: noted, out of scope).
10. Numbers disagree: RETENTION 80% vs 100% / 99% RECALL; "Reviews 5/30" after five new cards; "Time 2s"; percentages at n = 5 — PM, HL, LE.
11. SRS/teacher jargon on daily screens: FSRS, leeches, lapses, retrievability, realia, Cloze Generator — PM, HL.
12. First launch: offline toast covers YOUR DECK; "🔥 Day 0" — PM, HL.
13. Session end is a dead end: no "what's next", no continue path, no consolidation of weak items — PM, LE (HL: the numbers on it).
14. Each drill has three names; "All active don" truncation; doubled exits; three progress formats — PM, HL.
15. Vocab list truncates definitions to ~15 characters — PM, HL.
16. Drill results should not feed FSRS as if they were recall; the "feeds your FSRS schedule" line needs rewording — LE (mapping), PM (copy).

Single-reviewer findings that still made the plan: character-level layer and confusable-aware feedback (LE); slang audit 劇透→雷, 俚語 label, Zhuyin-as-slang cards (HL); Taiwan voice (HL); shop-type slips, prices, 楷體/明體 (HL); domain chip shown before reveal (LE); thumb-zone tiles and whole-screen tap (HL); destructive buttons and backup reminder (PM).

---

## B. Conflicts and resolutions

**B1. How the order slip cues: characters (today) vs meaning (PM) vs sound + meaning (LE).**
Resolution: sound + meaning, exactly like the foil drill — `朋友說 Your friend says: lǔ ròu fàn (xiǎo) · dàn bǐng · ô-á-tsian` with the English gloss line beneath. No Chinese characters for the ordered items anywhere in the cue. Reasoning: this is the sanctioned exception (the learner receives what is in their head and must find the shape); meaning-only adds a translation step the real counter never has ("braised pork rice" → lǔ ròu fàn → shape), and sound disambiguates near-synonyms (蚵仔煎 vs 蚵仔炸 is not an English distinction). The slip's own rows never show pinyin before grading, so the rule is intact: the only pinyin on screen belongs to the cue, and the character prompt (the slip) still has to be read.

**B2. How variants like 魯肉飯 behave in each drill (HL: slip may use either spelling as correct; LE: accept with a note or make it a deliberate "same dish" test).**
Resolution, per surface:

- Data: `variants?: string[]` on Card ("Also written 也寫作"). Variants are accepted forms, never distractors, anywhere.
- Foil drill: canonical form is always the correct tile; variants are filtered out of the foil pool at generation time (even if a hand-authored foil field contains one). After answering, the feedback card adds "也寫作 魯肉飯 · common on signs".
- Cloze: canonical is the correct tile; distractors are other deck words (B4) so variants cannot collide; same post-answer note.
- Order slip: exactly one accepted form of each target is printed, chosen at random (canonical 60 % / a variant 40 %); ticking it is correct; the result row gets a tag "也寫作 滷肉飯 · this shop spells it 魯". A variant never appears as a trap row, and the dedupe set (item 1) includes every target's variants.
- Search, import duplicate detection and the Vocab row all treat variants as the same card.
  Reasoning: the slip is the realia surface where spelling variation actually occurs, so that is where the learner should meet it; keeping the foil and cloze tiles canonical avoids the "two correct tiles" bug and keeps the shape drill about shape.

**B3. Is 鹵肉飯 an acceptable foil? (HL: yes, you never see 鹵 on a sign; LE: 鹵 is an attested form in converted text.)**
Resolution: no attested spelling of the target — in any region's convention — may be a foil. Foils must be unambiguously wrong strings (a wrong character or a non-word). Replace 鹵肉飯 with 滷肉販 (販 fàn, homophone, 貝 not 食) or 鹽肉飯 (shares the 鹵 component). Reasoning: a foil teaches "this is not lǔ ròu fàn", and for 鹵肉飯 that statement is false; the learner reads reposted mainland text on PTT and Bilibili subtitles. HL's point that it is low-stakes is granted — it is a cheap rule to apply deck-wide and it removes the ambiguity forever.

**B4. Cloze distractors: one real word that fits grammar but not the sentence (PM) vs all same-domain deck words (LE).**
Resolution: 4 tiles = the correct word + 2 same-domain deck words + 1 visual foil of the correct word (3 deck words if the card has no foils). Reasoning: two readable real words make the sentence necessary (the learner must read it to exclude 牛肉麵), and the single foil keeps the shape-discrimination demand that is this learner's actual bottleneck. Both reviewers' goals are met in one option set.

**B5. Drill results → scheduling (today: Good/Again; LE: asymmetric).**
Resolution: wrong → Again for any state; right → Good only when the card is New/Learning/Relearning; right on a Review-state card → no FSRS change, logged as `applied: "none"` (counts as an answer today, not in retention). Reasoning: a 4-tile hit has a 25 % guess floor and recognition is weaker evidence than recall, so a hit should never push a stable card's interval out; a miss is strong evidence and should bring the card back. Also verify lapses only increment on Again for Review-state cards (ts-fsrs default) so learning-step and drill Agains on New/Learning cards cannot create a leech overnight (LE/HL).

**B6. Slip length: trim to ~12 rows (PM) vs richer, more realistic slips with 湯類 and prices (HL).**
Resolution: both — shop-type templates of 12–14 rows in 3–4 sections with prices, plus a pinned cue/timer strip and a pinned Submit bar. Reasoning: PM's complaint is really about the timer and Submit scrolling away, which pinning solves; HL's realism adds a section but the templates cap total rows.

**B7. Reveal latency: enforce a minimum dwell and nudge toward Hard (LE) vs frictionless whole-screen tap (HL).**
Resolution: measure and log `revealMs` and `rateMs`, show the latency next to the rating question, no enforcement, no nudge yet. Reasoning: an enforced dwell fights "Rapid Recognition" and feels broken on a phone; the data is cheap to collect now and a calibrated nudge can be designed once we see real distributions.

**B8. Domain chip before reveal: hide it (LE) vs show it consistently on drills too (PM).**
Resolution: never on a prompt face; always in the answer/feedback panel, on cards and drills alike. Reasoning: the chip is a retrieval cue that no sign or LINE thread carries; PM's consistency goal is met by giving every answer panel the chip.

**B9. Offline/install toast: dashboard row (PM) vs bottom snackbar or Settings (HL).**
Resolution: the first-launch slot goes to a one-time "How this works" card (the method, not the app); install hint becomes a dismissable row under YOUR DECK worded for benefit; the service-worker "ready" becomes a 3-second buttonless snackbar. Reasoning: the first ten seconds should explain why pinyin is hidden — that is the question the learner actually has on screen 02.

**B10. Sentence pinyin: reuse the reveal-delay setting (HL) vs tap-only.**
Resolution: tap-only, always, via a small `拼音 Reading` pill; the delay setting governs the headword only. Reasoning: the sentence is the learner's one connected-text retrieval per card; auto-revealing it on a timer recreates the exact failure the rule prevents.

**B11. Zhuyin slang cards (HL) vs "learner does not read Zhuyin".**
Resolution: allowed, as content. ㄏㄏ / ㄎㄎ / 頗ㄏ are what PTT writes; the prompt is the string itself, pinyin (hē hē…) is tap-to-reveal like any card. Zhuyin never appears as an annotation on any other card.

**B12. 藉口 belongs in a 常用字 bucket (HL) vs the five fixed domains.**
Resolution: stays in `slang`, which is relabelled "Slang 網路用語" and described as internet + everyday chat; 藉口 gets tag `日常口語`, definition "Excuse", variants [借口]. No sixth domain (PRD).

**B13. When to show memory metrics: "Study to start tracking" on day one (PM) vs hide until a week of data (HL).**
Resolution: hidden with the caption "Shows after 7 study days 練滿 7 天就會出現" until there are ≥ 7 distinct study days; then shown. Reasoning: at n = 5 every percentage is noise and reads as a verdict.

**B14. Today bar: rename to "Answers today" (PM option) vs count new under New only (HL).**
Resolution: "Reviews" counts only due (non-new) cards answered; "New" counts new cards introduced; answers-with-repeats live on the summary. One neutral colour for both bars.

**B15. Rating rubric: permanent anchors under every button (LE) vs a one-time coach strip (PM).**
Resolution: a permanent one-line question above the row, a coach strip on the first three reveals ever, and a "?" that reopens it. Four permanent anchors do not fit a 390-px row.

---

## C. Ranked backlog for this iteration

Order: bug fixes and pedagogy-critical items first, then impact-per-effort. Effort: S ≤ half a day, M ≈ 1–2 days, L > 2 days.

### 1. Order slip integrity: dedupe rows, honest result colouring, size grading — S

Addresses A1; HL major, PM major, LE major.

- Build rows against a `taken: Set<string>` seeded with every target's traditional and variants. A candidate foil/filler row is skipped if it is in `taken` or already placed in any section; each target appears exactly once, in one section. Assert no duplicates in dev.
- Result colouring: correctly ticked target → green row + ✓; target not ticked → amber row, empty box outlined, tag `Missed 漏點`; wrongly ticked row → red row, tag `Wrong 點錯`; untouched look-alike rows → no tint, small grey tag `look-alike 形近`; untouched filler → unchanged.
- Right dish, wrong size (大 ticked for 小) → the ticked box red, the correct box amber; verdict `Right dish, wrong size 對的菜，錯的份量`; that target is graded wrong.
- Verdict `Perfect order` only when zero misses and zero wrong ticks. Timer expiry auto-submits with verdict `Time's up 時間到`.

### 2. Dark theme actually dark — S

Addresses A9.

- Verify `data-theme` is written to `<html>` on toggle and persisted; "System" follows `prefers-color-scheme`; the three Theme buttons reflect the stored value (capture 18 shows System selected while 19/20 are labelled dark — either persistence or the capture is wrong; test with Playwright `emulateMedia({ colorScheme: 'dark' })` and with the explicit Dark button, both must produce a dark study card).
- Palette: page `#1c1917`, cards `#292524`, text `#f5f5f4`, headword glyph `#fafaf9` (warm, not pure black/white — HL); red accent desaturated one step; `color-scheme: dark` on root so native selects/inputs follow. Slip in dark mode uses dark paper `#2b2523` with the same red rules (a white slip at 11 pm is the flashlight HL describes).

### 3. Accepted spelling variants + starter-deck corrections — M

Addresses A4, B2, B3; HL blocker.

- Card: `variants?: string[]`, `notes?: string` (free-text mnemonic, shown on reveal under the definition, editable). Editor: field `Also written 也寫作` directly under Traditional, helper: "Other spellings you'll see on signs and online (e.g. 魯肉飯 for 滷肉飯). Separate with |. Never used as wrong answers." Foil helper becomes: "Wrong look-alikes only, separated with | (e.g. 滷內飯 | 滷肉販). Real alternative spellings go under Also written."
- CSV column `variants` and `notes`; JSON keys the same; export round-trips them. Import duplicate check: a row whose traditional equals an existing card's traditional or variant is flagged `Variant of 滷肉飯`.
- Generation guard (one helper used by foil drill, cloze and slip): drop any candidate string ∈ traditional ∪ variants of the target, and any candidate that equals another deck card's traditional/variant unless that card is the intended distractor.
- Reveal and all feedback cards: line `也寫作 魯肉飯 · also written this way on many signs` when variants exist.
- Vocab row: sub-line `也寫作 魯肉飯`; search matches variants.
- Starter deck edits: 滷肉飯 variants [魯肉飯], foils [滷內飯 | 滷肉販 | 鹽肉飯]; 藉口 definition "Excuse", variants [借口], tags + `日常口語`; if present as cards: 鹹酥雞 [鹽酥雞], 肉燥飯 [肉臊飯], 焢肉飯 [爌肉飯]. Sweep every card's foils for attested spellings (B3) and move them to variants or delete them.

### 4. Order slip cue = sound + meaning, pinned strip, post-grade reveal — M

Addresses A2, A3, B1; PM, LE, HL majors. Depends on 1 and 3.

- Pinned top strip (sticky under the app header, ~92 px): label `朋友說 Your friend says:`; line 2 large: the targets' pinyin with tone marks joined by `·`, size in parentheses `(xiǎo)` / `(dà)`; line 3 small grey: English glosses joined by `·`, `(small)` / `(large)`; line 4: timer bar + seconds, bar turns amber under 5 s. No Chinese characters for ordered items anywhere in the strip.
- Pinned bottom bar: `Ticked 已點 2 / 3` + `Submit order 送單`. Submit enabled at 0 ticks (submitting nothing is a valid wrong answer).
- Slip rows show characters only until grading. After grading every row becomes tappable and expands one line: pinyin + gloss (deck cards from the card; filler rows from the bundled filler table, which must carry `pinyin` and `gloss`), plus `+ Add to deck 加入詞彙` on filler rows not in the deck (creates a food card with pinyin, definition, tag `小吃店`, no sentence).
- Copy at the top of the screen: `Order Slip 點菜單 — tick what your friend ordered before the timer runs out.`
- Timer stays 20 s (a constant); grading is per target as today (item 8 defines the FSRS effect).

### 5. Reveal panel: sentence pinyin behind a tap, target highlight, chip moved, per-character tap — M

Addresses A5, B8, B10; LE major, HL major, LE character-level.

- Prompt face: no domain chip; a small state chip instead (`New 新` for New, `Relearning 重學` for Relearning, none otherwise). Copy under the glyphs: `Say it in your head, then tap anywhere to check 先在心裡唸出來，再點一下看答案`; the whole area below the header is the tap target (merge the second card into the prompt card).
- Answer panel order: pinyin (large) → definition → `也寫作 …` (if any) → `notes` (if any) → domain chip (small) → divider → `例句 Example` → sentence in characters with every occurrence of traditional or a variant highlighted (reuse the green underline from screen 13) → English translation → pill `拼音 Reading` that reveals the sentence pinyin inline (grey); state resets on every card; no delay-based auto-reveal for the sentence.
- Per-character tap (after reveal only): each headword glyph is a button; tapping opens a popover under the card: `滷 lǔ · brine, braise · also in 滷蛋、滷味`. Reading = the card's pinyin split on whitespace when token count equals character count, else omitted; gloss from charInfo when present, else omitted; "also in" = up to 4 other deck cards whose traditional or variants contain the character. Tap again or tap elsewhere to close.

### 6. Shared feedback card with character-level contrast + charInfo table — M

Addresses A6, A16 copy, B5 copy; PM, LE, HL majors.

- Bundled `charInfo.ts`: `Record<string, { pinyin: string; gloss: string; tell?: string }>` covering every character in starter headwords and every character that appears in a starter foil but not in its headword (~250 entries). Author `tell` for at least: 內/肉 "肉 has two 人 stacked inside; 內 has one 入"; 師/帥 "師 has the extra 𠂤 on the left; 帥 is bare"; 牧/收/枚 "牧 starts with 牛, 收 with 丩, 枚 with 木"; 藉/借 "藉 wears 艹 over 耒; 借 is 亻+ 昔"; 己/已/巳 "the left gap closes: 己 open, 已 half, 巳 shut"; 未/末 "未 short top stroke, 末 long"; 燥/躁 "火 dry vs 足 restless"; 旦/蛋 "蛋 has 疋 on top"; 面/麵 "麵 has 麥 on the left"; 滷/鹵 "滷 adds 氵"; 煎/炸 "煎 has 灬 underneath; 炸 has 火 beside 乍"; 飯/販 "食 to eat vs 貝 to sell".
- One `FeedbackCard` used by foil drill and cloze (slip keeps its checklist but shares rows 1 and 5):
  1. Verdict: correct → rotating `答對了！ Correct` / `就是這個！` / `讚！`; wrong → `不對 — 答案是 滷肉飯` (`Not this one — the answer is …`).
  2. The correct word at tile size with pinyin + definition beneath.
  3. Why (wrong only): chosen and correct words side by side at tile size, differing position(s) outlined red on the chosen, green on the correct; line `第 2 個字：你選了 內 nèi「inside」，正確是 肉 ròu「meat」` + `tell` if present. Same-length strings diff positionally; different lengths highlight the whole word and skip the line. Missing charInfo → `differs at character 2: 內 vs 肉` without gloss.
  4. Example: sentence with target highlighted + English; pinyin behind the same `拼音 Reading` pill (also fixes the cloze-correct card exposing sentence pinyin).
  5. Schedule: `Schedule 排程: comes back sooner (Again)` / `Good · next in 10m` / `unchanged — drills only move words you're still learning`.
- Wrong pick: the correct tile pulses; Continue is disabled with `Tap the correct one to continue 點一下正確答案`; enabled after the tap. The missed item is appended once to the end of the drill queue; the second attempt is logged as practice and does not re-rate.
- Log `chosen` (the picked string) on every drill answer so leech remediation (D) has data.

### 7. Cloze that requires reading the sentence — M

Addresses A7, B4; PM minor, LE major, HL nits.

- Options: correct + 2 same-domain deck words (not present in the sentence, not variants of anything on screen) + 1 visual foil of the correct word; 3 deck words if the card has no foils; fill from all domains when the domain has < 3 other cards (custom). Shuffle; drop the A–D letters (the foil drill has none).
- Blank: `＿` repeated `traditional.length` times, inline, no spaces before or after; the filled answer renders inline (fixes "牧師 和師母").
- Mid-session drill selection: prefer a learning card not shown in the last 3 positions; if none, run the foil drill instead of a cloze on a just-seen sentence.
- Copy: header `Which word fits? 哪個詞填得進去？`; delete the "Pick the character that fits." hint card; Continue hidden until an answer is chosen.
- Post-answer: each unchosen deck-word tile shows small pinyin + gloss beneath it (a free retrieval per tile); the foil tile shows `look-alike 形近`; the chosen tile gets the FeedbackCard.
- Drills-tab description: `Read the sentence and pick the word that fits.`

### 8. Drill → FSRS mapping and lapse rule — S

Addresses A16, B5.

- `rateFromDrill(card, correct)`: wrong → Again; correct and state ∈ {New, Learning, Relearning} → Good; correct and Review → no rating. Review-log gains `source: 'session' | 'drill:foil' | 'drill:cloze' | 'drill:slip'` and `applied: 'again' | 'good' | 'none'`; `applied: 'none'` entries count toward answers today but not toward retention or Reviews.
- Slip: per target — ticked with the right size → correct; missed, wrong row, or wrong size → wrong; extra ticks on rows that are not a target's foil affect the verdict only.
- Verify leech = `card.lapses ≥ threshold` where lapses increment only on Again for a Review-state card (if the count is derived from logs, filter to logs whose pre-state was Review).
- Drills tab subtitle: `Extra practice 額外練習 — a miss brings the word back sooner; a hit only moves words you're still learning.`

### 9. Rating rubric, coach strip, duplicate-interval labels, latency logging — S

Addresses A8, B7, B15.

- Above the buttons: `How well did you read it? 讀得如何？` with the reveal latency small grey at the right (`4.2 s`) and a `?` that opens the rubric.
- Coach strip (first three reveals ever, `ratingCoachSeen` counter in settings, dismissable ✕): `Again = it didn't come · Hard = slow, or only part of it · Good = sound and meaning came · Easy = instant, like a chat message`.
- When two adjacent buttons format to the same interval, the lower one shows words instead: Again → `relearn now 重來`, Hard → `again soon 稍後`, Good → `later 稍後`; Easy always keeps its interval.
- Log `revealMs` (card shown → tap) and `rateMs` (tap → rating) on session answers. No minimum dwell.

### 10. Session summary that closes the loop + all-done dashboard — M

Addresses A13, A10 (summary tiles); PM major, LE minor, HL minor.

- Variant A (queue empty for today): title `Done for today 今天練完了`, subtitle rotating `讚啦！` / `太強了！` / `辛苦了！`. Variant B (due or new cards remain): title `Good stop 先到這裡`, subtitle `5 new words still available today`, primary `Continue (≈ 4 min) 繼續`, secondary `Done for today 今天先這樣`.
- Tiles: `Words 5` · `Answers 7 (incl. repeats)` · `First try 4 of 5` (fraction only; add the % only when ≥ 10) · `Time 3 min` (real active time; `45 s` under a minute).
- `Look again 再看一次`: cards rated Again/Hard this session as large characters, no pinyin, each tap-to-reveal pinyin + gloss inline, max 8, caption `Read these once more before you go — tap to check.`
- Next appointment: `Tomorrow 明天: 5 reviews due · keeps the streak 🔥` (cards due ≤ tomorrow 23:59 local); if none: `Nothing due tomorrow — new words will be waiting.` Streak line: `🔥 Day 1 · any answered card keeps it alive` (streak = consecutive local days with ≥ 1 logged answer, drills included).
- Dashboard all-done state: CTA becomes outlined `Done for today ✓ 今天完成` with sub `Tomorrow: 5 reviews · ≈ 4 min`; secondary link `Extra practice 額外練習 →` (Drills).

### 11. One set of numbers, plain language everywhere — M

Addresses A10, A11, B13, B14; PM major, HL minor, LE minor.

- `Recall now 現在記得` = mean retrievability of Review-state cards; the only name for it on dashboard ring and Stats hero; caption `Chance you'd remember a learned word right now`. Hidden (grey ring, `—`, `Shows after 7 study days 練滿 7 天就會出現`) until ≥ 7 distinct study days.
- `Not-Again rate, 30 days 30 天答對率` in Stats only, shown as `80% · 5 answers`, replaced by `Not enough answers yet` under 10.
- Today card: `Reviews 0/30` counts due cards answered; `New 5/10`; hide the Reviews row when nothing is due and nothing done; both bars the app green, `✓` at full.
- Domain progress: stacked bar per domain `Not started 22 · Learning 0 · Solid 0` (Solid = stability ≥ 30 d) with caption `Solid = you'd still read it after a month`.
- Glossary applied on every screen: lapses → `Forgotten 忘記`; leeches → `Keeps slipping 常忘` (section header `Keeps slipping 常忘 (leeches)` once); retrievability → `Recall now`; states `New 新 · Learning 學習中 · Review 複習中 · Relearning 重學`; Stats subtitle `How your memory is doing`; "FSRS" only in the Settings section header; "realia" and "Cloze Generator" removed.
- Editor memory panel for New cards: `Not studied yet 還沒學過`, stability/difficulty rows hidden.

### 12. First launch that explains the method — S

Addresses A12, B9; PM major, HL minor.

- One-time card above DUE TODAY: `How this works 怎麼用` — `1. You'll see a word in 繁體字. 2. Say it in your head — sound and meaning. 3. Tap to check. Pinyin stays hidden until then, on purpose.` Button `Got it 知道了` (persisted).
- Install row under YOUR DECK, dismissable: `📲 Add to Home Screen — opens full-screen and keeps your progress safe · How`; "How" opens a sheet with iOS/Android steps; on Android use `beforeinstallprompt` to show `Install` instead of `How`.
- Service-worker ready → 3-second buttonless snackbar `Ready to use offline ✓`, once.
- Streak chip before day 1: `🔥 Start your streak`; `🔥 Day N` after.

### 13. Slang deck audit and relabel — M (content)

Addresses HL major, B11, B12.

- Label `Slang 網路用語` in dashboard chips, filters, editor select, Settings, Stats, Drills (key `slang` unchanged); description `PTT / Dcard / LINE talk and everyday chat`.
- Replace 劇透 with 爆雷 (bào léi, "spoil / spoiler — online you'll also see the China term 劇透") and add 有雷 (yǒu léi, "contains spoilers (warning tag)"); delete the 劇透 card.
- Add three Zhuyin-as-slang cards: ㄏㄏ (hē hē, sarcastic "heh"), ㄎㄎ (kē kē, giggle), 頗ㄏ (pǒ hē, "that's a laugh"); foils are other Zhuyin pairs (ㄑㄑ, ㄈㄈ, ㄏㄎ); PTT-style example sentences.
- Check all 22 against current Taiwan usage; ensure 母湯, 是在哈囉, 87, 傻眼貓咪, 北七, 笑死, 4ni are present; keep the domain at 22 by swapping out anything that is 中國用語 or not internet usage (except 藉口, retagged per B12). Anime cards untouched.

### 14. Slips that look and read like real shops — M

Addresses B6; HL major, PM (length).

- Three bundled templates, ≤ 14 rows, 3–4 sections, filler rows with `pinyin` + `gloss`:
  - 小吃店 (阿婆小吃店): 飯類 (小/大), 麵類 (小/大), 湯類 (貢丸湯, 蛋花湯, 味噌湯, 餛飩湯, 魚丸湯), 小菜 (嘴邊肉, 滷蛋, 皮蛋豆腐, 燙青菜, 滷豆干, 海帶).
  - 早餐店 (美而美早餐): 蛋餅類 (蛋餅, 起司蛋餅, 玉米蛋餅, 鮪魚蛋餅), 吐司／漢堡 (火腿蛋吐司, 培根蛋吐司, 豬排漢堡), 其他 (蘿蔔糕, 鐵板麵, 薯餅), 飲料 (豆漿, 米漿, 紅茶, 奶茶) with 冰/熱 columns.
  - 夜市攤 (廟口夜市): 招牌 (蚵仔煎, 肉圓, 鹹酥雞, 雞排, 甜不辣, 大腸包小腸, 臭豆腐), 飲料 (珍珠奶茶, 冬瓜茶, 青草茶, 木瓜牛奶) with 小/大.
- Food cards get one section tag from a fixed list (飯類, 麵類, 湯類, 小菜, 蛋餅類, 吐司漢堡, 早餐其他, 飲料, 夜市); the drill picks the template covering the most eligible targets, targets replace filler rows in their section; fallback: 小吃店 with a 招牌 section.
- Prices: `35 / 50` for 小/大 rows, single price otherwise, rounded to 5, plausible ranges per section; not graded this iteration.
- Slip font stack: `"BiauKai","標楷體","DFKai-SB","Kaiti TC","KaiTi","AR PL UKai TW","TW-Kai","PMingLiU","新細明體","Noto Serif CJK TC","Songti TC",serif` at 22 px (Kai renders lighter). Accept sans fallback on devices without a Kai/Ming face.
- 桌號 random 1–12; 老闆 reply rotates `好～馬上來！` / `好喔，等一下` / `來，{n} 號桌！`; wrong order: `老闆娘：欸，你是不是點錯了？`.

### 15. One name per drill, one exit, one progress format, thumb-zone layout — S/M

Addresses A14, HL thumb-zone; PM minor.

- Names used in tab card, kicker and header: `Order Slip 點菜單` · `Fill the Blank 填空` · `Spot the Character 辨字`. Descriptions: Order Slip `Your friend orders out loud — tick it on the slip in 20 seconds.`; Spot the Character `Hear the word, find the right shape among look-alikes.`
- Domain select full width, `All domains 全部`.
- One exit control top-right: `End session 結束` in sessions, `End 結束` in drills; remove `← Back`. Progress: `Card 3 of 10` (denominator grows with repeats) / `2 of 5` in drills; remove `0 answered · 9 left` and `2 left after this`.
- Tile grid + Continue anchored to the bottom (`margin-top: auto`, safe-area padding); cue/sentence sits above. Continue hidden until an answer exists (no disabled pink state).

### 16. Taiwan voice — S

Addresses HL minor.

- Rotation sets (Chinese large, English small): session end `讚啦！` / `太強了！` / `辛苦了！` / `今天練完了！`; correct `答對了！` / `就是這個！` / `讚！`; wrong `不對喔` / `差一點` / `再看一次`; slip replies per item 14.
- Example sentence for 滷肉飯: `老闆，滷肉飯大碗一碗，加一顆滷蛋。` (target still present for cloze). Other sentence tune-ups happen inside the slang audit (13).

### 17. Vocab tab: learner jobs first — S

Addresses A15; PM minor, HL nit.

- Order: title + `+ Add`, search, domain filters, sort (`Due · Newest · A–Z · Domain`, default Due), list. Import / Export JSON / Export CSV / Restore starter deck move to a `⋯` menu.
- `Restore starter deck (adds N missing cards)` with live N (matches on traditional or variants); disabled with `(all 88 present)` at 0; never overwrites.
- Rows: definition wraps to two lines; domain pill → 8-px coloured dot before the state text; `也寫作 …` sub-line when present. `Show pinyin` stays off by default.

### 18. Data safety: destructive actions and backup age — S

Addresses PM minor.

- Editor: `Delete card 刪除` becomes a red text link at the bottom; confirm sheet `Delete 本命 and its review history? 刪除後無法復原` with `Delete` / `Cancel`.
- Settings: `Reset all data` outlined danger; confirm names the loss `This removes 88 cards and 132 answers.`
- `Last backup: never / 12 days ago 上次備份` next to Export; set `lastBackupAt` on export. Dashboard row after 14 study days without a backup: `Back up your progress — 14 days since last backup · Export` (dismiss snoozes 7 days).

---

## D. Later (deferred, with why)

- Realia for church / slang / anime (週報 order of service, LINE thread, PTT post) reusing the slip engine — after items 1, 4 and 14 stabilise the engine and the cue pattern.
- Second example sentence per card and cross-card sentence sourcing for the cloze — 88 cards of authoring; do after the slang audit changes the deck.
- Leech remediation view (lapse history, which foil was chosen, mnemonic pre-focused, recognise-only state) — needs the `chosen` and `source` log fields shipped in 6 and 8 first.
- "As heard" Taiwanese reading field (蚵仔煎 ô-á-tsian, 肉圓 bah-uân) as an alternate cue — after variants land; needs a native check of the romanisation.
- Latency-based nudge toward Hard / Easy — needs the `revealMs` distributions from item 9.
- Generated foils from a confusable table for custom cards, and deck-internal foils (words sharing a character) — charInfo (6) ships first; generation is the next step.
- Per-character stats (characters in ≥ 2 words and which words lapsed) — needs charInfo plus logs.
- Variant as the correct tile in Spot the Character — only after the slip has shown the learner the equivalence.
- Price-reading tasks on the slip ("order under 100 元") — prices ship ungraded in 14 first.
- "Learn 5 more" beyond the daily new limit on the all-done dashboard — useful, but the loop-closing work in 10 must land first.

## E. Rejected

- Any pinyin beside slip rows, sentence lines or tiles before an attempt — the rule; and it is exactly what LE/HL report happening at the reveal today.
- Zhuyin annotations anywhere (other than the three slang cards as content) — the learner does not read it; annotations would be noise.
- Bundled/downloaded 楷體 font files — constraint (system font stacks only); the Kai → Ming → serif chain is the fallback.
- Enforced minimum dwell before the tap registers — breaks "Rapid" recognition and feels like a stuck screen; measuring gets the same signal.
- Meaning-only (English) cue on the slip — inserts a translation step that the real counter never has and cannot separate 蚵仔煎 from 蚵仔炸.
- 鹵肉飯 (or any attested spelling) as a foil — a foil must be unambiguously wrong.
- A sixth "everyday words" domain — PRD fixes five; tags cover it.
- Treating a drill hit on a Review-state card as Good — 25 % guess floor, recognition ≠ recall.
- Auto-revealing sentence pinyin on the headword delay setting — the sentence is a second retrieval, not part of the answer.
- Sound effects or a beeping timer on the slip — the learner studies in bed and on the couch; amber colour is enough.

## F. Convergence check (next critique round should verify)

1. On every generated order slip: no two rows share a string; the pinned cue contains no Chinese characters for the ordered items; after a perfect submission only the ticked target rows are coloured; and the cue, timer and Submit stay visible at every scroll position.
2. 魯肉飯 and every string listed under 也寫作 never appear as a wrong answer in Spot the Character, Fill the Blank or the slip; ticking a variant row on the slip is graded correct and shows the "also written" tag.
3. After the reveal, the example sentence shows characters with the target highlighted and the English translation only; its pinyin appears only after tapping 拼音; no domain chip is visible on any prompt face before the reveal.
4. A wrong pick in Spot the Character or Fill the Blank shows the chosen and correct words side by side with the differing character highlighted and named with its reading and gloss (內 nèi vs 肉 ròu), and Continue stays disabled until the correct tile is tapped; Fill the Blank options include at least two readable deck words, and the blank has as many slots as the answer has characters.
5. The same figures appear everywhere: "Recall now" is one number on the dashboard and in Stats (hidden before 7 study days); the summary shows real minutes and "First try x of y"; the Today bar counts only due cards under Reviews; and selecting Dark (or system dark) renders the study card on a warm dark background with the Dark button shown as selected.
