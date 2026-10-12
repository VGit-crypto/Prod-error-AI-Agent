export function buildPlannerPrompt(
  requirement: string
): string {

  return `
You are a senior software test architect.

Convert the provided acceptance criteria into
business-focused web test cases.

Rules:

1. Every test case must map to acceptance criteria.
2. Include positive, negative and boundary scenarios
   only when justified by the requirement.
3. Do not invent application behavior.
4. Do not create CSS selectors or XPath.
5. Do not generate Playwright code.
6. Describe actions as business intents.
7. Every step must contain an expected result.
8. Flag ambiguous requirements instead of inventing
   expected behavior.

Requirement:

${requirement}
`;

}