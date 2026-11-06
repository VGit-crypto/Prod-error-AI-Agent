import { BugMarkdownInput, BugSection } from '../models/testcase.model';

/**
 * Parses markdown created by bug-story-writer:
 * # BUG-ID - Summary
 * ## Description
 * <text>
 * ## Acceptance Criteria
 * <text>
 */
export class MarkdownParserService {
  parseBugMarkdown(markdown: string): BugMarkdownInput {
    const titleLine = this.extractFirstHeading(markdown);
    const description = this.extractSection(markdown, 'Description');
    const acceptanceCriteria = this.extractSection(markdown, 'Acceptance Criteria');

    return {
      bugTitle: titleLine ?? 'Unknown Bug Title',
      description: description ?? '',
      acceptanceCriteria: acceptanceCriteria ?? ''
    };
  }

  /**
   * Parses a markdown file that can contain multiple bug sections.
   * Each section begins with a level-1 heading:
   *   # BUG-EY001 - [TITLE]
   * and contains:
   *   ## Description
   *   ...
   *   ## Acceptance Criteria
   *   ...
   * Sections may be separated by `---`.
   */
  parseAllBugSections(markdown: string): BugSection[] {
    const sections = this.splitByBugHeading(markdown);
    const parsed: BugSection[] = [];

    for (const section of sections) {
      const bugTitle = this.extractFirstHeading(section) ?? 'Unknown Bug Title';
      const description = this.extractSection(section, 'Description') ?? '';
      const acceptanceCriteria = this.extractSection(section, 'Acceptance Criteria') ?? '';

      // Skip truly empty sections
      if (!bugTitle && !description && !acceptanceCriteria) continue;

      parsed.push({
        bugTitle,
        description,
        acceptanceCriteria
      });
    }

    return parsed;
  }

  private splitByBugHeading(markdown: string): string[] {
    // Find all "# ..." headings. We assume each bug starts with a level-1 heading.
    const headingRe = /^#\s+.+$/gm;
    const matches: Array<{ index: number }> = [];

    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(markdown)) !== null) {
      if (typeof m.index === 'number') matches.push({ index: m.index });
    }

    if (matches.length === 0) return [];

    const chunks: string[] = [];
    for (let i = 0; i < matches.length; i += 1) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
      const chunk = markdown.slice(start, end).trim();
      if (chunk) chunks.push(chunk);
    }
    return chunks;
  }

  private extractFirstHeading(markdown: string): string | null {
    const m = markdown.match(/^#\s+(.+)\s*$/m);
    return m?.[1]?.trim() || null;
  }

  private extractSection(markdown: string, sectionTitle: string): string | null {
    const re = new RegExp(
      `(^|\\n)##\\s+${this.escapeRegExp(sectionTitle)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|\\n---\\s*$|$)`,
      'i'
    );
    const m = markdown.match(re);
    const content = m?.[2]?.trim();
    return content ? content : null;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
