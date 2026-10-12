import {Requirement} from '../schemas/requirement.schema';
import {TestPlan} from '../schemas/test-plan.schema';
import {PlannerService} from '../services/planner.service';

export interface OrchestrationResult {
  requirement:Requirement;
  testPlan:TestPlan;
  requiredIntents:string[];
}

export class UATOrchestrator {

  constructor(private readonly planner:PlannerService) {}

  async plan(requirement: Requirement): Promise<OrchestrationResult> {
    console.log('\n[ORCHESTRATOR] Starting UAT planning');
    console.log(`[ORCHESTRATOR] Feature: ${requirement.title}`);

    const testPlan =await this.planner.createPlan(requirement);

    console.log(`[PLANNER] Generated ${testPlan.testCases.length} test cases`);

    const intents =new Set<string>();

    // for (const testCase of testPlan.testCases) {console.log(`\n[TEST] ${testCase.id} - ${testCase.title}` );

    //   for (const step of testCase.steps) {
    //     intents.add(step.intent);
    //     // console.log(`  ${step.order}. ${step.intent}`);
    //     // console.log(`     ${step.description}`);
    //     // console.log(`     Expected: ${step.expectedResult}`);
    //   }
    // }

    const requiredIntents =Array.from(intents).sort();

    // console.log('\n[ORCHESTRATOR] Required automation capabilities:');

    // for (const intent of requiredIntents) {
    //   // console.log(`  - ${intent}`);
    // }

    // if (testPlan.ambiguities.length > 0) {
    //   // console.log('\n[PLANNER] Requirement ambiguities:');

    //   for (const ambiguity of testPlan.ambiguities) {
    //     // console.log(`  ${ambiguity.acceptanceCriteriaId}: ${ambiguity.description}`);
    //   }

    // }

    return {
      requirement,
      testPlan,
      requiredIntents
    };
  }

}