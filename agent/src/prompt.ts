/**
 * Building the system prompt.
 *
 * The static half is identical for every conversation, so it sits in front of
 * the SDK's cache boundary and is billed once rather than per turn. Only the
 * genuinely per-session facts go after it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CARD_FORMAT_RULES } from '@/lib/assistant/rules';

const here = path.dirname(fileURLToPath(import.meta.url));

function readPrompt(name: string): string {
  // Works from src/ under tsx and from dist/ after bundling.
  for (const candidate of [
    path.join(here, '..', 'prompts', name),
    path.join(here, 'prompts', name),
  ]) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      continue;
    }
  }
  return '';
}

/** Worked examples beat description for format rules. */
const EXAMPLES = `## Two cards done right

滷肉飯 — pinyin "lǔ ròu fàn", definition "Braised minced pork over rice",
domain food, tags ["staple", "rice", "night-market"],
sentence "老闆，滷肉飯大碗一碗，加一顆滷蛋。"
reading "Lǎobǎn, lǔròufàn dà wǎn yī wǎn, jiā yī kē lǔdàn."
translation "Boss, one large braised pork rice, add a braised egg."
foils ["滷內飯", "滷肉販", "鹽肉飯"], variants ["魯肉飯"],
variantNote "魯肉飯 is what half the shops actually print."

團契 — pinyin "tuán qì", definition "Fellowship (church small-group gathering)",
domain church, tags ["evangelical", "youth"],
sentence "我們教會每週五晚上有青年團契。"
reading "Wǒmen jiàohuì měi zhōuwǔ wǎnshang yǒu qīngnián tuánqì."
translation "Our church has youth fellowship every Friday evening."
foils ["團隊", "契合", "團夥"].`;

export interface SessionFacts {
  localDate?: string;
  timeZone?: string;
  deckSize?: number;
  appBuild?: string;
}

/** The cacheable half: identical for every conversation and every learner. */
export function staticSystemPrompt(): string {
  return [readPrompt('system.md').trim(), CARD_FORMAT_RULES, EXAMPLES].filter(Boolean).join('\n\n');
}

/** The per-session half: small, and never worth caching. */
export function dynamicSystemPrompt(facts: SessionFacts): string {
  const lines: string[] = [];
  if (facts.localDate) {
    lines.push(`Today is ${facts.localDate}${facts.timeZone ? ` (${facts.timeZone})` : ''}.`);
  }
  if (typeof facts.deckSize === 'number') {
    lines.push(`Their deck holds ${facts.deckSize} cards right now.`);
  }
  if (facts.appBuild) lines.push(`App build ${facts.appBuild}.`);
  return lines.join('\n');
}

/** `systemPrompt` for the SDK: static, boundary marker, dynamic. */
export function buildSystemPrompt(boundary: string, facts: SessionFacts): string[] {
  const dynamic = dynamicSystemPrompt(facts);
  return dynamic ? [staticSystemPrompt(), boundary, dynamic] : [staticSystemPrompt()];
}
