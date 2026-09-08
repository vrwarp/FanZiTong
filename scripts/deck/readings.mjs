/**
 * Taiwan readings, character by character, so a sentence's pinyin can be
 * proposed and then checked rather than typed from memory.
 *
 *   node scripts/deck/readings.mjs fetch    # MOE reading for every character
 *                                          # the pools and the deck use, cached
 *   node scripts/deck/readings.mjs check    # lint the shipped deck's readings
 *
 * The map is a lint, not an oracle. Mandarin is full of characters that read
 * two ways (了 le/liǎo, 不 bù/bú, 得 de/dé/děi), and MOE's first heteronym is
 * only one of them, so `check` reports a disagreement for a human to judge
 * instead of rewriting anything. What it catches reliably is the slip that
 * matters: a reading that belongs to no pronunciation of that character at all.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moedictEntry } from '../harvest/sources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const CHARS = path.join(OUT, 'chars.json');
const HAN = /[㐀-䶿一-鿿豈-﫿]/u;

/** Politeness: moedict is a volunteer project, not a CDN. */
const DELAY_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function load(file, fallback) {
  return readFile(file, 'utf8')
    .then(JSON.parse)
    .catch(() => fallback);
}

async function save(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 0)}\n`);
}

/** Every character the deck might need a reading for. */
async function neededChars() {
  const chars = new Set();
  const add = (text) => {
    for (const ch of String(text ?? '')) if (HAN.test(ch)) chars.add(ch);
  };
  const pool = await load(path.join(HERE, '..', 'harvest', 'out', 'pool.json'), []);
  for (const row of pool) {
    add(row.word);
    add(row.verse);
  }
  const deck = await load(path.join(HERE, '..', '..', 'src', 'data', 'starterDeck.json'), null);
  if (deck) {
    for (const rows of Object.values(deck.entries)) {
      for (const row of rows) {
        add(row[0]);
        add(row[4]);
        add(row[7]);
        add(row[8]);
      }
    }
  }
  // The function words that hold a sentence together are rare in headwords and
  // unavoidable in sentences.
  add(
    '的了嗎呢吧啊我你他她它們是不在有這那個一二三四五六七八九十好還要就都很和跟給把被會能可以說看去來到過著得地很太也還再又才只沒別讓對從向往上下裡外前後左右大小多少長短高低早晚今明昨天年月日時分秒點半每次回件本張條隻位些什麼怎為何誰哪裡邊面兒子女媽爸哥姐弟妹家人朋友老師學生同學先生太太小姐',
  );
  return [...chars].sort();
}

async function fetchAll() {
  const known = await load(CHARS, {});
  const wanted = await neededChars();
  const missing = wanted.filter((ch) => !(ch in known));
  console.log(`${wanted.length} characters wanted, ${missing.length} not cached`);
  let done = 0;
  for (const ch of missing) {
    const entry = await moedictEntry(ch).catch(() => null);
    // null is cached too: asking again next run would get the same nothing.
    known[ch] = entry?.mandarin ?? null;
    done += 1;
    if (done % 200 === 0) {
      await save(CHARS, known);
      console.log(`  ${done}/${missing.length}`);
    }
    await sleep(DELAY_MS);
  }
  await save(CHARS, known);
  const have = Object.values(known).filter(Boolean).length;
  console.log(`${have}/${Object.keys(known).length} characters have an MOE reading`);
}

const TONELESS = new Map(
  Object.entries({
    ā: 'a',
    á: 'a',
    ǎ: 'a',
    à: 'a',
    ē: 'e',
    é: 'e',
    ě: 'e',
    è: 'e',
    ī: 'i',
    í: 'i',
    ǐ: 'i',
    ì: 'i',
    ō: 'o',
    ó: 'o',
    ǒ: 'o',
    ò: 'o',
    ū: 'u',
    ú: 'u',
    ǔ: 'u',
    ù: 'u',
    ǖ: 'ü',
    ǘ: 'ü',
    ǚ: 'ü',
    ǜ: 'ü',
  }),
);

/** "lǜ" → "lü": the sound without the tone, for comparing a reading loosely. */
export function toneless(syllable) {
  return [...syllable.toLowerCase()].map((c) => TONELESS.get(c) ?? c).join('');
}

export async function charReadings() {
  return load(CHARS, {});
}

const stage = process.argv[2];
if (stage) {
  const stages = { fetch: fetchAll };
  if (!stages[stage]) {
    console.error(`usage: readings.mjs <${Object.keys(stages).join('|')}>`);
    process.exit(1);
  }
  await stages[stage]();
}
