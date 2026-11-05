import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DynatraceReport } from '../models/DynatraceReport';

export class DynatraceReportReader {
  async read(reportPath: string): Promise<DynatraceReport> {
    const resolved = path.isAbsolute(reportPath)
      ? reportPath
      : path.resolve(process.cwd(), reportPath);

    const raw = await readFile(resolved, 'utf-8');
    const parsed = JSON.parse(raw) as DynatraceReport;

    if (!parsed || !Array.isArray(parsed.failures)) {
      throw new Error(`Invalid Dynatrace report: missing failures array at ${resolved}`);
    }

    return parsed;
  }
}
