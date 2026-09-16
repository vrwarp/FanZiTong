# Analytics round, 2026-09-16 — the heritage-language teacher's read

The third export from the same phone: ten study days (2026-09-06 → 09-16),
136 studied words, 686 answers the scheduler heard and 979 recorded events,
on build `0306faa` (the sentence rotation and Which Word have been live since
the evening of the 13th, local time). Read against the exit criteria the
previous round set for itself, then for what the new data shows.

## What the previous rounds fixed, checked

| Criterion set on 09-12                            | Result on 09-16                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| no `drill_lapse_after_reading` after the build    | none: every drill miss since the build was on a word already read that day, so it was practice and charged nothing         |
| no `scheduler_day_mismatch` after the build       | none real; the diagnostic still counted 56 post-build pairs because it recomputed UTC days regardless of era (fixed below) |
| 餛飩湯 with no lapses and growing stability       | stability 7.3 d, difficulty 6.3, no lapses, not due yet                                                                    |
| the settling pile draining                        | 13 settling against a hold of 20 (room for 7 new words a day)                                                              |
| next-day not-Again on first-Again words above 58% | 72% over the whole history (53 of 74); 79% (11 of 14) for words first failed after the build                               |
| the learner still finishing every sitting         | 37 of 38 recorded sessions completed; the one that was not lost its end event, not its answers                             |

Also working: daily retention 0.81–0.86 since the 12th (0.59–0.65 on the
8th and 9th); the 4 a.m. day is doing its job (seven sittings began between
midnight and 1 a.m. local and were counted with the evening before);
Fill the Blank has clozed twelve items since the build on eleven distinct
sentences, 小組 in two different frames, with no repeats; Which Word ran four
standalone runs plus a dozen interleaved items, 32 of 33 correct.

## What the data shows now

**1. The words that never graduate are invisible to the leech list.** Nine
words have been forgotten in reading on three or more study days — 傲嬌 (11
Agains over four days, stability 0.38 d, difficulty 9.9), 治癒系, 壓軸, 吐槽,
聲優, 傻眼, 歸剛, 阿雜, 餛飩湯 — and the Stats tab says "Nothing keeps
slipping" in every domain. FSRS counts a lapse only when a word in Review is
forgotten; these words fail before they graduate, or fail once in Review and
fall straight back into Learning, so their lapse counts sit at 0 or 1 under
the threshold of 3. Eight of them are at saturated difficulty. Since the
build, 17 of 85 readings on words in Review were Again (80% against a 90%
target), almost all on this group. A tutor would have had these nine on a
list a week ago; the app has no list they can be on.

**2. The ear check was half contaminated.** Which Word asked 16 words by ear
and all 16 were known — but 8 of the 16 were asked hours after the day's
session had already put the word's reading on screen. What the other eight
say is still useful: 吐槽, 聲優, 追番, 燃, 靠譜, 靈修, 恩典 and 小組 are known
by ear, so the trouble words are a reading problem, not a vocabulary problem.
But the check cannot be trusted on a day the word was read, and standalone
runs picked words the day had already touched.

**3. The familiar word gives itself away.** Fill the Blank and Which Word
draw readable distractors from the whole domain: 47 of 576 food words have
been studied, so a typical set is the target plus two or three words the
learner has never seen. Among strangers the familiar shape wins without a
character being read — the same class of shortcut as the other-domain
distractors and the centred foil set the app removed before. It fits the
data: 32 of 33 Which Word answers and every post-build cloze were correct,
on words that fail one reading in five.

**4. The trouble words never reached Which Word.** Standalone runs order by
FSRS lapses, so 傲嬌 (one lapse), 壓軸 and 治癒系 (none) sat behind thirty
words with a single lapse each and were not in any of the four runs.

**5. A diagnostic bug.** `scheduler_day_mismatch` recomputed the scheduler's
day in whole UTC days for every pair, including the 56 pairs since the
build, when the scheduler has counted study days.

## Patch set

1. **Slip days.** A card counts the study days it was forgotten in reading
   after its first sight (`slipDays`; the engine adds one for each charged
   recognition Again, and a one-time backfill counts the history). A word
   keeps slipping when it has lapsed three times _or_ slipped on three
   days: the Stats list, the reveal's note, the export's flags, census and
   `leech` diagnostic, and the standalone drills' priority all use that.
2. **An honest ear check.** Which Word never asks by ear on a day the word
   was read, and standalone runs take the words the day has not touched
   first.
3. **Studied words as distractors.** Fill the Blank and Which Word offer
   words the learner has studied before words they have never seen, in
   both the written options and the readings.
4. **Trouble first.** Standalone drill selection orders by days forgotten
   plus lapses, so 傲嬌 leads a run.
5. **The diagnostic.** The export records when this device's scheduler
   started counting study days and looks for mismatches only before it.

## Exit criteria for the next export

- the nine words above in the leech list, and in the first Which Word run;
- ear checks only on words not read that day, with at least one anime or
  slang word answered from a cold start;
- the cloze and Which Word hit rate on the trouble words falling from 100%
  toward the reading hit rate, which is what a drill without a shortcut
  looks like;
- `scheduler_day_mismatch` at zero after the build;
- and Review-state retention moving toward the 90% target as the trouble
  words get drilled instead of only re-read.
