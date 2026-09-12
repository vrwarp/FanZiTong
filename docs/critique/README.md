# Critique loop records

The persona reviews and ideation syntheses from the visual critique loop
(`docs/ux-critique-log.md` has the per-iteration summary). Each round was run
against a live build with `node scripts/walkthrough.mjs <dir>` on a Pixel 7
viewport; the screenshots themselves are not committed (≈ 5 MB per round) and
can be regenerated with that script.

- `context.md` — the brief every reviewer read (product, the pinyin rule, the capture list).
- `iterN/critique-pm.md` — product manager, user journeys.
- `iterN/critique-language-expert.md` — orthographic acquisition and spaced repetition.
- `iterN/critique-heritage-learner.md` — the target learner, in their own voice.
- `iterN/ideation.md` — the ranked, reconciled plan that followed (iterations 1–3).
- `analytics-2026-09-09/critique-language-expert.md` — a round run on the
  [analytics export](../analytics-export.md) rather than on screenshots: what
  three days of one learner's data showed about the scheduling, and what changed.
- `analytics-2026-09-12/critique-heritage-teacher.md` — the second export from
  the same phone, six days in, read as a heritage-language teacher would: what
  is working, what still overrules the learner's own reading, and what a tutor
  would have said on day one; `analytics-2026-09-12/ideation.md` is the
  ideation–critique loop behind the patch set that followed.
