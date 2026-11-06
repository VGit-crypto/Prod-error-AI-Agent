import { z } from 'zod';
import type { AIProvider, ChatMessage } from '../../../ai/providers/AIProvider';
import { StructuredResponseService } from '../../../ai/services/structured-response.service';
import type {
  BugMarkdownInput,
  GeneratedTestCasesPayload
} from '../models/testcase.model';

const GeneratedTestCaseSchema = z.object({
  testCaseId: z.string().min(1),
  scenario: z.string().min(1),
  testSteps: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(1),
  priority: z.enum(['High', 'Medium', 'Low'])
});

const GeneratedTestCasesPayloadSchema = z.object({
  testCases: z.array(GeneratedTestCaseSchema).min(1)
});

export class TestCaseGeneratorService {
  constructor(
    private readonly provider: AIProvider,
    private readonly parser: StructuredResponseService
  ) {}

  buildPrompt(
    template: string,
    input: BugMarkdownInput
  ): string {
    return template
      .replace('{{BUG_TITLE}}', input.bugTitle)
      .replace('{{DESCRIPTION}}', input.description)
      .replace('{{ACCEPTANCE_CRITERIA}}', input.acceptanceCriteria);
  }

  normalizeTestCaseIds(bugTitle: string, testCases: GeneratedTestCasesPayload['testCases']): GeneratedTestCasesPayload['testCases'] {
    const bugId = this.extractBugId(bugTitle) ?? 'BUG';
    return testCases.map((tc, idx) => {
      const n = String(idx + 1).padStart(3, '0');
      return {
        ...tc,
        testCaseId: `TC-${bugId}-${n}`
      };
    });
  }

  private extractBugId(bugTitle: string): string | null {
    // bugTitle example: "BUG-EY001 - [FLOW] ..."
    const m = bugTitle.match(/\b(BUG-[A-Z0-9]+)\b/i);
    return m?.[1]?.toUpperCase() ?? null;
  }

  async generateTestCases(prompt: string): Promise<GeneratedTestCasesPayload> {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You generate QA test cases as JSON only.' },
      { role: 'user', content: prompt }
    ];

    const raw = await this.provider.chat(messages);
    return this.parser.parse(raw, GeneratedTestCasesPayloadSchema);
  }
}
