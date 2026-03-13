import type { Opportunity, UserProfile } from '@/types';
import Groq from 'groq-sdk';

const apiKey = import.meta.env.VITE_GROQ_API_KEY;

// Only initialize if API key is present to prevent startup crashes
const groq = apiKey ? new Groq({ apiKey, dangerouslyAllowBrowser: true }) : null;

const getExtractionPrompt = (currentDate: string) => `
You are InternRadar AI. Your job is to extract internship/job opportunity details from raw, messy text (like a WhatsApp or Telegram message).

CRITICAL RULE: First, evaluate if the text is actually describing a job, internship, or career opportunity. 
If the text is just a random conversation, spam, or completely irrelevant, you MUST return exactly this JSON:
{"error": "irrelevant"}

If it IS an opportunity, return ONLY a valid JSON object matching this schema, with no markdown formatting, no code blocks, and no extra text.
If a field is missing, use null or an empty array as appropriate.

Today's Date is: ${currentDate}. If you see relative deadlines like "Tomorrow" or "Next Week", calculate the actual ISO 8601 Date string.

{
  "companyName": "string",
  "role": "string",
  "deadline": "ISO 8601 Date string (e.g. 2025-12-31) or null",
  "eligibility": ["string array", "e.g. 2025 batch", "B.Tech CA"],
  "applicationLink": "string (extract the URL if present)",
  "requiredDocuments": ["string array", "e.g. Resume", "Cover Letter"]
}
`;

export async function extractOpportunity(text: string): Promise<Omit<Opportunity, 'id' | 'createdAt' | 'status' | 'userId' | 'matchStatus' | 'matchReasoning'> | null> {
  if (!groq) {
    throw new Error('VITE_GROQ_API_KEY is not set in environment variables. Please check your .env file.');
  }

  try {
    const d = new Date();
    const currentDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: getExtractionPrompt(currentDate) },
        { role: 'user', content: text }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    
    // Check if the AI determined the text was irrelevant
    if (parsed.error === 'irrelevant') {
      throw new Error("IRRELEVANT_TEXT");
    }

    return {
      companyName: parsed.companyName || 'Unknown Company',
      role: parsed.role || 'Unknown Role',
      deadline: parsed.deadline || null,
      eligibility: Array.isArray(parsed.eligibility) ? parsed.eligibility : [],
      applicationLink: parsed.applicationLink || '',
      requiredDocuments: Array.isArray(parsed.requiredDocuments) ? parsed.requiredDocuments : [],
    };
  } catch (error: any) {
    console.error('LLM Extraction Error:', error);
    if (error.message === "IRRELEVANT_TEXT") {
      throw error;
    }
    throw new Error(`Failed to parse opportunity using groq: ${error.message || 'Unknown error. Check console.'}`);
  }
}

const RESUME_PROMPT = `
You are an expert tech recruiter AI. Extract the user's core profile details from the provided resume text.
Return ONLY a valid JSON object matching this schema, with no markdown formatting, no code blocks, and no extra text.

{
  "fullName": "string",
  "graduationYear": "string (e.g. 2025)",
  "major": "string (e.g. Computer Science)",
  "skills": ["string array", "e.g. React", "Python"],
  "experience": ["string array", "summarized key experiences"]
}
`;

export async function parseResume(text: string): Promise<Omit<UserProfile, 'id' | 'userId'> | null> {
  if (!groq) throw new Error('Groq API Key is not configured.');

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: RESUME_PROMPT },
        { role: 'user', content: text }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      fullName: parsed.fullName || 'Unknown',
      graduationYear: parsed.graduationYear || 'Unknown',
      major: parsed.major || 'Unknown',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      rawResumeText: text
    };
  } catch (error: any) {
    console.error('LLM Resume Parse Error:', error);
    throw new Error('Failed to parse resume using Groq.');
  }
}

const getMatchPrompt = (currentYear: number) => `
You are an AI career advisor. Evaluate if the candidate is eligible and a good match for the opportunity.

Current Year: ${currentYear}

CRITICAL RULES:
1. MAJOR / DEGREE ALIGNMENT: If the opportunity is for a specific field (e.g. Civil Engineering) and the candidate is studying an unrelated field (e.g. Computer Science), the majorMatch must be "Fail".
2. GRADUATION YEAR & ACADEMIC YEAR: 
   - A student graduating in ${currentYear} is in their final/4th year.
   - A student graduating in ${currentYear + 1} is in their 3rd year.
   - A student graduating in ${currentYear + 2} is in their 2nd year.
   - A student graduating in ${currentYear + 3} is in their 1st year.
   If the opportunity requires a specific graduation year OR an academic year (e.g. "2nd year students") and the candidate does not match based on this formula, the yearMatch must be "Fail".
   *CRITICAL IMPLICIT YEAR FALLBACK*: If the opportunity text mentions an academic requirement (like "2nd year students") but completely fails to mention a specific calendar year (like 2026), you MUST assume the opportunity is for the Current Year (${currentYear}). Calculate their eligibility based on that.
3. If EITHER yearMatch or majorMatch is "Fail", the matchStatus MUST be 'Ineligible'.
4. Auxiliary skills do NOT make up for a failed Major or Graduation Year.

Step 1: Calculate the candidate's current academic year using the formula above.
Step 2: Evaluate yearMatch ("Pass", "Fail", or "Unspecified")
Step 3: Evaluate majorMatch ("Pass", "Fail", or "Unspecified")
Step 4: Determine matchStatus ('Eligible' or 'Ineligible')

Return ONLY a valid JSON object matching this schema, with no markdown formatting, no code blocks, and no extra text.

{
  "calculatedAcademicYear": "string (Explain the math: e.g. 2028 - 2026 = 2nd year)",
  "yearMatch": "Pass" | "Fail" | "Unspecified",
  "majorMatch": "Pass" | "Fail" | "Unspecified",
  "matchStatus": "Eligible" | "Ineligible",
  "reasoning": "string"
}
`;

export async function evaluateMatch(
  opportunity: Opportunity,
  profile: UserProfile
): Promise<{ matchStatus: 'Eligible' | 'Ineligible'; matchReasoning: string }> {
  if (!groq) return { matchStatus: 'Eligible', matchReasoning: 'Groq not configured.' };

  try {
    const inputPayload = {
      opportunity: {
        company: opportunity.companyName,
        role: opportunity.role,
        eligibility: opportunity.eligibility
      },
      candidateProfile: {
        graduationYear: profile.graduationYear,
        major: profile.major,
        skills: profile.skills
      }
    };

    const currentYear = new Date().getFullYear();
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: getMatchPrompt(currentYear) },
        { role: 'user', content: JSON.stringify(inputPayload) }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return { matchStatus: 'Eligible', matchReasoning: 'Failed to evaluate.' };

    const parsed = JSON.parse(content);
    return {
      matchStatus: parsed.matchStatus === 'Ineligible' ? 'Ineligible' : 'Eligible',
      matchReasoning: parsed.reasoning || ''
    };
  } catch (error: any) {
    console.error('LLM Match Error:', error);
    return { matchStatus: 'Eligible', matchReasoning: 'Error during evaluation.' };
  }
}
