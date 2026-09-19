/**
 * Build `src/data/dictionary.json`: a reading and a one-line gloss for every
 * character the app can show, and the other common meanings of every word in
 * the starter deck.
 *
 * WHY A SECOND TABLE
 *
 * `src/data/charInfo.ts` is hand-written: the pairs heritage readers blur, each
 * with a "tell". It was never going to cover every character the deck touches,
 * and a character chip with no reading and no meaning is a hole where a tutor
 * would have said one word. This table fills the holes mechanically, and the
 * hand-written entry still wins wherever there is one.
 *
 * SOURCES, AND WHAT IS TAKEN FROM EACH
 *
 * - Make Me a Hanzi (dictionary.txt, LGPL-3.0; the same file the composition
 *   layer is built from): its `pinyin` and `definition` fields, which are
 *   Unihan's kMandarin and kDefinition. Short, one line, and the kind of gloss
 *   a chip has room for ("to hide; secret, latent").
 * - CC-CEDICT (CC BY-SA 4.0): the fallback for characters the first source
 *   lacks, and the only source for word senses — the meanings a word has
 *   besides the one its card teaches (機車 the scooter and the locomotive
 *   behind 機車 the pain in the neck). Only entries for the deck's own words
 *   are taken, cleaned of cross-references and classifiers.
 *
 * Nothing here is authored by hand and nothing is a claim about origins; the
 * composition layer keeps that discipline (see docs/etymology-sources.md).
 *
 * Run: node scripts/build-dictionary.mjs
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MMAH_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';
const MMAH_CACHE = resolve(root, 'node_modules/.cache/makemeahanzi-dictionary.txt');
const CEDICT_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';
const CEDICT_CACHE = resolve(root, 'node_modules/.cache/cedict_1_0_ts_utf-8_mdbg.txt.gz');

async function cached(url, path) {
  try {
    return await readFile(path);
  } catch {
    /* not cached yet */
  }
  process.stderr.write(`fetching ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  await mkdir(dirname(path), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
  return readFile(path);
}

const HAN = /\p{Script=Han}/u;
const IDS_OPERATORS = /[⿰-⿿？]/u;

/** Tone-numbered CEDICT pinyin ("ji1 che1", "lu:3") to the marked house style ("jī chē", "lǜ"). */
const MARKS = {
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  ü: 'ǖǘǚǜ',
};
function markSyllable(syllable) {
  const m = /^([a-zA-Z:]+)([1-5])$/.exec(syllable);
  if (!m) return syllable.toLowerCase();
  const letters = m[1].replace(/u:/g, 'ü').toLowerCase();
  const tone = Number(m[2]);
  if (tone === 5) return letters;
  let index = -1;
  if (letters.includes('a')) index = letters.indexOf('a');
  else if (letters.includes('e')) index = letters.indexOf('e');
  else if (letters.includes('ou')) index = letters.indexOf('o');
  else {
    for (let i = letters.length - 1; i >= 0; i -= 1) {
      if ('iouü'.includes(letters[i])) {
        index = i;
        break;
      }
    }
  }
  if (index < 0) return letters;
  const vowel = letters[index];
  const marked = MARKS[vowel]?.[tone - 1];
  return marked ? letters.slice(0, index) + marked + letters.slice(index + 1) : letters;
}
const markPinyin = (numbered) => numbered.split(/\s+/).filter(Boolean).map(markSyllable).join(' ');

/**
 * One CEDICT sense as a learner would want to read it: no pinyin brackets,
 * no cross-references, no classifiers, no "(Tw)" in a Taiwanese deck.
 * Returns null for a sense that is only a pointer to another entry.
 */
function cleanSense(sense) {
  let s = sense.trim();
  if (!s) return null;
  if (
    /^(CL:|variant of |old variant of |erhua variant of |see |see also |abbr\. for |abbr\. of |also written |also pr\. |Taiwan pr\. |same as |used in )/i.test(
      s,
    )
  ) {
    return null;
  }
  s = s.replace(/\[[^\]]*\]/g, ''); // pinyin of a cross-reference
  s = s.replace(/\((Tw|Taiwan)\)\s*/gi, '');
  // "(from Taiwanese, Tai-lo pr. [...])" loses its pronunciation with the bracket.
  s = s.replace(/,?\s*(Tai-lo|Taiwanese|Taiwan|Hokkien|Cantonese)\s+pr\.\s*/gi, '');
  s = s
    .replace(/\(\s*\)/g, '')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(');
  s = s
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([;,])/g, '$1')
    .trim();
  if (!s || /^\(.*\)$/.test(s)) return null;
  return s;
}

const STOPWORDS = new Set(
  'a an the of to in on with and or for as by at from is are be it its one very kind sort type style taiwanese taiwan chinese slang coll sth sb lit fig'.split(
    ' ',
  ),
);
/** The words a gloss is made of, lowercased and roughly singular, parentheticals dropped. */
function contentWords(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
      .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)),
  );
}
/** Two glosses close enough to be the same sense: two shared content words, or one inside the other. */
function sameSense(a, b) {
  const x = contentWords(a);
  const y = contentWords(b);
  if (x.size === 0 || y.size === 0) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared >= 2 || shared === Math.min(x.size, y.size);
}

function parseCedict(text) {
  const byTrad = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line || line.startsWith('#')) continue;
    const m = /^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/.exec(line);
    if (!m) continue;
    const [, trad, , pinyin, glosses] = m;
    const list = byTrad.get(trad) ?? [];
    list.push({ pinyin, senses: glosses.split('/') });
    byTrad.set(trad, list);
  }
  return byTrad;
}

/** Entries for a headword, the common noun before the surname, place or brand. */
function commonEntries(entries) {
  const lower = entries.filter((e) => !/^[A-Z]/.test(e.pinyin));
  return lower.length > 0 ? lower : entries;
}

async function main() {
  const mmah = new Map();
  for (const line of (await cached(MMAH_URL, MMAH_CACHE)).toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    mmah.set(row.character, row);
  }
  const cedict = parseCedict(gunzipSync(await cached(CEDICT_URL, CEDICT_CACHE)).toString('utf8'));

  const deck = JSON.parse(await readFile(resolve(root, 'src/data/starterDeck.json'), 'utf8'));
  const etymology = JSON.parse(await readFile(resolve(root, 'src/data/etymology.json'), 'utf8'));

  // Every character a chip, a breakdown part, a foil contrast or a family tile
  // can show: the deck's words, their variants and foils, the composition
  // table's characters and every component it names.
  const chars = new Set();
  const addChars = (text) => {
    for (const ch of text ?? '') if (HAN.test(ch)) chars.add(ch);
  };
  /** Each deck word (and accepted variant) with the definition its card teaches. */
  const words = new Map();
  for (const rows of Object.values(deck.entries)) {
    for (const row of rows) {
      words.set(row[0], row[2]);
      addChars(row[0]);
      for (const foil of (row[7] ?? '').split('|')) addChars(foil);
      for (const variant of (row[8] ?? '').split('|')) {
        if (variant.trim()) words.set(variant.trim(), row[2]);
        addChars(variant);
      }
      for (const homophone of (row[9] ?? '').split('|')) addChars(homophone);
    }
  }
  for (const [ch, row] of Object.entries(etymology)) {
    chars.add(ch);
    for (const part of row.split('|')[0])
      if (HAN.test(part) && !IDS_OPERATORS.test(part)) chars.add(part);
  }

  const charRows = {};
  let fromCedict = 0;
  const missing = [];
  for (const ch of [...chars].sort()) {
    const row = mmah.get(ch);
    const entries = commonEntries(cedict.get(ch) ?? []);
    let pinyin = (row?.pinyin ?? []).find((p) => typeof p === 'string' && p.trim()) ?? '';
    let gloss = (row?.definition ?? '').trim();
    if (!pinyin && entries.length) pinyin = markPinyin(entries[0].pinyin);
    if (!gloss && entries.length) {
      const senses = entries.flatMap((e) => e.senses.map(cleanSense)).filter(Boolean);
      gloss = senses.slice(0, 3).join('; ');
      if (gloss) fromCedict += 1;
    }
    if (!pinyin && !gloss) {
      missing.push(ch);
      continue;
    }
    charRows[ch] = `${pinyin}|${gloss}`;
  }

  // The senses a word has besides the one its card teaches: the card's own
  // sense and near-repeats are dropped here, so the file carries only what
  // the reveal would add. Paraphrases the word test cannot see stay in, and
  // the app shows them under a "dictionary" label rather than an "also".
  const wordRows = {};
  for (const [word, definition] of [...words].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const entries = commonEntries(cedict.get(word) ?? []);
    const senses = [];
    for (const entry of entries) {
      for (const sense of entry.senses) {
        const clean = cleanSense(sense);
        if (!clean) continue;
        if (sameSense(clean, definition ?? '')) continue;
        if (senses.some((kept) => sameSense(kept, clean))) continue;
        senses.push(clean);
      }
    }
    if (senses.length > 0) wordRows[word] = senses.slice(0, 5);
  }

  const body =
    `{\n  "chars": {\n` +
    Object.entries(charRows)
      .map(([ch, row]) => `    ${JSON.stringify(ch)}: ${JSON.stringify(row)}`)
      .join(',\n') +
    `\n  },\n  "words": {\n` +
    Object.entries(wordRows)
      .map(([w, senses]) => `    ${JSON.stringify(w)}: ${JSON.stringify(senses)}`)
      .join(',\n') +
    `\n  }\n}\n`;
  await writeFile(resolve(root, 'src/data/dictionary.json'), body, 'utf8');
  process.stderr.write(
    `wrote ${Object.keys(charRows).length} characters (${fromCedict} glossed from CC-CEDICT, ` +
      `${missing.length} with nothing to say: ${missing.join('')}) and ` +
      `${Object.keys(wordRows).length} words with senses\n`,
  );
}

await main();
