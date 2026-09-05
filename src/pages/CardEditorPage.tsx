import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, inputClass, textareaClass } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { repository } from '@/db/repository';
import { useCard } from '@/hooks/useCards';
import { newFsrsState } from '@/lib/fsrs/scheduler';
import { splitList } from '@/lib/io/domain';
import { uuid } from '@/lib/util/id';
import { numberedToMarks } from '@/lib/util/pinyin';
import { formatRelativeDue } from '@/lib/util/time';
import {
  CARD_STATE_LABELS,
  CARD_STATE_ZH,
  DOMAIN_CATEGORIES,
  DOMAIN_LABELS,
  type CardStateValue,
  type DomainCategory,
  type VocabCard,
} from '@/types';

interface FormState {
  traditional: string;
  pinyin: string;
  definition: string;
  domain: DomainCategory;
  tags: string;
  exampleSentenceTraditional: string;
  exampleSentencePinyin: string;
  exampleSentenceTranslation: string;
  visualFoils: string;
  variants: string;
  spoken: string;
  variantNote: string;
  clozeDistractors: string;
}

const EMPTY_FORM: FormState = {
  traditional: '',
  pinyin: '',
  definition: '',
  domain: 'custom',
  tags: '',
  exampleSentenceTraditional: '',
  exampleSentencePinyin: '',
  exampleSentenceTranslation: '',
  visualFoils: '',
  variants: '',
  spoken: '',
  variantNote: '',
  clozeDistractors: '',
};

function toForm(card: VocabCard): FormState {
  return {
    traditional: card.traditional,
    pinyin: card.pinyin,
    definition: card.definition,
    domain: card.domain,
    tags: card.tags.join(' | '),
    exampleSentenceTraditional: card.exampleSentenceTraditional ?? '',
    exampleSentencePinyin: card.exampleSentencePinyin ?? '',
    exampleSentenceTranslation: card.exampleSentenceTranslation ?? '',
    visualFoils: (card.visualFoils ?? []).join(' | '),
    variants: (card.variants ?? []).join(' | '),
    spoken: card.spoken ?? '',
    variantNote: card.variantNote ?? '',
    clozeDistractors: (card.clozeDistractors ?? []).join(' | '),
  };
}

/** Inline card editor (create + edit) with FSRS diagnostics for existing cards. */
export default function CardEditorPage() {
  const navigate = useNavigate();
  const { cardId } = useParams();
  const existing = useCard(cardId);
  const isNew = !cardId;

  if (!isNew && existing === undefined)
    return <p className="p-4 text-sm text-stone-500">Loading…</p>;
  if (!isNew && !existing) {
    return (
      <div className="p-4">
        <p>Card not found.</p>
        <Button className="mt-3" onClick={() => navigate('/vocab')}>
          Back to Vocab
        </Button>
      </div>
    );
  }
  // Keyed on the card id so a different card gets a fresh form.
  return <CardEditorForm key={existing?.id ?? 'new'} existing={existing ?? null} />;
}

function CardEditorForm({ existing }: { existing: VocabCard | null }) {
  const navigate = useNavigate();
  const cardId = existing?.id;
  const isNew = !existing;
  const [form, setForm] = useState<FormState>(() => (existing ? toForm(existing) : EMPTY_FORM));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const traditional = form.traditional.trim();
    if (!traditional) {
      setError('Traditional characters are required.');
      return;
    }
    const clash = await repository.findByTraditional(traditional);
    if (clash && clash.id !== cardId) {
      setError(`“${traditional}” is already in your deck.`);
      return;
    }
    const now = new Date().toISOString();
    const base: VocabCard = existing ?? {
      id: uuid(),
      traditional,
      pinyin: '',
      definition: '',
      domain: 'custom',
      tags: [],
      fsrs: newFsrsState(),
      createdAt: now,
      updatedAt: now,
    };
    const card: VocabCard = {
      ...base,
      traditional,
      pinyin: numberedToMarks(form.pinyin.trim()),
      definition: form.definition.trim(),
      domain: form.domain,
      tags: splitList(form.tags),
      updatedAt: now,
    };
    const sentence = form.exampleSentenceTraditional.trim();
    card.exampleSentenceTraditional = sentence || undefined;
    card.exampleSentencePinyin = numberedToMarks(form.exampleSentencePinyin.trim()) || undefined;
    card.exampleSentenceTranslation = form.exampleSentenceTranslation.trim() || undefined;
    const foils = splitList(form.visualFoils);
    card.visualFoils = foils.length ? foils : undefined;
    const variants = splitList(form.variants);
    card.variants = variants.length ? variants : undefined;
    card.spoken = form.spoken.trim() || undefined;
    card.variantNote = form.variantNote.trim() || undefined;
    const clozeDistractors = splitList(form.clozeDistractors);
    card.clozeDistractors = clozeDistractors.length ? clozeDistractors : undefined;
    // A foil must be unambiguously wrong: never a real spelling of this or another word.
    const allCards = await repository.getAllCards();
    const realSpellings = new Set(
      allCards.flatMap((c) => [c.traditional, ...(c.variants ?? [])]).concat(variants),
    );
    const realFoil = foils.find((f) => realSpellings.has(f));
    if (realFoil) {
      setError(
        `“${realFoil}” is a real spelling — move it to “Also written” instead of the foils.`,
      );
      return;
    }
    await repository.putCard(card);
    navigate('/vocab');
  };

  const remove = async () => {
    if (cardId) await repository.deleteCard(cardId);
    navigate('/vocab');
  };

  const resetProgress = async () => {
    if (!existing) return;
    await repository.putCard({
      ...existing,
      fsrs: newFsrsState(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4" data-testid="card-editor">
      <PageHeader
        title={isNew ? 'New card' : 'Edit card'}
        zh={isNew ? '新增' : '編輯'}
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/vocab')}>
            Cancel
          </Button>
        }
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <Field label="Traditional characters 繁體" htmlFor="traditional">
        <input
          id="traditional"
          className={`${inputClass} hanzi text-2xl`}
          lang="zh-Hant-TW"
          value={form.traditional}
          onChange={set('traditional')}
          required
          autoComplete="off"
          data-testid="field-traditional"
        />
      </Field>
      <Field
        label="Pinyin (tone marks or numbers)"
        htmlFor="pinyin"
        hint="lu3 rou4 fan4 is converted to lǔ ròu fàn."
      >
        <input
          id="pinyin"
          className={inputClass}
          value={form.pinyin}
          onChange={set('pinyin')}
          data-testid="field-pinyin"
        />
      </Field>
      <Field label="Definition" htmlFor="definition">
        <input
          id="definition"
          className={inputClass}
          value={form.definition}
          onChange={set('definition')}
          data-testid="field-definition"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Domain" htmlFor="domain">
          <select
            id="domain"
            className={inputClass}
            value={form.domain}
            onChange={set('domain')}
            data-testid="field-domain"
          >
            {DOMAIN_CATEGORIES.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABELS[d].emoji} {DOMAIN_LABELS[d].en} {DOMAIN_LABELS[d].zh}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tags" htmlFor="tags" hint="Separate with |">
          <input id="tags" className={inputClass} value={form.tags} onChange={set('tags')} />
        </Field>
      </div>
      <Field
        label="Example sentence 例句"
        htmlFor="sentence"
        hint="Must contain the word to power cloze drills."
      >
        <textarea
          id="sentence"
          className={`${textareaClass} hanzi text-lg`}
          lang="zh-Hant-TW"
          value={form.exampleSentenceTraditional}
          onChange={set('exampleSentenceTraditional')}
          data-testid="field-sentence"
        />
      </Field>
      <Field label="Sentence pinyin" htmlFor="sentencePinyin">
        <input
          id="sentencePinyin"
          className={inputClass}
          value={form.exampleSentencePinyin}
          onChange={set('exampleSentencePinyin')}
        />
      </Field>
      <Field label="Sentence translation" htmlFor="translation">
        <input
          id="translation"
          className={inputClass}
          value={form.exampleSentenceTranslation}
          onChange={set('exampleSentenceTranslation')}
        />
      </Field>
      <Field
        label="Visual foils 形近字"
        htmlFor="foils"
        hint="Wrong look-alikes only, separated with | (e.g. 滷內飯 | 滷肉販). Real alternative spellings go under Also written."
      >
        <input
          id="foils"
          className={`${inputClass} hanzi`}
          lang="zh-Hant-TW"
          value={form.visualFoils}
          onChange={set('visualFoils')}
          data-testid="field-foils"
        />
      </Field>
      <Field
        label="As heard 口語唸法"
        htmlFor="spoken"
        hint="Only when people say it differently from the pinyin (e.g. ô-á-tsian for 蚵仔煎). Used as the drill cue."
      >
        <input
          id="spoken"
          className={inputClass}
          value={form.spoken}
          onChange={set('spoken')}
          data-testid="field-spoken"
        />
      </Field>
      <Field
        label="Also written 也寫作"
        htmlFor="variants"
        hint="Accepted spellings you will see on signs and in chats (e.g. 魯肉飯 for 滷肉飯). Never used as wrong answers."
      >
        <input
          id="variants"
          className={`${inputClass} hanzi`}
          lang="zh-Hant-TW"
          value={form.variants}
          onChange={set('variants')}
          data-testid="field-variants"
        />
      </Field>
      <Field
        label="Note on spellings"
        htmlFor="variantNote"
        hint="Where you meet each spelling, e.g. “借口 is what most people type online”."
      >
        <input
          id="variantNote"
          className={inputClass}
          value={form.variantNote}
          onChange={set('variantNote')}
          data-testid="field-variant-note"
        />
      </Field>
      <Field
        label="Fill-the-blank distractors 填空干擾詞"
        htmlFor="clozeDistractors"
        hint="Readable words that must NOT fit the example sentence, separated with |. Optional; other domains are used otherwise."
      >
        <input
          id="clozeDistractors"
          className={`${inputClass} hanzi`}
          lang="zh-Hant-TW"
          value={form.clozeDistractors}
          onChange={set('clozeDistractors')}
          data-testid="field-cloze-distractors"
        />
      </Field>

      {existing && (
        <section className="card-surface p-4 text-sm" aria-labelledby="fsrs-heading">
          <h2 id="fsrs-heading" className="font-bold">
            Memory state
          </h2>
          {existing.fsrs.state === 0 ? (
            <p className="mt-2 text-stone-600 dark:text-stone-300" data-testid="memory-new">
              Not studied yet <span lang="zh-Hant-TW">還沒學過</span> — it will come up as a new
              card in a daily session.
            </p>
          ) : (
            <>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-stone-600 dark:text-stone-300">
                <dt>State</dt>
                <dd>
                  {CARD_STATE_LABELS[existing.fsrs.state as CardStateValue]}{' '}
                  <span lang="zh-Hant-TW">
                    {CARD_STATE_ZH[existing.fsrs.state as CardStateValue]}
                  </span>
                </dd>
                <dt>Due</dt>
                <dd>{formatRelativeDue(new Date(existing.fsrs.due), new Date())}</dd>
                <dt>Stability</dt>
                <dd>{existing.fsrs.stability.toFixed(2)} days</dd>
                <dt>Difficulty</dt>
                <dd>{existing.fsrs.difficulty.toFixed(2)} / 10</dd>
                <dt>Reviews / forgotten</dt>
                <dd>
                  {existing.fsrs.reps} / {existing.fsrs.lapses}
                </dd>
              </dl>
              <Button variant="outline" size="sm" className="mt-3" onClick={resetProgress}>
                Reset progress
              </Button>
            </>
          )}
        </section>
      )}

      <Button type="submit" size="lg" block data-testid="save-card">
        Save
      </Button>
      {existing && (
        <p className="text-center">
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-red-700 underline dark:text-red-300"
            onClick={() => setConfirmDelete(true)}
            data-testid="delete-card"
          >
            Delete this card <span lang="zh-Hant-TW">刪除</span>
          </button>
        </p>
      )}

      <Modal
        open={confirmDelete}
        title={`Delete ${existing?.traditional ?? 'this card'}?`}
        onClose={() => setConfirmDelete(false)}
        testId="delete-dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} data-testid="confirm-delete">
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm">Its review history will be deleted too. This cannot be undone.</p>
      </Modal>
    </form>
  );
}
