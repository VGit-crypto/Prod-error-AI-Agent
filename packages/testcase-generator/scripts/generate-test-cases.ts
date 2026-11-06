import dotenv from 'dotenv';
import { AIProvider } from '../../ai/providers/AIProvider';
import { StructuredResponseService } from '../../ai/services/structured-response.service';

import { PromptLoaderService } from '../src/services/prompt-loader.service';
import { MarkdownParserService } from '../src/services/markdown-parser.service';
import { TestCaseGeneratorService } from '../src/services/testcase-generator.service';
import { ExcelWriterService } from '../src/services/excel-writer.service';
import { LoggerService } from '../src/services/logger.service';
import { TestCaseGenerationAgent } from '../src/agents/testcase-generation.agent';

dotenv.config();

async function main(): Promise<void> {
  const provider = new AIProvider();
  const structured = new StructuredResponseService();

  const agent = new TestCaseGenerationAgent(
    new PromptLoaderService(),
    new MarkdownParserService(),
    new TestCaseGeneratorService(provider, structured),
    new ExcelWriterService(),
    new LoggerService()
  );

  const inputDir = process.env.TC_INPUT_DIR ?? 'test-results/TC-Input';
  const outputDirs = [
    process.env.TC_OUTPUT_DIR_1 ?? 'C:\\Temp',
    process.env.TC_OUTPUT_DIR_2 ?? 'test-results/TC-Output'
  ];

  await agent.run({
    inputDir,
    outputDirs,
    promptTemplatePath: 'prompts/testcase-generator-prompt.md',
    latestOnly: true
  });
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
