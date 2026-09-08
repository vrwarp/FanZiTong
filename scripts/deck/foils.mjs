/**
 * Give every card two look-alike foils, from the character pair table.
 *
 *   node scripts/deck/foils.mjs report          # how far the table reaches
 *   node scripts/deck/foils.mjs fill            # fill empty foils in the deck
 *
 * A foil is the headword with one character swapped for a character that looks
 * like it: 龜毛 → 龜手. That is the same substitution a learner makes by
 * accident, which is the point of the drill, and because the swap comes from a
 * table of pairs rather than from invention, both characters already have the
 * note the app needs to explain a miss.
 *
 * Foils that collide with a real word in the deck are dropped: a wrong answer
 * has to be unambiguously wrong.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DECK = path.join(HERE, '..', '..', 'src', 'data', 'starterDeck.json');
const PAIRS = path.join(HERE, 'lookAlikes.json');
const POOL = path.join(HERE, '..', 'harvest', 'out', 'pool.json');

const pairs = JSON.parse(await readFile(PAIRS, 'utf8'));
const deck = JSON.parse(await readFile(DECK, 'utf8'));

/** Every spelling the deck treats as real, so a foil never lands on one. */
const real = new Set();
for (const rows of Object.values(deck.entries)) {
  for (const row of rows) {
    real.add(row[0]);
    for (const variant of (row[8] ?? '').split('|').filter(Boolean)) real.add(variant);
  }
}

export function foilsFor(word, taken = real) {
  const chars = [...word];
  const out = [];
  // One swap per position, walking the word left to right so a two-character
  // word does not get both its foils from the same character.
  for (let round = 0; round < 3; round += 1) {
    for (let i = 0; i < chars.length; i += 1) {
      const like = pairs[chars[i]] ?? [];
      if (round >= like.length) continue;
      const candidate = chars.map((c, j) => (j === i ? like[round] : c)).join('');
      if (candidate === word || taken.has(candidate) || out.includes(candidate)) continue;
      out.push(candidate);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

const command = process.argv[2];

if (command === 'report') {
  const pool = JSON.parse(await readFile(POOL, 'utf8'));
  const byDomain = new Map();
  for (const row of pool) {
    for (const domain of row.domains) {
      const bucket = byDomain.get(domain) ?? { total: 0, ok: 0 };
      bucket.total += 1;
      if (foilsFor(row.word).length >= 2) bucket.ok += 1;
      byDomain.set(domain, bucket);
    }
  }
  console.log(`${Object.keys(pairs).length} characters have a look-alike`);
  for (const [domain, b] of [...byDomain].sort((a, b) => b[1].ok - a[1].ok)) {
    console.log(
      `${domain.padEnd(7)} ${String(b.ok).padStart(4)}/${String(b.total).padStart(4)} words can be given two foils`,
    );
  }
} else if (command === 'fill') {
  let filled = 0;
  const short = [];
  for (const rows of Object.values(deck.entries)) {
    for (const row of rows) {
      if (row[7]) continue;
      const foils = foilsFor(row[0]);
      if (foils.length < 2) {
        short.push(row[0]);
        continue;
      }
      row[7] = foils.join('|');
      filled += 1;
    }
  }
  await writeFile(DECK, `${JSON.stringify(deck, null, 2)}\n`);
  console.log(
    `filled ${filled} cards${short.length ? `; ${short.length} still short of two foils (${short.slice(0, 12).join(' ')})` : ''}`,
  );
} else if (command === 'gaps') {
  // Which character, given a look-alike, would unlock the most words. One pair
  // serves every word that character appears in, so this is where the next
  // hour of writing notes is worth the most.
  const pool = JSON.parse(await readFile(POOL, 'utf8'));
  const want = process.argv[3];
  const gain = new Map();
  for (const row of pool) {
    if (want && !row.domains.includes(want)) continue;
    if (foilsFor(row.word).length >= 2) continue;
    for (const ch of new Set(row.word)) {
      if (pairs[ch]?.length >= 2) continue;
      gain.set(ch, (gain.get(ch) ?? 0) + 1);
    }
  }
  const ranked = [...gain].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[4] ?? 200));
  console.log(ranked.map(([c, n]) => `${c}${n}`).join(' '));
} else {
  console.error('usage: foils.mjs <report|fill|gaps [domain] [n]>');
  process.exit(1);
}
