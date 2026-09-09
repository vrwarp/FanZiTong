# Where the character breakdowns come from

The deck teaches words. This layer teaches the characters inside them, because
a heritage reader who knows 滷肉飯 by silhouette has learned one shape, and a
heritage reader who knows that 滷 is water 氵 beside 鹵 lǔ has learned a way to
attack every character they meet next.

That is what [Chinese Etymology 字源](https://hanziyuan.net) is good at, and
this document is the record of what happened when we went looking for a way to
put it in the app.

## What 字源 actually is, and why we link to it rather than ship it

Richard Sears' site is the largest free collection of ancient Chinese character
forms anywhere: roughly 31,000 oracle bone (甲骨文), 24,000 bronze (金文) and
49,000 seal (篆文) images, against about 15,000 characters, with 說文解字 entries
and modern variants alongside. Nothing else in the open comes close.

Three things follow from looking at it closely:

1. **There is no API and no downloadable dataset.** The site is a single-page
   app over a private database; the images are served as images.
2. **It is copyrighted.** The footer reads "Copyright © 1994 - 2017 Richard
   Sears… All rights received", with no licence grant. The images are his life's
   work, digitised and hosted at his own expense.
3. **It could not go in this app even if it were free.** FanZiTong is
   offline-first and precaches itself; tens of thousands of glyph images is not
   a thing you put in a service worker for someone studying on the MRT.

So the app links out. `hanziyuanUrl()` builds `https://hanziyuan.net/#<char>`,
the site's own hash route, and the link sits under every character breakdown as
"Ancient forms of 滷 on 字源". The history stays where its author put it, and
the learner is one tap from it.

## What we could ship: the composition layer

The part of "how characters are put together" that _is_ shippable offline is
the composition — which components a character is made of, which one says what
it is about, and which one says how it sounds.

Sources evaluated for that:

| Source                                                      | Licence               | What it has                                           | Verdict                                             |
| ----------------------------------------------------------- | --------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| [Chinese Etymology 字源](https://hanziyuan.net)             | © all rights reserved | ancient forms, 說文 entries                           | link out only                                       |
| [Unihan](https://unicode.org/charts/unihan.html)            | Unicode (permissive)  | radical, stroke counts, readings, definitions         | already have equivalents                            |
| [CHISE / cjkvi-ids](https://github.com/cjkvi/cjkvi-ids)     | GPL                   | IDS decomposition, very complete                      | decomposition only, and GPL                         |
| [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) | LGPL-3.0 (data)       | IDS decomposition, radical, readings, prose etymology | **used, selectively**                               |
| [Wiktionary](https://en.wiktionary.org) glyph origin        | CC BY-SA 3.0          | careful, sourced, cites modern scholarship            | best prose; needs scraping and per-page attribution |
| Outlier Linguistics                                         | commercial            | the best modern analysis available                    | paid, not redistributable                           |

Make Me a Hanzi wins on coverage: of the 1,683 characters in the starter deck's
words and foils, 1,665 are in its dictionary. It is itself derived from Unihan
and CJKlib, and its data files are LGPL-3.0 — which is why `etymology.json` is
generated as a **separate data file** by a **committed script**
(`scripts/build-etymology.mjs`) rather than pasted into a module: it can be
regenerated, inspected, or swapped for another source without touching the app.

## The part that took the longest: it is not all trustworthy

Make Me a Hanzi carries two very different kinds of field, and treating them
the same would have shipped confident nonsense.

The **mechanical** fields — the Ideographic Description Sequence and the Kangxi
radical — are checkable by looking at the character. 滷 is `⿰氵鹵`. You can see
that it is.

The **prose** field is secondary scholarship of uneven quality. Three examples
from characters this deck actually contains:

- **麵** is filed as semantic 面 "face", phonetic 麥. This is backwards. 麥 is
  mài and means wheat; 面 is miàn and is plainly where the reading comes from.
- **魯** gets "To talk 日 like a fish 魚". That is a mnemonic somebody invented,
  not a derivation.
- **團** gets "A lot of talent 專 gathered in one place 囗", where 專 is the
  phonetic.

This is not a knock on the project — it is a free dataset doing an enormous
amount of good — but it is exactly the failure mode character etymology is
famous for. The popular origin stories (東 as the sun behind a tree, 射 as a
body and an inch) are largely folk etymology that survives because it is
memorable. And the same trap catches language models: asked where a character
comes from, they will produce something fluent, plausible and unfalsifiable by
the person asking.

So **none of the prose is imported.** Not one string.

## What the app claims instead, and how it knows

Two claims, both checkable, plus one deliberate silence.

**"This component says what it is about."** The Kangxi radical, when it is one
of the character's top-level components and we can gloss it. This is a fact
about how the script files things, not a claim about history, and it is what
lets you guess that an unfamiliar 魚-something is a fish. The glosses are
hand-written in `src/data/components.ts` for the ~200 radicals and squeezed
variant forms the deck touches (氵 → water, 貝 → money, 辶 → the road).

**"This component gives the reading."** Asserted only when the component's own
modern Mandarin reading still predicts the character's — computed by comparing
the readings, never read off a label. Three grades, in the data as `e`/`t`/`r`:

| Grade   | Meaning                                     | Example           |
| ------- | ------------------------------------------- | ----------------- |
| `exact` | same syllable and tone                      | 鹵 lǔ → 滷 lǔ     |
| `tone`  | same syllable, different tone               | 反 fǎn → 飯 fàn   |
| `rime`  | same ending **and** tone, different initial | 令 lìng → 命 mìng |

This is deliberately narrower than "which component is the phonetic". Plenty of
genuine phonetics stopped rhyming centuries ago — 監 jiān lends its sound to 藍
lán, which is true history and useless to someone trying to guess a reading
today. The app is for reading acquisition, so it only claims the ones that
would actually help, and the learner can check every one of them against the
two readings on screen. Of 2,056 characters in the table, 776 have one.

The weakest grade needed two guards, both found by reading its own output. A
shape that is really just strokes is never allowed to lend a reading — 七 qī
genuinely decomposes to `⿻一乚`, and 一 is genuinely yī, and that is a
coincidence. And a bare rhyme is not accepted from the component already doing
the meaning, nor from the handful of components common enough (一 二 十 日 目 宀)
that rhyming with them means nothing: 嘔 ǒu is `⿰口區`, and it was 區 that once
carried the sound, not the 口 that happens to rhyme. Between them these removed
every wrong claim in the grade and no correct one.

Falling out of this: **麵 comes out right**, with 麥 as the meaning and 面 as
the sound, because 面 miàn matches 麵 miàn and 麥 mài does not. The correction is
not hand-patched; it is what the evidence says.

**The silence.** Where a character came from is not claimed at all. 魯 shows
"魚 (fish) on top" and no reading story, because none of it predicts lǔ. A
character whose only decomposition is into bare strokes — 肉 "is" `⿻冂仌` —
gets no breakdown at all, because that is true of the shape and worthless to a
reader. 200 characters were dropped on exactly that test. Silence, then a link
to the oracle bones.

## Where it shows up

- **On the reveal**, under the character chips: the parts, colour-coded amber
  for meaning and jade for sound, plus every other deck character built on the
  same sound component — the payoff, where 青 turns 清 情 請 晴 鯖 from five
  shapes into one family with one reading.
- **In the foil and cloze drills**, when a wrong pick is a look-alike: the one
  component that separates them. "飯 has 飠 (food); 販 has 貝 (money)."
- **In the leech list on Stats**, behind the same tap that reveals the reading —
  the composition names the sound component's pronunciation, which is half the
  answer, so it obeys the same rule (PRD §1.2, AC-2).
- **In the assistant**, through `char_info`, which now returns the same
  breakdown the screen is using. The system prompt tells it to get parts from
  the tool rather than from memory, and to answer "where did this come from?"
  with the 字源 link instead of a story.

## Regenerating

```bash
node scripts/build-etymology.mjs   # rewrites src/data/etymology.json
```

It caches the upstream file under `node_modules/.cache/`, covers every
character in the starter deck's words, sentences, foils and variants, plus
everything `charInfo.ts` already knows and every component of those. One
`"ids|radical|sound|match"` row per character, the same compact shape the
starter deck uses, because this file ships to a phone: 2,056 characters in 62 KB.

## Attribution

Composition data derived from [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)
(LGPL-3.0), itself derived from [Unihan](https://unicode.org/charts/unihan.html)
and [CJKlib](https://github.com/cburgmer/cjklib). Component glosses are written
for this app. Ancient forms are linked to, never copied, from
[Chinese Etymology 字源](https://hanziyuan.net) © Richard Sears.
