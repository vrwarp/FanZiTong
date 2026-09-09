import { Fragment } from 'react';
import { Hanzi } from '@/components/ui/Hanzi';
import { useEtymology } from '@/hooks/useEtymology';
import { contrast, shortGloss, type BreakdownPart } from '@/lib/etymology';

export interface CharacterContrastProps {
  /** The character the learner chose. */
  picked: string;
  /** The character the word actually uses. */
  correct: string;
}

function Parts({ parts }: { parts: BreakdownPart[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={`${part.char}-${i}`}>
          {i > 0 && ' and '}
          <Hanzi className="font-semibold">{part.char}</Hanzi>
          {part.gloss && ` (${shortGloss(part.gloss)})`}
        </Fragment>
      ))}
    </>
  );
}

/**
 * The one component that separates two characters the learner just mixed up.
 *
 * A foil pair is confusable precisely because most of it is shared; saying so
 * out loud — 滷 and 魯 both carry 鹵's family resemblance, but one has water in
 * it and one has a fish — gives the eye somewhere specific to look next time.
 * Renders nothing unless both characters break down and the difference has a
 * name, because "they differ in a stroke" is not worth a line of screen.
 */
export function CharacterContrast({ picked, correct }: CharacterContrastProps) {
  useEtymology();
  const diff = contrast(correct, picked);
  if (!diff) return null;
  const named = diff.aOnly.filter((p) => p.gloss);
  const namedOther = diff.bOnly.filter((p) => p.gloss);
  if (!named.length && !namedOther.length) return null;

  return (
    <span className="block text-xs text-stone-500 dark:text-stone-400" data-testid="foil-contrast">
      {named.length > 0 && (
        <>
          <Hanzi className="text-jade-600">{correct}</Hanzi> has <Parts parts={named} />
        </>
      )}
      {named.length > 0 && namedOther.length > 0 && '; '}
      {namedOther.length > 0 && (
        <>
          <Hanzi className="text-red-700">{picked}</Hanzi> has <Parts parts={namedOther} />
        </>
      )}
      .
    </span>
  );
}
