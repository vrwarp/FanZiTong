/**
 * The content contract for anything the assistant writes into the deck.
 *
 * One source of truth, used twice: verbatim in the sidecar's system prompt
 * (so the model is told the rules) and by `validateCard` (so the rules are
 * enforced). The rules themselves come from the critique rounds in
 * docs/critique and docs/ux-critique-log.md.
 */

export const RULE_IDS = {
  shape: 'shape',
  traditional: 'traditional',
  headword: 'headword',
  pinyin: 'pinyin',
  definition: 'definition',
  sentence: 'sentence',
  sentencePinyin: 'sentence-pinyin',
  translation: 'translation',
  foils: 'foils',
  variants: 'variants',
  spoken: 'spoken',
  duplicate: 'duplicate',
  tags: 'tags',
  domain: 'domain',
  cloze: 'cloze-distractors',
  charInfo: 'char-info',
} as const;

export type RuleId = (typeof RULE_IDS)[keyof typeof RULE_IDS];

/** Markdown, embedded verbatim in the system prompt. */
export const CARD_FORMAT_RULES = `## Card format contract

Every field you write is validated. A rejected card comes back with the rule it
broke; fix it and try again rather than dropping the field.

**Traditional only.** Headwords, sentences, foils, variants and distractors are
Taiwan Traditional characters. A simplified-only glyph (说, 这, 团, 饭) is
rejected. Characters that are legal in both scripts (台, 后, 干, 里, 面) are fine.

**Taiwan usage, not PRC usage.** 爆雷 not 劇透; 影片 not 视频; 網路 not 网络.
Slang is PTT / Dcard register. Church vocabulary is Taiwanese evangelical usage
(Protestant 阿們, Catholic 阿門 — say which in variantNote when it matters).
Quote scripture verbatim or not at all.

**pinyin** — the headword reading, tone-marked, lowercase, ONE SPACE PER
CHARACTER: 滷肉飯 → "lǔ ròu fàn". Not "lǔròufàn", not "Lǔ Ròu Fàn".

**exampleSentencePinyin** — the sentence reading, one token per WORD with the
syllables joined inside the word, punctuation and capitalisation kept:
老闆，滷肉飯大碗一碗，加一顆滷蛋。 → "Lǎobǎn, lǔròufàn dà wǎn yī wǎn, jiā yī kē lǔdàn."
The syllable count must equal the number of Han characters in the sentence.

**exampleSentenceTraditional** — must contain the headword exactly once,
something a person in Taiwan would actually say, ≤ 40 characters. Always give
exampleSentenceTranslation with it.

**definition** — meaning only, 3 to 60 characters. No readings, no romanisation,
no register labels. "Excuse, pretext", never "Excuse (Taiwan standard form)".

**visualFoils** — wrong spellings for the discrimination drill. Each foil must
be the same length as the headword, differ by one classic confusion
(滷肉飯 → 魯肉飯, 貢丸 → 貞丸), and be unambiguously WRONG. A spelling that any
convention attests (Taiwan, Hong Kong, simplified, Japanese) is never a foil.
Give at least two.

**variants** — real alternative spellings seen in the wild (滷肉飯 → 魯肉飯).
Shown as "also written", graded correct. Never a foil. Put the remark about
them in variantNote.

**spoken** — how the word is actually said when the Mandarin reading is not what
people use, in Tâi-lô only, never POJ: 蚵仔煎 → "ô-á-tsian" (not "ô-á-chian").

**notes** — origin, usage or a mnemonic. Shown after the reveal, never on the
prompt face.

**tags** — at least one, lowercase, hyphenated: "night-market", "youth".

**domain** — one of food, church, slang, anime, custom.`;
