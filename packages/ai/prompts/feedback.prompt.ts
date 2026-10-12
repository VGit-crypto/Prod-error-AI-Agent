import {
  Requirement
} from '../schemas/requirement.schema';

import {
  TestCase
} from '../schemas/test-plan.schema';

import {
  TestExecutionResult
} from '../schemas/execution-result.schema';

export function buildFeedbackPrompt(
  requirement: Requirement,
  testCase: TestCase,
  execution: TestExecutionResult,
  feedback: string
): string {

  return `
You are analysing business feedback from
User Acceptance Testing.

Classify the feedback into exactly one:

TEST_DATA_CHANGE
AUTOMATION_CHANGE
REQUIREMENT_CLARIFICATION
PRODUCT_DEFECT
NO_CHANGE
OTHER

Definitions:

TEST_DATA_CHANGE:
The test data should change, while the expected
business behaviour remains unchanged.

AUTOMATION_CHANGE:
The automation implementation is likely incorrect
or outdated.

REQUIREMENT_CLARIFICATION:
The feedback changes or clarifies expected
business behaviour.

PRODUCT_DEFECT:
The business expectation remains valid and the
application behaviour appears inconsistent with it.

NO_CHANGE:
Feedback does not require modification.

OTHER:
Cannot confidently classify.

RULES:

1. Never change acceptance criteria automatically.

2. Never modify a test merely because it failed.

3. Separate product defects from automation
   failures.

4. Base the classification only on the provided
   requirement, execution result and feedback.

5. Return only JSON.

Required JSON:

{
  "classification":
    "TEST_DATA_CHANGE |
     AUTOMATION_CHANGE |
     REQUIREMENT_CLARIFICATION |
     PRODUCT_DEFECT |
     NO_CHANGE |
     OTHER",

  "summary": "string",

  "affectedTestCaseId":
    "string or null",

  "affectedStepId":
    "string or null",

  "acceptanceCriteriaImpacted":
    true,

  "testUpdateRequired":
    true,

  "automationUpdateRequired":
    false,

  "proposedChange":
    "string or null",

  "reExecutionRecommended":
    true,

  "reasoning":
    "string"
}

REQUIREMENT:

${JSON.stringify(
  requirement,
  null,
  2
)}

TEST CASE:

${JSON.stringify(
  testCase,
  null,
  2
)}

EXECUTION:

${JSON.stringify(
  execution,
  null,
  2
)}

BUSINESS FEEDBACK:

${feedback}
`;

}