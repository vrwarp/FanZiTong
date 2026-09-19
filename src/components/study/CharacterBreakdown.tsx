import { useMemo } from 'react';
import { Hanzi } from '@/components/ui/Hanzi';
import { briefGloss, charInfo } from '@/data/charInfo';
import { useEtymology } from '@/hooks/useEtymology';
import {
  breakdown,
  hanziyuanUrl,
  shortGloss,
  soundFamily,
  SOUND_MATCH_LABELS,
  type BreakdownPart,
} from '@/lib/etymology';
import type { CharacterKnowledge } from '@/lib/stats/characters';
import { cn } from '@/lib/util/cn';
import { hanChars } from '@/lib/util/pinyin';
import type { VocabCard } from '@/types';

export interface CharacterBreakdownProps {
  char: string;
  /** Characters the learner's own deck contains, for the sound family. */
  deckChars?: Iterable<string>;
  /** The deck, so a family member can be shown in a word the learner knows it from. */
  pool?: readonly VocabCard[];
  /** What the review log says about each character, so the family names the ones met. */
  knowledge?: CharacterKnowledge;
  /** Hide the outbound link where there is no room for it. */
  showSource?: boolean;
}

const ROLE_STYLE: Record<BreakdownPart['role'], string> = {
  meaning: 'border-amber-brand/50 bg-amber-brand/10',
  sound: 'border-jade-500/50 bg-jade-500/10',
  part: 'border-stone-200 dark:border-stone-700',
};

const ROLE_LABEL: Record<BreakdownPart['role'], string | null> = {
  meaning: 'gives the meaning',
  sound: 'gives the reading',
  part: null,
};

/**
 * One component: its reading and what it means, then what it does here.
 * A component with no reading of its own (氵) shows the full form's meaning;
 * the reading and gloss come from the dictionary when the composition table
 * does not name them, so no part is left as a bare shape.
 */
function PartRow({ part }: { part: BreakdownPart }) {
  const info = charInfo(part.char);
  const reading = part.reading ?? info?.pinyin;
  const gloss = part.gloss ?? info?.gloss;
  const role = ROLE_LABEL[part.role];
  return (
    <li
      className={`flex flex-wrap items-baseline gap-x-1.5 rounded-lg border px-2 py-1 ${ROLE_STYLE[part.role]}`}
      data-testid="breakdown-part"
      data-role={part.role}
    >
      <Hanzi className="text-base font-semibold">{part.char}</Hanzi>
      {reading && <span className="text-xs text-stone-500 dark:text-stone-400">{reading}</span>}
      {gloss && (
        <span className="text-xs text-stone-600 dark:text-stone-300">{shortGloss(gloss)}</span>
      )}
      {role && (
        <span
          className={cn(
            'text-[11px] font-semibold',
            part.role === 'sound'
              ? 'text-jade-700 dark:text-jade-500'
              : 'text-amber-800 dark:text-amber-300',
          )}
        >
          · {role}
        </span>
      )}
      {part.position && (
        <span className="text-[11px] text-stone-400 dark:text-stone-500">{part.position}</span>
      )}
    </li>
  );
}

/** How the learner stands with a character in the deck's other words. */
interface FamilyMember {
  char: string;
  reading?: string;
  gloss?: string;
  /** A word to know it from: one the learner has met first, else any deck word. */
  word?: string;
  status: 'read' | 'missed' | 'seen' | 'unseen';
}

const STATUS_ORDER: Record<FamilyMember['status'], number> = {
  read: 0,
  missed: 1,
  seen: 2,
  unseen: 3,
};

/**
 * The deck characters built on the same sound part, the ones the learner has
 * already met first — each with the word they met it in. This is the payoff
 * of the composition layer: 忍 in 認 is not a shape to memorise but the same
 * 忍 they read in 忍者 last week, and the reading comes with it.
 */
function familyOf(
  char: string,
  stem: string,
  deckChars: Iterable<string>,
  pool: readonly VocabCard[] | undefined,
  knowledge: CharacterKnowledge | undefined,
): FamilyMember[] {
  const deck = new Set(deckChars);
  const chars = soundFamily(char, deck);
  // The sound part itself, when it is a character of some deck word.
  if (deck.has(stem) && stem !== char && !chars.includes(stem)) chars.unshift(stem);
  return chars
    .map((member): FamilyMember => {
      const fact = knowledge?.get(member);
      const info = charInfo(member);
      const inDeck = pool?.filter((c) => hanChars(c.traditional).includes(member)) ?? [];
      const met = fact?.words ?? [];
      const word = fact?.readIn[0] ?? met[0] ?? inDeck[0]?.traditional;
      const status: FamilyMember['status'] =
        fact && fact.readIn.length > 0
          ? 'read'
          : fact && fact.failedIn.length > 0
            ? 'missed'
            : met.length > 0
              ? 'seen'
              : 'unseen';
      return {
        char: member,
        ...(info?.pinyin ? { reading: info.pinyin } : {}),
        ...(info?.gloss ? { gloss: briefGloss(info.gloss) } : {}),
        ...(word ? { word } : {}),
        status,
      };
    })
    .sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.char.localeCompare(b.char),
    );
}

const FAMILY_SHOWN = 6;

const STATUS_STYLE: Record<FamilyMember['status'], string> = {
  read: 'border-jade-500/50 text-jade-700 dark:text-jade-500',
  missed: 'border-amber-brand/50 text-amber-800 dark:text-amber-300',
  seen: 'border-stone-300 text-stone-700 dark:border-stone-600 dark:text-stone-200',
  unseen: 'border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400',
};

const STATUS_LABEL: Record<FamilyMember['status'], string> = {
  read: 'read',
  missed: 'missed',
  seen: 'met',
  unseen: 'not yet met',
};

/**
 * How one character is put together.
 *
 * The two roles are colour-coded because they answer different questions: the
 * amber part is what the character is *about*, the jade part is how it
 * *sounds*. A part with neither role is still shown — it is on the page, the
 * learner can see it — with its own reading and meaning but no story about
 * what it does here.
 *
 * The link out is not decoration. The ancient forms are the thing this app
 * cannot ship: they are Richard Sears' copyrighted images, there is no
 * redistributable dataset, and an offline-first app should not pretend
 * otherwise. So the composition is offline and the history is one tap away.
 */
export function CharacterBreakdown({
  char,
  deckChars,
  pool,
  knowledge,
  showSource = true,
}: CharacterBreakdownProps) {
  const loaded = useEtymology();
  const b = breakdown(char);
  const stem = b?.sound?.char;
  const family = useMemo(
    () => (stem && deckChars ? familyOf(char, stem, deckChars, pool, knowledge) : []),
    // `loaded` is a dependency on purpose: the family is empty until the chunk lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [char, stem, deckChars, pool, knowledge, loaded],
  );
  if (!b) return null;
  const stemInfo = stem ? charInfo(stem) : undefined;
  const shown = family.slice(0, FAMILY_SHOWN);
  const met = family.filter((m) => m.status !== 'unseen').length;

  return (
    <div className="flex flex-col gap-1.5" data-testid="character-breakdown">
      <ul className="flex flex-wrap gap-1.5">
        {b.parts.map((part, i) => (
          <PartRow key={`${part.char}-${i}`} part={part} />
        ))}
      </ul>
      {b.sound && b.sound.match !== 'exact' && (
        <p className="text-[11px] text-stone-500 dark:text-stone-400">
          <Hanzi>{b.sound.char}</Hanzi> {SOUND_MATCH_LABELS[b.sound.match]} — close enough to guess
          from, not to spell from.
        </p>
      )}
      {stem && deckChars && (
        <div className="flex flex-col gap-1" data-testid="sound-family">
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Same sound part <Hanzi className="font-semibold">{stem}</Hanzi>
            {stemInfo?.pinyin && ` ${stemInfo.pinyin}`}
            {stemInfo?.gloss && ` “${briefGloss(stemInfo.gloss)}”`}
            {family.length === 0 ? (
              <span className="text-stone-500 dark:text-stone-400"> · no other deck word yet</span>
            ) : met > 0 ? (
              <span className="text-stone-500 dark:text-stone-400"> · in your words first</span>
            ) : (
              <span className="text-stone-500 dark:text-stone-400">
                {' '}
                · in words you have not met yet
              </span>
            )}
          </p>
          {shown.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {shown.map((m) => (
                <li
                  key={m.char}
                  className={cn(
                    'flex flex-wrap items-baseline gap-x-1 rounded-lg border px-2 py-0.5 text-xs',
                    STATUS_STYLE[m.status],
                  )}
                  data-testid="family-member"
                  data-status={m.status}
                >
                  <Hanzi className="text-sm font-semibold">{m.char}</Hanzi>
                  {m.reading && <span>{m.reading}</span>}
                  {m.gloss && <span className="text-stone-500 dark:text-stone-400">{m.gloss}</span>}
                  {m.word && (
                    <span>
                      · <Hanzi>{m.word}</Hanzi>
                    </span>
                  )}
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">
                    {STATUS_LABEL[m.status]}
                  </span>
                </li>
              ))}
              {family.length > shown.length && (
                <li className="self-center text-[11px] text-stone-500 dark:text-stone-400">
                  +{family.length - shown.length} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}
      {showSource && (
        <a
          href={hanziyuanUrl(char)}
          target="_blank"
          rel="noreferrer noopener"
          className="self-start text-xs text-jade-700 underline underline-offset-2 dark:text-jade-500"
          onClick={(e) => e.stopPropagation()}
          data-testid="hanziyuan-link"
        >
          Ancient forms of <Hanzi>{char}</Hanzi> on 字源 ↗
        </a>
      )}
    </div>
  );
}
