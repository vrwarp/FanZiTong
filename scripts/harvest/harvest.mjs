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
  DOMAIN_BOARDS,
  DOMAIN_SOURCES,
  HAN_ONLY,
  bahamutTerms,
  categoryMembers,
  cuvVerses,
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
 * Church candidates from the 和合本, plus the verse each word came from.
 *
 * Public domain, so unlike every other corpus here its text may be kept: the
 * verse is saved alongside the word as a ready-made example sentence, which is
 * what the style guide asks for anyway.
 */
async function bible() {
  const cached = await load('cuv.json', null);
  const verses =
    cached ??
    (await cuvVerses({
      onChapter: (book, chap, n) => {
        if (chap === 1) process.stdout.write(`${book} `);
        if (n && n % 5000 === 0) console.log(`\n  ${n} verses`);
      },
    }));
  if (!cached) await save('cuv.json', verses);
  console.log(`\n${verses.length} verses`);

  // Count words, and remember the shortest verse each was seen in: a short
  // verse makes a better card than a long one.
  const counts = new Map();
  const homeVerse = new Map();
  for (const { ref, text } of verses) {
    for (const run of text.split(/[^一-鿿]+/)) {
      for (let n = 2; n <= 4; n += 1) {
        for (let i = 0; i + n <= run.length; i += 1) {
          const gram = run.slice(i, i + n);
          counts.set(gram, (counts.get(gram) ?? 0) + 1);
          const held = homeVerse.get(gram);
          if (!held || text.length < held.text.length) homeVerse.set(gram, { ref, text });
        }
      }
    }
  }
  const already = await existingWords();
  const rows = await load('candidates.json', []);
  const seen = new Set(rows.map((r) => r.word));
  const ranked = [...counts].filter(([, n]) => n >= 8).sort((a, b) => b[1] - a[1]);
  console.log(`${ranked.length} n-grams appear eight times or more; checking which are words`);
  const added = [];
  for (const [word, verseCount] of ranked) {
    if (!HAN_ONLY.test(word) || already.has(word) || seen.has(word)) continue;
    const entry = await moedictEntry(word).catch(() => null);
    if (!entry?.mandarin) continue;
    const home = homeVerse.get(word);
    added.push({
      word,
      domains: ['church'],
      source: 'https://bible.fhl.net/ 和合本 (public domain)',
      verses: verseCount,
      verse: home?.text,
      ref: home?.ref,
    });
    seen.add(word);
  }
  await save('candidates.json', [...rows, ...added]);
  console.log(`${added.length} new church candidates from scripture`);
}

/**
 * ACG candidates from 巴哈姆特, dictionary-checked like the C_Chat ones.
 *
 * Boards are sampled across the whole id range rather than cherry-picked, so
 * the vocabulary is not just one fandom's. 場外休憩區 is age-gated and skipped.
 */
async function bahamut() {
  // A spread over the sitemap's range: early ids are the long-lived boards,
  // later ones the games people are playing now.
  // Stride is an argument so a first pass can be cheap and a later one deeper;
  // 433 boards at stride 37 already yielded 442 candidates.
  const stride = Number(process.argv[3]) || 37;
  const boards = [];
  for (let bsn = 1; bsn <= 16000; bsn += stride) boards.push(bsn);
  const { boards: read, terms } = await bahamutTerms({ boards });
  console.log(`${read} boards read, ${terms.length} n-grams recur; checking which are words`);
  const already = await existingWords();
  const rows = await load('candidates.json', []);
  const seen = new Set(rows.map((r) => r.word));
  const added = [];
  for (const { word, threads } of terms) {
    if (!HAN_ONLY.test(word) || already.has(word) || seen.has(word)) continue;
    const entry = await moedictEntry(word).catch(() => null);
    if (!entry?.mandarin) continue;
    added.push({
      word,
      domains: ['anime'],
      source: `https://forum.gamer.com.tw/ (${threads} thread titles)`,
      threads,
    });
    seen.add(word);
  }
  await save('candidates.json', [...rows, ...added]);
  console.log(`${added.length} new ACG candidates from 巴哈姆特`);
}

/**
 * Ask the boards a word actually lives on, for the words the general board did
 * not know. Only the shortfall is re-queried, so this costs a fraction of a
 * full pass and nothing already answered is asked again.
 */
async function boards() {
  const rows = await load('candidates.json', []);
  const general = await load('attestation.json', {});
  const cache = await load('attestation-boards.json', {});
  const wanted = rows.filter((r) => !passes(r, general));
  console.log(`${wanted.length} candidates the general board did not know`);
  let done = 0;
  for (const row of wanted) {
    done += 1;
    for (const domain of row.domains) {
      for (const board of (DOMAIN_BOARDS[domain] ?? []).slice(1)) {
        const key = `${board}:${row.word}`;
        if (key in cache) continue;
        try {
          cache[key] = await pttHits(row.word, board);
        } catch {
          cache[key] = null;
        }
      }
    }
    if (done % 50 === 0) {
      await save('attestation-boards.json', cache);
      console.log(`  ${done}/${wanted.length}`);
    }
  }
  await save('attestation-boards.json', cache);
  // Fold the best answer back into the main table so every later stage sees it.
  const merged = { ...general };
  for (const [key, n] of Object.entries(cache)) {
    const word = key.slice(key.indexOf(':') + 1);
    merged[word] = Math.max(merged[word] ?? 0, n ?? 0);
  }
  await save('attestation.json', merged);
  const gained =
    rows.filter((r) => passes(r, merged)).length - rows.filter((r) => passes(r, general)).length;
  console.log(`\n${gained} more words attested once asked in the right room`);
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
const stages = { candidates, cchat, bahamut, bible, attest, boards, readings, report };
if (!stages[stage]) {
  console.error(`usage: harvest.mjs <${Object.keys(stages).join('|')}>`);
  process.exit(1);
}
await stages[stage]();
