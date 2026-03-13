import 'dotenv/config';
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.VITE_GROQ_API_KEY });
async function run() {
  try {
    const res = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        { role: 'system', content: 'You are an AI that outputs JSON. Format: {"status": "ok"}' },
        { role: 'user', content: 'Test' }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    });
    console.log(res.choices[0]?.message?.content);
  } catch (err) {
    console.error("GROQ_ERROR:", err.message);
  }
}
run();
