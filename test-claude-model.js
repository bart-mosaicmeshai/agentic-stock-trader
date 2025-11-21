import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const modelsToTry = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-latest',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-3-7-sonnet-20250219',
];

console.log('Testing Claude models...\n');

for (const model of modelsToTry) {
  try {
    console.log(`Testing: ${model}...`);
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    console.log(`✅ ${model} WORKS!\n`);
    process.exit(0); // Exit on first working model
  } catch (error) {
    if (error.status === 404) {
      console.log(`❌ ${model} not found\n`);
    } else {
      console.log(`⚠️  ${model} error: ${error.message}\n`);
    }
  }
}

console.log('No working models found. Check your API key or tier.');
