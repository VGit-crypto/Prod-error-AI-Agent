import {
  AIProvider
} from '../providers/AIProvider';

import {
  Requirement
} from '../schemas/requirement.schema';

import {
  TestCase
} from '../schemas/test-plan.schema';

import {
  TestExecutionResult
} from '../schemas/execution-result.schema';

import {
  FeedbackAnalysis,
  FeedbackAnalysisSchema
} from '../schemas/feedback.schema';

import {
  buildFeedbackPrompt
} from '../prompts/feedback.prompt';

import {
  StructuredResponseService
} from './structured-response.service';

export class FeedbackService {

  constructor(
    private readonly provider:
      AIProvider,

    private readonly parser:
      StructuredResponseService
  ) {}

  async analyze(
    requirement: Requirement,
    testCase: TestCase,
    execution: TestExecutionResult,
    feedback: string
  ): Promise<FeedbackAnalysis> {

    const prompt =
      buildFeedbackPrompt(
        requirement,
        testCase,
        execution,
        feedback
      );

    const response =
      await this.provider.chat([
        {
          role: 'system',
          content:
            'Analyze business UAT feedback. Return only JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

    return this.parser.parse(
      response,
      FeedbackAnalysisSchema
    );
  }

}