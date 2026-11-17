import { z } from 'zod';
import type { AIProvider, ChatMessage } from '../../../ai/providers/AIProvider';
import { StructuredResponseService } from '../../../ai/services/structured-response.service';
import type { GeneratedTestCase, TcReportBugInput } from '../models/testcase.model';

// Keys and order are defined by prompts/testcase-generator-prompt.md.
const RawTestCaseSchema = z.object({
  'Test Case ID': z.string().min(1),
  Scenario: z.string().min(1),
  'Test Steps': z.union([z.string(), z.array(z.string())]),
  'Expected result': z.string().min(1),
  Priority: z.enum(['High', 'Medium', 'Low'])
});

const RawTestCasesSchema = z.array(RawTestCaseSchema).min(1);

export class TestCaseGeneratorService {
  constructor(
    private readonly provider: AIProvider,
    private readonly parser: StructuredResponseService
  ) {}

  /** Only these fields reach the model; correlationId / relatedCorrelationIds are never sent. */
  toBugInput(entry: Record<string, unknown>): TcReportBugInput {
    const input: TcReportBugInput = {
      id: String(entry.id ?? ''),
      bugTitle: String(entry.Cluster ?? entry.bugTitle ?? '')
    };
    for (const k of ['appName', 'service', 'context', 'url', 'message', 'error'] as const) {
      const v = entry[k];
      if (typeof v === 'string') input[k] = v;
    }
    if (typeof entry.statusCode === 'number') input.statusCode = entry.statusCode;
    return input;
  }

  /** The prompt file is the system prompt; the bug JSON replaces its {{BUG_JSON}} placeholder. */
  buildSystemPrompt(template: string, bug: TcReportBugInput): string {
    return template.replace('{{BUG_JSON}}', () => JSON.stringify(bug, null, 2));
  }

  async generateTestCases(systemPrompt: string, bug: TcReportBugInput): Promise<GeneratedTestCase[]> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate the test cases for bug ${bug.id} now. Return only the JSON array.` }
    ];
    const raw = await this.provider.chat(messages);
    const rows = this.parser.parse(raw, RawTestCasesSchema);
    const idPart = bug.id.replace(/-/g, '');
    return rows.map((r, i) => ({
      // Deterministic ID that always carries the bug id, e.g. TC-EY010-01
      testCaseId: `TC-${idPart}-${String(i + 1).padStart(2, '0')}`,
      scenario: r.Scenario,
      testSteps: Array.isArray(r['Test Steps'])
        ? r['Test Steps'].map((s, n) => `${n + 1}. ${s}`).join('\n')
        : r['Test Steps'],
      expectedResult: r['Expected result'],
      priority: r.Priority
    }));
  }
}
