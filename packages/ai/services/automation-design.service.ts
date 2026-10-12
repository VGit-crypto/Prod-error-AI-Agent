import {
  AIProvider
} from '../providers/AIProvider';

import {
  AutomationDesign,
  AutomationDesignSchema
} from '../schemas/automation-design.schema';

import {
  buildAutomationDesignPrompt,
  DiscoveredInteraction
} from '../prompts/automation-design.prompt';

import {
  StructuredResponseService
} from './structured-response.service';

export class AutomationDesignService {

  constructor(
    private readonly provider:
      AIProvider,

    private readonly parser:
      StructuredResponseService
  ) {}

  async design(
    interaction: DiscoveredInteraction
  ): Promise<AutomationDesign> {

    const prompt =
      buildAutomationDesignPrompt(
        interaction
      );

    const response =
      await this.provider.chat([
        {
          role: 'system',
          content:
            'Design reusable Playwright automation capabilities. Return only JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

    return this.parser.parse(
      response,
      AutomationDesignSchema
    );
  }

}