export type TestCasePriority = 'High' | 'Medium' | 'Low';

export interface GeneratedTestCase {
  testCaseId: string;
  scenario: string;
  testSteps: string[];
  expectedResult: string;
  priority: TestCasePriority;
}

export interface GeneratedTestCasesPayload {
  testCases: GeneratedTestCase[];
}

export interface BugMarkdownInput {
  bugTitle: string;
  description: string;
  acceptanceCriteria: string;
}

export interface BugSection {
  bugTitle: string;
  description: string;
  acceptanceCriteria: string;
}

