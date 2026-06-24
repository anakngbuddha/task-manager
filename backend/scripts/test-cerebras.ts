const apiKey = process.env.CEREBRAS_API_KEY;
if (!apiKey) {
  console.error("No CEREBRAS_API_KEY");
  process.exit(1);
}

fetch('https://api.cerebras.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'llama3.1-8b',
    messages: [{ role: 'user', content: 'Hello' }]
  })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}).catch(err => console.error(err));
