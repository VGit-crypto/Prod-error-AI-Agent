import type { DynatraceFailure } from '../models/DynatraceReport';
import { BugStoryWriterAgent } from '../agents/BugStoryWriterAgent';

export interface BugStory {
  bugId: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
}

export class BugStoryService {
  private readonly agent: BugStoryWriterAgent;

  constructor(agent: BugStoryWriterAgent) {
    this.agent = agent;
  }

  async generateStories(failures: DynatraceFailure[]): Promise<BugStory[]> {
    const results: BugStory[] = [];

    for (let i = 0; i < failures.length; i++) {
      const failure = failures[i];
      const bugId = this.formatBugId(i + 1);
      const summary = failure.suggestedBug;

      try {
        const ai = await this.agent.generate(failure);
        results.push({
          bugId,
          summary,
          description: ai.descriptionMarkdown,
          acceptanceCriteria: ai.acceptanceCriteriaMarkdown
        });
      } catch (error) {
        // Never stop processing due to one incident, but do log the error for diagnosability.
        // eslint-disable-next-line no-console
        console.error(`[BugStoryService] AI generation failed for ${bugId} (${summary}).`, error);
        results.push({
          bugId,
          summary,
          description: 'Unable to generate AI description.',
          acceptanceCriteria: 'Generation failed.'
        });
      }
    }

    return results;
  }

  private formatBugId(n: number): string {
    return `BUG-EY${String(n).padStart(3, '0')}`;
  }
}
