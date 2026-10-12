import { test, expect } from '@playwright/test';

test.describe('Framework Smoke Test', () => {

  test('Playwright framework should launch browser successfully',
    async ({ page }) => {

      await page.goto('https://example.com');

      await expect(page)
        .toHaveTitle(/Example Domain/);

    });

});