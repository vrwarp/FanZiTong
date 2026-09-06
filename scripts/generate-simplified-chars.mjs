/**
 * Generate src/data/simplifiedChars.ts from OpenCC's STCharacters table.
 *
 * The app is a Traditional-reading trainer, so a simplified glyph in a card is
 * a content bug (docs/ux-critique-log.md). Detecting one needs a list of
 * characters that are simplified-ONLY: 说 → 說 is simplified, but 台, 后, 干
 * and 里 map to a set that includes themselves, so they are legal Traditional
 * characters too and must never be flagged.
 *
 * Usage: node scripts/generate-simplified-chars.mjs [path-to-STCharacters.txt]
 * Without an argument the table is fetched from the pinned OpenCC commit.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Pinned so a regeneration is reproducible; bump deliberately.
const OPENCC_REF = 'ver.1.1.9';
const SOURCE_URL = `https://raw.githubusercontent.com/BYVoid/OpenCC/${OPENCC_REF}/data/dictionary/STCharacters.txt`;

/**
 * Characters OpenCC converts away from, but which Taiwan actually writes.
 *
 * OpenCC's traditional target follows Kangxi/Hong Kong preferences in a few
 * places where Taiwan's standard (or common usage) keeps the shorter form.
 * Flagging these would reject correct Taiwanese text, so they are removed from
 * the table. Add to this list only with evidence that the form is attested in
 * Taiwan writing.
 */
const TAIWAN_ALLOWLIST = [
  '\u7fa4', // 群 — MOE standard; OpenCC prefers 羣
  '\u75f4', // 痴 — 白痴; OpenCC prefers 癡
  '\u79d8', // 秘 — 秘書; OpenCC prefers 祕
];

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, '..', 'src', 'data', 'simplifiedChars.ts');

async function loadTable(arg) {
  if (arg) return readFile(arg, 'utf8');
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Could not fetch ${SOURCE_URL}: ${res.status}`);
  return res.text();
}

const raw = await loadTable(process.argv[2]);

const simplifiedOnly = [];
for (const line of raw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [key, values = ''] = line.split('\t');
  const simplified = key?.trim();
  if (!simplified || Array.from(simplified).length !== 1) continue;
  const traditional = values.trim().split(/\s+/).filter(Boolean);
  if (traditional.length === 0) continue;
  // A character that is also one of its own Traditional forms (台, 后, 干, 里)
  // is legal Traditional text; only flag characters that always convert away.
  if (traditional.includes(simplified)) continue;
  if (TAIWAN_ALLOWLIST.includes(simplified)) continue;
  simplifiedOnly.push(simplified);
}
simplifiedOnly.sort();

const chunks = [];
for (let i = 0; i < simplifiedOnly.length; i += 64) {
  chunks.push(simplifiedOnly.slice(i, i + 64).join(''));
}

const body = `/**
 * Simplified-only characters, generated from OpenCC ${OPENCC_REF} STCharacters.
 *
 * Run \`npm run simplified\` to regenerate. Characters that are also a valid
 * Traditional form of themselves (台, 后, 干, 里, 面 ...) are deliberately
 * absent, as are the Taiwan-standard forms OpenCC converts away from
 * (群, 痴, 秘): all of them are legal in a Traditional deck.
 *
 * DO NOT EDIT BY HAND.
 */

/** Every character that is simplified and never a Traditional form. */
export const SIMPLIFIED_ONLY: string =
${chunks.map((c) => `  '${c}'`).join(' +\n')};

const SIMPLIFIED_SET = new Set(Array.from(SIMPLIFIED_ONLY));

/** True when this single character only exists as a simplified form. */
export function isSimplifiedOnly(char: string): boolean {
  return SIMPLIFIED_SET.has(char);
}

/** The simplified-only characters in \`text\`, in order, without duplicates. */
export function findSimplified(text: string): string[] {
  const found: string[] = [];
  for (const char of text) {
    if (SIMPLIFIED_SET.has(char) && !found.includes(char)) found.push(char);
  }
  return found;
}
`;

await writeFile(outFile, body, 'utf8');
console.log(`Wrote ${outFile} with ${simplifiedOnly.length} simplified-only characters.`);
