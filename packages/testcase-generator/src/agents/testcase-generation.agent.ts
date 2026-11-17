import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { PromptLoaderService } from '../services/prompt-loader.service';
import { TestCaseGeneratorService } from '../services/testcase-generator.service';
import { ExcelWriterService } from '../services/excel-writer.service';
import { LoggerService } from '../services/logger.service';
import { ensureDir, pathExists } from '../utils/file-utils';
import { formatTestCaseExcelFileName } from '../utils/filename';
import type { GeneratedTestCase } from '../models/testcase.model';

export interface TestCaseGenerationAgentConfig {
  /** Path to test-results/SkypadLogs-Error-report_TC.json */
  inputJsonPath: string;
  outputDirs: string[];
  promptTemplatePath: string;
}

export class TestCaseGenerationAgent {
  constructor(
    private readonly promptLoader: PromptLoaderService,
    private readonly generator: TestCaseGeneratorService,
    private readonly excelWriter: ExcelWriterService,
    private readonly logger: LoggerService
  ) {}

  async run(config: TestCaseGenerationAgentConfig): Promise<void> {
    const started = Date.now();
    const abs = (p: string) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p));
    const inputPath = abs(config.inputJsonPath);
    const resolvedOutputs = config.outputDirs.map(abs);
    for (const d of resolvedOutputs) await ensureDir(d);

    const template = await this.promptLoader.loadPromptTemplate(config.promptTemplatePath);

    this.logger.info(`Input file: ${inputPath}`);
    const data = JSON.parse(await readFile(inputPath, 'utf-8')) as { errors?: Array<Record<string, unknown>> };
    const entries = data.errors;
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error(`No "errors" array found in ${inputPath}`);
    }

    const blocks: Array<{ title: string; testCases: GeneratedTestCase[] }> = [];
    for (const entry of entries) {
      const bug = this.generator.toBugInput(entry);
      this.logger.info(`Generating test cases for ${bug.id}`);
      const testCases = await this.generator.generateTestCases(
        this.generator.buildSystemPrompt(template, bug),
        bug
      );
      blocks.push({ title: `${bug.id} - ${bug.bugTitle}`, testCases });
    }

    // Never overwrite; on collision move the timestamp forward by 1 second.
    let now = new Date();
    let fileName = formatTestCaseExcelFileName(now);
    let guard = 0;
    while (await this.anyOutputExists(resolvedOutputs, fileName)) {
      now = new Date(now.getTime() + 1000);
      fileName = formatTestCaseExcelFileName(now);
      if (++guard > 30) throw new Error('Unable to generate a unique filename after multiple attempts.');
    }

    // One buffer, written to every folder -> identical name and content.
    const buffer = await this.excelWriter.buildWorkbookBuffer(blocks);
    for (const outDir of resolvedOutputs) {
      const result = await this.excelWriter.writeBuffer(outDir, fileName, buffer);
      this.logger.info(`Output file: ${result.fullPath}`);
    }

    this.logger.info(`Total execution time: ${Date.now() - started} ms`);
  }

  private async anyOutputExists(outputDirs: string[], fileName: string): Promise<boolean> {
    const checks = await Promise.all(outputDirs.map(d => pathExists(path.join(d, fileName))));
    return checks.some(Boolean);
  }
}
