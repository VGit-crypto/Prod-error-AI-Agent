import type {
  CategorizedFailure,
  DynatraceFailureKnowledgeBase,
  DynatraceLogAnalysisReport,
  DynatraceLogEvent,
} from './dynatrace-log-types';

function toFlowTag(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function deriveFlowTag(event: DynatraceLogEvent): string {
  const attrs = (event as any).attributes as Record<string, unknown> | undefined;
  const flow = typeof attrs?.flow === 'string' && attrs.flow.trim() ? attrs.flow.trim() : undefined;
  if (flow) return toFlowTag(flow);

  const logger = event.logger?.trim();
  const service = event.service?.trim();

  if (logger && service) return toFlowTag(`${service}_${logger}`);
  if (logger) return toFlowTag(logger);
  if (service) return toFlowTag(service);
  return 'UNKNOWN';
}

function sanitizeBugText(text: string): string {
  return text
    .replace(/\btraceId\b\s*[:=]\s*[a-zA-Z0-9-]+/gi, '')
    .replace(/\bspanId\b\s*[:=]\s*[a-zA-Z0-9-]+/gi, '')
    .replace(/\bcorrelationId\b\s*[:=]\s*[a-zA-Z0-9-]+/gi, '')
    .replace(/\bpnr\b\s*[:=]\s*[a-zA-Z0-9-]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate140(text: string): string {
  if (text.length <= 140) return text;
  return text.slice(0, 137).trimEnd() + '...';
}

function extractHttpStatus(message: string): string | undefined {
  const m = message.match(/\b(400|401|403|404|409|422|429|500|502|503|504)\b/);
  return m?.[1];
}

function extractDownstreamService(message: string): string | undefined {
  const m1 = message.match(/calling\s+([a-z0-9-]+)\b/i);
  if (m1?.[1]) return m1[1];
  const m2 = message.match(/downstreamService\s*[:=]\s*([a-z0-9-]+)/i);
  if (m2?.[1]) return m2[1];
  const m3 = message.match(/https?:\/\/([a-z0-9-]+)\./i);
  if (m3?.[1]) return m3[1];
  return undefined;
}

function extractTableName(event: DynatraceLogEvent): string | undefined {
  const attrs = (event as any).attributes as Record<string, unknown> | undefined;
  const table = typeof attrs?.table === 'string' ? attrs.table : undefined;
  if (table?.trim()) return table.trim();

  const haystack = `${event.message}\n${event.stackTrace ?? ''}`;
  const m = haystack.match(/relation\s+\"([^\"]+)\"\s+does not exist/i);
  return m?.[1];
}

function extractNullVariable(event: DynatraceLogEvent): string | undefined {
  const haystack = `${event.message}\n${event.stackTrace ?? ''}`;
  const m = haystack.match(/because\s+\"([^\"]+)\"\s+is null/i);
  if (m?.[1]) return m[1];

  const m2 = haystack.match(/reading\s+'([^']+)'/i);
  return m2?.[1];
}

function looksLikeJwtSignatureIssue(message: string): boolean {
  return /jwt\s+validation\s+failed/i.test(message)
    && /(SignatureException|signature does not match|signature validation)/i.test(message);
}

export function buildSuggestedBug(
  event: DynatraceLogEvent,
  category: { id: string },
): string {
  const flowTag = deriveFlowTag(event);
  const msg = sanitizeBugText(event.message ?? '');
  const stack = sanitizeBugText(event.stackTrace ?? '');
  const attrs = (event as any).attributes as Record<string, unknown> | undefined;

  const status = extractHttpStatus(msg);
  if (status) {
    const downstream = extractDownstreamService(msg)
      ?? (typeof attrs?.downstreamService === 'string' ? attrs.downstreamService : undefined);
    const statusText = /gateway timeout/i.test(msg) && status === '504' ? '504 Gateway Timeout' : status;
    if (downstream) {
      const verb = flowTag.includes('CREATE') ? 'Booking creation fails' : 'Request fails';
      return truncate140(`[${flowTag}] ${verb} when ${downstream} returns ${statusText}`);
    }
    return truncate140(`[${flowTag}] Request fails with HTTP ${statusText}`);
  }

  if (category.id === 'DB_SCHEMA_OR_QUERY' || /PSQLException|SQLSTATE|ORA-/i.test(`${msg}\n${stack}`)) {
    const table = extractTableName(event);
    if (table) return truncate140(`[${flowTag}] Booking retrieval fails due to missing database table ${table}`);
    return truncate140(`[${flowTag}] Database operation fails due to schema/query error`);
  }

  if (category.id === 'AUTHN_AUTHZ' || /Unauthorized|Forbidden|invalid token|AccessDenied/i.test(msg)) {
    if (looksLikeJwtSignatureIssue(msg)) {
      return truncate140(`[${flowTag}] Authentication request rejected due to JWT signature validation failure`);
    }
    return truncate140(`[${flowTag}] Authentication request rejected due to authorization failure`);
  }

  if (category.id === 'NULL_POINTER_OR_BUG' || /NullPointerException|TypeError|ReferenceError|Unhandled exception/i.test(`${msg}\n${stack}`)) {
    const v = extractNullVariable(event);
    const op = flowTag.includes('PRICE')
      ? 'Fare calculation fails'
      : flowTag.includes('VIEW')
        ? 'Booking retrieval fails'
        : 'Operation fails';
    if (v) return truncate140(`[${flowTag}] ${op} when ${v} value is null`);
    return truncate140(`[${flowTag}] ${op} due to unhandled exception`);
  }

  const fallback = msg || (event.service ? `${event.service} error` : 'Unexpected error');
  return truncate140(`[${flowTag}] ${fallback}`);
}

function isErrorLevel(level?: string): boolean {
  return level === 'ERROR' || level === 'FATAL';
}

export function categorizeEvent(
  event: DynatraceLogEvent,
  kb: DynatraceFailureKnowledgeBase,
): CategorizedFailure | null {
  const haystack = `${event.message}\n${event.stackTrace ?? ''}`;

  for (const category of kb.categories) {
    for (const regexString of category.match.anyRegex) {
      const re = new RegExp(regexString, 'i');
      if (re.test(haystack)) {
        return {
          categoryId: category.id,
          categoryTitle: category.title,
          severity: category.severity,
          matchedRegex: regexString,
          event,
          suggestedBug: buildSuggestedBug(event, category),
        };
      }
    }
  }

  return null;
}

export function analyzeDynatraceLogEvents(
  events: DynatraceLogEvent[],
  kb: DynatraceFailureKnowledgeBase,
  source: { logPath: string; kbPath: string },
): DynatraceLogAnalysisReport {
  const errorEvents = events.filter((e) => isErrorLevel(e.level));

  const failures: CategorizedFailure[] = [];
  const uncategorizedErrors: DynatraceLogEvent[] = [];

  for (const event of errorEvents) {
    const categorized = categorizeEvent(event, kb);
    if (categorized) failures.push(categorized);
    else uncategorizedErrors.push(event);
  }

  return {
    source,
    totals: {
      events: events.length,
      errorEvents: errorEvents.length,
      categorized: failures.length,
      uncategorized: uncategorizedErrors.length,
    },
    failures,
    uncategorizedErrors,
  };
}
