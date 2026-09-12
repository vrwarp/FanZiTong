import type { ExampleSentence } from '@/types';
import { numberedToMarks } from '@/lib/util/pinyin';

/**
 * The card editor's shape for further sentences: one per line, written as
 * "sentence | pinyin | translation"; a line with only a sentence is fine.
 */
export function parseExtraSentenceLines(text: string): ExampleSentence[] {
  const out: ExampleSentence[] = [];
  for (const line of text.split('\n')) {
    const [traditional = '', pinyin = '', translation = ''] = line.split('|').map((s) => s.trim());
    if (!traditional) continue;
    const sentence: ExampleSentence = { traditional };
    if (pinyin) sentence.pinyin = numberedToMarks(pinyin);
    if (translation) sentence.translation = translation;
    out.push(sentence);
  }
  return out;
}

/** The inverse, for filling the editor from a card. */
export function formatExtraSentenceLines(sentences: ExampleSentence[] | undefined): string {
  return (sentences ?? [])
    .map((e) => [e.traditional, e.pinyin ?? '', e.translation ?? ''].join(' | '))
    .join('\n');
}
