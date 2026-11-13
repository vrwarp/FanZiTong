import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { repository } from '@/db/repository';
import { READING_STATE_KEY, parseReadingState, type ReadingState } from '@/lib/reading/state';

/** The reading mode's memory (see lib/reading/state), live from the meta table. */
export function useReadingState(): {
  state: ReadingState;
  save: (next: ReadingState) => Promise<void>;
} {
  const raw = useLiveQuery(() => repository.getMeta(READING_STATE_KEY), []);
  const state = useMemo(() => parseReadingState(raw), [raw]);
  const save = useCallback(
    (next: ReadingState) => repository.setMeta(READING_STATE_KEY, JSON.stringify(next)),
    [],
  );
  return { state, save };
}
