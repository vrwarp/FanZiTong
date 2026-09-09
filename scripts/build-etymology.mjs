/**
 * Build `src/data/etymology.json`: the character-composition layer.
 *
 * WHAT THIS DOES AND DOES NOT TAKE FROM ITS SOURCE
 *
 * The source (Make Me a Hanzi) carries two very different kinds of field.
 * The mechanical ones — the Ideographic Description Sequence and the Kangxi
 * radical — are checkable by looking at the character, and we take them. The
 * prose `etymology.hint`, and the `semantic`/`phonetic` labels that go with
 * it, are secondary scholarship of uneven quality: for 麵 the file names 麥
 * (wheat) as the phonetic and 面 as the semantic, which is exactly backwards,
 * and for 魯 it offers "to talk 日 like a fish 魚", which is a mnemonic, not a
 * derivation. We take none of it.
 *
 * Instead we decide the sound side from evidence the learner can check on the
 * screen in front of them: a component is only called the sound half when its
 * own modern Mandarin reading still predicts the character's. That is a
 * narrower claim than "this is the phonetic" — three thousand years of sound
 * change means many real phonetics no longer rhyme — but it is the only claim
 * that helps someone guess a reading, which is what this app is for, and it is
 * the only one we can stand behind without a paleographer.
 *
 * Run: node scripts/build-etymology.mjs
 * Source: https://github.com/skishore/makemeahanzi (dictionary.txt, LGPL-3.0,
 * itself derived from Unihan and CJKlib). See docs/etymology-sources.md.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';
const CACHE = resolve(root, 'node_modules/.cache/makemeahanzi-dictionary.txt');

async function source() {
  try {
    return await readFile(CACHE, 'utf8');
  } catch {
    /* not cached yet */
  }
  process.stderr.write(`fetching ${SOURCE_URL}\n`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`${SOURCE_URL} -> ${res.status}`);
  await mkdir(dirname(CACHE), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(CACHE));
  return readFile(CACHE, 'utf8');
}

const IDS_OPERATORS = /[⿰-⿿？]/u;
const HAN = /\p{Script=Han}/u;

/** Top-level pieces of an IDS string: the operators and unknowns dropped. */
function idsParts(ids) {
  if (!ids) return [];
  return [...ids].filter((ch) => !IDS_OPERATORS.test(ch));
}

/**
 * Shapes a decomposition can name but nobody reads as a character.
 *
 * They are excluded from ever being called the sound component: 七 qī does
 * decompose to ⿻一乚, and 一 is yī, and the rhyme is a coincidence, not a
 * phonetic. These are the same shapes left unglossed in src/data/components.ts,
 * for the same reason.
 */
const STROKES = new Set([...'丨丶丿乚亅乙⺀⺌⺊肀彐彑爻冂冖凵匚亠丷⺗几弋']);

/**
 * Components common enough that a bare rhyme is more likely coincidence than
 * inheritance. Chosen by reading the rime-graded output: every claim these
 * produced was wrong (具 jù "from" 目 mù, 替 tì "from" 日 rì, 直 zhí "from"
 * 十 shí), and removing them costs no correct one. They stay eligible at the
 * exact and same-syllable grades, where the evidence is much stronger.
 */
const WEAK_RHYME_SOURCES = new Set([...'一二十日目宀']);

const toneless = (p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Everything after the initial consonant: "fàn" -> "an", "zhāng" -> "ang". */
const rime = (p) => toneless(p).replace(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyvw])/, '');

/**
 * How well a component's reading predicts the character's, or null.
 * Ordered strongest first; only these three are ever asserted.
 */
function soundMatch(charReadings, partReadings) {
  for (const c of charReadings) {
    for (const p of partReadings) {
      if (c === p) return 'exact';
    }
  }
  for (const c of charReadings) {
    for (const p of partReadings) {
      if (toneless(c) === toneless(p)) return 'tone';
    }
  }
  for (const c of charReadings) {
    for (const p of partReadings) {
      // Same ending and same tone, different initial: 監 jiān -> 藍 lán would
      // fail here (different tone) and is therefore never asserted.
      if (rime(c) === rime(p) && tone(c) === tone(p) && tone(c) !== 5) return 'rime';
    }
  }
  return null;
}

const TONE_MARKS = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };
function tone(p) {
  for (const ch of p.normalize('NFD')) if (TONE_MARKS[ch]) return TONE_MARKS[ch];
  return 5;
}

/** Strongest match first; `rank` orders the candidates for one character. */
const MATCH_RANK = { exact: 0, tone: 1, rime: 2 };
const rank = (match) => MATCH_RANK[match];

async function main() {
  const dict = new Map();
  for (const line of (await source()).split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    dict.set(row.character, row);
  }

  const deck = JSON.parse(await readFile(resolve(root, 'src/data/starterDeck.json'), 'utf8'));
  const wanted = new Set();
  const add = (text) => {
    for (const ch of text ?? '') if (HAN.test(ch)) wanted.add(ch);
  };
  for (const rows of Object.values(deck.entries)) {
    for (const row of rows) {
      add(row[0]); // the word
      add(row[4]); // the example sentence
      for (const foil of (row[7] ?? '').split('|')) add(foil);
      for (const variant of (row[8] ?? '').split('|')) add(variant);
    }
  }
  // Every character the app can already say something about, so the two
  // layers cover the same ground.
  const charInfoSource = await readFile(resolve(root, 'src/data/charInfo.ts'), 'utf8');
  for (const [, ch] of charInfoSource.matchAll(/^ {2}(\p{Script=Han}): /gmu)) add(ch);
  // Components of wanted characters are themselves worth an entry, so tapping
  // 鹵 inside 滷 lands somewhere rather than nowhere.
  for (const ch of [...wanted]) add(idsParts(dict.get(ch)?.decomposition).join(''));

  const readings = (ch) =>
    (dict.get(ch)?.pinyin ?? []).filter((p) => typeof p === 'string' && p.trim());

  const out = {};
  let sounded = 0;
  let dropped = 0;
  for (const ch of [...wanted].sort()) {
    const row = dict.get(ch);
    if (!row) continue;
    const parts = idsParts(row.decomposition).filter((p) => p !== ch);
    // A character that decomposes to nothing but itself has no composition to
    // show; it is a component, not a compound.
    if (parts.length < 2) continue;
    const mine = readings(ch);
    const radical = row.radical && parts.includes(row.radical) ? row.radical : null;
    let sound = null;
    if (mine.length) {
      for (const part of parts) {
        if (STROKES.has(part)) continue;
        const theirs = readings(part);
        if (!theirs.length) continue;
        const match = soundMatch(mine, theirs);
        // A shared rhyme is weak evidence on its own, and the component already
        // doing the meaning is the likeliest place for a coincidence to land:
        // 嘔 ǒu is ⿰口區, and it is 區 that once carried the sound, not the 口
        // that happens to rhyme. So a rhyme is only accepted from a component
        // that is not already accounted for.
        if (match === 'rime' && (part === radical || WEAK_RHYME_SOURCES.has(part))) continue;
        if (match && (!sound || rank(match) < rank(sound.match))) sound = { part, match };
      }
    }
    // Neither a reading to lend nor a component we could name: a decomposition
    // into bare strokes (肉 "is" 冂 + 仌) teaches nothing, so it is not shipped.
    if (!sound && !radical) {
      dropped++;
      continue;
    }
    if (sound) sounded++;
    out[ch] = [
      row.decomposition,
      radical ?? '',
      sound?.part ?? '',
      sound ? sound.match[0] : '',
    ].join('|');
  }

  // One "ids|radical|sound|match" row per character, the same compact shape the
  // starter deck uses: this file ships to a phone, and the field names would be
  // three quarters of it.
  const body = Object.entries(out)
    .map(([ch, row]) => `  ${JSON.stringify(ch)}: ${JSON.stringify(row)}`)
    .join(',\n');
  await writeFile(resolve(root, 'src/data/etymology.json'), `{\n${body}\n}\n`, 'utf8');
  process.stderr.write(
    `wrote ${Object.keys(out).length} characters, ${sounded} with a usable sound component, ` +
      `${dropped} dropped as bare strokes\n`,
  );
}

await main();
