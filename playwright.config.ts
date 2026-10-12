import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({

  testDir: './packages/playwright/tests',

  fullyParallel: true,

  timeout: 60_000,

  expect: {
    timeout: 10_000
  },

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 1 : 0,

  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: 'never'
      }
    ]
  ],

  use: {

    baseURL: process.env.BASE_URL,

    headless: false,

    actionTimeout: 15_000,

    navigationTimeout: 30_000,

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'retain-on-failure'
  },

  projects: [

    {
      name: 'chromium',

      use: {
        ...devices['Desktop Chrome']
      }
    }

  ],

  outputDir: 'test-results'
});