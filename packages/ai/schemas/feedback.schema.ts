import { z } from 'zod';

export const FeedbackTypeSchema =
  z.enum([
    'TEST_DATA_CHANGE',
    'AUTOMATION_CHANGE',
    'REQUIREMENT_CLARIFICATION',
    'PRODUCT_DEFECT',
    'NO_CHANGE',
    'OTHER'
  ]);

export const FeedbackAnalysisSchema =
  z.object({

    classification:
      FeedbackTypeSchema,

    summary:
      z.string(),

    affectedTestCaseId:
      z.string()
        .nullable(),

    affectedStepId:
      z.string()
        .nullable(),

    acceptanceCriteriaImpacted:
      z.boolean(),

    testUpdateRequired:
      z.boolean(),

    automationUpdateRequired:
      z.boolean(),

    proposedChange:
      z.string()
        .nullable(),

    reExecutionRecommended:
      z.boolean(),

    reasoning:
      z.string()

  });

export type FeedbackAnalysis =
  z.infer<
    typeof FeedbackAnalysisSchema
  >;
