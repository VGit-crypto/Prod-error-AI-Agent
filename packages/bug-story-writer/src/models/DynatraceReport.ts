export interface DynatraceErrorEvent {
  timestamp: string;
  service: string;
  traceId: string;
  message: string;
  stackTrace?: string;
  attributes?: Record<string, unknown>;
}

export interface DynatraceFailure {
  categoryId: string;
  categoryTitle: string;
  severity: string;
  suggestedBug: string;
  event: DynatraceErrorEvent;
}

export interface DynatraceReport {
  failures: DynatraceFailure[];
  totals?: {
    events?: number;
    errorEvents?: number;
    categorized?: number;
    uncategorized?: number;
  };
  uncategorizedErrors?: unknown[];
}
