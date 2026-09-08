/**
 * Look-alike characters, and the entries the app needs to explain them.
 *
 *   node scripts/deck/chars.mjs pairs.json   # merge into src/data/charInfo.ts
 *
 * Every card ships at least two look-alike foils, and the app can only explain
 * a wrong pick when it has a note for both characters involved. Writing a
 * bespoke foil per card would mean writing two bespoke notes per card as well;
 * writing them per *character pair* means one note serves every word that
 * character appears in, which is the difference between a few hundred notes and
 * several thousand.
 *
 * The input is a JSON object of characters:
 *
 *   { "天": { "pinyin": "tiān", "gloss": "sky, day", "tell": "天 has a long top stroke",
 *             "like": ["夭", "夫"] } }
 *
 * `like` names the characters this one is confusable with; each of those needs
 * an entry of its own in the same file or already in charInfo.ts. The pairing
 * is written to scripts/deck/out/lookAlikes.json, which the foil generator
 * reads; the notes are written into the shipped table.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHAR_INFO = path.join(HERE, '..', '..', 'src', 'data', 'charInfo.ts');
const PAIRS = path.join(HERE, 'lookAlikes.json');

const [command, input] = process.argv.slice(2);
if (command !== 'seed' && !(command === 'merge' && input)) {
  console.error('usage: chars.mjs seed | chars.mjs merge <pairs.json>');
  process.exit(1);
}

const source = await readFile(CHAR_INFO, 'utf8');

/**
 * The pairs the shipped table already implies.
 *
 * Every tell in charInfo.ts contrasts its character with another one by name
 * ("肉 has two 人 stacked inside; 內 has one 入"), so the pairing has been
 * written down all along — just not in a form anything could read.
 */
if (command === 'seed') {
  const known = new Set([...source.matchAll(/^ {2}(\S):/gmu)].map((m) => m[1]));
  const seeded = {};
  const add = (a, b) => {
    if (a === b) return;
    seeded[a] ??= [];
    if (!seeded[a].includes(b)) seeded[a].push(b);
  };
  for (const entry of source.split(/\n(?= {2}\S: \{)/)) {
    const char = /^ {2}(\S): \{/u.exec(entry)?.[1];
    const tell = /tell: '((?:[^'\\]|\\.)*)'/u.exec(entry)?.[1];
    if (!char || !tell) continue;
    // A tell is written as clauses, each opening with the character it is
    // about: "肉 has two 人 stacked inside; 內 has one 入". Only a character in
    // that opening position is the contrast partner — the ones inside a clause
    // are components being pointed at (人 and 入 there), and pairing with those
    // would produce foils that look nothing like the word.
    for (const clause of tell.split(/[;；]\s*/)) {
      const other = [...clause.trimStart()][0];
      if (other && other !== char && known.has(other)) {
        add(char, other);
        add(other, char);
      }
    }
  }
  await mkdir(path.dirname(PAIRS), { recursive: true });
  await writeFile(PAIRS, `${JSON.stringify(seeded, null, 0)}\n`);
  console.log(`${Object.keys(seeded).length} characters seeded from the tells already written`);
  process.exit(0);
}

const batch = JSON.parse(await readFile(input, 'utf8'));

const present = new Set([...source.matchAll(/^ {2}(\S):/gmu)].map((m) => m[1]));

const escape = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const lines = [];
for (const [char, info] of Object.entries(batch)) {
  if (present.has(char)) continue;
  if (!info.pinyin || !info.gloss) throw new Error(`${char}: needs a pinyin and a gloss`);
  const tell = info.tell ? `, tell: '${escape(info.tell)}'` : '';
  lines.push(
    `  ${char}: { pinyin: '${escape(info.pinyin)}', gloss: '${escape(info.gloss)}'${tell} },`,
  );
  present.add(char);
}

if (lines.length > 0) {
  const anchor = '\n};\n';
  const at = source.indexOf(anchor, source.indexOf('export const CHAR_INFO'));
  if (at < 0) throw new Error('could not find the end of CHAR_INFO');
  await writeFile(CHAR_INFO, `${source.slice(0, at)}\n${lines.join('\n')}${source.slice(at)}`);
}

// The pairing survives across batches: a later file may add a second look-alike
// for a character an earlier one introduced.
const pairs = await readFile(PAIRS, 'utf8')
  .then(JSON.parse)
  .catch(() => ({}));
let links = 0;
const link = (a, b) => {
  if (a === b) return;
  pairs[a] ??= [];
  if (!pairs[a].includes(b)) {
    pairs[a].push(b);
    links += 1;
  }
};
for (const [char, info] of Object.entries(batch)) {
  for (const other of info.like ?? []) {
    link(char, other);
    link(other, char);
  }
}
await mkdir(path.dirname(PAIRS), { recursive: true });
await writeFile(PAIRS, `${JSON.stringify(pairs, null, 0)}\n`);
console.log(
  `${lines.length} new character notes, ${links} new links; ${Object.keys(pairs).length} characters now have a look-alike`,
);
