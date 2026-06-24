import "dotenv/config.js";
const apiKey = process.env.CEREBRAS_API_KEY;

fetch('https://api.cerebras.ai/v1/models', {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}).catch(err => console.error(err));
