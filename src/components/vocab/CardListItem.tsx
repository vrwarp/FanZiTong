import { Link } from 'react-router';
import { Hanzi } from '@/components/ui/Hanzi';
import { formatRelativeDue } from '@/lib/util/time';
import {
  CARD_STATE_LABELS,
  DOMAIN_LABELS,
  type CardStateValue,
  type DomainCategory,
  type VocabCard,
} from '@/types';

const DOT: Record<DomainCategory, string> = {
  food: 'bg-orange-500',
  church: 'bg-sky-500',
  slang: 'bg-emerald-500',
  anime: 'bg-fuchsia-500',
  custom: 'bg-stone-500',
};

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
          <p className="line-clamp-2 text-sm">{card.definition}</p>
          {card.variants && card.variants.length > 0 && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              也寫作 <Hanzi>{card.variants.join('、')}</Hanzi>
            </p>
          )}
          <p className="text-xs text-stone-500 dark:text-stone-400">
            <span
              className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${DOT[card.domain]}`}
              title={DOMAIN_LABELS[card.domain].en}
              aria-label={DOMAIN_LABELS[card.domain].en}
            />
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
      </Link>
    </li>
  );
}
