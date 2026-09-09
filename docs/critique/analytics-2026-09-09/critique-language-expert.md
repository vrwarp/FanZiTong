# 繁字通 FanZiTong — analytics round, 2026-09-09 (language / learning-effectiveness lens)

Lens unchanged from the visual rounds: does each answer give evidence about the
shape → known-sound binding, and what does the scheduler do with that evidence.
The difference this time is the material. Instead of 29 screenshots there is one
[analytics export](../../analytics-export.md) from a real device — three study
days, 193 graded answers, 50 words met, the FSRS state of every one of them and
the full answer history behind it. The previous rounds judged what the screens
_ask_; this one can judge what the app _did with the answers_.

The short version: the screens are teaching. The scheduler was being fed the
wrong answers, and it was drawing the harshest conclusion it has from them.

## (a) What the file shows

**The learner did what the app asked, and retention fell every day.**

| day   | answers | new words met | rated _Again_ | not-_Again_ rate |
| ----- | ------- | ------------- | ------------- | ---------------- |
| 09-07 | 24      | 10            | 4             | 83%              |
| 09-08 | 67      | 20            | 23            | 66%              |
| 09-09 | 102     | 20            | 46            | 55%              |

The daily new-card limit had been raised from the default 10 to 20. On day three
the learner answered 102 times in about 25 minutes across three sittings and was
wrong 46 times.

**A heritage reader meets a never-seen word by failing it.** First-sight ratings
on new words: _Again_ 27, _Hard_ 2, _Good_ 5, _Easy_ 16. That is bimodal, and it
is the single most informative number in the file. A third of the words were
already bound — the learner reads 珍珠奶茶 and 便當 on sight, rates _Easy_, and
FSRS correctly gives them a week. Just over half were not bound at all. For
those, the first _Again_ is not a memory failure; there is no memory to fail. It
is the app learning "not yet", and it is exactly right. What went wrong is what
happened next.

**Same-day loops drove six words to maximum difficulty in single sessions.** The
file's own diagnostics led with this and the histories bear it out.

- 貢丸湯 (`07f7a2d1`): 15 of the first session's 24 answers, in 128 seconds —
  _Again_ ×4, _Hard_ ×9, _Good_ ×2, at one point three seconds apart. Difficulty
  went 6.41 → 8.81 → 9.59 → 9.85 on the four _Agains_ and crept to 9.95 on the
  nine _Hards_. It then lapsed on day two (a real forgetting, correctly charged)
  and picked up lapses two and three ninety seconds apart in the evening, from a
  foil drill run twice. Three lapses made it a leech; two of the three were the
  same miss twice.
- 傲嬌 (`31acb896`): 14 answers, nine of them _Again_; never once read
  correctly in recognition, passed only in the four-tile foil drill. Stability
  0.001 days — the FSRS floor — and difficulty 9.96.
- 治癒系 (`7a66717f`): the second sitting on 09-09 gave it six answers in nine
  minutes, then a _Good_ after 68 seconds' thought and another _Good_ three
  seconds later. The second _Good_ is what graduated it to Review. It is a
  memory of the screen, not a reading.
- The last sitting of the file: five answers in 46 seconds, four of them 傲嬌,
  with gaps of 6, 29 and 5 seconds.

In FSRS-6 (the version `ts-fsrs` 5.4 implements) a same-day _Again_ multiplies
stability by about 0.4 and adds 3.02 × (10 − D) / 9 to difficulty; _Hard_ leaves
stability alone (it is masked at ×1) and still adds difficulty. The formulas were
fitted on Anki users failing learning steps, where a second failure in ten
minutes is unusual. Here it is the normal case: a never-seen word, shown again
sixty seconds after the reveal with five other never-seen words in between, will
be failed by almost anyone, and the failure says nothing the first one did not.
FSRS has no way to know that. It hears three fresh verdicts and concludes, for
good, that the word is nearly impossible. Difficulty 9.95 then taxes every
interval the word will ever get — the stability-growth term is proportional to
(11 − D), so a word pinned at 9.95 grows its intervals four times slower than
one at 6.4, long after the learner has actually learned it.

**Half of everything introduced is still unbound.** 26 of the 50 words have
stability under a day, i.e. the scheduler is still bringing them back daily.
That is the real size of the learner's workload, and it is the number that
predicted the slide in the table above: twenty new words a day, eleven of them
unknown, on top of yesterday's eleven. The five with the worst loops are all
words met on the day they looped.

**Drills can only cost a Review card ground, and a rerun costs it twice.** The
diagnostic `guess_floor_lapse` already says the first half. The second half is
in 貢丸湯's evening: miss → _Again_ (lapse 2) → comes back once → hit → the
learner runs the drill again → miss → _Again_ (lapse 3). The rule "a missed
item comes back before the end" is right; charging the second run as a new lapse
is not.

**Answer times say the learner is decoding, not glancing.** Recognition p50 is
7.4 s and p90 19.4 s. For a reader who already has the sound and meaning, seven
seconds is the shape being worked out character by character. That is the
intended effort, and it is also why a retry seconds after the reveal is
worthless: the answer is still in view.

**One quiet finding for later.** The 09-09 sittings begin at 00:22 local time.
The app's day — for streaks, caps and now for the once-a-day rule — is the local
calendar day, so a word failed at 23:50 and again at 00:10 is charged twice.
Anki rolls the day over at 4 a.m. for this reason. Not changed in this round;
recorded.

## (b) What changed

Every change below is about _which answers reach the scheduler_, not about how
it schedules. FSRS is still the only thing that computes an interval or a
memory state (AC-1).

1. **A word is knocked down at most once a day** (`lib/queue/session.ts`,
   `lib/session/engine.ts`). The first _Again_ of the day is charged in full.
   After it, an _Again_ or _Hard_ on the same word that day is a _retry_: it is
   recorded in the event log, counted in the session, brings the word back for
   another look (within the existing cap of three returns a session), and never
   touches FSRS. A recognition pass always counts, because that is how the word
   climbs back out of its learning step. A drill hit on a word already knocked
   down that day counts for nothing — a four-tile pick minutes after the reveal
   is a memory of the screen — and a drill miss on it is a retry, which is what
   ends the twice-run-drill double charge. The card carries `lastAgainAt`; the
   rule is `isRetry`.

   Under this rule 貢丸湯's history gives difficulty 8.8 and one lapse instead of
   9.95 and three: a hard word, still, which it is — the day-two lapse was real
   and is kept. 傲嬌 comes out at 6.4 and stability 0.29 days, due tomorrow,
   where it will be failed and charged again if the learner still cannot read
   it. The truth catches up in days; the difference is that a bad two minutes no
   longer decides the next two months.

2. **A minute between looks** (`MIN_RETRY_GAP_MS`, `StudyEngine.advance`,
   `WaitStep`). A card is not shown within sixty seconds of its last answer —
   the minute the _Again_ button already promises. Another ready card goes
   first; a drill on a different word fills the gap; and when nothing else is
   ready the session waits it out in the open, with a countdown, a sentence
   saying why, and a way to stop. It never shows the waiting word. The engine
   also never drills a card inside its own gap. Session six of the file
   (傲嬌 at 6, 29 and 5 seconds) cannot happen again: the learner gets one
   real retry a minute later, or leaves.

3. **New words wait for old ones to settle** (`maxSettlingCards`, default 20;
   `buildSessionQueue`; dashboard; Settings). A studied word is _settling_
   until its stability reaches a day. While more than the hold are settling,
   new cards are held back however high the daily limit is, and the dashboard
   says so in the learner's terms: "New words on hold: 26 words are still
   settling 還沒記牢 (limit 20). Review them first — new ones return as they
   stick, or raise the limit in Settings." This is the rule every
   spaced-repetition community arrives at (WaniKani's "keep Apprentice under a
   hundred", SuperMemo's "no new material with a backlog"), made automatic and
   visible. On this device it will hold new words for a few days. That is the
   intervention.

4. **The damage already done is repaired, once, from the history**
   (`lib/fsrs/repair.ts`, `repairSchedulesOnce`). Every studied card's review
   log is replayed through FSRS twice on the first launch after the update:
   first with every answer, which must reproduce the stored stability and
   difficulty exactly (stability and difficulty are deterministic; only the
   interval carries fuzz), then under the once-a-day rule. A card whose history
   does not reproduce its state — a restore without logs, an assistant merge —
   is left exactly as it was. The dashboard says which words were recomputed.
   Run against this file's histories, all 50 studied cards reproduce their
   stored state, and 22 change under the rule — the six the diagnostics named
   among them (貢丸湯 9.95 → 8.79 with one lapse instead of three; 傲嬌 9.96 →
   6.41; 治癒系, 吐槽, 壓軸 and 邊緣人 from ≥ 9.5 to 6.4) — while eight only
   gain a record of their last _Again_ and twenty, never failed, are untouched.

5. **The export can see all of it** (`lib/analytics/report.ts`,
   [`analytics-export.md`](../../analytics-export.md)). Retries never write a
   review log, so the report now reads them from the event log: per day, per
   exercise, per card, and per recorded session. Two diagnostics are new
   (`same_day_retries`, `settling_hold`); `in_session_repeat_loop` now counts
   from recorded sessions where they exist, since a loop of retries would be
   invisible in the log alone; the census counts settling words per domain.

## (c) What was considered and not done

- **Teach before testing.** The obvious reaction to "54% fail on first sight"
  is a presentation screen before the first rating. Rejected: the first-sight
  rating is the most informative signal in the file. Thirty-two percent _Easy_
  on first sight is the heritage reader's existing lexicon showing through, and
  FSRS uses it well (a week's interval on the first answer). A presentation
  first would flatten that into _Good_ for everyone. The reveal already is the
  teaching moment; what needed fixing was the retest seconds later.
- **Re-fitting FSRS weights to this learner.** 193 answers is far too few, and
  the pathology was in the inputs, not the weights.
- **Rewording _Hard_.** Nine _Hards_ in thirty seconds on 貢丸湯 suggest the
  rubric ("slow, or only part of it") invites _Hard_ when the honest answer is
  _Again_. Under the once-a-day rule the distinction no longer costs the learner
  anything on a retry, so the copy is left alone for a visual round to judge.
- **Leech handling.** With retries no longer counted as lapses, 貢丸湯 is not a
  leech under the replayed history. Whether the leech list needs a different
  treatment than "more of the same drill" is a question for a device that has
  earned a leech honestly.
- **The 4 a.m. day.** See (a). It touches streaks and caps as well, and
  deserves its own change.

## (d) What to expect on this device

- The first launch shows "Schedules recomputed" for 22 words, and "New words
  on hold" on the dashboard, because 24 words are settling against a hold of
  20 (26 before the repair; 聲優 and 燙青菜 cross the day mark once their
  same-day retries stop counting). The next few days are review-only until at
  least four more are trusted for a day. Raising the hold is one field in
  Settings; the recommendation is not to.
- Five of the 22 recomputed words come out slightly _less_ stable, not more
  (團契, 奉獻, 餛飩湯, 鹹酥雞, 滷味): the same-day drill hit that had
  graduated them is now practice, so they wait for a recognition pass instead.
  One extra look each, on words that were failed at first sight.
- The not-_Again_ rate will still look low on a day with new words, because a
  never-seen word is still met by failing it. The session summary's "Right on
  first try" and the analytics' `ratingsByStateBefore.review` row are the
  numbers to watch; the per-day `retries` count is the new one.
- A card that is failed will come back once a minute at most, and at the end
  of a short session the learner will see a countdown. That is by design and
  the screen says why.

## (e) Score and convergence

Overall score, on the scheduler's handling of evidence: 4/10 before this round
— the surfaces were asking the right question and the scheduler was being told
each answer three times over — and, on the mechanics now in place, 8/10. The
remaining two points are the day boundary, and the fact that only one device's
three days have been read; the export exists so that the next file can say
whether the settling hold's default is right.

Converged? On mechanics, yes: one verdict a day, a minute between looks, new
words gated on old ones, history repaired. On the numbers, no — the hold's
default (20) and the settling threshold (a day of stability) are informed
guesses that a fortnight of exports should confirm or move.

## (f) Keep doing

- The first-sight rating as a memory test, with _Easy_ meaning "I already read
  this": it is the cleanest signal the app has about a heritage reader.
- The reveal as the teaching moment — reading, meaning, component chips, the
  sentence — and seven-second answer times, which say the shapes are being
  read, not glanced at.
- Drills as recognition, graded as weaker evidence than recall, and a missed
  item coming back before the end of a standalone drill.
- The diagnostics in the export: `in_session_repeat_loop`,
  `difficulty_saturated`, `stability_floor` and `guess_floor_lapse` named the
  whole of this round before anyone opened a history by hand.
