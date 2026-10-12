import { z } from 'zod';

export const TestTypeSchema =
  z.enum([
    'positive',
    'negative',
    'boundary'
  ]);

export const TestPrioritySchema =
  z.enum([
    'high',
    'medium',
    'low'
  ]);

export const TestStepSchema =
  z.object({

    id: z.string(),

    order: z.number()
      .int()
      .positive(),

    intent: z.string()
      .min(1),

    description: z.string()
      .min(1),

    expectedResult: z.string()
      .min(1),

    testDataHint: z.record(
      z.string(),
      z.unknown()
    ).optional()

  });

export const TestCaseSchema =
  z.object({

    id: z.string(),

    title: z.string()
      .min(1),

    acceptanceCriteriaIds:
      z.array(z.string())
        .min(1),

    type: TestTypeSchema,

    priority: TestPrioritySchema,

    objective: z.string()
      .min(1),

    preconditions:
      z.array(z.string()),

    steps:
      z.array(TestStepSchema)
        .min(1),

    expectedOutcome:
      z.string()
        .min(1)

  });

export const AmbiguitySchema =
  z.object({

    acceptanceCriteriaId:
      z.string(),

    description:
      z.string(),

    clarificationRequired:
      z.string()

  });

export const TestPlanSchema =
  z.object({

    feature:
      z.string(),

    summary:
      z.string(),

    testCases:
      z.array(TestCaseSchema),

    ambiguities:
      z.array(AmbiguitySchema)

  });

export type TestStep =
  z.infer<typeof TestStepSchema>;

export type TestCase =
  z.infer<typeof TestCaseSchema>;

export type TestPlan =
  z.infer<typeof TestPlanSchema>;