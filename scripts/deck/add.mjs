/**
 * Merge an authored batch into the shipped deck.
 *
 *   node scripts/deck/add.mjs batch.json
 *
 * A batch is a JSON array of cards in readable object form; this script turns
 * them into the deck's compact row format, folds `spoken`/`notes`/`variantNote`
 * into their side tables, refuses a headword the deck already has, and writes
 * the file back. The content rules are not checked here — `npm test` runs the
 * real validator over the result, which is the same one the app uses.
 *
 *   { "word": "龜毛", "pinyin": "guī máo", "definition": "Fussy, picky",
 *     "domain": "slang", "tags": "colloquial|taiwan",
 *     "sentence": "他很龜毛，點個菜要想十分鐘。",
 *     "reading": "Tā hěn guīmáo, diǎn ge cài yào xiǎng shí fēnzhōng.",
 *     "translation": "He's so fussy it takes him ten minutes to order.",
 *     "foils": "龜手|烏毛", "variants": "", "spoken": "", "notes": "",
 *     "variantNote": "" }
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DECK = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src',
  'data',
  'starterDeck.json',
);

const DOMAINS = ['food', 'church', 'slang', 'anime'];

const batchPath = process.argv[2];
if (!batchPath) {
  console.error('usage: add.mjs <batch.json>');
  process.exit(1);
}

const deck = JSON.parse(await readFile(DECK, 'utf8'));
const batch = JSON.parse(await readFile(batchPath, 'utf8'));

const known = new Set();
for (const rows of Object.values(deck.entries)) for (const row of rows) known.add(row[0]);

const added = { food: 0, church: 0, slang: 0, anime: 0 };
const skipped = [];
for (const card of batch) {
  const word = card.word?.trim();
  if (!word) throw new Error(`a batch row has no word: ${JSON.stringify(card)}`);
  if (!DOMAINS.includes(card.domain)) throw new Error(`${word}: unknown domain ${card.domain}`);
  if (known.has(word)) {
    skipped.push(word);
    continue;
  }
  known.add(word);
  const row = [
    word,
    card.pinyin?.trim() ?? '',
    card.definition?.trim() ?? '',
    card.tags?.trim() ?? '',
    card.sentence?.trim() ?? '',
    card.reading?.trim() ?? '',
    card.translation?.trim() ?? '',
    card.foils?.trim() ?? '',
  ];
  if (card.variants?.trim()) row.push(card.variants.trim());
  deck.entries[card.domain].push(row);
  if (card.spoken?.trim()) deck.spoken[word] = card.spoken.trim();
  if (card.notes?.trim()) deck.notes[word] = card.notes.trim();
  if (card.variantNote?.trim()) deck.variantNotes[word] = card.variantNote.trim();
  added[card.domain] += 1;
}

await writeFile(DECK, `${JSON.stringify(deck, null, 2)}\n`);
const total = Object.values(deck.entries).reduce((n, rows) => n + rows.length, 0);
console.log(
  `added ${Object.entries(added)
    .filter(([, n]) => n > 0)
    .map(([d, n]) => `${d} ${n}`)
    .join(
      ', ',
    )}${skipped.length ? `; skipped ${skipped.length} already present (${skipped.slice(0, 8).join(' ')})` : ''}`,
);
console.log(
  `deck now ${total}: ${DOMAINS.map((d) => `${d} ${deck.entries[d].length}`).join(', ')}`,
);
