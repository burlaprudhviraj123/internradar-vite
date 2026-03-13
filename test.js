import { config } from 'dotenv';
import Groq from 'groq-sdk';

config();

const apiKey = process.env.VITE_GROQ_API_KEY;
console.log('API Key starts with:', apiKey ? apiKey.substring(0, 5) + '...' : 'undefined');

const groq = new Groq({ apiKey });

async function main() {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an AI that outputs JSON. Format: {"status": "ok"}' },
        { role: 'user', content: 'Test' }
      ],
      model: 'llama3-8b-8192',
      temperature: 0,
      response_format: { type: 'json_object' }
    });
    console.log('Success:', chatCompletion.choices[0]?.message?.content);
  } catch (error) {
    console.error('Groq Error:', error.message || error);
  }
}

main();
