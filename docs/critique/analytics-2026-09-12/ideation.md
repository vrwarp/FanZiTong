# analytics-2026-09-12 ideation — the loop behind the patch set

Input: the [heritage-teacher critique](critique-heritage-teacher.md) of the
2026-09-12 export. Method, as in the visual rounds: list every candidate change
the critique implies, argue against each one from the other two chairs (the
scheduler engineer who has to keep AC-1 honest, and the learner who has to live
with the screen), keep what survives, rank it by evidence, and write down what
the next export must show for the round to count.

## Candidates and their critiques

### A. A word in Review is moved only by reading (drill misses book a reading)

**Proposal.** In the daily session a drill miss on a Review-state card is
recorded as practice and the card is put back for a recognition look after the
minute; the rating on that look is what FSRS hears. Any drill answer on a word
the learner has already read correctly today is practice. A drill can still
move a word that is still being learned and has not been read today: a miss
is _Again_, a hit is _Good_, as now. Standalone drills on Review cards touch
nothing; the missed item still comes back once before the end.

**Engineer's objection.** The recognition look after a drill miss comes sixty
seconds after the drill showed the answer with its contrast. A _Good_ there is
partly a memory of the screen. — Accepted, and it is the same compromise the
one-Again-a-day rule already makes for learning steps ("a recognition pass
always counts, because that is how the word climbs back out"). The alternative
— charge nothing and book nothing — leaves a genuinely forgotten word
undetected until its next due date. The booked look catches the case that
matters: a learner who _still_ cannot read the word after being shown it, who
rates _Again_ and is knocked down honestly.

**Learner's objection.** "So drills don't count?" — They count for words you
are still learning, and a miss on a word you know brings it straight back to
read. The Drills tab already says a hit only speeds up words not yet in review;
it now says a miss brings the word back to read. That is one sentence more
than before, not a new concept.

**Teacher's check.** Every drill lapse in the file was on a word the learner
read the same day or within two minutes. Zero were followed by a failed
reading. The rule cannot lose information the file shows the drills producing.

**Data.** Ten drill lapses; seven after a same-day pass; one contradicted in
65 s; two already retries. 餛飩湯 replays to zero lapses. **Kept.**

### B. One day for everything, starting at 4 a.m.

**Proposal.** `dayKey`, `startOfDay` and `isSameLocalDay` roll over at 04:00
local. Streak, caps, "done for today", the paused session, the once-a-day
rule and the analytics day rows all follow, because they all go through those
three functions.

**Engineer's objection.** Every test that builds a date at midnight and
expects "tomorrow" moves. — They do, and they should: "23:59 and 00:00 are
different days" was never a claim about this learner. Costed at a dozen
assertions.

**Learner's objection.** None. A sitting at 01:23 is the same evening.

**Data.** 34% of answers after midnight; four sittings between 00:21 and
01:42. **Kept.**

### C. Tell the scheduler what day it is in the learner's terms

**Proposal.** `ts-fsrs` counts elapsed time in whole UTC calendar days. The
app shifts every timestamp it hands the scheduler so that the scheduler's UTC
date is the learner's study day (local time minus four hours), and shifts the
`due` and `last_review` it gets back the other way. One helper, both
directions, at the boundary the app already converts ISO ↔ Date.

**Engineer's objection 1.** AC-1 says the app never computes an interval or a
memory state. — It still does not. FSRS computes everything; the app tells it
the time in study days instead of UTC days, which is what Anki's FSRS does
with the collection's day cutoff. What changes is which of FSRS's own two
formulas (same-day or overnight) a given pair of reviews falls under, and the
change is toward the formula FSRS intended for that pair.

**Engineer's objection 2.** The schedule repair proves a card's history by
replaying it and matching the stored state. Histories on this device were
produced under the UTC clock; replaying them under the study-day clock will
not match. — So the faithful replay runs under the clock the state was made
with, and the ruled replay under the new one. The repair already has this
shape (every answer vs. the rule); it gains a clock parameter.

**Engineer's objection 3.** DST. — The shift is computed from the instant
being shifted; on the two nights a year the offset changes, a review inside
the changed hour can land a study day early or late. Due dates are whole days;
the error is bounded to one review on those nights and self-corrects.

**Learner's objection.** Invisible, which is the point.

**Data.** Eight overnight recalls scored as same-day; 歸剛 aged a day in five
hours; the learner's late-night-then-late-morning habit lands on the wrong
side of 5 p.m. every time. **Kept**, bundled with B so there is one definition
of a day.

### D. A third learning step at three hours

**Proposal.** Learning steps 1m · 10m · 3h; relearning steps 10m · 3h. A word
failed on first sight gets its third look in the learner's next sitting rather
than tomorrow; if there is no next sitting, tomorrow's test is unchanged.

**Engineer's objection.** This changes FSRS's inputs to the same degree the
default steps do, and `ts-fsrs` supports it natively (`learning_steps`). A
_Hard_ at the three-hour step is 5½ minutes (the strategy's average of the
first two steps), which is inside the learn-ahead window and comes back in the
session; fine. The dashboard will show "3 reviews due" in the evening after a
morning session, and the "Done for today ✓" card will give way to "Due today"
when those come due. That is the intended nudge, and the summary already says
when the next reviews are.

**Learner's objection.** "It said done and now it says three due." — The
words you met this morning are back for a real look; five minutes. The copy
on the summary should say so ("3 of today's new words come back this
evening"), which is a small addition.

**Teacher's check.** Spacing the encoding across the day is the single most
reliable finding in the literature on learning new orthographic forms, and the
learner already does two to four sittings a day. The step costs nothing when
they do not.

**Data.** Only two of 47 first-_Again_ words had a second sitting on day one,
so the file cannot show the effect; it can show the need (14 of 38 failed the
next-day test). **Kept as an informed guess**, with the summary line, to be
confirmed or moved by the next export.

### E. Cap the time counted per answer at two minutes

**Proposal.** `timeSpentMs` on the log, `timeMs` on the result, and the
session's elapsed time exclude anything past two minutes on one step; the
event keeps the raw latency; the export flags answers over ten minutes.

**Objections.** None worth recording. Anki caps at 60 s; two minutes leaves
room for a genuine slow read of a sentence. **Kept.**

### F. Character knowledge: "read in 滷肉飯" or "new to you"

**Proposal.** A pure function over cards and logs: for each character, the
studied words containing it, the words in which it was read in a real test
(first sight ≥ _Good_, or a recognition pass on a later study day than the
first sight), and the words in which it was failed. On the reveal, each chip
says "read in 滷肉飯" (up to two words) or "new to you". Stats gains a
Characters block (met · read · not yet, with the not-yet characters as chips).
The export carries the table and the per-card list of characters new to the
learner.

**Engineer's objection.** The chips are on the answer panel, after the reveal;
nothing about the prompt face changes, so the pinyin rule is untouched. The
computation is O(words × characters) over 81 cards; over 1,967 it is still
trivial and is memoised per render.

**Learner's objection.** "Read in 滷肉飯" next to 滷 when I failed 滷味 — is
that a reproach? — It is the tutor's sentence: you already read this one.
The word "new to you" beside 味 is the one to look at.

**Teacher's objection.** An _Easy_ on 滷肉飯 does not prove 滷 is bound; the
learner reads the word as a logo. — Correct, which is why the chip says "read
in 滷肉飯" and not "known". The claim is about the word, and the learner can
tell whether they read the character or the shape of the dish.

**Data.** 149 characters met, 116 read, 33 only failed; every hard word in the
file fails on one character the learner has never read elsewhere. **Kept.**

### G. First-sight profile on Stats and in the export

Three lines from the log per domain. **Kept**, folded into F's Stats work.

### H. Export: study days, practice per day, lapses by source, new diagnostics

`days[]` keyed by the study day, with `practice` (retries and no-ops) beside
`answers`; `difficulty_saturated` says how many of a card's lapses came from
drills; new codes `drill_lapse_after_reading` (historical: a drill lapse on a
word read the same day, or on a Review card — the rule now books a reading),
`backgrounded_answers` (latency over ten minutes; time overstated),
`scheduler_day_mismatch` (consecutive answers the UTC clock and the study day
count differently; historical); `activity.firstSight` and `characters`
sections. **Kept.**

### I. Repair the histories once more

The v1 repair replayed every studied card under the once-a-day rule. Rule v2
(A) and clock (C) change what the same histories mean, so the repair runs
again, once, with the same proof: the faithful replay (under v1's rule and the
UTC clock, or under no rule for a card v1 never touched) must reproduce the
stored state before anything is written. The dashboard notice is the same
component. **Kept.**

### J. Sub-day due dates for settling words (considered, not done)

The critique's item 4 could also be met by serving a Review-state word with
stability under a day at `last_review + stability` rather than tomorrow. Not
done: under `ts-fsrs` a review on the same study day uses the short-term
formula whatever the hour, so the scheduler would learn almost nothing from
the extra look, and the app would be computing a due date — the one thing
AC-1 keeps out of its hands. The learning step (D) gets the same exposure
through the scheduler's own front door.

### K. Re-fit or re-weight difficulty (considered, not done)

Eighteen cards at difficulty ≥ 8.3 after six days is loud, but the previous
round's argument stands: 356 answers is not a fit, and A, C and D remove the
inputs that were never memory failures. Judge what remains on the next file.

### L. Reword _Hard_ (deferred to a visual round)

Unchanged from last round. Under the once-a-day rule a same-day _Hard_ costs
nothing; a cross-day _Hard_ is honest.

## Ranking

By how much of the file's damage each one explains, then by risk:

1. **A** — drill misses book a reading. Explains the file's only saturated
   card entirely and every drill lapse it has.
2. **B + C** — one day, 4 a.m., and the scheduler told the time in study days.
   Explains eight mis-scored overnight recalls and the pile that cannot drain.
3. **I** — repair v2, because A and C without it leave 餛飩湯 where it is.
4. **F + G** — the tutor's sentence on the reveal, and the fingerprint on
   Stats. The largest pedagogical gain; the lowest risk (read-only over the
   log).
5. **E** — the honest clock.
6. **D** — the three-hour step. Cheapest change; least evidence; explicitly
   provisional.
7. **H** — so the next export can judge all of the above.

## Patch set (analytics round 2026-09-12)

1. `lib/queue/session.ts`, `lib/session/engine.ts`: `lastPassAt` on the card;
   `readToday`; `drillVerdict(card, correct, now)` returning `again` / `good` /
   `practice` / `book`; the engine books a recognition look (once per card per
   session, after the minute, outside the requeue cap) and emits the drill
   answer with `booked: true`; `describeDrillOutcome` and the Drills tab say
   what happens.
2. `lib/util/time.ts`: `DAY_START_HOUR = 4`; `startOfDay` / `dayKey` /
   `isSameLocalDay` follow it.
3. `lib/fsrs/scheduler.ts`: a `SchedulerClock` (`STUDY_DAY_CLOCK`,
   `UTC_CLOCK`); `toFsrsCard` / `fromFsrsCard` / `previewRatings` /
   `applyRating` / `retrievability` take it; the engine uses the study-day
   clock; learning steps 1m · 10m · 3h, relearning 10m · 3h.
4. `lib/session/engine.ts`: `MAX_COUNTED_ANSWER_MS`; elapsed excludes the
   excess; raw latency stays on the event.
5. `lib/stats/characters.ts` (new): `characterKnowledge`, `firstSightProfile`;
   `CharacterChips` shows "read in …" / "new to you"; Stats gains Characters
   and Read-on-sight blocks.
6. `lib/fsrs/repair.ts`, `hooks/useBootstrap.ts`: rule versions; faithful
   replay under the old rule and clock; ruled replay under v2; meta key
   `scheduleRepairV2`.
7. `lib/analytics/report.ts`, `docs/analytics-export.md`: study-day keys,
   practice per day, lapse sources, three diagnostics, two sections;
   `reportVersion` 2.
8. Summary copy: "N of today's new words come back this evening" when the
   session leaves words at their three-hour step.

## Exit criterion for the next export

The round counts if the next file shows, on this device:

- no `drill_lapse_after_reading` after this build;
- no `scheduler_day_mismatch` after this build;
- 餛飩湯 with zero lapses and a stability that grows on each pass;
- the settling pile draining on overnight passes (words leaving it after one
  next-day _Good_, not two);
- a next-day not-_Again_ rate on first-_Again_ words above the 58% here, if
  the three-hour step is doing what it should;
- and the learner still finishing every sitting.

## Addendum: sentence rotation (reported after the round)

The learner noticed that Fill the Blank and the reveal kept showing one
sentence per word, and that a few key characters were enough to answer it. The
export bears it out: 貢丸湯 was clozed seven times in a week, always on the
same frame; 燙青菜 six; 餛飩湯 five. The fix is in `lib/exercises/cloze.ts`:

- several sentences per card (`extraSentences`), and sentences borrowed from
  other cards that happen to use the word, hosts the learner has met first;
- the reveal rotates to the sentence shown least recently; a cloze takes a
  sentence not clozed in the last seven days, preferably not the last reveal's,
  and returns nothing for a word with every sentence cooling off;
- a fixed-width blank and character-sharing distractors, so neither the length
  of the gap nor a single recognised character settles it;
- the card records what it showed, the event carries the sentence, and the
  export reports `cloze_sentence_repeats`.

What this does not fix: a foil still differs from the answer at one authored
position, so a learner who knows the foil's weak character can still pick by
that; only more authored foils per word would vary it. Watch the next export
for `cloze_sentence_repeats` at zero after this build and for whether the
cloze hit rate on the rotated words moves at all — if it does not, the
sentences were never the cue.
