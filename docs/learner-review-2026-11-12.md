# A teacher's second reading, and what the app changed

_The analytics export of 2026-11-12 (65 of 67 study days, 7 September –
11 November 2026; 755 of 1,967 words met; 5,157 scheduled answers and 5,000
recorded events), read the way a teacher of heritage Chinese readers would
read a term's marked work, then checked against the code. The numbers are
from the export. The 1 November reading is
[`learner-review-2026-11-01.md`](learner-review-2026-11-01.md)._

## Where the learner stands

The habit is the asset: one sitting of about a quarter of an hour, usually
after midnight, on 65 of 67 days. 424 words hold for a month or more by the
scheduler's reckoning, and about 720 of the 755 could be read today. Recall on
reviews has run 85–91% over the last four weeks against a target of 90.

The heritage pattern is plain. Food words, which the learner already says,
cost about five looks each and are recalled 92% of the time. The twelve slang
words usually said in Taiwanese (歸剛, 抓耙仔, 總鋪師…) have cost thirty.

## Three places the app was working against the learner

### 1. A word that once kept slipping was counted forever

`isLeech` read lifetime counts, and nothing subtracted. Of 51 words on the
list, 40 had not been missed in two weeks, and 34 of those had since passed a
look after a gap of a week or more. The per-domain hold counted all 51, so
slang (20) and anime (16) had been dealt no new word since 2 November, and
church stood at 9 with 26 more words one count short. The dashboard's
"practise them in Stats" could not lift the hold: a drill lowers none of the
counts. _Start over_ was offered one word and one confirmation at a time and
had never been used.

The eleven words slipping at the time were mostly plain compounds, not slang:
製作, 預計, 環保, 特效, 麻煩, 僕人, 施主, 邪魔外道, 鏟子, 堅果, 顏值.

### 2. Say It asked the same few words every night

In-session drills chose from the whole deck by lifetime trouble, with no
memory of yesterday. Of 227 Say It answers since late September, 66% went to
five words, 歸剛 alone 45 times. Each correct typing is a review and pushes
the card a month out, so 歸剛 had not come up as a card, or been tested at
more than a two-day gap, since the end of September. Fill the Blank had the
same skew: 207 answers on 41 words.

### 3. A word shown four minutes ago was scheduled as if read cold

New non-food words are shown face up, then tested a median 3.7 minutes later,
and that rating seeded the schedule.

| First sitting                     | words | what followed                                                         |
| --------------------------------- | ----: | --------------------------------------------------------------------- |
| Good, then Easy two minutes later |   101 | first review after 4–5 days: 75% recalled against 89% predicted       |
| Good, Good                        |   105 | next-day look: 90%                                                    |
| failed the first test             |    91 | about half failed again next day; 25 now pinned at maximum difficulty |
| met cold (food), Easy on sight    |    67 | first review after 8 days: 100%                                       |

The whole retention shortfall is here. Since 1 October, words met face up are
recalled 84% in Review where the scheduler predicts 89%; words met cold, 91%
against 89%. Fitting the scheduler's parameters to the 5,157 answers improved
held-out predictions by about 2%: the trouble is what the first rating means,
not the parameters.

## A correction to the 1 November reading

That reading told the learner "Hard only when the characters were slow". It
contradicted the rubric under the buttons ("slow, but if you read it, that is
Good"), and the learner followed it: Hard on reads of 8–12 seconds went from
6% in October to 19% in November.

The stopwatch already carries what Hard was meant to. Among reads rated Good,
the next look failed:

| time before the reveal  | next look failed |
| ----------------------- | ---------------: |
| under 5 s               |               8% |
| 8–20 s                  |              17% |
| over 20 s               |              23% |
| (rated Hard, any speed) |              19% |

## What the app did not teach

- **Whether the word was already known.** The by-ear check had run on 32 of
  755 words.
- **Reading, as opposed to recognising words.** Median time to read a word
  got right: 4.4–6.0 seconds every week since late September, under three
  seconds one time in five, and nowhere on any screen. A rating came a second
  and a half after the reveal, so the example sentence went unread; sentences
  reached the learner about eight times a day. A third of the characters in
  the studied cards' sentences (的 這 了 他 要 個 都) had never been the thing
  tested.
- **The right words in the right order.** A third of the "church" words
  studied (70 of 212) were temple and Buddhist vocabulary, dealt before 祈禱,
  信心, 得救, 悔改 and 洗禮. The next "anime" words were 公司, 孩子, 妹妹, 生日,
  請問, 再見 — behind the hold. The learner's own domain was empty.

Smaller: the three multiple-choice drills ran 94–100% correct; one missed day
put 135 cards in front of the learner at 1:50 a.m. and took three sittings;
the time estimate ran at about twice the learner's pace.

## What changed in the app

1. **Trouble expires.** Slip days and hard days are counted over the last
   thirty days (`TROUBLE_WINDOW_DAYS`), recounted at every launch, and FSRS's
   lifetime lapse counter no longer makes a leech. On this export that leaves
   13 words and lifts both holds. Stats offers _Start over_ in one tap for
   the pinned words not missed in a fortnight.
2. **Say It rests.** A word in Review is not asked by Say It within a week of
   its last correct reading, and equal trouble goes to the word read longest
   ago.
3. **The face-up sitting is a lesson.** Looks at a word on the day it was met
   face up are practice; the first rating the scheduler hears is a cold look
   on a later day, which is owed and does not wait for the new-card budget.
4. **A slow Good comes back sooner.** A Good after eight seconds or more is
   scheduled by a scheduler with the retention target raised by 0.03, about
   0.6 of the interval, with difficulty untouched. The rubric is unchanged.
5. **"Did you already know this word by ear?"** One tap on the reveal or the
   face-up look, once per word.
6. **Read 讀句子.** Sentences made mostly of known characters, no reading
   shown; tap what could not be read. And a check of the common characters no
   word card tests, twenty at a time.
7. **Topics, an everyday lane, set aside, paste a text.** A domain's tags can
   be switched off for new words; words tagged `general` take turns as a lane
   no hold reaches; a word can be set aside; the deck words in a pasted text
   can be asked for next.
8. **A backlog is spread** over a few days, least stable first, and the time
   estimate is the learner's own pace.
9. **Stats** shows the words readable now, reading speed week by week, the
   by-ear count, mix-ups (the wrong shapes taken for a word in drills) and
   what is set aside.

Not done: audio. The learner did not want it.

## What to check in the next export

- no domain on hold for words not missed in a month;
- Say It spread over more than a handful of words, none typed on consecutive
  days;
- `lesson: true` events on the day a word is met face up, and no review log
  for it until a later day;
- recall on face-up words in Review moving from 84% toward the cold-met 91%;
- the Hard share on slow reads back near October's 6%;
- `byEar` on most newly met words;
- median reveal time, now on Stats, under five seconds and falling.
