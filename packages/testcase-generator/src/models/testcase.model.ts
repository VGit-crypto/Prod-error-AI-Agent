export type TestCasePriority = 'High' | 'Medium' | 'Low';

export interface GeneratedTestCase {
  testCaseId: string;
  scenario: string;
  /** Numbered steps in one string, separated by \n (as defined by the prompt file). */
  testSteps: string;
  expectedResult: string;
  priority: TestCasePriority;
}

/** Bug entry from SkypadLogs-Error-report_TC.json (only the fields sent to the model). */
export interface TcReportBugInput {
  id: string;
  bugTitle: string;
  appName?: string;
  service?: string;
  context?: string;
  url?: string;
  statusCode?: number;
  message?: string;
  error?: string;
}
