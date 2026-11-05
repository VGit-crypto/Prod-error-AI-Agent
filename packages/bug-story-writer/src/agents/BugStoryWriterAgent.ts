import type { DynatraceFailure } from '../models/DynatraceReport';
import type { ChatMessage } from '../providers/AIProvider';
import type { AIProvider } from '../providers/AIProvider';

export interface BugStoryAIResult {
  descriptionMarkdown: string;
  acceptanceCriteriaMarkdown: string;
}

export class BugStoryWriterAgent {
  private readonly provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  private buildSystemPrompt(): string {
    return [
      'You are a Senior QA Architect and Production Incident Analyst.',
      '',
      'Analyze the incident.',
      'Convert it into a Jira-style bug story.',
      '',
      'Generate:',
      '1. Description',
      '2. Acceptance Criteria',
      '',
      'Base your response only on:',
      '- categoryId',
      '- categoryTitle',
      '- severity',
      '- suggestedBug',
      '- event.message',
      '- event.stackTrace',
      '- event.attributes',
      '- event.traceId',
      '',
      'Description must explain:',
      '- Business context',
      '- Failure scenario',
      '- Customer impact',
      '',
      'Acceptance criteria must prevent similar incidents in the future.',
      '',
      'Return markdown only.',
      '',
      'Output format strictly:',
      '## Description',
      '<markdown>',
      '',
      '## Acceptance Criteria',
      'AC1: ...',
      'AC2: ...',
      'AC3: ...',
      'AC4: ...',
      'AC5: ...',
      '(Exactly 5 acceptance criteria. No more, no less.)'
    ].join('\n');
  }

  private buildUserPrompt(failure: DynatraceFailure): string {
    const payload = {
      categoryId: failure.categoryId,
      categoryTitle: failure.categoryTitle,
      severity: failure.severity,
      suggestedBug: failure.suggestedBug,
      event: {
        message: failure.event.message,
        stackTrace: failure.event.stackTrace ?? null,
        attributes: failure.event.attributes ?? null,
        traceId: failure.event.traceId
      }
    };

    return [
      'Incident payload (JSON):',
      '```json',
      JSON.stringify(payload, null, 2),
      '```',
      '',
      'Ensure the Description includes:',
      '- What failed',
      '- Where it failed',
      '- Why it likely failed',
      '- Customer impact',
      '- Technical impact',
      '- Service name (if inferable from message/attributes; otherwise omit)',
      '- Relevant flow (if present in attributes)',
      '- Relevant traceId'
    ].join('\n');
  }

  async generate(failure: DynatraceFailure): Promise<BugStoryAIResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: this.buildUserPrompt(failure) }
    ];

    const raw = await this.provider.chat(messages);

    const description = this.extractSection(raw, 'Description');
    const acRaw = this.extractSection(raw, 'Acceptance Criteria');
    const ac = acRaw ? this.normalizeAcceptanceCriteriaToFive(acRaw) : null;

    return {
      descriptionMarkdown: description ?? 'Unable to generate AI description.',
      acceptanceCriteriaMarkdown: ac ?? 'Generation failed.'
    };
  }

  private normalizeAcceptanceCriteriaToFive(acSection: string): string {
    // Keep only lines starting with "AC" and take first 5.
    // If the model returns bullet points, we try to map the first 5 bullets to AC1..AC5.
    const lines = acSection
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const acLines = lines.filter(l => /^AC\d+\s*:/i.test(l));
    if (acLines.length > 0) {
      const extracted = acLines
        .map(l => l.replace(/^AC\d+\s*:\s*/i, '').trim())
        .filter(Boolean)
        .slice(0, 5);

      const normalized = extracted.map((text, idx) => `AC${idx + 1}: ${text}`);
      while (normalized.length < 5) normalized.push(`AC${normalized.length + 1}: Generation failed.`);
      return normalized.slice(0, 5).join('\n');
    }

    const bulletLines = lines.filter(l => /^[-*]\s+/.test(l));
    const candidates = bulletLines.slice(0, 5);

    if (candidates.length === 0) {
      return [
        'AC1: Generation failed.',
        'AC2: Generation failed.',
        'AC3: Generation failed.',
        'AC4: Generation failed.',
        'AC5: Generation failed.'
      ].join('\n');
    }

    const normalized = candidates.map((line, idx) => {
      const n = idx + 1;
      // strip leading bullet or existing AC prefix
      const text = line
        .replace(/^AC\d+\s*:\s*/i, '')
        .replace(/^[-*]\s+/, '')
        .trim();
      return `AC${n}: ${text || 'Generation failed.'}`;
    });

    while (normalized.length < 5) normalized.push(`AC${normalized.length + 1}: Generation failed.`);
    return normalized.slice(0, 5).join('\n');
  }

  private extractSection(markdown: string, sectionTitle: string): string | null {
    // Matches "## <sectionTitle>" and captures until next "## " or end.
    const re = new RegExp(`(^|\\n)##\\s+${this.escapeRegExp(sectionTitle)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
    const match = markdown.match(re);
    if (!match) return null;
    const content = match[2]?.trim();
    if (!content) return null;
    return content;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
