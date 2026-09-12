import Papa from 'papaparse';
import type { ExampleSentence, VocabCard } from '@/types';
import { numberedToMarks } from '@/lib/util/pinyin';
import { normalizeDomain, splitList } from './domain';
import type { ImportRow, ParseIssue, ParseResult } from './types';

/** PRD §7.2 canonical header order. Two optional trailing columns round-trip sentence pinyin/translation. */
export const CSV_HEADERS = [
  'traditional',
  'pinyin',
  'definition',
  'domain',
  'tags',
  'example_sentence',
  'foils',
  'example_pinyin',
  'example_translation',
  'variants',
  'spoken',
  'variant_note',
  'cloze_distractors',
  'notes',
  'homophones',
  'extra_sentences',
  'extra_pinyin',
  'extra_translations',
] as const;

const HEADER_ALIASES: Record<string, (typeof CSV_HEADERS)[number]> = {
  traditional: 'traditional',
  hanzi: 'traditional',
  word: 'traditional',
  character: 'traditional',
  characters: 'traditional',
  繁體: 'traditional',
  pinyin: 'pinyin',
  拼音: 'pinyin',
  definition: 'definition',
  meaning: 'definition',
  english: 'definition',
  定義: 'definition',
  domain: 'domain',
  category: 'domain',
  領域: 'domain',
  tags: 'tags',
  tag: 'tags',
  標籤: 'tags',
  example_sentence: 'example_sentence',
  example: 'example_sentence',
  sentence: 'example_sentence',
  example_sentence_traditional: 'example_sentence',
  例句: 'example_sentence',
  foils: 'foils',
  visual_foils: 'foils',
  visualfoils: 'foils',
  homophones: 'homophones',
  homophone_foils: 'homophones',
  homophonefoils: 'homophones',
  example_pinyin: 'example_pinyin',
  example_sentence_pinyin: 'example_pinyin',
  example_translation: 'example_translation',
  example_sentence_translation: 'example_translation',
  translation: 'example_translation',
  variants: 'variants',
  variant: 'variants',
  also_written: 'variants',
  異體: 'variants',
  spoken: 'spoken',
  as_heard: 'spoken',
  taiwanese: 'spoken',
  variant_note: 'variant_note',
  cloze_distractors: 'cloze_distractors',
  distractors: 'cloze_distractors',
  notes: 'notes',
  note: 'notes',
  extra_sentences: 'extra_sentences',
  more_sentences: 'extra_sentences',
  extra_pinyin: 'extra_pinyin',
  extra_sentence_pinyin: 'extra_pinyin',
  extra_translations: 'extra_translations',
  extra_sentence_translations: 'extra_translations',
};

/** Extra sentences travel as "|"-separated parallel lists; a sentence itself never contains "|". */
const EXTRA_SEPARATOR = '|';

function splitExtras(value: string | undefined): string[] {
  return (value ?? '').split(EXTRA_SEPARATOR).map((s) => s.trim());
}

/** Zip the three extra-sentence columns into sentences; blank sentences are dropped. */
export function parseExtraSentences(
  sentences: string | undefined,
  pinyin: string | undefined,
  translations: string | undefined,
): ExampleSentence[] {
  const texts = splitExtras(sentences);
  const readings = splitExtras(pinyin);
  const glosses = splitExtras(translations);
  const out: ExampleSentence[] = [];
  texts.forEach((text, i) => {
    if (!text) return;
    const sentence: ExampleSentence = { traditional: text };
    if (readings[i]) sentence.pinyin = numberedToMarks(readings[i]);
    if (glosses[i]) sentence.translation = glosses[i];
    out.push(sentence);
  });
  return out;
}

const BOM = '\uFEFF';

export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

function normalizeHeader(header: string): string {
  const key = header
    .replace(BOM, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return HEADER_ALIASES[key] ?? HEADER_ALIASES[header.trim()] ?? key;
}

/** Parse a UTF-8 CSV deck into import rows. Never throws; problems are reported as issues. */
export function parseCsv(text: string): ParseResult {
  const issues: ParseIssue[] = [];
  const source = stripBom(text);
  if (!source.trim()) {
    return { rows: [], issues: [{ row: 0, message: 'The file is empty.' }] };
  }

  const parsed = Papa.parse<Record<string, string>>(source, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  });

  for (const err of parsed.errors) {
    if (err.code === 'UndetectableDelimiter') continue;
    issues.push({ row: (err.row ?? -1) + 2, message: err.message });
  }

  const fields = parsed.meta.fields ?? [];
  if (!fields.includes('traditional')) {
    issues.push({
      row: 0,
      message: `Missing required "traditional" column. Found columns: ${fields.join(', ') || '(none)'}.`,
    });
    return { rows: [], issues };
  }

  const rows: ImportRow[] = [];
  parsed.data.forEach((record, index) => {
    const sourceIndex = index + 2; // 1-based, after the header line
    const traditional = (record.traditional ?? '').trim();
    if (!traditional) {
      issues.push({ row: sourceIndex, message: 'Row skipped: "traditional" is empty.' });
      return;
    }
    const warnings: string[] = [];
    const rawDomain = (record.domain ?? '').trim();
    const domain = normalizeDomain(rawDomain);
    if (rawDomain && !domain) {
      warnings.push(`Unknown domain "${rawDomain}" — will use "custom" unless overridden.`);
    }
    const pinyin = numberedToMarks((record.pinyin ?? '').trim());
    if (!pinyin) warnings.push('No pinyin provided.');
    const definition = (record.definition ?? '').trim();
    if (!definition) warnings.push('No definition provided.');

    const row: ImportRow = {
      traditional,
      pinyin,
      definition,
      domain,
      tags: splitList(record.tags),
      visualFoils: splitList(record.foils),
      homophoneFoils: splitList(record.homophones),
      variants: splitList(record.variants),
      clozeDistractors: splitList(record.cloze_distractors),
      warnings,
      sourceIndex,
    };
    const spoken = (record.spoken ?? '').trim();
    if (spoken) row.spoken = spoken;
    const variantNote = (record.variant_note ?? '').trim();
    if (variantNote) row.variantNote = variantNote;
    const notes = (record.notes ?? '').trim();
    if (notes) row.notes = notes;
    const sentence = (record.example_sentence ?? '').trim();
    if (sentence) row.exampleSentenceTraditional = sentence;
    const sentencePinyin = (record.example_pinyin ?? '').trim();
    if (sentencePinyin) row.exampleSentencePinyin = numberedToMarks(sentencePinyin);
    const translation = (record.example_translation ?? '').trim();
    if (translation) row.exampleSentenceTranslation = translation;
    const extras = parseExtraSentences(
      record.extra_sentences,
      record.extra_pinyin,
      record.extra_translations,
    );
    if (extras.length > 0) row.extraSentences = extras;
    rows.push(row);
  });

  return { rows, issues };
}

/** Serialize cards to the PRD CSV format (UTF-8 with BOM so spreadsheets open Chinese correctly). */
export function toCsv(cards: VocabCard[]): string {
  const data = cards.map((c) => ({
    traditional: c.traditional,
    pinyin: c.pinyin,
    definition: c.definition,
    domain: c.domain,
    tags: c.tags.join('|'),
    example_sentence: c.exampleSentenceTraditional ?? '',
    foils: (c.visualFoils ?? []).join('|'),
    example_pinyin: c.exampleSentencePinyin ?? '',
    example_translation: c.exampleSentenceTranslation ?? '',
    variants: (c.variants ?? []).join('|'),
    spoken: c.spoken ?? '',
    variant_note: c.variantNote ?? '',
    cloze_distractors: (c.clozeDistractors ?? []).join('|'),
    notes: c.notes ?? '',
    homophones: (c.homophoneFoils ?? []).join('|'),
    extra_sentences: (c.extraSentences ?? []).map((e) => e.traditional).join(EXTRA_SEPARATOR),
    extra_pinyin: (c.extraSentences ?? []).map((e) => e.pinyin ?? '').join(EXTRA_SEPARATOR),
    extra_translations: (c.extraSentences ?? [])
      .map((e) => e.translation ?? '')
      .join(EXTRA_SEPARATOR),
  }));
  const body = Papa.unparse(
    { fields: [...CSV_HEADERS], data: data.map((d) => CSV_HEADERS.map((h) => d[h])) },
    { newline: '\n' },
  );
  return `${BOM}${body}\n`;
}
