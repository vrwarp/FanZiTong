# A teacher's reading of one learner's export

_The analytics export of 2026-11-01 (55 study days, 7 September – 31 October 2026,
668 of 1,967 words met, 4,376 scheduled answers and 5,000 recorded events), read
the way a teacher of heritage Chinese readers would read a term's worth of
marked work. The numbers are from the export; the changes it led to are at the
end._

## What is going well

**The habit is the asset.** Fifty-five study days without a gap, one sitting a
day, midnight to half past one Los Angeles time, 75–130 answers in 15–25
minutes. Sleep follows immediately, which is the best place for it. Nothing
below should be allowed to disturb this.

**Retention is where it was asked to be.** Target 90%; over the last thirty study
days the daily recognition retention runs 79–95%, and the last fortnight
averages 89%. Reviews in Review
state recall at 93% in food, 86% in slang and church, 84% in anime.

**The eyes are reading, not pattern-matching.** The forced-choice drills are
near ceiling — Fill the Blank 97%, Spot the Character 95%, Find It 100%, Which
Word 93% — while cold recognition sits at 86%. The hard part is the right part:
producing the sound from the shape with nothing to choose between.

**Characters are the strong layer.** 709 of the 715 distinct characters behind
the studied words have been read correctly in a real test. The six never read
(帥 煮 邪 鮭 鯖 刀) are all inside words met in the last week. The failures are
at the word level, not the character level, and the trouble words share almost
no characters (共 仔 師 載 子 appear twice each, nothing more). This is not a
learner who confuses shapes; it is a learner who has not yet bound certain
_words_.

**The ear is ahead of the eye, as it should be.** Of 36 Which Word ear checks,
35 were known. 傻眼 was the one word not known by ear, and it is now one of the
43 words pinned at maximum difficulty. The one place the export shows a word
genuinely unknown, it predicted trouble.

**Say It is a strength.** 194 typed readings, 186 right first time (96%).

## Where the trouble is, and what it is

### 1. Two domains are producing almost all the leeches

| domain | studied | leeches | pinned at D ≥ 9.5 | Hard rate | Easy rate | Review recall |
| ------ | ------: | ------: | ----------------: | --------: | --------: | ------------: |
| food   |     198 |       4 |                 3 |      5.5% |     31.3% |           93% |
| church |     172 |       4 |                 7 |      7.6% |     15.4% |           86% |
| slang  |     157 |      19 |                17 |     14.2% |     10.6% |           86% |
| anime  |     141 |      15 |                16 |      9.0% |     14.6% |           84% |

Slang and anime hold 34 of the 42 leeches and 33 of the 43 pinned words, with
fewer studied words than food. On first cold sight, food words were failed 41%
of the time; slang 84%, anime 76%, church 55%. The learner's spoken Mandarin
covers the night market; the slang and anime registers are being met as _new
words_, not as new spellings of known words.

The daily queue did not know this. New cards were dealt round-robin, one from
each domain in turn, so the two domains that were not sticking kept receiving
a quarter of every day's new cards each. The settling hold (20 words under a
day of stability) never saw the problem: a leech is in Review on a ten- to
twenty-day interval, far above the settling line.

### 2. The Hard button is being used for a different question

The twenty-one words in a Hard loop — rated Hard on three or more days at a
difficulty the scheduler cannot raise further — are:

> 歸剛 踹共 抓耙仔 吐槽 傻眼 壓軸 總鋪師 饒恕 很瞎 摃龜 鬱卒 田僑仔 撇步 連載 吸睛
> 揪團 烏魚子 等級 鹹酥雞 布袋戲 希伯來書

Eight of them (歸剛 踹共 抓耙仔 總鋪師 摃龜 鬱卒 田僑仔 撇步) are Taiwanese words
written with Mandarin characters for their sound. Across the export, the words
the deck marks as _usually said in Taiwanese_ were rated Hard on **38%** of
their recognition reviews; words said either way, 28%; Mandarin food words,
**4%**. Their Again rate is ordinary (13%). The learner is _reading_ them —
and then hesitating over which of two correct readings is wanted. 總鋪師 typed
as "cong pu sai" in Say It is the hesitation written down: Mandarin for two
syllables, Taiwanese for the third.

FSRS-6 cannot tell this hesitation from a weak memory. Every Hard at
difficulty 9 adds difficulty and lets stability grow only a little, so these
words have come back every seven to twenty days for two months, each time
rated Hard, each time confirming the verdict. The app's own one-Hard-a-day rule
(build #15/#16) stopped the loop tightening further — the recent histories are
long runs of Good — but the difficulty is pinned and only _Start over_ frees it.

The rubric to adopt: **if the Taiwanese reading comes, that is a read: Good.**
Hard is for when the characters themselves were slow. The reveal now says so
on every word that has a Taiwanese reading.

### 3. Face-up introductions that fail minutes later are seeding bad difficulty

Since build #18, new slang, church and anime words are shown face up first and
tested about four minutes later in the same sitting. About one such first
test in five is Again (80 words so far). A first rating of Again seeds FSRS
difficulty near 7, and the retries that follow push it up; 19 of those 80 words
are now pinned at 9.5+. The pattern is strongest in slang (12 of 30) and anime
(6 of 20), against 1 of 30 in church.

Four minutes after a face-up look, a failure is an encoding failure, not a
forgetting. The word was never known; the scheduler is told it was known and
lost. _Start over_ is the right repair for these, and there is no shame in it:
a word started over gets a fresh first sight that seeds difficulty from what
is actually known now.

### 4. Say It marks the accent, not the reading

Of the Say It misses in the event log:

| typed             | for    | what it is                                             |
| ----------------- | ------ | ------------------------------------------------------ |
| heng xia          | 很瞎   | -n/-ng merger: the reading is right                    |
| fang pai          | 反派   | -n/-ng merger                                          |
| guang ka          | 關卡   | -n/-ng merger                                          |
| zhua pa zhi       | 抓耙仔 | z/zh merger on 仔                                      |
| cong pu shi (×3)  | 總鋪師 | z/c romanisation slip (ㄗ written as c)                |
| cong pu sai       | 總鋪師 | half Mandarin, half Taiwanese                          |
| kun kip, kun kang | 歸剛   | Tâi-lô spelling of kui-kang                            |
| kui kang          | 踹共   | 歸剛's Taiwanese reading given for 踹共: a real mix-up |
| xia yan           | 傻眼   | 傻 read as 瞎 (from 很瞎): a real misreading           |
| shi yu xi         | 治癒系 | zh written as sh: a slip, not an accent                |

The first four are Taiwanese Mandarin, not errors. They cost a second try each,
and 很瞎 was charged a lapse. A heritage speaker who says hěng for 很 has read
很. Say It now takes these as readings and shows the standard spelling after.
The last three rows are genuine and the drill was right to catch them; 傻眼 and
踹共 are both on the pinned list.

### 5. The fine print

- **One sitting a day means the learning steps never land where they aim.**
  A new word's third look is scheduled three hours later "in the next
  sitting"; there is never a next sitting, so it falls to tomorrow. Harmless,
  but the scheduler's picture of the first day is one look shorter than it
  thinks.
- **Hard ratings are slower, and are followed by more forgetting.** Reveal
  latency on a Hard is 8.6 s against 5.9 s for Good; the next review after a
  Hard is failed 21% of the time against 14% after Good. The button is
  carrying real information about half the time, which is why it matters that
  it stop being pressed for the Taiwanese-reading hesitation.
- **Sessions do not tire.** Again rate by position falls from 16% in the first
  twenty cards to 7% around the eightieth, because the later cards are the
  day's repeats. Twenty-five minutes at midnight is not too long.
- **The export's older findings are already handled.** The 15-of-24 loop on
  貢丸湯, the 421 day-mismatched reviews, the clozed-seven-times sentence and
  the sixteen drill-charged lapses all predate builds that fixed them.

## What changed in the app

1. **A per-domain leech hold.** A domain holding ten or more leeches (by the
   learner's leech threshold) is dealt no new cards until the list shrinks;
   the other domains take its turns. For this export that is slang (19) and
   anime (15) on hold, food and church flowing. The dashboard names the
   domains and the way out; Settings has the number (0 switches it off); the
   analytics export reports it as `domain_leech_hold`.
2. **Say It accepts Taiwanese Mandarin.** The -n/-ng and zh/z, ch/c, sh/s
   mergers, f said as hu-, and 風 as fong are folded on both sides, so "heng
   xia" for 很瞎 is a first-try reading, graded as one, with the standard
   spelling pointed out beneath the answer. Aspiration is not folded.
3. **The reveal states the rubric for Taiwanese-read words.** On a word
   usually, only, or as often said in Taiwanese: _Either reading is a read:
   Good._

## What to do, as the learner

In order of return on effort:

1. **Start over the twenty-one Hard-loop words and the pinned words that
   failed their first test after a face-up look.** Stats → the pinned list →
   _Start over_. It keeps the history and seeds a fresh first sight. Expect
   most of the Taiwanese ones to come back Good at once; they were never
   forgotten.
2. **Change what Hard means.** Hard only when the characters were slow. If
   the Taiwanese word arrived and the hesitation was "but what is the
   Mandarin", that is Good. Expect the Hard rate to fall from 10% to around
   5%, which is where food already is.
3. **Let the domain hold do its work for two or three weeks.** New food and
   church words keep coming; slang and anime pause while their leech lists are
   worked down through _Start over_ and the leech drills in Stats. Lower the
   hold to 8 to be stricter, or set it to 0 to switch it off.
4. **When a face-up word fails its first test minutes later, treat it as not
   yet learned.** On the reveal, read the sentence aloud and look at the
   character chips before rating; a second Again that day is a retry and costs
   nothing, but the _first_ one seeds the difficulty.
5. **Settings worth leaving alone.** Target retention 0.9 and the settling
   hold of 20 are right for this history. The daily new-card limit of 18 is
   never reached (the settling hold allows about 10) and need not change.
