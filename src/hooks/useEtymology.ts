import { useEffect, useSyncExternalStore } from 'react';
import { isLoaded, loadEtymologyTable, subscribe } from '@/lib/etymology/table';

/**
 * Pull in the character-composition chunk and re-render when it lands.
 *
 * Returns false for the first frame or two after mounting. Every caller treats
 * that the same way it treats a character with no breakdown — by rendering
 * nothing — so the panel appears rather than flickering through a spinner.
 */
export function useEtymology(): boolean {
  const loaded = useSyncExternalStore(subscribe, isLoaded, isLoaded);
  useEffect(() => {
    if (!loaded) void loadEtymologyTable();
  }, [loaded]);
  return loaded;
}
