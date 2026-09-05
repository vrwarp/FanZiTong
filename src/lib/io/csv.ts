import Papa from 'papaparse';
import type { VocabCard } from '@/types';
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
  example_pinyin: 'example_pinyin',
  example_sentence_pinyin: 'example_pinyin',
  example_translation: 'example_translation',
  example_sentence_translation: 'example_translation',
  translation: 'example_translation',
};

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
      warnings,
      sourceIndex,
    };
    const sentence = (record.example_sentence ?? '').trim();
    if (sentence) row.exampleSentenceTraditional = sentence;
    const sentencePinyin = (record.example_pinyin ?? '').trim();
    if (sentencePinyin) row.exampleSentencePinyin = numberedToMarks(sentencePinyin);
    const translation = (record.example_translation ?? '').trim();
    if (translation) row.exampleSentenceTranslation = translation;
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
  }));
  const body = Papa.unparse(
    { fields: [...CSV_HEADERS], data: data.map((d) => CSV_HEADERS.map((h) => d[h])) },
    { newline: '\n' },
  );
  return `${BOM}${body}\n`;
}
