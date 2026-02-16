import { test, expect } from '@playwright/test';

test('full page visual snapshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=Memento mori');
  await expect(page).toHaveScreenshot('full-page.png', {
    fullPage: true,
  });
});
