export type DynatraceLogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface DynatraceLogEvent {
  /** Raw log line (or multi-line combined event). */
  raw: string;
  /** ISO timestamp if parsed from the line. */
  timestamp?: string;
  level?: DynatraceLogLevel;
  service?: string;
  traceId?: string;
  spanId?: string;
  logger?: string;
  message: string;
  stackTrace?: string;
}

export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FailureCategoryRule {
  id: string;
  title: string;
  severity: FailureSeverity;
  match: {
    anyRegex: string[];
  };
  suggestedTestIdeas: string[];
}

export interface DynatraceFailureKnowledgeBase {
  name: string;
  version: string;
  description?: string;
  categories: FailureCategoryRule[];
}

export interface CategorizedFailure {
  categoryId: string;
  categoryTitle: string;
  severity: FailureSeverity;
  matchedRegex: string;
  event: DynatraceLogEvent;
  suggestedTestIdeas: string[];
}

export interface DynatraceLogAnalysisReport {
  source: {
    logPath: string;
    kbPath: string;
  };
  totals: {
    events: number;
    errorEvents: number;
    categorized: number;
    uncategorized: number;
  };
  failures: CategorizedFailure[];
  uncategorizedErrors: DynatraceLogEvent[];
}
