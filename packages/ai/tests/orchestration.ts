import dotenv from 'dotenv';
import {AIProvider} from '../providers/AIProvider';
import {StructuredResponseService} from '../services/structured-response.service';
import {PlannerService} from '../services/planner.service';
import {UATOrchestrator} from '../orchestration/uat.orchestrator';
import {Requirement} from '../schemas/requirement.schema';

dotenv.config();

async function main(): Promise<void> {

  const requirement: Requirement = {

    storyId:'FLIGHT-SEARCH-001',
    title:'Flight Search',
    description:'Validate flight search functionality for business UAT.',
    acceptanceCriteria: [
      {id: 'AC1',
       title:'Origin and Destination Selection',
       description:'User should be able to select valid origin and destination airports or cities from the available options.'
      },
      {
        id: 'AC2',
        title:'Travel Date Selection',
        description:'User should be able to select a valid departure date. Past dates should not be allowed for a new flight search.'
      },
      {
        id: 'AC3',
        title:'Passenger and Cabin Selection',
        description:'User should be able to select the number of passengers and available cabin class before initiating the search.'
      },
      {
        id: 'AC4',
        title:'Flight Search Results',
        description:'On providing all mandatory search details and selecting Search Flights, the system should display available flights matching the selected route and travel date.'
      },
      {
        id: 'AC5',
        title:'Mandatory Field Validation',
        description:'If the user initiates a search without providing mandatory information, the system should prevent the search and display appropriate validation messages.'
      }
    ]
  };


  const provider =new AIProvider();
  const parser =new StructuredResponseService();
  const planner =new PlannerService(provider,parser);
  const orchestrator =new UATOrchestrator(planner);

  try {
    const result =await orchestrator.plan(requirement);
    console.log('\n====================================');
    console.log('UAT ORCHESTRATION COMPLETED');
    console.log('====================================\n');
    console.log( JSON.stringify(result.testPlan,null,2));
  } catch (error) {
    console.error('\n[ORCHESTRATOR] FAILED');
    // if ( error instanceof Error) {
    //   console.error(error.message);
    // } else {console.error(error);}
    process.exitCode = 1;
  }

}


main();