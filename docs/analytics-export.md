# The analytics export

Settings → Data → **📊 Export study analytics** writes
`fanzitong-analytics-<timestamp>.json`.

It is not a backup. It cannot restore a deck, and nothing in the app reads it
back. It exists to be handed to somebody — a person, or an assistant — who is
asked _why does the app behave like this_, and to make that question answerable
without a guessing game.

## Why the full backup is the wrong file for that

The full backup is a faithful copy of what the learner owns, which is exactly
what makes it a poor diagnostic. A real one, taken after two days of study:

|                    | full backup | analytics export                          |
| ------------------ | ----------- | ----------------------------------------- |
| size               | 1.79 MB     | 67 KB                                     |
| cards              | 1,967       | the 20 that had been studied              |
| of which studied   | 20          | 20                                        |
| session boundaries | none        | reconstructed, and recorded going forward |
| findings           | none        | 8, ranked                                 |

Ninety-nine percent of that 1.79 MB is starter-deck content that is identical
in every backup anyone will ever send. What it does _not_ contain is most of
what a diagnosis needs:

- **No session boundaries.** `ReviewLog` has a timestamp and nothing else, so
  "one card took fifteen of this session's twenty-four answers" has to be
  inferred from clock gaps.
- **No timezone.** Every timestamp is UTC, but the app's streak, daily caps and
  day buckets are all _local_ days. Reading a backup means guessing the offset.
- **Answers the scheduler ignored are simply absent.** A review log is written
  only when a rating moved the schedule. A correct drill answer on a card
  already in Review moves nothing, so it is never recorded — which biases any
  retention figure computed from review logs downwards, because the misses are
  all recorded and some of the hits are not.
- **No record of what was picked**, only whether it was right. Whether the
  authored look-alike foils are actually confusable is unanswerable.
- **Nothing about time-to-answer beyond one number**, which several cards in a
  single Order Slip all share.

## What is in the file

```
schema, schemaVersion, eventVersion, generatedAt
readme            — orientation, in the file itself
environment       — app version, build, IANA timezone, UTC offset, locale
report
  settings        — the learner's scheduling settings, verbatim
  deck            — counts per domain: states, content coverage, what has been
                    seen; and newQueueAhead, the domains of the next 200 new
                    cards, run-length encoded
  activity        — per local day and per inferred session; rating matrices by
                    exercise and by pre-answer state; answer-time quantiles;
                    where the lapses came from
  cards[]         — one row per STUDIED card: content coverage, FSRS state,
                    the full answer history with the gap before each answer,
                    and per-card flags
  diagnostics[]   — the patterns the app found in its own data
events            — real session boundaries and answers, including the ones
                    FSRS ignored (see below)
```

Read `report.diagnostics` first. Each finding carries a stable `code`, a
severity, the numbers behind it, and a handful of examples to open.

### Diagnostic codes

| code                            | severity | what it means                                                                                                                                                 |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `in_session_repeat_loop`        | high     | One card took 6+ answers in a single session. A card at the stability floor is always due inside the 20-minute learn-ahead window, so it comes straight back. |
| `difficulty_saturated`          | high     | Cards at difficulty ≥ 9.5. FSRS has no harsher verdict left, so the card cannot climb out on its own.                                                         |
| `stability_floor`               | warn     | Stability ≤ 0.05 days: every interval the card is given is measured in minutes.                                                                               |
| `leech`                         | warn     | At or past the learner's leech threshold, and still scheduled like any other card.                                                                            |
| `guess_floor_lapse`             | warn     | A lapse charged by a one-in-four multiple-choice drill on a card already in Review. A hit on such a card changes nothing, so drills can only cost it ground.  |
| `domain_starvation`             | warn     | An active domain that has never had a single card introduced.                                                                                                 |
| `new_queue_single_domain_run`   | warn     | The upcoming new cards are a long run of one domain — days of study before another domain appears.                                                            |
| `answered_faster_than_readable` | info     | Answers under 800 ms: reflex, or a card still on screen from a re-queue.                                                                                      |
| `shared_answer_timing`          | info     | One duration written onto several cards, so time on task is overstated.                                                                                       |
| `missing_state_before`          | info     | Answers with no pre-answer state, which then count against the daily review budget by default.                                                                |
| `deck_barely_touched`           | info     | Almost none of the deck has been answered, so deck-wide averages are dominated by cards nobody has met.                                                       |

### The event log

`report.activity.sessions` is a _reconstruction_: answers separated by more
than 30 minutes are called separate sessions. It is the best that history alone
allows, and it is what the file falls back on for study done before the event
log existed.

`events` is the real thing. The engine emits one event per session boundary,
answer and skip, into an IndexedDB table capped at 50,000 rows (oldest dropped
first); the export carries the newest 5,000 and says how many it left behind.
An event knows things a review log cannot:

- the session it belongs to, and its position in that session;
- `applied: false` answers — the ones FSRS ignored and never logged;
- `repeatIndex`, how many times this card had already come round this session;
- `revealLatencyMs`, how long the prompt was studied before the answer was
  asked for, separately from how long the rating took;
- `picked` and `misses`: which wrong shape was taken for the word;
- `foilSource` and `foilStrategy`: which confusion a Spot the Character set was
  built from (`homophone` or `shape`) and how it was balanced (`factorial`,
  `column` or `pair`). Accuracy is not comparable across these, and events
  recorded before the generator stopped leaving the answer at the centre of the
  set carry neither — so a drop at that boundary is the shortcut closing, not
  the learner regressing.

## What is not in it

The unstudied bulk of the deck; the assistant's configuration, endpoint or
pairing; anything about the learner beyond their study settings, browser
locale and user agent. Card text appears only for cards that have actually been
studied — a diagnosis about 貢丸湯 is unreadable without the word itself.

## Versioning

`schemaVersion` covers the envelope and the report; `eventVersion` covers the
shape of the rows in `events`. Both are integers, and both are bumped only when
a change would break a reader. New optional fields do not bump either.
