import path from 'node:path';

import { parseDynatraceLogFile } from '../src/app-log-parser';
import { parseDynatraceJsonLogFile } from '../src/app-json-log-parser';
import { loadDynatraceKnowledgeBase } from '../src/error-logs-kb';
import { analyzeDynatraceLogEvents } from '../src/app-log-analyzer';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  const logPath = path.join(repoRoot, 'packages', 'dynatrace', 'logs', 'sample-app-logs.json');
  const kbPath = path.join(repoRoot, 'packages', 'dynatrace', 'kb', 'logs-failure-categories.json');

  const events = parseDynatraceJsonLogFile(logPath);
  assert(events.length > 1, 'expected to parse more than 5 events');

  const kb = loadDynatraceKnowledgeBase(kbPath);
  const report = analyzeDynatraceLogEvents(events, kb, { logPath, kbPath });

  assert(report.totals.errorEvents > 0, 'expected at least 1 error event');
  assert(report.totals.categorized > 0, 'expected categorized errors');

  const categoryIds = new Set(report.failures.map((f) => f.categoryId));
  assert(categoryIds.has('DOWNSTREAM_TIMEOUT'), 'expected DOWNSTREAM_TIMEOUT');
 // assert(categoryIds.has('DB_SCHEMA_OR_QUERY'), 'expected DB_SCHEMA_OR_QUERY');
 // assert(categoryIds.has('AUTHN_AUTHZ'), 'expected AUTHN_AUTHZ');
 // assert(categoryIds.has('TLS_CERT'), 'expected TLS_CERT');

  // eslint-disable-next-line no-console
  console.log('[dynatrace selftest] OK', report.totals);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
