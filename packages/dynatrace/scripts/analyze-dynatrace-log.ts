import path from 'node:path';
import fs from 'node:fs';

import { parseDynatraceLogFile } from '../src/dynatrace-log-parser';
import { loadDynatraceKnowledgeBase } from '../src/dynatrace-kb';
import { analyzeDynatraceLogEvents } from '../src/dynatrace-log-analyzer';

function readArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  const logPath = readArg(
    '--log',
    path.join(repoRoot, 'packages', 'dynatrace', 'logs', 'sample-dynatrace-app.log'),
  );
  const kbPath = readArg(
    '--kb',
    path.join(repoRoot, 'packages', 'dynatrace', 'kb', 'dynatrace-failure-categories.json'),
  );
  const outPath = readArg('--out');

  if (!logPath) throw new Error('Missing --log <path>');
  if (!kbPath) throw new Error('Missing --kb <path>');

  const events = parseDynatraceLogFile(logPath);
  const kb = loadDynatraceKnowledgeBase(kbPath);
  const report = analyzeDynatraceLogEvents(events, kb, { logPath, kbPath });

  const json = JSON.stringify(report, null, 2);

  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, 'utf-8');
  } else {
    // eslint-disable-next-line no-console
    console.log(json);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
