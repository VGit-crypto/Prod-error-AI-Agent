import fs from 'node:fs';

import type { DynatraceLogEvent, DynatraceLogLevel } from './app-log-types';

export interface DynatraceJsonLogEventInput {
  timestamp?: string;
  level?: DynatraceLogLevel | string;
  service?: string;
  traceId?: string;
  spanId?: string;
  logger?: string;
  message?: string;
  stackTrace?: string;
  // allow any extra Dynatrace fields
  [k: string]: unknown;
}

function toLevel(value: unknown): DynatraceLogLevel | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.toUpperCase();
  if (v === 'TRACE' || v === 'DEBUG' || v === 'INFO' || v === 'WARN' || v === 'ERROR' || v === 'FATAL') {
    return v;
  }
  return undefined;
}

function normalizeEvent(raw: DynatraceJsonLogEventInput, rawJson: string): DynatraceLogEvent {
  return {
    raw: rawJson,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined,
    level: toLevel(raw.level),
    service: typeof raw.service === 'string' ? raw.service : undefined,
    traceId: typeof raw.traceId === 'string' ? raw.traceId : undefined,
    spanId: typeof raw.spanId === 'string' ? raw.spanId : undefined,
    logger: typeof raw.logger === 'string' ? raw.logger : undefined,
    message: typeof raw.message === 'string' ? raw.message : rawJson,
    stackTrace: typeof raw.stackTrace === 'string' ? raw.stackTrace : undefined,
    // Preserve extra fields (like attributes.flow/table/etc.) for downstream bug suggestion.
    ...(raw.attributes && typeof raw.attributes === 'object'
      ? ({ attributes: raw.attributes } as any)
      : {}),
  };
}

/**
 * Parses a Dynatrace-exported JSON log file.
 *
 * Supported formats:
 * 1) JSON array of objects
 * 2) NDJSON (one JSON object per line)
 */
export function parseDynatraceJsonLogFile(logPath: string): DynatraceLogEvent[] {
  const content = fs.readFileSync(logPath, 'utf-8').trim();
  if (!content) return [];

  const events: DynatraceLogEvent[] = [];

  // Some exported logs are "almost JSON" arrays but contain occasional raw text lines.
  // If JSON.parse fails, fall back to a tolerant line-based parser.
  const firstNonWs = content.match(/\S/)?.[0];
  if (firstNonWs === '[') {
    try {
      const arr = JSON.parse(content) as DynatraceJsonLogEventInput[];
      if (!Array.isArray(arr)) throw new Error(`Expected JSON array in ${logPath}`);
      for (const item of arr) {
        const rawJson = JSON.stringify(item);
        events.push(normalizeEvent(item, rawJson));
      }
      return events;
    } catch {
      // tolerant fallback below
    }
  }

  // NDJSON / mixed-content tolerant fallback:
  // - Accept full JSON objects per line
  // - Accept lines starting with ",{" as array-fragments and parse the object portion
  // - Ignore non-JSON lines
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  for (const line of lines) {
    const trimmed = line.trim();
    const candidate = trimmed.startsWith(',') ? trimmed.slice(1).trim() : trimmed;
    if (!candidate.startsWith('{') || !candidate.endsWith('}')) continue;
    try {
      const obj = JSON.parse(candidate) as DynatraceJsonLogEventInput;
      events.push(normalizeEvent(obj, candidate));
    } catch {
      // ignore invalid JSON lines
    }
  }

  return events;
}
