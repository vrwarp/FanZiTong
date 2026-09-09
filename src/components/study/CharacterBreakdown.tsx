import { Hanzi } from '@/components/ui/Hanzi';
import { useEtymology } from '@/hooks/useEtymology';
import {
  breakdown,
  hanziyuanUrl,
  soundFamily,
  SOUND_MATCH_LABELS,
  type BreakdownPart,
} from '@/lib/etymology';

export interface CharacterBreakdownProps {
  char: string;
  /** Characters the learner's own deck contains, for the sound family. */
  deckChars?: Iterable<string>;
  /** Hide the outbound link where there is no room for it. */
  showSource?: boolean;
}

const ROLE_STYLE: Record<BreakdownPart['role'], string> = {
  meaning: 'border-amber-brand/50 bg-amber-brand/10',
  sound: 'border-jade-500/50 bg-jade-500/10',
  part: 'border-stone-200 dark:border-stone-700',
};

function PartRow({ part }: { part: BreakdownPart }) {
  const label =
    part.role === 'sound'
      ? 'gives the reading'
      : part.role === 'meaning'
        ? part.gloss
        : (part.gloss ?? null);
  return (
    <li
      className={`flex items-baseline gap-1.5 rounded-lg border px-2 py-1 ${ROLE_STYLE[part.role]}`}
    >
      <Hanzi className="text-base font-semibold">{part.char}</Hanzi>
      {part.reading && (
        <span className="text-xs text-stone-500 dark:text-stone-400">{part.reading}</span>
      )}
      {label && <span className="text-xs text-stone-600 dark:text-stone-300">{label}</span>}
      {part.position && (
        <span className="text-[11px] text-stone-400 dark:text-stone-500">{part.position}</span>
      )}
    </li>
  );
}

/**
 * How one character is put together.
 *
 * The two roles are colour-coded because they answer different questions: the
 * amber part is what the character is *about*, the jade part is how it
 * *sounds*. A part with neither role is still shown — it is on the page, the
 * learner can see it — but it is left unlabelled rather than given a story.
 *
 * The link out is not decoration. The ancient forms are the thing this app
 * cannot ship: they are Richard Sears' copyrighted images, there is no
 * redistributable dataset, and an offline-first app should not pretend
 * otherwise. So the composition is offline and the history is one tap away.
 */
export function CharacterBreakdown({
  char,
  deckChars,
  showSource = true,
}: CharacterBreakdownProps) {
  useEtymology();
  const b = breakdown(char);
  if (!b) return null;
  const family = deckChars ? soundFamily(char, deckChars) : [];

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
      {family.length > 0 && (
        <p className="text-xs text-stone-600 dark:text-stone-300" data-testid="sound-family">
          Same sound part <Hanzi className="font-semibold">{b.sound!.char}</Hanzi>:{' '}
          <Hanzi>{family.join('、')}</Hanzi>
        </p>
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
