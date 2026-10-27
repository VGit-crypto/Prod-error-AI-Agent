import type {
  CategorizedFailure,
  DynatraceFailureKnowledgeBase,
  DynatraceLogAnalysisReport,
  DynatraceLogEvent,
} from './dynatrace-log-types';

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
          suggestedTestIdeas: category.suggestedTestIdeas,
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
