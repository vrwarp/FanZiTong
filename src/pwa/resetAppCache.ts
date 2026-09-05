/**
 * Last resort for a wedged install: drop the service worker and every cached
 * asset so the next load comes straight from the network.
 *
 * This deliberately touches only the HTTP/asset caches. The learner's deck,
 * review history and settings live in IndexedDB and are left untouched — the
 * UI that offers this must say so, because "Reset all data" next to it means
 * something entirely different.
 */
export async function resetAppCache(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}
