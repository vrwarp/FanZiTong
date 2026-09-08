/**
 * Candidate words for the next authoring batch.
 *
 *   node scripts/deck/pick.mjs anime 120
 *
 * Attested, not already in the deck, and coverable by the look-alike table, so
 * nothing on the list will turn out to be unshippable after it is written.
 * Best-attested first.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foilsFor } from './foils.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const deck = JSON.parse(
  await readFile(path.join(HERE, '..', '..', 'src', 'data', 'starterDeck.json'), 'utf8'),
);
const pool = JSON.parse(
  await readFile(path.join(HERE, '..', 'harvest', 'out', 'pool.json'), 'utf8'),
);

const have = new Set();
for (const rows of Object.values(deck.entries)) for (const row of rows) have.add(row[0]);

const [domain, limit = '100', offset = '0'] = process.argv.slice(2);
const rows = pool
  .filter((r) => r.domains.includes(domain) && !have.has(r.word) && foilsFor(r.word).length >= 2)
  .slice(Number(offset), Number(offset) + Number(limit));
for (const row of rows) {
  console.log([row.word, row.mandarin ?? '?', row.taigi ?? '', row.verse ?? ''].join('\t'));
}
console.error(`${rows.length} shown`);
