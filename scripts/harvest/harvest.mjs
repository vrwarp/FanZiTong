/**
 * Collect deck candidates and prove they are Taiwanese.
 *
 *   node scripts/harvest/harvest.mjs candidates   # categories -> candidates.json
 *   node scripts/harvest/harvest.mjs attest       # PTT hit counts, cached
 *   node scripts/harvest/harvest.mjs readings     # MOE readings for survivors
 *   node scripts/harvest/harvest.mjs report       # what each domain can support
 *
 * Every stage caches to scripts/harvest/out/, so re-running costs nothing and
 * nobody's server is asked the same question twice.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DOMAIN_SOURCES,
  HAN_ONLY,
  categoryMembers,
  cchatTerms,
  moedictEntry,
  pttHits,
} from './sources.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');

/**
 * How many PTT threads a word needs before it counts as Taiwanese.
 *
 * Zero always means no: the search that returns nothing for 丹貝 (tempeh),
 * 意粉 (Cantonese for spaghetti) and 地三鮮 (a northeastern dish) is telling
 * the truth about which kitchen those words belong to. Above zero the floor is
 * a supply decision rather than a linguistic one — slang has thousands of
 * candidates and can afford to be picky, ACG has a few hundred and cannot —
 * so the thinly attested cards are kept and marked instead of dropped.
 */
const ATTESTATION_FLOOR = { slang: 3, food: 1, church: 1, anime: 1 };
const THIN = 3;

const floorFor = (domains) => Math.min(...domains.map((d) => ATTESTATION_FLOOR[d] ?? 3));
const passes = (row, hits) => (hits[row.word] ?? 0) >= floorFor(row.domains);

async function load(name, fallback) {
  try {
    return JSON.parse(await readFile(path.join(OUT, name), 'utf8'));
  } catch {
    return fallback;
  }
}

async function save(name, value) {
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`);
}

/** Words already in the deck, so the harvest never proposes a duplicate. */
async function existingWords() {
  const source = await readFile(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/data/starterDeck.ts'),
    'utf8',
  );
  // The seed rows are tuples whose first element is the headword.
  return new Set([...source.matchAll(/^\s*'([㐀-鿿]+)',$/gm)].map((m) => m[1]));
}

async function candidates() {
  const already = await existingWords();
  const byWord = new Map();
  for (const [domain, sources] of Object.entries(DOMAIN_SOURCES)) {
    for (const [host, category] of sources) {
      let members;
      try {
        members = await categoryMembers(host, category);
      } catch (error) {
        console.error(`  ! ${host} ${category}: ${String(error).slice(0, 80)}`);
        continue;
      }
      for (const { word } of members) {
        const length = [...word].length;
        // Two to four characters: shorter is a bare character, longer is a
        // phrase or an article title rather than a word to learn.
        if (!HAN_ONLY.test(word) || length < 2 || length > 4) continue;
        if (already.has(word)) continue;
        const seen = byWord.get(word) ?? { word, domains: new Set(), sources: [] };
        seen.domains.add(domain);
        seen.sources.push(`https://${host}/wiki/${encodeURIComponent(word)}`);
        byWord.set(word, seen);
      }
      console.log(
        `  ${domain.padEnd(7)} ${host.split('.')[1].padEnd(10)} ${category}: ${members.length}`,
      );
    }
  }
  const rows = [...byWord.values()].map((c) => ({
    word: c.word,
    domains: [...c.domains],
    source: c.sources[0],
  }));
  await save('candidates.json', rows);
  console.log(`\n${rows.length} candidates -> out/candidates.json`);
}

async function attest() {
  const rows = await load('candidates.json', []);
  if (!rows.length) throw new Error('run `candidates` first');
  const cache = await load('attestation.json', {});
  let done = 0;
  for (const { word } of rows) {
    done += 1;
    if (word in cache) continue;
    try {
      cache[word] = await pttHits(word);
    } catch (error) {
      console.error(`  ! ${word}: ${String(error).slice(0, 60)}`);
      cache[word] = null;
    }
    if (done % 50 === 0) {
      await save('attestation.json', cache);
      console.log(`  ${done}/${rows.length}`);
    }
  }
  await save('attestation.json', cache);
  const attested = rows.filter((r) => passes(r, cache)).length;
  console.log(`\n${attested}/${rows.length} attested on PTT`);
}

async function readings() {
  const rows = await load('candidates.json', []);
  const hits = await load('attestation.json', {});
  const cache = await load('readings.json', {});
  const wanted = rows.filter((r) => passes(r, hits));
  let done = 0;
  for (const { word } of wanted) {
    done += 1;
    if (word in cache) continue;
    try {
      cache[word] = await moedictEntry(word);
    } catch {
      cache[word] = { mandarin: null, taigi: null };
    }
    if (done % 50 === 0) {
      await save('readings.json', cache);
      console.log(`  ${done}/${wanted.length}`);
    }
  }
  await save('readings.json', cache);
  console.log(`\nreadings for ${Object.keys(cache).length} words -> out/readings.json`);
}

async function report() {
  const rows = await load('candidates.json', []);
  const hits = await load('attestation.json', {});
  const readingsByWord = await load('readings.json', {});
  const perDomain = new Map();
  for (const row of rows) {
    const n = hits[row.word] ?? 0;
    for (const domain of row.domains) {
      const bucket = perDomain.get(domain) ?? {
        total: 0,
        attested: 0,
        thin: 0,
        withReading: 0,
        taigi: 0,
      };
      bucket.total += 1;
      if (passes(row, hits)) {
        bucket.attested += 1;
        if (n < THIN) bucket.thin += 1;
        if (readingsByWord[row.word]?.mandarin) bucket.withReading += 1;
        if (readingsByWord[row.word]?.taigi) bucket.taigi += 1;
      }
      perDomain.set(domain, bucket);
    }
  }
  console.log('domain    candidates  attested  thinly  MOE reading  Tâi-lô  short of 1000');
  for (const [domain, b] of perDomain) {
    const gap = Math.max(0, 1000 - b.attested);
    console.log(
      `${domain.padEnd(9)} ${String(b.total).padEnd(11)} ${String(b.attested).padEnd(9)} ${String(b.thin).padEnd(7)} ${String(b.withReading).padEnd(12)} ${String(b.taigi).padEnd(7)} ${gap || '-'}`,
    );
  }
}

/**
 * ACG candidates from C_Chat, kept only when a dictionary agrees they are words.
 * Without that check the list is anime titles and n-gram debris.
 */
async function cchat() {
  const mined = await cchatTerms();
  console.log(`${mined.length} n-grams recur on C_Chat; checking which are words`);
  const already = await existingWords();
  const kept = [];
  for (const { word, threads } of mined) {
    if (!HAN_ONLY.test(word) || already.has(word)) continue;
    const entry = await moedictEntry(word).catch(() => null);
    if (!entry?.mandarin) continue;
    kept.push({
      word,
      domains: ['anime'],
      source: `https://www.ptt.cc/bbs/C_Chat/search?q=${encodeURIComponent(word)}`,
      threads,
    });
  }
  const rows = await load('candidates.json', []);
  const seen = new Set(rows.map((r) => r.word));
  const added = kept.filter((k) => !seen.has(k.word));
  await save('candidates.json', [...rows, ...added]);
  console.log(`${added.length} new ACG candidates kept (of ${mined.length} mined)`);
}

const stage = process.argv[2];
const stages = { candidates, cchat, attest, readings, report };
if (!stages[stage]) {
  console.error(`usage: harvest.mjs <${Object.keys(stages).join('|')}>`);
  process.exit(1);
}
await stages[stage]();
