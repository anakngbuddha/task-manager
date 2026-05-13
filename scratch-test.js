import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;

async function testGemini() {
  const prompt = `
You are an expert system administrator and software engineer.
Analyze the following error log captured from our web application.
Identify the likely problem cause and provide a clear, actionable fix.

Source/Context: Unknown Source
Error Message: AxiosError: Request failed with status code 500
Stack Trace:
No stack trace available

Provide the response in the following strict JSON format without markdown wrapping:
{
  "cause": "A brief explanation of why this error occurred.",
  "fix": "Actionable steps to resolve the issue."
}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return;
    }

    const data = await response.json();
    console.log('Success:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Fetch failed:', error);
  }
}

testGemini();
