import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DynatraceReport } from '../models/DynatraceReport';

export class DynatraceReportReader {
  async read(reportPath: string): Promise<DynatraceReport> {
    const resolved = path.isAbsolute(reportPath)
      ? reportPath
      : path.resolve(process.cwd(), reportPath);

    const raw = await readFile(resolved, 'utf-8');
    const parsed = JSON.parse(raw) as DynatraceReport & { errors?: Array<Record<string, any>> };

    // Support the SkypadLogs error report format ({ errors: [...] }).
    if (parsed && !Array.isArray(parsed.failures) && Array.isArray(parsed.errors)) {
      parsed.failures = parsed.errors.map(e => ({
        categoryId: String(e.appName ?? 'SKYPAD'),
        categoryTitle: String(e.context ?? e.service ?? 'Skypad error'),
        severity: String(e.level ?? 'error'),
        suggestedBug: String(e.Cluster ?? e.bugTitle ?? e.message ?? 'Skypad error'),
        event: {
          timestamp: String(e.timestamp ?? ''),
          service: String(e.service ?? ''),
          traceId: String(e.correlationId ?? ''),
          message: String(e.message ?? ''),
          stackTrace: e.error ? String(e.error) : undefined,
          attributes: { url: e.url, context: e.context, appName: e.appName }
        }
      }));
    }

    if (!parsed || !Array.isArray(parsed.failures)) {
      throw new Error(`Invalid Dynatrace report: missing failures array at ${resolved}`);
    }

    return parsed;
  }
}
