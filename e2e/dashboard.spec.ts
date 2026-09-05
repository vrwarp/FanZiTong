import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test.describe('Learn dashboard', () => {
  test("first launch seeds the starter deck and shows today's plan", async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('繁字通');
    await expect(page.getByTestId('due-summary')).toHaveText('0 reviews, 10 new cards');
    await expect(page.getByTestId('estimated-time')).toContainText('min');
    await expect(page.getByTestId('streak-badge')).toHaveText(/Start your streak/);
    await expect(page.getByTestId('how-it-works')).toBeVisible();
    await expect(page.getByTestId('start-session')).toBeEnabled();
    await expect(page.getByText(/\d+ words/)).toBeVisible();
  });

  test('bottom navigation reaches every tab', async ({ page }) => {
    await openApp(page);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await nav.getByRole('link', { name: /Drills/ }).click();
    await expect(page).toHaveURL(/\/drills$/);
    await nav.getByRole('link', { name: /Vocab/ }).click();
    await expect(page).toHaveURL(/\/vocab$/);
    await nav.getByRole('link', { name: /Stats/ }).click();
    await expect(page).toHaveURL(/\/stats$/);
    await nav.getByRole('link', { name: /Settings/ }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await nav.getByRole('link', { name: /Learn/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('unknown routes fall back to the dashboard', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByTestId('start-session')).toBeVisible();
  });
});
