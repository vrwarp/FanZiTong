/**
 * The content invariants for a vocabulary card, in one place.
 *
 * Until now these lived only in the starter-deck tests, so nothing stopped an
 * import — or an assistant — from writing a card the drills cannot use. This
 * module is the single implementation: the card editor calls it before saving,
 * the assistant executor calls it before applying a proposal, and the
 * starter-deck tests assert the shipped deck passes it.
 *
 * Errors reject the card; warnings apply it and are reported back so the model
 * (or the learner) can improve it.
 */
import { CardState, type DomainCategory, type VocabCard } from '@/types';
import { findSimplified } from '@/data/simplifiedChars';
import { charInfo } from '@/data/charInfo';
import { normalizeDomain } from '@/lib/io/domain';
import { diffCharacters, expandFoil } from '@/lib/exercises/foil';
import { containsHan, containsPinyin, hanChars, numberedToMarks } from '@/lib/util/pinyin';
import { alignSentenceReadings } from '@/lib/util/sentenceReadings';
import { RULE_IDS, type RuleId } from './rules';
import type { CardDraft } from './tools';

export interface ValidationIssue {
  rule: RuleId;
  field?: keyof VocabCard | 'card';
  message: string;
}

export interface ValidationReport {
  /** The card as it would be stored. Present even when there are errors. */
  card: VocabCard;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface DeckIndex {
  /** Headword or variant → card id, for duplicate and foil checks. */
  spellings: Map<string, string>;
  byId: Map<string, VocabCard>;
}

export function buildDeckIndex(cards: VocabCard[]): DeckIndex {
  const spellings = new Map<string, string>();
  const byId = new Map<string, VocabCard>();
  for (const card of cards) {
    byId.set(card.id, card);
    spellings.set(card.traditional, card.id);
    for (const variant of card.variants ?? []) {
      if (!spellings.has(variant)) spellings.set(variant, card.id);
    }
  }
  return { spellings, byId };
}

/**
 * How strictly to read the rules.
 *
 * `strict` is for the assistant: it is writing finished cards, so a missing
 * reading or translation is a defect. `draft` is for a person typing at the
 * keyboard, who is allowed to put the characters down now and come back for
 * the sentence later. Both modes reject the things that are actually wrong:
 * simplified characters, duplicates, and foils that are real spellings.
 */
export type ValidationMode = 'strict' | 'draft';

export interface ValidateOptions {
  deck: DeckIndex;
  mode?: ValidationMode;
  /** The card being replaced, when this is an update. */
  existing?: VocabCard | null;
  /** Headwords proposed alongside this one, so a batch cannot duplicate itself. */
  batchSpellings?: Set<string>;
  now?: Date;
}

const DEFINITION_MIN = 3;
const DEFINITION_MAX = 60;
/** Tone marks and Tâi-lô diacritics: a reading, which belongs in `pinyin`. */
const READING_IN_TEXT_RE = /[áǎàéěèíǐìóǒòúǔùâêôû]|̄|̍/;
const TONE_MARK_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
/** POJ writes ch- where Tâi-lô writes ts-; the deck is Tâi-lô only. */
const POJ_RE = /ch/i;

function text(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function list(value: readonly string[] | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    const item = raw.trim();
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/**
 * Merge a draft onto the card it updates, so a partial edit is validated as the
 * whole card it will become. `null` clears a field; `undefined` leaves it.
 */
export function mergeDraft(draft: CardDraft, existing: VocabCard | null, now: Date): VocabCard {
  const nowIso = now.toISOString();
  const base: VocabCard = existing ?? {
    id: draft.id ?? '',
    traditional: '',
    pinyin: '',
    definition: '',
    domain: 'custom',
    tags: [],
    fsrs: {
      due: nowIso,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: CardState.New,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const card: VocabCard = { ...base, updatedAt: nowIso };
  card.traditional = text(draft.traditional) || base.traditional;

  const assignText = (key: 'pinyin' | 'definition') => {
    if (draft[key] === undefined) return;
    card[key] = draft[key] === null ? '' : text(draft[key]);
  };
  assignText('pinyin');
  assignText('definition');
  if (card.pinyin) card.pinyin = numberedToMarks(card.pinyin);

  if (draft.domain !== undefined) {
    card.domain = (normalizeDomain(draft.domain) ?? 'custom') as DomainCategory;
  }
  if (draft.tags !== undefined) card.tags = draft.tags === null ? [] : list(draft.tags);

  const assignOptional = (
    key:
      | 'exampleSentenceTraditional'
      | 'exampleSentencePinyin'
      | 'exampleSentenceTranslation'
      | 'spoken'
      | 'variantNote'
      | 'notes',
  ) => {
    if (draft[key] === undefined) return;
    const value = draft[key] === null ? '' : text(draft[key]);
    card[key] = value || undefined;
  };
  assignOptional('exampleSentenceTraditional');
  assignOptional('exampleSentencePinyin');
  assignOptional('exampleSentenceTranslation');
  assignOptional('spoken');
  assignOptional('variantNote');
  assignOptional('notes');
  if (card.exampleSentencePinyin) {
    card.exampleSentencePinyin = numberedToMarks(card.exampleSentencePinyin);
  }

  const assignList = (key: 'visualFoils' | 'variants' | 'clozeDistractors') => {
    if (draft[key] === undefined) return;
    const value = draft[key] === null ? [] : list(draft[key]);
    card[key] = value.length > 0 ? value : undefined;
  };
  assignList('visualFoils');
  assignList('variants');
  assignList('clozeDistractors');

  return card;
}

/** Check one fully-merged card against every content rule. */
export function validateCard(card: VocabCard, options: ValidateOptions): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const draft = options.mode === 'draft';
  const err = (rule: RuleId, field: ValidationIssue['field'], message: string) =>
    errors.push({ rule, field, message });
  const warn = (rule: RuleId, field: ValidationIssue['field'], message: string) =>
    warnings.push({ rule, field, message });
  /** A rule about completeness or house style: only the assistant must obey it. */
  const expect = (rule: RuleId, field: ValidationIssue['field'], message: string) =>
    (draft ? warnings : errors).push({ rule, field, message });

  const word = card.traditional;
  const variants = card.variants ?? [];
  const foils = card.visualFoils ?? [];

  // 1. Headword ---------------------------------------------------------
  if (!word) {
    err(RULE_IDS.headword, 'traditional', 'A card needs its Traditional characters.');
    return { card, errors, warnings };
  }
  if (!containsHan(word)) {
    err(RULE_IDS.headword, 'traditional', `“${word}” has no Chinese characters.`);
  }
  if (containsPinyin(word)) {
    err(
      RULE_IDS.headword,
      'traditional',
      `“${word}” contains Latin letters or tone marks; the headword is characters only.`,
    );
  }

  // 2. Traditional only -------------------------------------------------
  const simplifiedIn = (value: string, field: ValidationIssue['field'], label: string) => {
    const found = findSimplified(value);
    if (found.length > 0) {
      err(
        RULE_IDS.traditional,
        field,
        `${label} uses simplified ${found.join('、')}; write it in Traditional characters.`,
      );
    }
  };
  simplifiedIn(word, 'traditional', `“${word}”`);
  // A definition is usually English, but when it is written in Chinese it is
  // read by the same learner and has to be Traditional too.
  simplifiedIn(card.definition, 'definition', 'The definition');
  // Foils are exempt: a simplified glyph is a plausible wrong shape, and the
  // deck ships several on purpose (charInfo calls them out as "the simplified
  // shape"). Everything the learner is meant to read stays Traditional.
  if (card.exampleSentenceTraditional) {
    simplifiedIn(card.exampleSentenceTraditional, 'exampleSentenceTraditional', 'The sentence');
  }
  for (const variant of variants) simplifiedIn(variant, 'variants', `The variant “${variant}”`);
  for (const option of card.clozeDistractors ?? []) {
    simplifiedIn(option, 'clozeDistractors', `The distractor “${option}”`);
  }

  // 3. Pinyin -----------------------------------------------------------
  if (!card.pinyin) {
    expect(RULE_IDS.pinyin, 'pinyin', `“${word}” needs a tone-marked reading, e.g. “lǔ ròu fàn”.`);
  } else {
    if (!TONE_MARK_RE.test(card.pinyin)) {
      expect(
        RULE_IDS.pinyin,
        'pinyin',
        `“${card.pinyin}” has no tone marks; write “lǔ ròu fàn”, not “lu rou fan”.`,
      );
    }
    const syllables = card.pinyin
      .trim()
      .split(/[\s·]+/)
      .filter(Boolean).length;
    const chars = hanChars(word).length;
    if (chars > 0 && syllables !== chars) {
      expect(
        RULE_IDS.pinyin,
        'pinyin',
        `“${card.pinyin}” has ${syllables} syllable${syllables === 1 ? '' : 's'} for ${chars}-character “${word}”; write one space-separated syllable per character.`,
      );
    }
  }

  // 4. Definition -------------------------------------------------------
  const definition = card.definition;
  if (definition.length < DEFINITION_MIN) {
    expect(RULE_IDS.definition, 'definition', `“${word}” needs a definition of its meaning.`);
  } else if (definition.length > DEFINITION_MAX) {
    err(
      RULE_IDS.definition,
      'definition',
      `The definition is ${definition.length} characters; keep it to ${DEFINITION_MAX} so it fits the order slip.`,
    );
  }
  if (READING_IN_TEXT_RE.test(definition)) {
    expect(
      RULE_IDS.definition,
      'definition',
      'The definition carries a reading; put readings in pinyin or spoken and leave the meaning alone.',
    );
  }

  // 5. Example sentence -------------------------------------------------
  const sentence = card.exampleSentenceTraditional;
  if (sentence) {
    if (!sentence.includes(word)) {
      err(
        RULE_IDS.sentence,
        'exampleSentenceTraditional',
        `The sentence does not contain “${word}”, so the fill-the-blank drill cannot use it.`,
      );
    }
    if (!card.exampleSentenceTranslation) {
      expect(
        RULE_IDS.translation,
        'exampleSentenceTranslation',
        'A sentence needs its English translation.',
      );
    }
    const reading = card.exampleSentencePinyin;
    if (!reading) {
      expect(
        RULE_IDS.sentencePinyin,
        'exampleSentencePinyin',
        'A sentence needs its reading, one token per word with the syllables joined.',
      );
    } else if (!alignSentenceReadings(sentence, reading)) {
      const chars = hanChars(sentence).length;
      expect(
        RULE_IDS.sentencePinyin,
        'exampleSentencePinyin',
        `The reading does not line up with the ${chars} characters of the sentence. Write one token per word, syllables joined inside the word, e.g. “Lǎobǎn, lǔròufàn dà wǎn yī wǎn.” for 老闆，滷肉飯大碗一碗。`,
      );
    }
  } else if (card.exampleSentencePinyin || card.exampleSentenceTranslation) {
    expect(
      RULE_IDS.sentence,
      'exampleSentenceTraditional',
      'There is a reading or translation but no sentence.',
    );
  }

  // 6. Foils ------------------------------------------------------------
  // A foil must not be a real way of writing THIS word; other deck words are
  // fair game and the foil generator picks them itself when authored foils run
  // out (src/lib/exercises/foil.ts).
  const ownSpellings = new Set<string>([word, ...variants]);
  const seenFoils = new Set<string>();
  for (const foil of foils) {
    const expanded = expandFoil(word, foil);
    if (!expanded) {
      err(
        RULE_IDS.foils,
        'visualFoils',
        `The foil “${foil}” reads as “${word}” itself; a foil must be visibly wrong.`,
      );
      continue;
    }
    if (seenFoils.has(expanded)) {
      warn(RULE_IDS.foils, 'visualFoils', `“${foil}” repeats an earlier foil.`);
      continue;
    }
    seenFoils.add(expanded);
    if (ownSpellings.has(expanded) || ownSpellings.has(foil)) {
      err(
        RULE_IDS.foils,
        'visualFoils',
        `“${foil}” is a real way of writing “${word}”; move it to variants (“also written”) instead of the foils.`,
      );
      continue;
    }
    const owner = options.deck.spellings.get(expanded);
    if (owner && owner !== card.id) {
      const other = options.deck.byId.get(owner);
      if (other && (other.variants ?? []).includes(expanded) && other.traditional !== expanded) {
        err(
          RULE_IDS.foils,
          'visualFoils',
          `“${foil}” is an accepted spelling of “${other.traditional}”, so it is not unambiguously wrong.`,
        );
        continue;
      }
    }
    if (hanChars(expanded).length !== hanChars(word).length) {
      err(
        RULE_IDS.foils,
        'visualFoils',
        `“${foil}” is a different length from “${word}”, so the app cannot show which character differs.`,
      );
      continue;
    }
    for (const diff of diffCharacters(expanded, word)) {
      if (!charInfo(diff.picked) || !charInfo(diff.correct)) {
        warn(
          RULE_IDS.charInfo,
          'visualFoils',
          `The app has no note for ${diff.picked}/${diff.correct}, so a miss on “${foil}” will not explain itself.`,
        );
      }
    }
  }
  if (foils.length > 0 && seenFoils.size < 2) {
    warn(
      RULE_IDS.foils,
      'visualFoils',
      `“${word}” has fewer than two usable foils; the spot-the-character drill wants at least two.`,
    );
  }

  // 7. Variants ---------------------------------------------------------
  for (const variant of variants) {
    if (variant === word) {
      err(RULE_IDS.variants, 'variants', `“${variant}” is the headword itself.`);
      continue;
    }
    const owner = options.deck.spellings.get(variant);
    if (owner && owner !== card.id) {
      const other = options.deck.byId.get(owner);
      err(
        RULE_IDS.variants,
        'variants',
        `“${variant}” is already the card ${other ? `“${other.traditional}”` : 'in the deck'}; merge the two instead of listing it here.`,
      );
    }
  }

  // 8. Spoken (Tâi-lô, never POJ) ---------------------------------------
  if (card.spoken && POJ_RE.test(card.spoken)) {
    expect(
      RULE_IDS.spoken,
      'spoken',
      `“${card.spoken}” looks like POJ; write Tâi-lô (ts- where POJ has ch-, e.g. “ô-á-tsian”).`,
    );
  }

  // 9. Cloze distractors ------------------------------------------------
  for (const option of card.clozeDistractors ?? []) {
    if (option === word) {
      err(RULE_IDS.cloze, 'clozeDistractors', `“${option}” is the answer, not a distractor.`);
    } else if (sentence?.includes(option)) {
      err(
        RULE_IDS.cloze,
        'clozeDistractors',
        `“${option}” already appears in the sentence, so it gives itself away.`,
      );
    }
  }

  // 10. Duplicates ------------------------------------------------------
  const owner = options.deck.spellings.get(word);
  if (owner && owner !== card.id) {
    const other = options.deck.byId.get(owner);
    err(
      RULE_IDS.duplicate,
      'traditional',
      other && other.traditional !== word
        ? `“${word}” is already in your deck as a spelling of “${other.traditional}”.`
        : `“${word}” is already in your deck.`,
    );
  }
  if (options.batchSpellings?.has(word)) {
    err(RULE_IDS.duplicate, 'traditional', `“${word}” appears twice in this batch.`);
  }

  // 11. Tags ------------------------------------------------------------
  if (card.tags.length === 0) {
    warn(RULE_IDS.tags, 'tags', `“${word}” has no tags; one word about where it is used helps.`);
  }

  return { card, errors, warnings };
}

/** Merge a draft onto its target and validate the result. */
export function validateCardDraft(draft: CardDraft, options: ValidateOptions): ValidationReport {
  const now = options.now ?? new Date();
  const card = mergeDraft(draft, options.existing ?? null, now);
  return validateCard(card, options);
}

/** One line per issue, for a tool result or an error banner. */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(' ');
}
