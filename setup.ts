import { writeFileSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('Welcome to Prophet setup!');
  console.log('This script will help you create your .env file with the necessary credentials.\n');

  const supabaseUrl = await askQuestion('Enter your Supabase Project URL: ');
  const supabaseKey = await askQuestion('Enter your Supabase Service Role Key: ');
  const openaiKey = await askQuestion('Enter your OpenAI API Key: ');

  const envContent = `# Supabase Configuration
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_KEY=${supabaseKey}

# OpenAI Configuration
OPENAI_API_KEY=${openaiKey}
`;

  writeFileSync('.env', envContent);
  console.log('\n.env file has been created successfully!');
  console.log('Please make sure to never commit this file to version control.');
  console.log('You can now run the Prophet scripts using:');
  console.log('  npm run generate - to generate new predictions');
  console.log('  npm run resolve - to resolve existing predictions');

  rl.close();
}

main().catch((error) => {
  console.error('Error during setup:', error);
  process.exit(1);
}); 