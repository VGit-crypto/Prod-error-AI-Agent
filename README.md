# business-uat-agent

AI-powered UAT orchestration (test planning) with a Playwright TypeScript test runner.

This repository contains:

* **AI orchestration** utilities that turn a requirement/acceptance criteria into a structured UAT test plan.
* **Playwright E2E tests** (TypeScript) and a ready-to-use GitHub Actions workflow to run them in CI.

---

## Tech stack

* Node.js + TypeScript
* [Playwright](https://playwright.dev/) (`@playwright/test`)
* `dotenv` for local environment configuration

---

## Repository layout

```
apps/
  web/                      # (currently empty)

packages/
  ai/                       # AI provider + orchestration + schemas
  playwright/               # Playwright engine/pages/fixtures/tests

playwright.config.ts        # Playwright configuration (testDir, reporter, baseURL)
tsconfig.json               # TS config + path aliases
```

Key locations:

* Playwright tests: `packages/playwright/tests`
* AI provider (env-driven): `packages/ai/providers/AIProvider.ts`
* Example orchestration runner: `packages/ai/tests/orchestration.ts`

---

## Prerequisites

* **Node.js** (CI uses `lts/*`; local development should use an active LTS)
* **npm**

---

## Setup

Install dependencies:

```bash
npm ci
```

Install Playwright browsers:

```bash
npx playwright install
```

> In CI (Linux), the workflow uses `npx playwright install --with-deps` to install system dependencies.

---

## Configuration (environment variables)

This project loads environment variables from `.env` via `dotenv`.

### Playwright

| Variable | Required | Description |
|---|---:|---|
| `BASE_URL` | Yes | Base URL of the application under test (used by `playwright.config.ts`). |

### AI orchestration

The AI provider reads configuration from environment variables:

| Variable | Required | Description |
|---|---:|---|
| `API_URL` | Yes | Chat/completions endpoint URL used by `AIProvider`. |
| `API_KEY` | Yes | API key sent as `X-API-KEY`. |
| `MODEL_NAME` | Yes | Model identifier sent in the request body. |

Example `.env` (adjust values for your environment):

```env
# Playwright
BASE_URL=https://your-uat-environment.example

# AI provider
API_URL=https://your-ai-gateway.example/chat
API_KEY=your_api_key_here
MODEL_NAME=your_model_name_here
```

> Note: `.env` files are ignored by git (see `.gitignore`).

---

## Running Playwright tests

Run all tests:

```bash
npm test
```

Useful variants:

```bash
npm run test:headed
npm run test:debug
npm run test:ui
npm run test:chromium
```

View the HTML report:

```bash
npm run report
```

Outputs:

* HTML report: `playwright-report/`
* Raw test artifacts: `test-results/`

---

## AI orchestration scripts

### 1) Test AI connectivity

```bash
npm run ai:connection
```

This script calls the configured AI endpoint and expects the model to respond with:
`COFORGE_AI_CONNECTION_SUCCESSFUL`.

### 2) Generate a UAT test plan from a requirement

```bash
npm run ai:orchestrate
```

This runs an example requirement (see `packages/ai/tests/orchestration.ts`) through the orchestration pipeline and prints a structured test plan to stdout.

---

## TypeScript type checking

```bash
npm run typecheck
```

---

## CI (GitHub Actions)

The workflow at `.github/workflows/playwright.yml`:

1. Checks out the repo
2. Installs dependencies (`npm ci`)
3. Installs Playwright browsers (`npx playwright install --with-deps`)
4. Runs the Playwright test suite (`npx playwright test`)
5. Uploads `playwright-report/` as a build artifact

---

## Troubleshooting

### `BASE_URL` is undefined / navigation fails

Ensure `BASE_URL` is set in your `.env` (or in your shell environment) and points to a reachable environment.

### AI scripts throw `API_URL is not configured` / `API_KEY is not configured` / `MODEL_NAME is not configured`

Set the required AI variables in `.env` before running:

* `API_URL`
* `API_KEY`
* `MODEL_NAME`

---

## License

Add a license file if/when you decide on licensing.
