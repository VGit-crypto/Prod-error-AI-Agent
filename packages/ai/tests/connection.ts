import dotenv from 'dotenv';

import {
  AIProvider
} from '../providers/AIProvider';

dotenv.config();


async function main() {

  console.log(
    'Testing Coforge AI connection...'
  );


  const ai =
    new AIProvider();


  const response =
    await ai.chat([
      {
        role: 'user',

        content:
          `You are a helpful AI.
           Reply exactly with:
           COFORGE_AI_CONNECTION_SUCCESSFUL`
      }
    ]);


  console.log('\nAI Response:');
  console.log(response);
}


main().catch(error => {

  console.error(
    '\nConnection failed:'
  );

  console.error(error);

  process.exit(1);
});