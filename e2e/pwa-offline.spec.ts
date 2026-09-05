import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test.describe('PWA (AC-4)', () => {
  test('serves a valid web app manifest and registers a service worker', async ({ page }) => {
    await openApp(page);
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const response = await page.request.get(new URL(manifestHref!, page.url()).toString());
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toContain('繁字通');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

    await page.waitForFunction(
      async () => Boolean((await navigator.serviceWorker.getRegistration())?.active),
      undefined,
      { timeout: 30_000 },
    );
  });

  test('runs a complete study session with no network access', async ({ page, context }) => {
    await openApp(page);
    await page.waitForFunction(
      async () => Boolean((await navigator.serviceWorker.getRegistration())?.active),
      undefined,
      { timeout: 30_000 },
    );
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, {
      timeout: 30_000,
    });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('start-session')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('offline-badge')).toBeVisible();

    await page.getByTestId('start-session').click();
    await expect(page.getByTestId('prompt-hanzi')).toBeVisible();
    await page.getByTestId('recognition-prompt').click();
    await expect(page.getByTestId('pinyin')).toBeVisible();
    await page.getByTestId('rate-4').click();
    await page.getByTestId('study-finish').click();
    await expect(page.getByTestId('summary-answers')).toHaveText('1');

    // Other routes are served from the precache too (navigateFallback).
    await page.goto('/stats');
    await expect(page.getByTestId('stat-cards')).toBeVisible();
    await page.goto('/');
    await expect(page.getByText(/Reviews 1\/30/)).toBeVisible();
    await context.setOffline(false);
  });
});
