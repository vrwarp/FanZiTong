import { useSyncExternalStore } from 'react';
import { settingsStore } from '@/state/settingsStore';

export function useSettings() {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.getSnapshot);
  const loaded = useSyncExternalStore(settingsStore.subscribe, settingsStore.isLoaded);
  return { settings, loaded, update: settingsStore.update };
}
