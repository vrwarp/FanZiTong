# Analytics round, 2026-09-30 — study effectiveness and what is out of place

Export `fanzitong-analytics-2026-09-30-17-56-06.json`, build `35020a9`,
America/Los_Angeles, study days from 4 a.m. 23 study days (2026-09-06 →
09-29, 09-07 missed), 294 of 1,967 words studied, 1,749 answers the scheduler
heard, 2,356 recorded answers since events shipped (353 of them retries).

## Headline

Retention looks healthy: 0.59 on the second day, 0.95 on the last one, with
review-state pass rates now at 0.88 against a predicted 0.87. Underneath it,
a third of the last week's answers went to 23 words pinned at maximum
difficulty, and the pin is not forgetting: in 17 of the 23 the word was rated
_Hard_ at least as often as _Again_, and 10 have never lapsed. The pin comes
from the _Hard_ button — the 5-second amber hint, and a rule gap that lets
same-day _Hard_ ratings stack — and FSRS-6 cannot undo it by rating.

Separately, the per-card bookkeeping the last two rounds built (slip days,
face-up introductions, ear checks) has been silently reset on dozens of
cards by **Restore starter deck**, so the leech list is missing the nine
words it was built to catch. Scheduling state is intact.

## 1. Where the time goes

| last 7 study days (09-23 → 09-29)      | value               |
| -------------------------------------- | ------------------- |
| recorded answers                       | 836                 |
| on the 23 words at difficulty ≥ 9.5    | 277 (33%)           |
| on slang (68 of 294 studied words)     | 46%                 |
| all-time answers + retries on those 23 | 599 of 2,102 (28%)  |
| study time, capped at 2 min per answer | ≈ 24 min/day        |
| sittings per day since 09-25           | 1 (≈ 23:40 → 01:10) |

Time by exercise (events, capped): recognition 69%, Fill the Blank 9.6% (26 s
per answer), face-up intros 8.5% (26 s each), Spot the Character 4.2%, Order
Slip 2.7%, Find It 2.2%, Say It 2.0%, Which Word 1.8%, Sound Families 0.1%.

Domain cost per word: slang 9.1 answers + 2.9 retries, anime 7.0 + 1.6,
church 5.0 + 0.5, food 3.8 + 0.2. Mean difficulty: slang 7.3, anime 5.6,
church 4.5, food 2.8. Review-state next-day pass rate: food 0.95, church
0.86, anime 0.81, slang 0.79.

## 2. The pinned words, and why _Hard_ is the cause

23 cards sit at difficulty ≥ 9.5 (13 slang, 8 anime, 1 church, 1 food); 34
more sit between 8.5 and 9.5.

| word   | dom.   | D    | S (d) | A/H/G/E   | retries | lapses | Say It first-try |
| ------ | ------ | ---- | ----- | --------- | ------- | ------ | ---------------- |
| 歸剛   | slang  | 9.95 | 2.6   | 5/7/12/0  | 17      | 3      |                  |
| 抓耙仔 | slang  | 9.94 | 3.2   | 2/20/3/0  | 12      | 0      |                  |
| 總鋪師 | slang  | 9.93 | 2.0   | 2/15/3/0  | 10      | 0      |                  |
| 踹共   | slang  | 9.93 | 1.3   | 5/13/4/0  | 18      | 0      |                  |
| 田僑仔 | slang  | 9.92 | 1.6   | 2/11/3/0  | 6       | 0      |                  |
| 鬱卒   | slang  | 9.90 | 3.1   | 2/8/3/0   | 10      | 0      |                  |
| 預告   | anime  | 9.89 | 1.3   | 3/5/4/0   | 5       | 0      |                  |
| 壓軸   | slang  | 9.88 | 1.6   | 9/3/13/0  | 17      | 1      |                  |
| 傻眼   | slang  | 9.87 | 4.5   | 5/4/15/1  | 4       | 2      |                  |
| 吐槽   | anime  | 9.86 | 6.7   | 7/6/14/0  | 9       | 1      |                  |
| 很瞎   | slang  | 9.84 | 3.1   | 3/4/9/0   | 6       | 2      |                  |
| 撇步   | slang  | 9.83 | 3.1   | 2/6/5/0   | 10      | 0      |                  |
| 治癒系 | anime  | 9.80 | 4.7   | 11/1/14/2 | 8       | 2      |                  |
| 等級   | anime  | 9.80 | 3.9   | 1/7/4/0   | 3       | 0      |                  |
| 饒恕   | church | 9.80 | 7.1   | 2/6/6/1   | 5       | 1      |                  |
| 連載   | anime  | 9.79 | 1.8   | 2/5/5/0   | 5       | 1      |                  |
| 聲優   | anime  | 9.78 | 5.6   | 5/3/11/1  | 8       | 1      |                  |
| 擺爛   | slang  | 9.77 | 4.0   | 3/3/11/0  | 5       | 1      |                  |
| 傲嬌   | anime  | 9.76 | 5.6   | 11/4/16/0 | 12      | 1      |                  |
| 摃龜   | slang  | 9.71 | 1.7   | 2/4/5/0   | 5       | 1      |                  |
| 布袋戲 | anime  | 9.61 | 5.1   | 2/3/5/0   | 2       | 0      |                  |
| 烏魚子 | food   | 9.60 | 1.9   | 2/3/4/0   | 4       | 0      |                  |
| 吸睛   | slang  | 9.59 | 4.1   | 2/3/7/0   | 3       | 1      |                  |

Across the 23, Say It (the typed reading) was right on the first try 26
times out of 29. The learner can produce these readings; the self-rating on
the same words says _Hard_.

### What FSRS-6 does with each rating (observed in this file)

| difficulty before | Again | Hard  | Good   | Easy  |
| ----------------- | ----- | ----- | ------ | ----- |
| 5 – 8 (n=606)     | +2.52 | +1.23 | −0.01  | −1.34 |
| ≥ 9.5 (n=217)     | +0.13 | +0.04 | −0.015 | −0.12 |

_Good_ never lowers difficulty; _Easy_ lowers it by about 1.3 in the middle
of the scale and by 0.12 at the top. A pinned card needs twenty or more
_Easy_ ratings to move; it will not happen by rating. Stability growth in
Review scales with (11 − D): about 1.1 at D 9.9 against 8 at D 3, which is
why 抓耙仔 has stability 3.2 days after 25 reviews. A same-day _Hard_ on a
word still in Learning leaves stability where it is (median S ratio 1.00,
n=100) and adds the difficulty above; a same-day _Again_ cuts it to 0.39.

### The 5-second hint decides the rating

Time before the reveal, applied recognition answers (correct answers only):

| reveal latency | n   | Hard  | Good  | Easy  |
| -------------- | --- | ----- | ----- | ----- |
| under 3 s      | 457 | 2.6%  | 52.7% | 44.6% |
| 3 – 5 s        | 395 | 10.1% | 79.2% | 10.6% |
| 5 – 8 s        | 265 | 44.2% | 47.9% | 7.9%  |
| 8 – 12 s       | 129 | 44.2% | 50.4% | 5.4%  |
| 12 – 20 s      | 86  | 64.0% | 32.6% | 3.5%  |
| over 20 s      | 37  | 59.5% | 40.5% | 0%    |

The step from 10% to 44% sits exactly at `SLOW_REVEAL_MS` (5 s,
`src/components/study/RatingButtons.tsx:37`), where the amber "slow? that is
Hard" hint appears (line 80) under a rubric that defines Hard as "slow, or
only part of it" (line 31). Median reveal latency: Again 7.5 s, Hard 7.3 s,
Good 3.8 s, Easy 2.2 s. Hard share by domain: slang 30%, anime 17%, church
13%, food 7%; on slang words in Learning, 33%.

### Same-day _Hard_ ratings stack

The once-a-day rule (`src/lib/queue/session.ts:221-227`) makes _Again_ and
_Hard_ retries only after an _Again_ that day. A day that opens with _Hard_
has no protection: 88 applied _Hard_ ratings followed an earlier same-day
_Hard_ or _Again_ on the same card, adding +33.6 difficulty in total, on 15
of the 23 pinned words; 13 a day on 09-26 and 09-27. 踹共 took four applied
_Hard_ ratings in 22 minutes on 09-26 (05:40, 05:53, 05:58, 06:02 UTC);
抓耙仔 three in 13 minutes on 09-24; 等級 gained +3.4 this way. The 09-12
ideation note L ("under the once-a-day rule a same-day Hard costs nothing")
is contradicted by the data.

### The face-up introduction works, but _Hard_ undoes it

First-test _Again_ rate, cold sight → face up: slang 84% → 43%, anime 76% →
15%, church 55% → 14%. Slang words introduced face up still end at mean
difficulty 8.2 (9 of 24 pinned) because 13 of 37 first tests were rated
_Hard_ (initial difficulty 5.1 instead of 2.1 for _Good_) and more _Hard_
followed.

Ten of the 23 pinned words are Taiwanese-read (`spoken` in the deck: 歸剛
kui-kang, 抓耙仔 jiàu-pê-á, 總鋪師, 踹共, 田僑仔, 鬱卒, 撇步, 摃龜, 布袋戲,
烏魚子; 預告 and 等級 are "also"). Worth asking the learner whether _Hard_ on
these means the shape was slow, or that the Mandarin reading on the reveal
(zhuā pá zǐ) is not the word they know.

## 3. Out of place: the bookkeeping was rolled back

| field          | evidence                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `slipDays`     | 46 of 294 cards store fewer slip days than their own review logs show (傲嬌 0 vs 4, 治癒系 0 vs 5, 踹共 1 vs 4, 預告 1 vs 3 …)         |
| `introducedAt` | 18 of 112 face-up introductions (intro events) have no `introducedAt` on the card; all 18 are words with a Taiwanese `spoken` form     |
| `byEar`        | 16 of 32 ear checks in the events are not on the card (every check on 09-14/09-15, plus 魯蛇, 傲嬌, 壓軸)                              |
| `fsrs`         | intact: all 1,288 logs match their events; the 40 state discontinuities all fall on the two repair dates and the three repaired dishes |

The leech list built on 09-16 should today hold nine words (≥ 3 slip days
or lapses: 傲嬌 4, 治癒系 5, 吐槽 4, 傻眼 4, 壓軸 4, 歸剛 4, 踹共 4, 聲優 4,
預告 3). It holds 歸剛, by lapses. The first exit criterion of the 09-16
round reads as failed; it is the bookkeeping. Downstream: Stats says nothing
keeps slipping, the first-sight profile counts face-up words as cold sights
(the slang rate is a mix), Which Word re-asks ear checks already answered,
and standalone drill priority ignores the slip days.

**Cause.** `planStarterRestore` (`src/data/starterDeck.ts:237-243`) rebuilds
any card whose content differs from the shipped row as
`{ ...shipped, id, fsrs, createdAt }`, which drops `slipDays`,
`lastAgainAt`, `lastPassAt`, `sentencesShown`, `byEar` and `introducedAt`.
After builds #18–#21 (extra sentences, readings, spoken forms) most studied
words differed, so **Restore starter deck** in Vocab "repaired" them. The
same shape is in `undoAssistantBatch` (`src/db/repository.ts:221`). The
importer (`src/lib/io/importer.ts:120-136`) already carries these fields
over and is the pattern to copy. On the day of a restore the lost
`lastAgainAt` also lets a second _Again_ reach the scheduler; no such day
shows in this file.

**Fix.** Carry the learner's fields over in both paths; then backfill:
re-run `countSlipDays` (bump `slipDaysBackfillV1`), set `introducedAt` from
`intro` events and `byEar` from the last `heard` answer. Longer term, derive
these from the logs and events at read time rather than storing them on the
card, so no writer can lose them.

## 4. Other things worth attention

- **One sitting a day since 09-25, at midnight.** The three-hour learning
  step (added 09-16 for "two to four sittings a day") never lands: 16 of 128
  new words since 09-17 got a same-day third look. Next-day first look:
  Again 6% with that look, 15% without (n=16 vs 112, suggestive only).
- **Sessions left open.** 09-22, 09-23 and 09-24 sessions ran 8–14 hours
  with 15 answers over ten minutes. The two-minute cap handles the totals
  now; the 09-10 row still reports 180 minutes from before the cap.
- **The four-tile drills do not discriminate.** Spot the Character 94%,
  Fill the Blank 97%, Which Word 95%, Find It 100%; on the pinned words
  64/67, 26/28, 44/46, 19/19. 25 of 75 Spot-the-Character drills and 15 of
  62 Find It came within two minutes of the same word's reading (23 within
  a minute, one 4.5 s after; `makeDrill` exempts drills from the minute).
  Fill the Blank costs 26 s per answer and 9.6% of study time. Say It is
  the one drill whose result carries information.
- **Retention counts _Hard_ as a pass.** 09-29's 0.95 came with 26 _Hard_ of 105. Stats should show the Hard share, or a Good+Easy rate, beside it.
- **傻眼** was not known by ear (09-26) and is pinned at 9.87 with two
  lapses. By the app's own rule it needs the word before the shape; there is
  no way to set a card aside.
- **Sound Families** has run three times in two weeks.
- **A Hard-loop criterion is missing.** 15 words at D ≥ 9 with four or more
  _Hard_ ratings are on neither leech count (抓耙仔 20 Hard, 總鋪師 15, 田僑仔
  11, 鬱卒 8, 等級 7, 饒恕 6, 撇步 6, 連載 5, 圍爐 5, 鐵齒 5, 很瞎 4, 摃龜 4,
  秀逗 4, 揪團 4, 犁田 4).

## 5. What to change

### The learner, from the next session

1. **Rate the reading you produced, not the seconds.** Read it right, even
   at eight seconds: _Good_. _Hard_ only when part of the reading was wrong.
   Ignore the amber hint until it is changed.
2. **Use _Easy_ for instant reads.** 103 of the 175 slang and anime reads
   under three seconds were rated _Good_; _Easy_ there takes ~1.3 off a
   difficulty of 5–8 and keeps the next 34 words from reaching the top.
3. **Never _Hard_ twice in a sitting.** A word already given _Hard_ or
   _Again_ today that comes back and is read right is _Good_.
4. **Two sittings.** A five-minute morning look lets the three-hour step
   land; close the session rather than leaving it open overnight.
5. **New cards at 12 a day** (from 18; the hold already trims to 16) until
   the pinned set is cleared, then back up.
6. **The 23 pinned words** will not recover by rating. The clean way out is
   an app change (below); deleting and re-adding a card works today but
   loses its history and shipped extras.

### The app, in order

1. **Fix the restore and the undo** (§3), then backfill the three fields.
2. **Reword _Hard_ and move the hint.** Rubric: "only part of it, or you
   needed the sentence"; `SLOW_REVEAL_MS` to ~10 s, or make the hint say
   "slow but right is Good".
3. **One downgrade a day.** A same-day _Hard_ after a _Hard_ or _Again_ is a
   retry (a `lastHardAt` beside `lastAgainAt` in `isRetry`). Replay
   histories under it with the existing repair machinery: for 15 of the 23
   that alone removes +33 of difficulty.
4. **A way out for pinned cards.** "Start over" per card (reset to New,
   keep the logs), offered on Stats for D ≥ 9.5 after three consecutive
   passes. Say It at 26/29 says the first sight would seed difficulty near 2
   with stability no worse than today's 1–7 days.
5. **A Hard-loop leech criterion**: D ≥ 9 and ≥ 4 _Hard_.
6. **Drills.** No Spot the Character or Find It within ten minutes of the
   word's reading; Say It first for words in Review; cap Fill the Blank.
7. **Later**, personal FSRS parameters from the 1,749 logs, once the Hard
   rule has been in force for a few weeks so the fit is not on the loop.

## What is working

Face-up introductions (§2), the once-a-day _Again_ rule (no same-day double
_Again_ since 09-10), the settling hold (4 settling against 20), the 4 a.m.
day, Say It as a reading (41 applied, 38 Good), the domain round-robin (the
next 200 new cards alternate food / church / slang / anime exactly), and a
23-of-24-day streak.

## Patch set (what followed this round)

1. **A restore keeps the learner's state.** `planStarterRestore` and the
   assistant undo carry every field the learner's study wrote on a card
   (`LEARNER_STATE_KEYS` in `types`) over the shipped content, not only the
   schedule. Bootstrap recounts slip days and hard days from the review log on
   every launch, and once wrote the face-up introductions and ear checks back
   from the event log. On this device that puts nine words on the leech list.
2. **Hard is heard once a day.** After the day's first _Hard_ or _Again_, a
   further _Hard_ is a retry (`lastHardAt`, `isRetry`); the day's first
   _Again_ is still heard after a _Hard_. Rule 3 in `lib/fsrs/repair` replays
   every history under it once: on this device that removes the 88 stacked
   _Hard_ ratings from fifteen of the twenty-three pinned words.
3. **The hint says the opposite.** Above five seconds the reveal now says
   "slow, but if you read it, that is Good"; the rubric reads _Hard_ = "part
   of it wrong, or the sentence gave it away", _Good_ = "sound and meaning
   came, however slowly".
4. **A Hard loop is a leech, and a pinned word can start over.** A card
   counts its hard days; rated _Hard_ on the threshold number of days at
   difficulty 9 or above, it keeps slipping (§4's fifteen words). Stats lists
   the words at difficulty 9.5 or above and offers _Start over_
   (`lib/fsrs/restart`): back to new, history kept, replayed and counted from
   the restart, tested cold. The editor's _Reset progress_ became the same
   _Start over_.
5. **Drills rest, and Say It leads.** A shape drill waits three minutes after
   the word's last look, and a drill slot no word can fill yet stays open
   until one has rested; a troubled word in Review takes Say It every other
   fresh turn.

## Exit criteria for the next export

- the nine words in §3 on the leech list, and `hard_loop` on the fifteen in §4;
- no `applied: true` _Hard_ on a word already rated _Hard_ or _Again_ that day
  after the build;
- the Hard share at 5–8 s of reveal latency falling from 44% toward the
  3–5 s band's 10%, with the Again share unchanged;
- the pinned words started over reaching a week of stability within two;
- no Spot the Character or Find It within three minutes of the word's reading.
