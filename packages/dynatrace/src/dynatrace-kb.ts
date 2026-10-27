import fs from 'node:fs';

import type { DynatraceFailureKnowledgeBase } from './dynatrace-log-types';

export function loadDynatraceKnowledgeBase(kbPath: string): DynatraceFailureKnowledgeBase {
  const raw = fs.readFileSync(kbPath, 'utf-8');
  const kb = JSON.parse(raw) as DynatraceFailureKnowledgeBase;

  if (!kb?.categories || !Array.isArray(kb.categories)) {
    throw new Error(`Invalid knowledge base at ${kbPath}: missing categories[]`);
  }

  return kb;
}
