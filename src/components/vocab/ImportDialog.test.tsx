import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { repository } from '@/db/repository';
import { makeCard } from '@/test/factories';
import { ImportDialog } from './ImportDialog';

const CSV = `traditional,pinyin,definition,domain,tags,example_sentence,foils
滷肉飯,lǔ ròu fàn,Braised pork rice,food,staple,台灣的滷肉飯很好吃。,魯
團契,tuán qì,Church fellowship,church,youth,我們有青年團契。,團隊
團契,tuán qì,dup,church,,,
`;

describe('ImportDialog (Journey 2)', () => {
  afterEach(async () => {
    await repository.clearAll();
  });

  it('previews rows, flags duplicates and imports only new cards by default', async () => {
    const existing = [makeCard({ traditional: '滷肉飯' })];
    await repository.putCard(existing[0]);
    const onImported = vi.fn();
    render(
      <ImportDialog
        source={{ fileName: 'deck.csv', text: CSV }}
        existing={existing}
        onClose={vi.fn()}
        onImported={onImported}
      />,
    );
    const rows = screen.getAllByTestId('import-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('data-status', 'duplicate');
    expect(rows[1]).toHaveAttribute('data-status', 'new');
    expect(rows[2]).toHaveAttribute('data-status', 'duplicate-in-file');
    expect(screen.getByTestId('import-counts')).toHaveTextContent('1');
    expect(screen.getByTestId('import-confirm')).toHaveTextContent('Import 1 card');

    await userEvent.selectOptions(screen.getByTestId('import-domain'), 'church');
    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith({ inserted: 1, updated: 0, skipped: 2, logs: 0 }),
    );
    const saved = await repository.findByTraditional('團契');
    expect(saved).toMatchObject({ domain: 'church', pinyin: 'tuán qì', fsrs: { state: 0 } });
    expect(await repository.countCards()).toBe(2);
  });

  it('can overwrite duplicates from the file', async () => {
    const existing = [makeCard({ traditional: '滷肉飯', definition: 'old' })];
    await repository.putCard(existing[0]);
    const onImported = vi.fn();
    render(
      <ImportDialog
        source={{ fileName: 'deck.csv', text: CSV }}
        existing={existing}
        onClose={vi.fn()}
        onImported={onImported}
      />,
    );
    await userEvent.click(screen.getByTestId('import-overwrite'));
    expect(screen.getByTestId('import-confirm')).toHaveTextContent('Import 2 cards');
    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith({ inserted: 1, updated: 1, skipped: 1, logs: 0 }),
    );
    expect((await repository.getCard(existing[0].id))?.definition).toBe('Braised pork rice');
  });

  it('surfaces parse issues for broken files', () => {
    render(
      <ImportDialog
        source={{ fileName: 'x.json', text: '{not json' }}
        existing={[]}
        onClose={vi.fn()}
        onImported={vi.fn()}
      />,
    );
    expect(screen.getByTestId('import-issues')).toHaveTextContent(/Not valid JSON/);
    expect(screen.getByTestId('import-confirm')).toBeDisabled();
  });
});
