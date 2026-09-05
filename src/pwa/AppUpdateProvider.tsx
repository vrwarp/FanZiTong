import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { clearChunkReloadAttempt } from '@/lib/pwa/chunkErrors';
import {
  APPLY_RELOAD_FALLBACK_MS,
  BACKSTOP_CHECK_INTERVAL_MS,
  shouldAutoCheck,
} from '@/lib/pwa/updatePolicy';
import type { UpdateStatus } from '@/lib/pwa/updatePolicy';
import { AppUpdateContext, type AppUpdate } from './appUpdateContext';

/**
 * Owns the single service-worker registration and decides when to look for a
 * new version.
 *
 * An hourly timer is not enough on a phone: the app is backgrounded or killed
 * long before it fires, so a learner who studies ten minutes a day would never
 * be told an update exists. The checks that matter are the ones tied to the
 * moments the app is actually used — coming back to the foreground and
 * regaining connectivity — throttled so flicking between apps costs nothing.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [checkState, setCheckState] = useState<UpdateStatus>(() =>
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'unknown' : 'unsupported',
  );
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastCheckedRef = useRef<number | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null;
      if (!registration) {
        setCheckState('unsupported');
        return;
      }
      // Loading the page already asked the server for the worker script, so
      // this counts as a check and the throttle starts from here.
      lastCheckedRef.current = Date.now();
      setLastCheckedAt(lastCheckedRef.current);
      setCheckState('up-to-date');
    },
    onRegisterError() {
      setCheckState('error');
    },
  });

  const checkNow = useCallback(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setCheckState('unsupported');
      return;
    }
    setCheckState('checking');
    void (async () => {
      try {
        // Settings can be opened before registration finishes, so look the
        // worker up rather than calling the page uncached on a race.
        const registration =
          registrationRef.current ?? (await navigator.serviceWorker.getRegistration()) ?? null;
        if (!registration) {
          setCheckState('unsupported');
          return;
        }
        registrationRef.current = registration;
        await registration.update();
        lastCheckedRef.current = Date.now();
        setLastCheckedAt(lastCheckedRef.current);
        // If that fetch found something, `needRefresh` flips once it installs
        // and takes precedence over this state.
        setCheckState('up-to-date');
      } catch {
        lastCheckedRef.current = Date.now();
        setLastCheckedAt(lastCheckedRef.current);
        setCheckState('error');
      }
    })();
  }, []);

  useEffect(() => {
    const maybeCheck = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (!registrationRef.current) return;
      if (!shouldAutoCheck(lastCheckedRef.current, Date.now())) return;
      checkNow();
    };
    document.addEventListener('visibilitychange', maybeCheck);
    window.addEventListener('online', maybeCheck);
    const backstop = window.setInterval(maybeCheck, BACKSTOP_CHECK_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', maybeCheck);
      window.removeEventListener('online', maybeCheck);
      window.clearInterval(backstop);
    };
  }, [checkNow]);

  const applyUpdate = useCallback(() => {
    // A reload onto the new build is a fresh start for the stale-chunk guard.
    clearChunkReloadAttempt();

    // Own the reload rather than leaving it to the registration helper. With
    // `clientsClaim` the first worker already claimed this page once, and the
    // helper's one-shot controller listener is spent by then — the new worker
    // activates but the tab keeps rendering the old build, which is the exact
    // "the update will not take" trap this whole feature exists to close.
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', reload, { once: true });
    // If the worker never takes control — nothing was waiting, or the message
    // was lost — reload anyway; landing on the current build is always right.
    window.setTimeout(reload, APPLY_RELOAD_FALLBACK_MS);
    void updateServiceWorker(false).catch(reload);
  }, [updateServiceWorker]);

  const value = useMemo<AppUpdate>(
    () => ({
      status: needRefresh ? 'update-ready' : checkState,
      updateReady: needRefresh,
      lastCheckedAt,
      checkNow,
      applyUpdate,
      dismissBanner: () => setBannerDismissed(true),
      bannerDismissed,
    }),
    [needRefresh, checkState, lastCheckedAt, checkNow, applyUpdate, bannerDismissed],
  );

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
}
