import dotenv from 'dotenv';
import { DynatraceReportReader } from '../src/services/DynatraceReportReader';
import { MarkdownWriter } from '../src/services/MarkdownWriter';
import { BugStoryWriterAgent } from '../src/agents/BugStoryWriterAgent';
import { BugStoryService } from '../src/services/BugStoryService';
import { formatBugStoryFileName } from '../src/utils/filename';
import { AIProvider } from '../src/providers/AIProvider';

dotenv.config();

async function main(): Promise<void> {
  const reader = new DynatraceReportReader();
  const reportPath = process.env.DYNATRACE_REPORT_PATH ?? 'test-results/dynatrace-report.json';
  const report = await reader.read(reportPath);

  let stories = [] as Awaited<ReturnType<BugStoryService['generateStories']>>;
  try {
    const provider = new AIProvider();
    const agent = new BugStoryWriterAgent(provider);
    const service = new BugStoryService(agent);
    stories = await service.generateStories(report.failures);
  } catch {
    // If provider config is missing, still generate the markdown with fallback content.
    stories = report.failures.map((f, idx) => ({
      bugId: `BUG-EY${String(idx + 1).padStart(3, '0')}`,
      summary: f.suggestedBug,
      description: 'Unable to generate AI description.',
      acceptanceCriteria: 'Generation failed.'
    }));
  }

  const md = stories
    .map(story => {
      return [
        `# ${story.bugId} - ${story.summary}`,
        '',
        '## Description',
        '',
        story.description.trim(),
        '',
        '## Acceptance Criteria',
        '',
        story.acceptanceCriteria.trim(),
        '',
        '---',
        ''
      ].join('\n');
    })
    .join('\n');

  const writer = new MarkdownWriter();
  const outputDir = process.env.BUGSTORY_OUTPUT_DIR ?? 'test-results/TC-Input';
  const fileName = formatBugStoryFileName(new Date(), 'BugStory');
  const fullPath = await writer.writeNewFile(outputDir, fileName, md);

  // eslint-disable-next-line no-console
  console.log(`Bug stories written: ${fullPath}`);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
