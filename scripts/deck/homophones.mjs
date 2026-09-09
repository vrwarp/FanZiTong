/**
 * Give every card the spellings its reading could have been typed as.
 *
 *   node scripts/deck/homophones.mjs report      # what the readings reach
 *   node scripts/deck/homophones.mjs fill        # write the homophones column
 *   node scripts/deck/homophones.mjs fill --offline   # skip the dictionary
 *
 * A heritage reader's commonest mistake is not mistaking one shape for
 * another — it is knowing the sound and picking the wrong characters for it.
 * That is the mistake a Zhuyin or Pinyin IME puts in front of them every time
 * they type: 豆漿 and 豆醬 are one keystroke apart, and only the meaning
 * separates them. This writes those candidates into the deck so the drill can
 * ask the question the learner will actually face.
 *
 * The reading of every character comes from the deck's own per-character
 * pinyin, so the candidate list needs no new source. Where moedict is
 * reachable, candidates that are themselves real words are preferred over
 * plausible non-words, because a real word is a distractor the learner has to
 * rule out on meaning rather than on "that isn't a thing".
 *
 * Candidates that collide with a real spelling in the deck are dropped: a
 * wrong answer has to be unambiguously wrong.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moedictEntry } from '../harvest/sources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DECK = path.join(HERE, '..', '..', 'src', 'data', 'starterDeck.json');
const CACHE = path.join(HERE, 'out', 'wordhood.json');

/** Han plus Bopomofo: Taiwanese slang writes ㄏㄏ and 頗ㄏ as words. */
const HAN = /[\p{Script=Han}\p{Script=Bopomofo}]/u;
const chars = (s) => Array.from(s).filter((c) => HAN.test(c));
const toneless = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** How many candidates to write per card. Three is a full column of four tiles. */
const PER_CARD = 3;

const deck = JSON.parse(await readFile(DECK, 'utf8'));
const mode = process.argv[2] ?? 'report';
const offline = process.argv.includes('--offline');

/** Every row, flattened, keeping the handle needed to write back. */
const rows = [];
for (const [domain, entries] of Object.entries(deck.entries)) {
  entries.forEach((row, i) => rows.push({ domain, i, row, word: row[0], pinyin: row[1] }));
}

/** Every spelling the deck treats as real, so a candidate never lands on one. */
const real = new Set();
for (const { row } of rows) {
  real.add(row[0]);
  for (const v of (row[8] ?? '').split('|').filter(Boolean)) real.add(v.trim());
}

// ---- reading index, from the deck's own pinyin ----------------------------
const charReadings = new Map();
const readingChars = new Map();
for (const { word, pinyin } of rows) {
  const cs = chars(word);
  const syllables = pinyin
    .trim()
    .split(/[\s·]+/)
    .filter(Boolean);
  if (syllables.length !== cs.length) continue;
  cs.forEach((c, i) => {
    const r = toneless(syllables[i]);
    if (!r) return;
    if (!charReadings.has(c)) charReadings.set(c, new Set());
    charReadings.get(c).add(r);
    if (!readingChars.has(r)) readingChars.set(r, new Set());
    readingChars.get(r).add(c);
  });
}

function homophonesOf(char) {
  const out = new Set();
  for (const r of charReadings.get(char) ?? []) {
    for (const other of readingChars.get(r) ?? []) if (other !== char) out.add(other);
  }
  return [...out];
}

/** Candidate spellings for a word: one character swapped for a same-reading one. */
function candidatesFor(word) {
  const cs = chars(word);
  const out = [];
  cs.forEach((c, i) => {
    for (const alt of homophonesOf(c)) {
      const swapped = cs.slice();
      swapped[i] = alt;
      const candidate = swapped.join('');
      if (candidate === word || real.has(candidate)) continue;
      out.push({ candidate, index: i });
    }
  });
  return out;
}

// ---- wordhood, cached ------------------------------------------------------
let cache = {};
try {
  cache = JSON.parse(await readFile(CACHE, 'utf8'));
} catch {
  cache = {};
}

async function isRealWord(word) {
  if (offline) return false;
  if (word in cache) return cache[word];
  try {
    const entry = await moedictEntry(word);
    cache[word] = Boolean(entry.mandarin || entry.taigi);
  } catch {
    // A lookup that fails is not evidence either way; treat it as unknown and
    // do not poison the cache with a guess.
    return false;
  }
  return cache[word];
}

if (mode === 'report') {
  let any = 0;
  let twoAxes = 0;
  const sizes = new Map();
  for (const { word } of rows) {
    const cands = candidatesFor(word);
    const axes = new Set(cands.map((c) => c.index));
    if (cands.length) any += 1;
    if (axes.size >= 2) twoAxes += 1;
    sizes.set(axes.size, (sizes.get(axes.size) ?? 0) + 1);
  }
  const pct = (n) => `${((n / rows.length) * 100).toFixed(1)}%`;
  console.log(`rows: ${rows.length}`);
  console.log(`characters with a reading: ${charReadings.size}`);
  console.log(`readings: ${readingChars.size}`);
  console.log(`rows with any same-reading candidate: ${any} (${pct(any)})`);
  console.log(`rows with candidates at 2+ positions: ${twoAxes} (${pct(twoAxes)})`);
  console.log('positions carrying candidates:', Object.fromEntries([...sizes].sort()));
  process.exit(0);
}

if (mode !== 'fill') {
  console.error(`unknown mode "${mode}" — use report or fill`);
  process.exit(1);
}

let filled = 0;
let verified = 0;
let done = 0;
for (const { domain, i, word } of rows) {
  const cands = candidatesFor(word);
  done += 1;
  if (done % 200 === 0) console.error(`  ${done}/${rows.length}`);
  if (cands.length === 0) continue;

  // Spread the picks across positions so the drill can cross two of them,
  // which is what makes the option set unguessable by counting glyphs.
  const byIndex = new Map();
  for (const c of cands) {
    if (!byIndex.has(c.index)) byIndex.set(c.index, []);
    byIndex.get(c.index).push(c.candidate);
  }
  // Real words first inside each position. Only the candidates that could
  // actually be picked are looked up: the dictionary is a volunteer service
  // and a full unbounded pass over the deck is tens of thousands of requests.
  for (const [, list] of [...byIndex].slice(0, PER_CARD)) {
    const flags = [];
    for (const candidate of list.slice(0, PER_CARD)) {
      flags.push([candidate, await isRealWord(candidate)]);
    }
    const rank = new Map(flags);
    list.sort((a, b) => Number(rank.get(b) ?? false) - Number(rank.get(a) ?? false));
    verified += flags.filter(([, ok]) => ok).length;
  }

  const picks = [];
  const positions = [...byIndex.keys()];
  // Round-robin across positions, so two different characters are covered
  // before a third candidate for the first one is taken.
  for (let round = 0; picks.length < PER_CARD; round += 1) {
    let added = false;
    for (const p of positions) {
      const list = byIndex.get(p);
      if (round < list.length && picks.length < PER_CARD) {
        picks.push(list[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  if (picks.length === 0) continue;

  const row = deck.entries[domain][i];
  while (row.length < 8) row.push('');
  if (row.length < 9) row.push('');
  row[9] = picks.join('|');
  filled += 1;
}

await mkdir(path.dirname(CACHE), { recursive: true });
await writeFile(CACHE, `${JSON.stringify(cache, null, 0)}\n`, 'utf8');
await writeFile(DECK, `${JSON.stringify(deck, null, 2)}\n`, 'utf8');
console.log(`filled ${filled}/${rows.length} rows; ${verified} candidates confirmed as words`);
