# 繁字通 FanZiTong — analytics round, 2026-09-12 (heritage-language teacher lens)

The material is the second [analytics export](../../analytics-export.md) from
the same phone: six study days (09-07 to 09-12), 356 graded answers, 81 words
met out of 1,967, and 464 events across 18 recorded sessions. Three of the six
days ran on the build that shipped the [previous round](../analytics-2026-09-09/critique-language-expert.md)
— one _Again_ a day, a minute between looks, new words held while old ones
settle — so this is the file that round asked for: the one that can say whether
the mechanics held and whether the numbers behind them were right.

The lens this time is the teacher's rather than the algorithm's. A heritage
reader is not learning Chinese; they are learning to _see_ the Chinese they
already have. Every question below is one a tutor would ask across the table:
what does this learner already read, what is the obstacle inside each word
they cannot, how many honest looks does a new shape get before it is tested,
and does the app's verdict match what the learner actually did.

The short version: the mechanics held and retention came back. What is still
wrong is about _evidence_ — two places where the app's verdict contradicts the
learner's own reading — and about the one thing a tutor would have said on
day one that the app still does not: which character in the word is the new
one.

## (a) What is working

**The learner shows up, in the sittings the product was designed for.** 18
recorded sittings in five days, every one finished; median 5½ minutes; 94
minutes of honest study in total (see (b)5 for the one that reads as three
hours). Two to four sittings a day, mostly 5–10 minutes. That is the daily
micro-session of the brief, not a compromise on it.

**The intervention held.** The not-_Again_ rate, which had slid 83 → 66 → 55%
over the first three days, came back to 80 / 70 / 78% on the three days after
the update. No card took over a session: the most answers any card got in one
sitting is five (26 cards took exactly four — _Again_, a retry, then the two
_Goods_ that climb the steps). The 81 retries are all in the event log and none
of them reached the scheduler. On cards already in Review the learner is right
73% of the time, which is what a 90% target looks like when half the pile is
still settling.

**The first-sight rating is this reader's fingerprint, and it is shaped by
domain.**

| domain | words met | _Easy_ on sight | _Good_ | _Hard_ | _Again_ |
| ------ | --------- | --------------- | ------ | ------ | ------- |
| food   | 33        | 16              | 5      | 2      | 10      |
| church | 20        | 1               | 0      | 6      | 13      |
| slang  | 15        | 1               | 0      | 1      | 13      |
| anime  | 13        | 0               | 1      | 1      | 11      |

Half the food words were read on sight — 滷肉飯, 牛肉麵, 珍珠奶茶, 蛋餅,
蚵仔煎, 便當: the menu vocabulary of someone who has ordered from those menus.
The other three domains are almost entirely new territory: 37 of 48 words
failed on first sight. This is exactly the profile the product brief predicted,
and the app handles it well: an _Easy_ on sight goes straight to an eight-day
interval, and the round-robin means a day's "20 new words" is really ten known
menu items and ten genuinely new shapes.

**The ratings are honest.** Time from the prompt to the tap, by the rating that
followed:

| rating  | median reveal time |
| ------- | ------------------ |
| _Easy_  | 2.1 s              |
| _Good_  | 3.4 s              |
| _Hard_  | 5.1 s              |
| _Again_ | 5.6 s              |

Monotonic, and separated. The learner is not gaming the buttons, and a
two-second _Easy_ is what fluent reading looks like. Any future use of latency
(a nudge, a fluency score) can trust this scale.

**The reveal teaches.** Of the 38 words failed on first sight and tested again
on a later day, 18 passed cleanly, 4 were _Hard_ and 15 failed — 58% not-_Again_
on words the learner could not read the day before, from one reveal and three
looks. That is encoding happening at the right cost.

**The repair did what it said.** 貢丸湯 came into the previous round at
difficulty 9.95 with three lapses; it is now 9.17 with one, and has passed
recognition on 09-09 and 09-11.

**Keep doing:** the first-sight rating as a memory test; the reveal (reading,
meaning, component chips, sentence); retries recorded but never scheduled; the
minute between looks; the settling hold, which engaged on 09-11 and 09-12 and
is the reason retention came back.

## (b) What could be better

### 1. The only thing that has ever cost 餛飩湯 a lapse is a drill, and the learner reads it fine

The file has one card flagged `difficulty_saturated`: 餛飩湯, difficulty 9.57,
two lapses. Here is every recognition answer it has had since the day it was
first seen:

| day   | recognition    |
| ----- | -------------- |
| 09-08 | _Good_, _Good_ |
| 09-09 | _Good_, _Good_ |
| 09-10 | _Good_         |
| 09-12 | _Good_         |

Six passes, no misses. Its two lapses are a Menu slip miss 53 seconds after the
_Good_ on 09-09 (difficulty 6.38 → 8.80) and a Fill the Blank miss at 01:29 on
09-12 (8.77 → 9.58) — followed 65 seconds later by a recognition _Good_. FSRS
now believes this is the hardest word in the deck, and because stability growth
scales with (11 − D), it is doling out one-day intervals to a word the learner
has read correctly on four different days.

This is not one card. Every drill lapse in the file — ten of them — is one of:

- a miss on a word the learner had read correctly in recognition **earlier the
  same day** (seven: 貢丸湯 twice, 燙青菜 twice, 地瓜葉 twice, 餛飩湯);
- a miss contradicted by a recognition pass within two minutes (餛飩湯 again);
- a second miss on a word already knocked down that day (邊緣人, 魯蛇), which
  the current rule already turns into a retry.

Not one drill lapse in the file was followed by a failed reading.

A tutor knows what a forced-choice miss is: a discrimination slip. The learner
reads 餛飩湯; asked to pick it out from 餛飩湯 / 餛飩場 / 餽飩湯 in a sentence,
they take a look-alike. That is information — it is what the drills are _for_
— but it is not the same event as forgetting the word, and FSRS models the
latter. The previous round said "drills can only cost a Review card ground" and
left the asymmetry in place. The data now says the ground they cost is
imaginary: on this device, the schedule's harshest verdict has come entirely
from four-tile picks.

**Rule:** a word in Review is moved only by reading. A drill miss on it books a
reading — the word comes back for a recognition look in the same session,
after the minute, and _that_ rating is what the scheduler hears — while the
miss itself is recorded as practice. A drill can still move a word that is
still being learned, as now, but never on a day the learner has already read it.
Replayed under this rule, 餛飩湯 has no lapses and a difficulty near where it
started.

### 2. Three different days: the app's, the scheduler's, and the learner's

The app's day is the local calendar day: streaks, daily caps, "done for today",
and now the once-a-day rule all turn over at midnight. This learner's does not.
Four of the 18 sittings began between 00:21 and 01:42, and 158 of the 464
recorded answers — 34% — fell after midnight. The same evening's study lands on
two "days":

| date  | answers by calendar day | answers by a day that starts at 4 a.m. |
| ----- | ----------------------- | -------------------------------------- |
| 09-08 | 33                      | 102                                    |
| 09-09 | 166                     | 97                                     |
| 09-11 | 24                      | 114                                    |
| 09-12 | 103                     | 13                                     |

No word was knocked down twice across a midnight yet — but the learner's
pattern (a 17:43 sitting, then 01:23) makes it a matter of time, and the streak
and the new-card cap already reset in the middle of what the learner thinks of
as one evening. Anki has rolled its day over at 4 a.m. for twenty years for
this exact reason. The previous round recorded it and deferred it; it has its
own change now.

The scheduler's day is a third thing, and the more consequential one.
`ts-fsrs` measures the time between two reviews in **whole UTC calendar days**.
For a learner at UTC−7, the scheduler's day turns over at 5 p.m. local, and
FSRS-6 treats any two reviews inside one such day as _same-day_: it applies its
short-term formula (stability × ~1.1 on _Good_) rather than the recall formula
that lets an overnight pass multiply stability seven-fold. In this file:

- **Eight overnight recalls were scored as same-day.** 傲嬌, 吐槽, 壓軸,
  治癒系, 厲害 and 聖餐 were studied at 00:30 and again at 07:40 — a night's
  sleep — and FSRS saw zero days elapsed. 奉獻 (00:28 → 10:21, _Good_) and
  聖餐 (_Good_) got a 10% stability bump for a real overnight recall instead of
  the 7× that 餛飩湯 got for the same feat at 10:22 the next morning.
- **歸剛 was scored a day older after five hours.** First seen at 12:51 on
  09-11, read correctly at 17:46 — across the 5 p.m. line — and stability went
  0.21 → 1.89 days on a five-hour-old memory. It is now due on 09-14.
- 聲優: 16:56 → 00:22, seven hours, one "day".

Ten of the 275 consecutive answer pairs in the file were bucketed on the wrong
side of a day. That is 4% overall, but it is not random: the learner's habit is
late night then late morning (23:41 → 12:50; 01:23 → 08:56), which lands on
the wrong side of 5 p.m. _every time_. Going forward, most of this learner's
overnight recalls would be scored as same-day, which means their settling words
can only graduate on a review that happens to straddle 5 p.m. That is the
mechanism by which the settling pile stays full and the new-card hold stays
shut for reasons that have nothing to do with the learner's memory.

**Rule:** one day, starting at 4 a.m. local, for everything — the streak, the
caps, the once-a-day rule, the analytics buckets, and the clock the scheduler
is told. FSRS still computes every interval; it is simply told what day it is
in the same terms the learner lives in. This is closer to FSRS's own intent
(Anki's implementation uses the collection's day cutoff), not further from it.

### 3. The difficulty tax now accumulates one day at a time

Eight cards sit at difficulty ≥ 9.1 and eighteen at ≥ 8.3. The path is always
the same: 6.41 on the first-sight _Again_, 8.8 after the next day's miss, 9.2
to 9.6 after a third. Two of those steps are honest (the word was not bound;
the learner said so). The third is often not: 餛飩湯's last step was a drill,
靠譜 and 鹹酥雞 climbed to 9.27 on two _Hards_ after one _Again_, and every one
of the eight has since passed at least one reading.

I am not proposing to touch the formula; the previous round was right that the
pathology is in the inputs. Three of the changes here shrink the inputs: the
drill rule removes the lapses that were never forgettings, the study day stops
an overnight pass being scored as a retry, and the third learning step (next
item) means a word that fails its next-day test while still being learned is
not yet a Review-state _lapse_ at all. What remains after that is honest, and
the next export can show whether it still saturates.

### 4. A new word gets three looks in five minutes and then nothing until tomorrow

The learning steps are FSRS's defaults, one minute and ten. A word failed on
first sight is seen again after a minute, again ten minutes later (in practice
the minute the gap allows), graduates to Review at a stability of 0.2–0.3
days, and is scheduled for tomorrow — where the model itself predicts 73–79%
recall. Ten of the 81 cards are due below 80% right now. Next-day results on
words that graduated with sub-day stability: 28 passed, 15 _Hard_, 14 failed.

The learner comes back two to four times a day, and nothing is asked of them
about the morning's new words in the afternoon. Only two of the 47 first-_Again_
words got a second sitting on the day they were met. A tutor would space the
encoding across the day — a minute, ten minutes, _this evening_, tomorrow —
and the scheduler supports exactly that: a third learning step of three hours
keeps the word in Learning, due at the next sitting. If there is no next
sitting, it is tomorrow's first test, as now. The interval label on the
_Good_ button will simply say "3h".

One consequence worth stating: a word that fails that next-day test while still
at its 3-hour step is a failed learning step, not a Review-state lapse. The
"Forgotten" count on Stats will then mean _forgotten after being learned_,
which is what a learner would take it to mean anyway.

This is an informed guess in the same sense the settling hold was: cheap,
principled, reversible, and to be confirmed by the next export.

### 5. The three-hour session

The sitting that began at 19:17 on 09-10 lasted 2 h 56 min: 42 answers in six
minutes, and one card — 吐槽, unrevealed — on screen for 2 h 49 min while the
phone was in a pocket. The session summary reported it; the day's "time on
task" is 3 hours; 77% of all the time in the file is that one card. The _Again_
that followed is honest and stays. The clock is not: a tutor would count the
six minutes.

**Rule:** cap the time counted for any one answer at two minutes, in the log,
the summary and the day totals; keep the raw latency in the event so the
diagnosis can still see it; flag it in the export.

### 6. The reveal does not say which character is the new one

This is the finding a tutor would have made on day one. Of the 149 distinct
characters the learner has met, 116 have been read correctly in a real test
and 33 have only ever been failed. Almost every failing word is failing on _one_
of its characters, and the app already knows which:

- 滷味 failed on first sight; 滷肉飯 was _Easy_. The learner reads 滷肉飯 as a
  logo, the way a menu regular does, and has never bound 滷 to lǔ. The reveal
  showed three chips; it did not say "you read 滷 every time you order".
- 餛飩 was introduced on 09-09 and passed the next day at once — its shape had
  already been encoded through 餛飩湯. 湯 is in three studied words.
- 意麵 failed; 麵 is read in 牛肉麵 and 乾麵. 意 is the new part.
- 米飯 _Easy_, 米粉 _Hard_, 米粥 _Again_: 米 is known, 粥 is not.
- 貢丸湯: 湯 known from two words; 貢 and 丸 have never been read anywhere else.

Two lessons. First, an _Easy_ on sight for a whole word is not evidence that
its characters are bound — heritage readers recognise high-frequency words as
gestalts — so "read before in 滷肉飯" is a claim about the word, and the chip
should say so rather than say the character is known. Second, the app can tell
the learner, on every reveal, which characters they have already read in other
words and which one is new to them. That is the sentence a tutor says, and it
is computable from the review log.

**Proposal:** each chip on the reveal carries "read in 滷肉飯" or "new to you";
Stats gains a Characters block (met · read · not yet, with the not-yet list);
the export carries the same table. This is the per-character stats item that
has been deferred since iteration 1, now with the evidence that it is where
the failures live.

### 7. Stats hides the fingerprint

The first-sight table in (a) is the most useful thing a Stats tab could show a
heritage learner: how much of each domain they already read. It is three lines
from the review log. The export's `ratingsByStateBefore.new` has the total but
not the split by domain.

### 8. What the export could not show

- The per-day table lists exercises by _applied_ answers only. 09-10 reads as
  a day with no drills; there were nineteen, all retries or no-ops. The day
  rows need a practice count.
- Time on task is overstated (item 5) and the diagnostics do not say so.
- `difficulty_saturated` does not say where the difficulty came from. For
  餛飩湯 the answer — "two lapses, both from drills" — is the whole diagnosis.
- Nothing records which side of the scheduler's day a review fell on.
- Days are keyed by calendar day, so the post-midnight sittings are split from
  the evening they belong to.

### 9. Left alone this round

- _Hard_ is pressed 46 times in recognition; 8 of them came after an _Again_
  the same day and were retries. The rubric question from last round is still
  a question for a visual round.
- The wait step never appears in the event log (there is no event for it), so
  whether the learner has ever sat through a countdown is unknown. Worth an
  event when the engine next changes shape; not worth a change on its own.
- The 20-hold and the one-day settling threshold: the pile has sat at 19–24 for
  four days and new words still arrived (15, 2, 14). The hold is doing what it
  should. The scheduler-day fix above will change how fast words leave the
  pile; judge the number after that.

## (c) Score and convergence

On what the app does with the learner's evidence: **7/10**. The previous
round's mechanics all held, and retention came back. The two points off are
the two places where the app still overrules the learner's own reading — a
four-tile pick charged as forgetting, and a night's sleep scored as no time at
all — and both are fixable in the same place the last round worked: which
answers the scheduler hears, and what it is told the time is.

On the surfaces the learner sees: **9/10**, unchanged. The one missing sentence
is the tutor's — which character is the new one.

Converged? Not yet. Two evidence rules, one measurement fix, one learning step
and one teacher feature, then the next export decides.

## (d) What changed

The [ideation loop](ideation.md) argued every candidate from the other two
chairs and ranked what survived. Everything below is about which answers reach
the scheduler, what time it is told, and what the learner is shown; FSRS still
computes every interval and every memory state.

1. **A word in Review is moved only by reading** (`drillVerdict` in
   `lib/queue/session.ts`, `bookLook` in `lib/session/engine.ts`,
   `lastPassAt` on the card). A drill miss on a Review word is recorded as
   practice and books one recognition look in the same session, after the
   minute; the rating on that look is what FSRS hears. Any drill answer on a
   word the learner has already read that day is practice. A drill can still
   move a word still being learned. Standalone drills on Review words touch
   nothing, and the missed item still comes back once. The outcome lines and
   the Drills tab say so.
2. **One day, from 4 a.m.** (`DAY_START_HOUR` in `lib/util/time.ts`).
   Streak, caps, "done for today", the paused session, the once-a-day rule
   and the analytics rows all turn over at 04:00 local.
3. **The scheduler is told the time in study days** (`STUDY_DAY_CLOCK` in
   `lib/fsrs/scheduler.ts`). Every instant handed to `ts-fsrs` is shifted so
   its UTC date is the learner's study day, and every `due` and `last_review`
   that comes back is shifted the other way. A night's sleep is a day; an
   hour across midnight is not.
4. **A third learning step at three hours** (`LEARNING_STEPS`,
   `RELEARNING_STEPS`). The summary says how many of today's words come back
   later today.
5. **At most two minutes counted per answer** (`MAX_COUNTED_ANSWER_MS`); the
   event keeps the raw latency; the export flags answers over ten minutes.
6. **The tutor's sentence on the reveal** (`lib/stats/characters.ts`,
   `CharacterChips`): each chip says "read in 滷肉飯", "missed in 滷味" or
   "new here". Stats gains _Read on sight_ (the fingerprint table from (a))
   and _Characters_ (met · read · not yet, with the not-yet characters and the
   words they sit in).
7. **The histories are replayed once more** (`lib/fsrs/repair.ts`, rule
   version 2, marker `scheduleRepairV2`). Each card's history is first
   replayed under the rule, clock and learning steps of its own day — every
   answer applied, the once-a-day rule, or the current rules — and must
   reproduce the stored state exactly before anything is written; then it is
   replayed under the rules in force. The dashboard notice names the words.
8. **The export** (`lib/analytics/report.ts`, report version 2): days keyed
   by the study day with a practice count beside the answers; booked readings
   per day, per exercise and per card; `firstSight` by domain; a
   `characters` census; lapse sources on `difficulty_saturated`; three new
   diagnostics (`drill_lapse_after_reading`, `scheduler_day_mismatch`,
   `backgrounded_answers`); `guess_floor_lapse` retired.

## (e) What the replay does to this device

Run against this file's 81 studied cards, in the learner's timezone:

- **81 of 81 verify.** 59 histories reproduce their stored state with every
  answer applied on the old clock and steps; 22 reproduce under the
  once-a-day rule the previous round shipped; none is left unverifiable.
- **40 change, 41 only gain their verdicts on record.** Lapses across the deck
  go from 17 to 5.
- **餛飩湯**: 0.61 d / difficulty 9.57 / two lapses → **7.30 d / 6.35 / none**.
  A word read correctly on four different days now looks like one.
- **貢丸湯**: one lapse → none; its day-two miss fell on a word still at its
  three-hour step. 燙青菜 and 地瓜葉, whose only lapses were drills seconds
  after a pass: 5–6 d → 14 d, difficulty to the floor after two _Easys_.
- **歸剛**: 1.90 d → 0.28 d. The five-hour "day" is gone; it is settling like
  the rest of that batch, which is what it is.
- **饒恕**: 0.28 d → 2.02 d, **奉獻** 0.61 → 1.19 d and no lapse, **聖餐**
  2.44 → 3.24 d: overnight recalls the old clock scored as same-day now count
  as a day. **恩典** 4.48 → 3.24 d: a 29-hour gap the old clock scored as two
  days is one.
- **Three words come out harder**, and honestly so: 傲嬌, 壓軸 and 治癒系 go
  from 7.59 to 9.17 and from 1.82 d to 0.57 d, still learning. Their failure
  at 07:42 on 09-09 followed a night's sleep after the 00:30 sitting; under
  the calendar day it was a retry of that sitting, under the study day it is a
  new day's verdict, which is what it was. 吐槽 reaches 9.56 the same way and
  is now the file's one saturated card: failed on three study days.
- The settling pile stays at 20 — the words are the same words — but eight of
  them are now in Learning at a three-hour step rather than in Review at a
  one-day interval the model did not believe in.

## (f) What to expect on this device

- The first launch shows "Schedules recomputed" for 40 words, with the two
  new rules in one sentence, and "New words on hold" stays until the pile
  drains — which it now can, on an overnight pass.
- A sitting at 01:00 counts for the evening before it: the streak, the new
  words already introduced, and the words already knocked down that evening
  all carry over. The day turns at 04:00.
- Words failed on first sight come back after a minute, after ten, and then
  "3h" — in the next sitting, or tomorrow if there is none. The summary says
  "Later today: N of today's words come back". The dashboard's "Done for
  today ✓" gives way to "Due today: N reviews" when they come due; five
  minutes.
- A drill miss on a word already in review says "In review — a drill does not
  move it; it comes back for another look, and only your reading counts", and
  the word turns up as a card a minute later.
- On the reveal, each character says where it has been read before. 滷 under
  滷味 will say "read in 滷肉飯"; 味 will say "new here".
- The next export will say whether the round counted, against the exit
  criterion in the [ideation](ideation.md): no `drill_lapse_after_reading` and
  no `scheduler_day_mismatch` after this build, 餛飩湯 growing on each pass,
  the pile draining on overnight passes, and a next-day not-_Again_ rate on
  first-_Again_ words above the 58% here.
