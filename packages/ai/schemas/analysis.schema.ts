import { z } from 'zod';

export const FailureAnalysisSchema =
  z.object({

    testCaseId:
      z.string(),

    summary:
      z.string(),

    failedStepId:
      z.string()
        .nullable(),

    expected:
      z.string(),

    actual:
      z.string(),

    evidenceBasedReason:
      z.string(),

    rootCauseStatus:
      z.enum([
        'ESTABLISHED',
        'SUSPECTED',
        'NOT_ESTABLISHED'
      ]),

    suspectedCause:
      z.string()
        .nullable(),

    recommendedNextAction:
      z.string()

  });

export type FailureAnalysis =
  z.infer<
    typeof FailureAnalysisSchema
  >;