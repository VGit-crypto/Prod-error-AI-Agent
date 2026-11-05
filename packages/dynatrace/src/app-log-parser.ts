import fs from 'node:fs';

import type {
  DynatraceLogEvent,
  DynatraceLogLevel,
} from './dynatrace-log-types';

// Example supported line:
// 2026-10-15T09:12:01.012Z ERROR [order-service] [trace_id=... span_id=...] com.foo.Bar - message
const HEADER_RE =
  /^(?<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(?<level>TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+\[(?<service>[^\]]+)\]\s+\[trace_id=(?<traceId>[^\s\]]+)\s+span_id=(?<spanId>[^\s\]]+)\]\s+(?<logger>[^\s]+)\s+-\s+(?<msg>.*)$/;

function isHeaderLine(line: string): boolean {
  return HEADER_RE.test(line);
}

function toLevel(value: string | undefined): DynatraceLogLevel | undefined {
  if (!value) return undefined;
  return value as DynatraceLogLevel;
}

function parseHeader(line: string): Omit<DynatraceLogEvent, 'raw'> {
  const match = line.match(HEADER_RE);

  if (!match || !match.groups) {
    return { message: line };
  }

  return {
    timestamp: match.groups.ts,
    level: toLevel(match.groups.level),
    service: match.groups.service,
    traceId: match.groups.traceId,
    spanId: match.groups.spanId,
    logger: match.groups.logger,
    message: match.groups.msg,
  };
}

/**
 * Parses a Dynatrace-exported application log file into multi-line events.
 * Multi-line stack traces are attached to the previous header event.
 */
export function parseDynatraceLogFile(logPath: string): DynatraceLogEvent[] {
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const events: DynatraceLogEvent[] = [];
  let current: DynatraceLogEvent | null = null;

  const flush = () => {
    if (!current) return;

    const rawLines = current.raw.split(/\r?\n/);
    if (rawLines.length > 1) {
      const rest = rawLines.slice(1).join('\n').trim();
      if (rest) current.stackTrace = rest;
    }

    events.push(current);
    current = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      // blank line: treat as separator
      flush();
      continue;
    }

    if (isHeaderLine(line)) {
      flush();
      current = {
        raw: line,
        ...parseHeader(line),
      };
      continue;
    }

    // continuation line (stack trace or extra message)
    if (!current) {
      // If file starts with a continuation line, create a synthetic event.
      current = {
        raw: line,
        message: line,
      };
    } else {
      current.raw += `\n${line}`;
    }
  }

  flush();
  return events;
}
