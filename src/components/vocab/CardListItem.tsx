import { Link } from 'react-router';
import { DomainBadge } from '@/components/ui/Badge';
import { Hanzi } from '@/components/ui/Hanzi';
import { formatRelativeDue } from '@/lib/util/time';
import { CARD_STATE_LABELS, type CardStateValue, type VocabCard } from '@/types';

export function CardListItem({
  card,
  showPinyin,
  now,
  leechThreshold,
}: {
  card: VocabCard;
  showPinyin: boolean;
  now: Date;
  leechThreshold: number;
}) {
  const state = CARD_STATE_LABELS[card.fsrs.state as CardStateValue] ?? 'New';
  const isLeech = card.fsrs.lapses >= leechThreshold;
  return (
    <li>
      <Link
        to={`/vocab/${card.id}`}
        className="card-surface flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-ink-3"
        data-testid="vocab-item"
      >
        <Hanzi className="min-w-16 text-2xl font-bold">{card.traditional}</Hanzi>
        <div className="min-w-0 flex-1">
          {showPinyin && (
            <p className="text-sm text-brand-700 dark:text-brand-300" data-testid="vocab-pinyin">
              {card.pinyin}
            </p>
          )}
          <p className="truncate text-sm">{card.definition}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {state}
            {card.fsrs.state !== 0 && ` · ${formatRelativeDue(new Date(card.fsrs.due), now)}`}
            {card.fsrs.lapses > 0 &&
              ` · ${card.fsrs.lapses} lapse${card.fsrs.lapses === 1 ? '' : 's'}`}
            {isLeech && (
              <span className="ml-1 rounded-full bg-red-100 px-1.5 font-bold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                LEECH
              </span>
            )}
          </p>
        </div>
        <DomainBadge domain={card.domain} className="hidden sm:inline-flex" />
      </Link>
    </li>
  );
}
