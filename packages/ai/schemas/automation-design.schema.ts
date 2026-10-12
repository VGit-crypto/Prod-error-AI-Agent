import { z } from 'zod';

export const LocatorStrategySchema =
  z.enum([
    'role',
    'label',
    'placeholder',
    'text',
    'testId',
    'css'
  ]);

export const LocatorDesignSchema =
  z.object({

    name:
      z.string(),

    strategy:
      LocatorStrategySchema,

    value:
      z.string(),

    accessibleName:
      z.string()
        .nullable()

  });

export const MethodDesignSchema =
  z.object({

    name:
      z.string(),

    parameters:
      z.array(z.string()),

    description:
      z.string()

  });

export const AutomationCapabilitySchema =
  z.object({

    intent:
      z.string(),

    page:
      z.string(),

    status:
      z.enum([
        'SUGGESTED',
        'DISCOVERED',
        'VALIDATED',
        'APPROVED'
      ]),

    action:
      MethodDesignSchema,

    assertion:
      MethodDesignSchema
        .nullable(),

    locators:
      z.array(
        LocatorDesignSchema
      ),

    evidence:
      z.array(z.string())

  });

export const AutomationDesignSchema =
  z.object({

    capabilities:
      z.array(
        AutomationCapabilitySchema
      )

  });

export type AutomationCapability =
  z.infer<
    typeof AutomationCapabilitySchema
  >;

export type AutomationDesign =
  z.infer<
    typeof AutomationDesignSchema
  >;
  