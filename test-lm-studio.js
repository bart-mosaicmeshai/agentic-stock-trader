import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:1234/v1',
  apiKey: 'lm-studio',
});

async function test() {
  console.log('Testing LM Studio connection...\n');

  try {
    // Test 1: List models
    const models = await client.models.list();
    console.log('✅ Available models:');
    models.data.forEach(m => console.log(`  - ${m.id}`));
    console.log('');

    // Test 2: Simple completion
    console.log('Testing simple completion...');
    const completion = await client.chat.completions.create({
      model: models.data[0].id,
      messages: [{ role: 'user', content: 'Say hello in 5 words' }],
      max_tokens: 50,
    });
    console.log('✅ Response:', completion.choices[0].message.content);
    console.log('');

    // Test 3: Function calling
    console.log('Testing function calling support...');
    const toolTest = await client.chat.completions.create({
      model: models.data[0].id,
      messages: [{ role: 'user', content: 'What is the weather in San Francisco?' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string', description: 'City name' },
              },
              required: ['city'],
            },
          },
        },
      ],
      tool_choice: 'auto',
    });

    if (toolTest.choices[0].message.tool_calls) {
      console.log('✅ Function calling SUPPORTED!');
      console.log('Tool calls:', JSON.stringify(toolTest.choices[0].message.tool_calls, null, 2));
    } else {
      console.log('⚠️  Function calling NOT supported by this model');
      console.log('Response:', toolTest.choices[0].message.content);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
