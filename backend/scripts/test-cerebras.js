import "dotenv/config.js";
const apiKey = process.env.CEREBRAS_API_KEY;

fetch('https://api.cerebras.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'gpt-oss-120b',
    messages: [{ role: 'user', content: 'Hello' }],
    tools: [{
      type: 'function',
      function: {
        name: 'test_func',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }
    }]
  })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}).catch(err => console.error(err));
