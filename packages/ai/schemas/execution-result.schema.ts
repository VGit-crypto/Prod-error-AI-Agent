import { z } from 'zod';

export const ExecutionStatusSchema =
  z.enum([
    'PASSED',
    'FAILED',
    'BLOCKED',
    'SKIPPED'
  ]);

export const EvidenceSchema =
  z.object({

    type: z.enum([
      'screenshot',
      'trace',
      'video',
      'log'
    ]),

    path: z.string(),

    description:
      z.string()
        .optional()

  });

export const StepExecutionResultSchema =
  z.object({

    stepId: z.string(),

    intent: z.string(),

    status:
      ExecutionStatusSchema,

    actionPerformed:
      z.string(),

    expected:
      z.string(),

    actual:
      z.string(),

    error:
      z.string()
        .optional(),

    evidence:
      z.array(EvidenceSchema)

  });

export const TestExecutionResultSchema =
  z.object({

    testCaseId:
      z.string(),

    status:
      ExecutionStatusSchema,

    startedAt:
      z.string(),

    completedAt:
      z.string(),

    steps:
      z.array(
        StepExecutionResultSchema
      )

  });

export type StepExecutionResult =
  z.infer<
    typeof StepExecutionResultSchema
  >;

export type TestExecutionResult =
  z.infer<
    typeof TestExecutionResultSchema
  >;