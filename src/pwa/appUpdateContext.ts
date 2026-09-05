import { createContext, useContext } from 'react';
import type { UpdateStatus } from '@/lib/pwa/updatePolicy';

export interface AppUpdate {
  status: UpdateStatus;
  /** A new version is downloaded and waiting for a reload. */
  updateReady: boolean;
  lastCheckedAt: number | null;
  /** Ask the server whether a newer build exists. */
  checkNow: () => void;
  /** Activate the waiting version and reload. */
  applyUpdate: () => void;
  dismissBanner: () => void;
  bannerDismissed: boolean;
}

/** Used when no provider is mounted (unit tests, and any tree without a shell). */
export const NO_APP_UPDATE: AppUpdate = {
  status: 'unsupported',
  updateReady: false,
  lastCheckedAt: null,
  checkNow: () => undefined,
  applyUpdate: () => undefined,
  dismissBanner: () => undefined,
  bannerDismissed: false,
};

export const AppUpdateContext = createContext<AppUpdate>(NO_APP_UPDATE);

/** Update state for the whole app; the banner and Settings read the same one. */
export function useAppUpdate(): AppUpdate {
  return useContext(AppUpdateContext);
}
