import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

import { parseDynatraceJsonLogFile } from '../src/app-json-log-parser';
import { analyzeDynatraceLogEvents } from '../src/app-log-analyzer';
import { loadDynatraceKnowledgeBase } from '../src/error-logs-kb';

import { AIProvider } from '../../ai/providers/AIProvider';

type JsonRecord = Record<string, unknown>;

interface SkypadErrorSummary {
  appName?: string;
  context?: string;
  correlationId?: string;
  service?: string;
  level?: string;
  message?: string;
  error: string;
  statusCode?: number;
  url?: string;
  correlationIds: string[];
  Cluster?: string;
}

async function generateBugTitle(
  ai: AIProvider,
  promptTemplate: string,
  summary: SkypadErrorSummary,
): Promise<string> {
  const payload = {
    appName: summary.appName ?? null,
    context: summary.context ?? null,
    url: summary.url ?? null,
    message: summary.message ?? null,
    error: summary.error ?? null,
  };

  const userPrompt = `Input error log (JSON):\n\n\
${JSON.stringify(payload, null, 2)}`;

  const raw = await ai.chat([
    { role: 'system', content: promptTemplate },
    { role: 'user', content: userPrompt },
  ]);

  // Enforce prompt constraints defensively.
  const title = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] ?? '';
  return title.length > 120 ? title.slice(0, 117).trimEnd() + '...' : title;
}

function fallbackBugTitle(summary: SkypadErrorSummary): string {
  const app = (summary.appName ?? '').trim() || 'UnknownApp';
  const url = summary.url?.trim() || 'unknown route';
  const msg = (summary.message ?? '').trim() || 'unknown error';

  // Very conservative fallback: do not attempt to infer/guess.
  const base = `[${app}] ${url} fails when ${msg}`.replace(/\s+/g, ' ').trim();
  return base.length > 120 ? base.slice(0, 117).trimEnd() + '...' : base;
}

function readArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

function isErrorRecord(obj: JsonRecord): boolean {
  const level = typeof obj.level === 'string' ? obj.level.toLowerCase() : '';
  const hasErrorKey = typeof obj.error === 'string' && obj.error.trim().length > 0;
  return level === 'error' || hasErrorKey;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return undefined;
}

function normalizeErrorKey(obj: JsonRecord): string {
  const explicit = typeof obj.error === 'string' ? obj.error.trim() : '';
  if (explicit) return explicit;
  const msg = typeof obj.message === 'string' ? obj.message.trim() : '';
  return msg || '[unknown error]';
}

function normalizeGroupKey(obj: JsonRecord): string {
  const context = typeof obj.context === 'string' ? obj.context.trim() : '';
  const http = getHttp(obj);
  const url = http.url?.trim() ?? '';

  // Requirement: group correlationIds when context + url are the same.
  // If either is missing, keep the grouping granular by including the error key.
  // This avoids collapsing unrelated errors into one giant bucket.
  if (context && url) return `${context}|||${url}`;

  return `${context}|||${url}|||${normalizeErrorKey(obj)}`;
}

function getCorrelationId(obj: JsonRecord): string {
  const c1 = typeof obj.correlationId === 'string' ? obj.correlationId : '';
  if (c1) return c1;
  const c2 = typeof obj['x-correlation-id'] === 'string' ? (obj['x-correlation-id'] as string) : '';
  return c2;
}

function getHttp(obj: JsonRecord): { statusCode?: number; url?: string } {
  const http = obj.http;
  if (!http || typeof http !== 'object') return {};
  const h = http as JsonRecord;
  return {
    statusCode: toNumber(h.statusCode),
    url: typeof h.url === 'string' ? (h.url as string) : undefined,
  };
}

async function main(): Promise<void> {
  dotenv.config();

  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  const logPath = readArg('--log', path.join(repoRoot, 'packages', 'dynatrace', 'logs', 'SkypadLogs.json'));
  const kbPath = readArg(
    '--kb',
    path.join(repoRoot, 'packages', 'dynatrace', 'kb', 'logs-failure-categories.json'),
  );
  // IMPORTANT:
  // - Do NOT create/overwrite repo-root "SkypadLogs-Error-report.json" going forward.
  // - Always write outputs under test-results/.
  // NOTE: We intentionally avoid writing any repo-root report file.
  const outPath = readArg('--out', path.join(repoRoot, 'test-results', 'SkypadLogs-Error-report.json'));

  if (!logPath) throw new Error('Missing --log <path>');
  if (!kbPath) throw new Error('Missing --kb <path>');
  if (!outPath) throw new Error('Missing --out <path>');

  const bugTitlePromptPath = readArg(
    '--bugTitlePrompt',
    path.join(repoRoot, 'prompts', 'Bug-Title-generator-prompt.md'),
  );
  if (!bugTitlePromptPath) throw new Error('Missing --bugTitlePrompt <path>');
  const bugTitlePromptTemplate = fs.readFileSync(bugTitlePromptPath, 'utf-8').trim();

  // Existing flow (parser -> KB -> analyzer) for categorization totals.
  const dynatraceEvents = parseDynatraceJsonLogFile(logPath);
  const kb = loadDynatraceKnowledgeBase(kbPath);
  const analysis = analyzeDynatraceLogEvents(dynatraceEvents, kb, { logPath, kbPath });

  // SkypadLogs.json can contain a JSON array with occasional non-JSON lines.
  // We'll parse it in a tolerant way (similar to the parser fallback):
  // - if valid JSON array -> use it
  // - else read line-by-line and JSON.parse object-ish lines
  const rawContent = fs.readFileSync(logPath, 'utf-8').trim();
  let parsedArray: JsonRecord[] = [];
  try {
    const parsed = JSON.parse(rawContent) as unknown;
    if (Array.isArray(parsed)) parsedArray = parsed as JsonRecord[];
  } catch {
    // ignore
  }

  if (parsedArray.length === 0) {
    const lines = rawContent.split(/\r?\n/).filter((l) => l.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      const candidate = trimmed.startsWith(',') ? trimmed.slice(1).trim() : trimmed;
      if (!candidate.startsWith('{') || !candidate.endsWith('}')) continue;
      try {
        const obj = JSON.parse(candidate) as JsonRecord;
        parsedArray.push(obj);
      } catch {
        // ignore invalid JSON lines
      }
    }
  }

  // Group by (context + url) to aggregate correlationIds for the same API/flow.
  const grouped = new Map<string, SkypadErrorSummary>();

  for (const obj of parsedArray) {
    if (!obj || typeof obj !== 'object') continue;
    if (!isErrorRecord(obj)) continue;

    const groupKey = normalizeGroupKey(obj);
    const correlationId = getCorrelationId(obj);
    const http = getHttp(obj);

    const existing = grouped.get(groupKey);
    const base: SkypadErrorSummary =
      existing ??
      {
        appName: typeof obj.appName === 'string' ? (obj.appName as string) : undefined,
        context: typeof obj.context === 'string' ? (obj.context as string) : undefined,
        correlationId: correlationId || undefined,
        service: typeof obj.service === 'string' ? (obj.service as string) : undefined,
        level: typeof obj.level === 'string' ? (obj.level as string) : undefined,
        message: typeof obj.message === 'string' ? (obj.message as string) : undefined,
        // Keep the original error/message for reference.
        error: normalizeErrorKey(obj),
        statusCode: http.statusCode,
        url: http.url,
        correlationIds: [],
      };

    if (correlationId && !base.correlationIds.includes(correlationId)) {
      base.correlationIds.push(correlationId);
    }

    // Fill missing http fields if available on later occurrences.
    if (base.statusCode == null && http.statusCode != null) base.statusCode = http.statusCode;
    if (base.url == null && http.url) base.url = http.url;

    grouped.set(groupKey, base);
  }

  const errors = Array.from(grouped.values()).sort(
    (a, b) => (b.correlationIds?.length ?? 0) - (a.correlationIds?.length ?? 0),
  );

  // Add bugTitle for each grouped error.
  // Uses prompts/Bug-Title-generator-prompt.md and the Coforge AI provider.
  let ai: AIProvider | null = null;
  try {
    ai = new AIProvider();
  } catch {
    ai = null;
  }

  for (const e of errors) {
    if (!ai) {
      e.Cluster = fallbackBugTitle(e);
      continue;
    }

    try {
      e.Cluster = await generateBugTitle(ai, bugTitlePromptTemplate, e);
    } catch {
      e.Cluster = fallbackBugTitle(e);
    }
  }

  const errorRecords = parsedArray.filter((o) => o && typeof o === 'object' && isErrorRecord(o)).length;

  // Total correlationIds count across *error records* (NOT unique).
  // For Skypad logs, each error record should correspond to exactly one correlationId.
  // NOTE: This differs from grouping-based totals (which dedupe correlationIds within each error group).
  const overallCorrelationIds = errorRecords;

  const report = {
    source: { logPath, kbPath },
    totals: {
      events: parsedArray.length,
      errorGroups: grouped.size,
      // Count error occurrences as the number of error records (level=error OR has error field).
      // This matches "total level:error" expectation for SkypadLogs.json.
      errorOccurrences: errorRecords,
      overallCorrelationIds,
      categorized: analysis.totals.categorized,
      uncategorized: analysis.totals.uncategorized,
    },
    errors,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`[SkypadLogs error report] wrote ${outPath}`);
  // eslint-disable-next-line no-console
  console.log(`[SkypadLogs error report] totals`, report.totals);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
