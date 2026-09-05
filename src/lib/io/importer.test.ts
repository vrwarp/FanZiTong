import { CardState } from '@/types';
import { makeCard, reviewState } from '@/test/factories';
import { parseCsv } from './csv';
import { analyzeImport, materializeImport } from './importer';
import type { ImportRow } from './types';

function row(overrides: Partial<ImportRow>): ImportRow {
  return {
    traditional: '火鍋',
    pinyin: 'huǒ guō',
    definition: 'Hot pot',
    tags: [],
    visualFoils: [],
    variants: [],
    clozeDistractors: [],
    warnings: [],
    sourceIndex: 1,
    ...overrides,
  };
}

describe('analyzeImport', () => {
  it('flags duplicates against the deck and within the file', () => {
    const existing = [makeCard({ traditional: '滷肉飯' })];
    const rows = [
      row({ traditional: '滷肉飯', sourceIndex: 1 }),
      row({ traditional: '火鍋', sourceIndex: 2 }),
      row({ traditional: '火鍋', sourceIndex: 3 }),
      row({ traditional: '豆漿', sourceIndex: 4, warnings: ['No pinyin provided.'] }),
    ];
    const preview = analyzeImport(rows, existing);
    expect(preview.counts).toEqual({ total: 4, new: 2, duplicate: 1, duplicateInFile: 1 });
    expect(preview.rows[0].status).toBe('duplicate');
    expect(preview.rows[0].existingId).toBe(existing[0].id);
    expect(preview.rows[2].status).toBe('duplicate-in-file');
    expect(preview.rows[3].messages).toEqual(['No pinyin provided.']);
  });

  it('detects duplicates by id as well (backup restore)', () => {
    const existing = [makeCard({ traditional: '滷肉飯' })];
    const preview = analyzeImport(
      [row({ id: existing[0].id, traditional: '滷肉飯（改）' })],
      existing,
    );
    expect(preview.rows[0].status).toBe('duplicate');
  });
});

describe('materializeImport', () => {
  const now = new Date('2026-09-05T08:00:00.000Z');

  it('creates new cards with fresh FSRS state and a stable order', () => {
    const preview = analyzeImport(
      [row({ traditional: '火鍋' }), row({ traditional: '豆漿', sourceIndex: 2 })],
      [],
    );
    const result = materializeImport(preview, [], { duplicatePolicy: 'skip', now });
    expect(result.toInsert).toHaveLength(2);
    expect(result.toUpdate).toEqual([]);
    expect(result.toInsert[0].fsrs.state).toBe(CardState.New);
    expect(result.toInsert[0].domain).toBe('custom');
    expect(result.toInsert[0].createdAt < result.toInsert[1].createdAt).toBe(true);
    expect(result.toInsert[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('applies the domain override (Journey 2 step 5)', () => {
    const preview = analyzeImport([row({ traditional: '禱告', domain: 'food' })], []);
    const result = materializeImport(preview, [], {
      duplicatePolicy: 'skip',
      domainOverride: 'church',
      now,
    });
    expect(result.toInsert[0].domain).toBe('church');
  });

  it('skips duplicates by default and never touches learner progress', () => {
    const existing = [makeCard({ traditional: '滷肉飯', fsrs: reviewState({ reps: 7 }) })];
    const preview = analyzeImport(
      [row({ traditional: '滷肉飯', definition: 'new def' })],
      existing,
    );
    const result = materializeImport(preview, existing, { duplicatePolicy: 'skip', now });
    expect(result.toInsert).toEqual([]);
    expect(result.toUpdate).toEqual([]);
    expect(result.skipped).toBe(1);
  });

  it('overwrite policy updates content but keeps FSRS state unless the file carries one', () => {
    const existing = [makeCard({ traditional: '滷肉飯', fsrs: reviewState({ reps: 7 }) })];
    const plain = analyzeImport(
      [row({ traditional: '滷肉飯', definition: 'new def', tags: ['x'] })],
      existing,
    );
    const updated = materializeImport(plain, existing, { duplicatePolicy: 'overwrite', now })
      .toUpdate[0];
    expect(updated.id).toBe(existing[0].id);
    expect(updated.definition).toBe('new def');
    expect(updated.tags).toEqual(['x']);
    expect(updated.fsrs.reps).toBe(7);

    const backup = analyzeImport(
      [row({ traditional: '滷肉飯', fsrs: reviewState({ reps: 99 }) })],
      existing,
    );
    const restored = materializeImport(backup, existing, { duplicatePolicy: 'overwrite', now })
      .toUpdate[0];
    expect(restored.fsrs.reps).toBe(99);
  });

  it('keeps ids from a backup file and drops in-file repeats', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const preview = analyzeImport(
      [row({ id, traditional: '火鍋' }), row({ traditional: '火鍋', sourceIndex: 2 })],
      [],
    );
    const result = materializeImport(preview, [], { duplicatePolicy: 'skip', now });
    expect(result.toInsert).toHaveLength(1);
    expect(result.toInsert[0].id).toBe(id);
    expect(result.skipped).toBe(1);
  });

  it('works end to end from CSV text', () => {
    const { rows } = parseCsv('traditional,pinyin,definition,domain\n火鍋,huǒ guō,Hot pot,food\n');
    const result = materializeImport(analyzeImport(rows, []), [], { duplicatePolicy: 'skip', now });
    expect(result.toInsert[0]).toMatchObject({
      traditional: '火鍋',
      pinyin: 'huǒ guō',
      domain: 'food',
    });
  });
});
