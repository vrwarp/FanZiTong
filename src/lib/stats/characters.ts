import { dayKey } from '@/lib/util/time';
import { hanChars } from '@/lib/util/pinyin';
import {
  DOMAIN_CATEGORIES,
  type DomainCategory,
  type RatingGrade,
  type ReviewLog,
  type VocabCard,
} from '@/types';

/**
 * What the review log says about one character, across every studied word it
 * appears in.
 *
 * A heritage reader recognises high-frequency words as wholes — 滷肉飯 is a
 * logo on a menu long before 滷 is bound to lǔ — so a word read on sight is
 * evidence about the word, not a proof that its characters are known. The
 * facts here are therefore kept at the word grain: "read in 滷肉飯" is a claim
 * the learner can check against their own memory of that word.
 */
export interface CharacterFact {
  char: string;
  /** Studied words containing the character. */
  words: string[];
  /** Words in which the character was read correctly in a real test. */
  readIn: string[];
  /** Words in which it was failed in a real test. */
  failedIn: string[];
}

export type CharacterKnowledge = Map<string, CharacterFact>;

/**
 * A real test is the first answer a card ever had — the first-sight rating —
 * or a recognition answer on a later study day than that first sight. A
 * same-day look after the reveal is a memory of the screen and says nothing
 * about the characters; a drill is a four-tile pick and is left out too.
 * Good and Easy count as read; Again as failed; Hard — "slow, or only part of
 * it" — as neither, since the part not read may be the character in question.
 */
export function characterKnowledge(cards: VocabCard[], logs: ReviewLog[]): CharacterKnowledge {
  const byCard = new Map<string, ReviewLog[]>();
  for (const log of logs) {
    const list = byCard.get(log.cardId);
    if (list) list.push(log);
    else byCard.set(log.cardId, [log]);
  }
  const knowledge: CharacterKnowledge = new Map();
  const fact = (ch: string): CharacterFact => {
    let f = knowledge.get(ch);
    if (!f) {
      f = { char: ch, words: [], readIn: [], failedIn: [] };
      knowledge.set(ch, f);
    }
    return f;
  };
  const add = (list: string[], word: string) => {
    if (!list.includes(word)) list.push(word);
  };

  for (const card of cards) {
    const history = byCard.get(card.id);
    if (!history || history.length === 0) continue;
    const ordered = [...history].sort((a, b) => a.reviewTimestamp.localeCompare(b.reviewTimestamp));
    const chars = Array.from(new Set(hanChars(card.traditional)));
    if (chars.length === 0) continue;
    for (const ch of chars) add(fact(ch).words, card.traditional);

    const firstDay = dayKey(new Date(ordered[0].reviewTimestamp));
    for (const [index, log] of ordered.entries()) {
      const realTest =
        index === 0 ||
        (log.exerciseType === 'rapid_recognition' &&
          dayKey(new Date(log.reviewTimestamp)) !== firstDay);
      if (!realTest) continue;
      if (log.rating >= 3) for (const ch of chars) add(fact(ch).readIn, card.traditional);
      else if (log.rating === 1) for (const ch of chars) add(fact(ch).failedIn, card.traditional);
    }
  }
  return knowledge;
}

/** What the learner has done with a character in words OTHER than this one. */
export interface CharacterElsewhere {
  /** Other studied words in which the character was read correctly. */
  readIn: string[];
  /** Other studied words in which it was failed and never read. */
  failedIn: string[];
}

export function characterElsewhere(
  knowledge: CharacterKnowledge,
  char: string,
  word: string,
): CharacterElsewhere {
  const fact = knowledge.get(char);
  if (!fact) return { readIn: [], failedIn: [] };
  const readIn = fact.readIn.filter((w) => w !== word);
  const failedIn = fact.failedIn.filter((w) => w !== word && !readIn.includes(w));
  return { readIn, failedIn };
}

/** The chip's claim about a character, from the learner's other words. */
export interface ElsewhereLabel {
  /** The claim: "read in", "missed in", or "new here". */
  text: string;
  /** The word the claim is about, when there is one. */
  word?: string;
  /** How many further words back the same claim. */
  more: number;
  tone: 'read' | 'missed' | 'new';
}

export function describeElsewhere(
  knowledge: CharacterKnowledge | undefined,
  char: string,
  word: string,
): ElsewhereLabel | null {
  if (!knowledge) return null;
  const elsewhere = characterElsewhere(knowledge, char, word);
  if (elsewhere.readIn.length > 0) {
    return {
      text: 'read in',
      word: elsewhere.readIn[0],
      more: elsewhere.readIn.length - 1,
      tone: 'read',
    };
  }
  if (elsewhere.failedIn.length > 0) {
    return {
      text: 'missed in',
      word: elsewhere.failedIn[0],
      more: elsewhere.failedIn.length - 1,
      tone: 'missed',
    };
  }
  return { text: 'new here', more: 0, tone: 'new' };
}

export interface CharacterSummary {
  /** Distinct characters across the studied words. */
  met: number;
  /** Read correctly in at least one real test. */
  read: number;
  /** Met, but never read in a real test. */
  notYet: number;
  /** The not-yet characters, most-failed first. */
  notYetChars: CharacterFact[];
}

export function summarizeCharacters(knowledge: CharacterKnowledge): CharacterSummary {
  const facts = Array.from(knowledge.values());
  const read = facts.filter((f) => f.readIn.length > 0);
  const notYet = facts
    .filter((f) => f.readIn.length === 0)
    .sort((a, b) => b.failedIn.length - a.failedIn.length || (a.char < b.char ? -1 : 1));
  return { met: facts.length, read: read.length, notYet: notYet.length, notYetChars: notYet };
}

export type RatingTally = Record<RatingGrade, number>;

export interface FirstSightDomain {
  domain: DomainCategory;
  /** Words with at least one answer. */
  met: number;
  ratings: RatingTally;
  /** Read on sight: rated Good or Easy the first time it was ever seen. */
  onSight: number;
}

/**
 * The heritage reader's fingerprint: how each domain was rated the first time
 * its words were seen. A word rated Good or Easy on sight was already in the
 * learner's lexicon; an Again was a shape they had never bound.
 */
export function firstSightProfile(cards: VocabCard[], logs: ReviewLog[]): FirstSightDomain[] {
  const first = new Map<string, ReviewLog>();
  for (const log of logs) {
    const existing = first.get(log.cardId);
    if (!existing || log.reviewTimestamp < existing.reviewTimestamp) first.set(log.cardId, log);
  }
  return DOMAIN_CATEGORIES.map((domain) => {
    const ratings: RatingTally = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let met = 0;
    for (const card of cards) {
      if (card.domain !== domain) continue;
      const log = first.get(card.id);
      if (!log) continue;
      met += 1;
      ratings[log.rating] += 1;
    }
    return { domain, met, ratings, onSight: ratings[3] + ratings[4] };
  });
}
