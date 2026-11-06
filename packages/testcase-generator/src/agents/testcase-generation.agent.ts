import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { PromptLoaderService } from '../services/prompt-loader.service';
import { MarkdownParserService } from '../services/markdown-parser.service';
import { TestCaseGeneratorService } from '../services/testcase-generator.service';
import { ExcelWriterService } from '../services/excel-writer.service';
import { LoggerService } from '../services/logger.service';
import { listMarkdownFilesNewestFirst, ensureDir, pathExists } from '../utils/file-utils';
import { formatTestCaseExcelFileName } from '../utils/filename';
import type { GeneratedTestCase } from '../models/testcase.model';

export interface TestCaseGenerationAgentConfig {
  inputDir: string;
  outputDirs: string[];
  promptTemplatePath: string;
  /**
   * If true, only the most recently modified .md file is processed.
   * Default: true (matches bugstory:generate output usage)
   */
  latestOnly?: boolean;
}

export class TestCaseGenerationAgent {
  constructor(
    private readonly promptLoader: PromptLoaderService,
    private readonly markdownParser: MarkdownParserService,
    private readonly generator: TestCaseGeneratorService,
    private readonly excelWriter: ExcelWriterService,
    private readonly logger: LoggerService
  ) {}

  async run(config: TestCaseGenerationAgentConfig): Promise<void> {
    const started = Date.now();
    const resolvedInputDir = path.isAbsolute(config.inputDir)
      ? config.inputDir
      : path.resolve(process.cwd(), config.inputDir);

    for (const d of config.outputDirs) {
      const resolved = path.isAbsolute(d) ? d : path.resolve(process.cwd(), d);
      await ensureDir(resolved);
    }

    const template = await this.promptLoader.loadPromptTemplate(config.promptTemplatePath);

    const mdFilesAll = await listMarkdownFilesNewestFirst(resolvedInputDir);
    const mdFiles = (config.latestOnly ?? true)
      ? mdFilesAll.slice(0, 1)
      : mdFilesAll;
    if (mdFiles.length === 0) {
      this.logger.warn(`No markdown files found in: ${resolvedInputDir}`);
      return;
    }

    for (const inputFile of mdFiles) {
      const fileStart = Date.now();
      this.logger.info(`Input file: ${inputFile}`);
      try {
        const md = await readFile(inputFile, 'utf-8');
        const bugs = this.markdownParser.parseAllBugSections(md);
        if (bugs.length === 0) {
          this.logger.warn(`No bug sections found in markdown: ${inputFile}`);
          continue;
        }

        const blocks = [] as Array<{ title: string; testCases: GeneratedTestCase[] }>;

        for (const bug of bugs) {
          const prompt = this.generator.buildPrompt(template, bug);
          const generated = await this.generator.generateTestCases(prompt);
          const normalized = this.generator.normalizeTestCaseIds(bug.bugTitle, generated.testCases);

          blocks.push({
            title: bug.bugTitle,
            testCases: normalized
          });
        }

        // Always create a new file; never overwrite. If collision, retry by adding 1-second increments.
        let now = new Date();
        let fileName = formatTestCaseExcelFileName(now);
        let collisionGuard = 0;

        const resolvedOutputs = config.outputDirs.map(d => (path.isAbsolute(d) ? d : path.resolve(process.cwd(), d)));

        while (await this.anyOutputExists(resolvedOutputs, fileName)) {
          collisionGuard += 1;
          now = new Date(now.getTime() + 1000);
          fileName = formatTestCaseExcelFileName(now);
          if (collisionGuard > 30) {
            throw new Error('Unable to generate a unique filename after multiple attempts.');
          }
        }

        for (const outDir of resolvedOutputs) {
          const result = await this.excelWriter.writeBugSectionsWorkbook(outDir, fileName, blocks);
          this.logger.info(`Output file: ${result.fullPath}`);
        }

        this.logger.info(`Completed in ${Date.now() - fileStart} ms`);
      } catch (err) {
        this.logger.error(`Failed processing file: ${inputFile}`, err);
        // Continue with remaining files
      }
    }

    this.logger.info(`Total execution time: ${Date.now() - started} ms`);
  }

  private async anyOutputExists(outputDirs: string[], fileName: string): Promise<boolean> {
    const checks = await Promise.all(
      outputDirs.map(d => pathExists(path.join(d, fileName)))
    );
    return checks.some(Boolean);
  }
}
