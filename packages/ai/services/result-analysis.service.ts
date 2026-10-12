import {
  AIProvider
} from '../providers/AIProvider';

import {
  TestCase
} from '../schemas/test-plan.schema';

import {
  TestExecutionResult
} from '../schemas/execution-result.schema';

import {
  FailureAnalysis,
  FailureAnalysisSchema
} from '../schemas/analysis.schema';

import {
  buildResultAnalysisPrompt
} from '../prompts/result-analysis.prompt';

import {
  StructuredResponseService
} from './structured-response.service';

export class ResultAnalysisService {

  constructor(
    private readonly provider:
      AIProvider,

    private readonly parser:
      StructuredResponseService
  ) {}

  async analyze(
    testCase: TestCase,
    execution: TestExecutionResult
  ): Promise<FailureAnalysis> {

    const prompt =
      buildResultAnalysisPrompt(
        testCase,
        execution
      );

    const response =
      await this.provider.chat([
        {
          role: 'system',
          content:
            'Analyze web test execution evidence. Return only JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

    return this.parser.parse(
      response,
      FailureAnalysisSchema
    );
  }

}