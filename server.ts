/**
 * server.ts — Recruit-AI
 *
 * AI provider: OpenRouter (meta-llama/llama-3.3-70b-instruct:free)
 * No Gemini dependency anywhere.
 *
 * Env vars required:
 *   OPENROUTER_API_KEY   — your sk-or-v1-... key from openrouter.ai
 *   SUPABASE_URL         — your existing Supabase URL
 *   SUPABASE_KEY         — your existing Supabase key
 *   PORT                 — optional, defaults to 3000
 */

import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' })); // PDF base64 can be large

// ─── OpenRouter config ────────────────────────────────────────────────────────

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL   = 'meta-llama/llama-3.3-70b-instruct:free';
const OPENROUTER_URL     = 'https://openrouter.ai/api/v1/chat/completions';

if (!OPENROUTER_API_KEY) {
  console.warn('[WARN] OPENROUTER_API_KEY is not set — AI features will use heuristic fallback only');
}

// ─── OpenRouter helper ────────────────────────────────────────────────────────

/**
 * Call OpenRouter with a plain text prompt.
 * Returns the model's text reply, or throws on HTTP error.
 */
async function callOpenRouter(prompt: string, maxTokens = 1000): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://recruitai-yc07.onrender.com', // your Render URL
      'X-Title':       'Recruit-AI',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      // Ask for JSON output reliably
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`OpenRouter ${res.status}: ${errText}`), { status: res.status });
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty content');
  return content.trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experienceYears: number;
  companies: string[];
  education: {
    degree: string;
    field: string;
    school: string;
    graduationYear: number;
  };
  resumeText: string;
  parsedByFallback: boolean;
}

interface ScreeningResult {
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no';
  scoredByFallback: boolean;
}

// ─── Helper: extract readable text from base64 PDF ───────────────────────────
/**
 * Pulls ASCII printable runs from raw PDF bytes.
 * No npm library — no ESM/CJS issues.
 */
function extractTextFromBase64Pdf(base64: string): string {
  try {
    const buffer  = Buffer.from(base64, 'base64');
    const raw     = buffer.toString('latin1');
    const chunks  = raw.match(/[\x20-\x7E]{4,}/g) ?? [];
    return chunks.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

// ─── Helper: heuristic resume parser (no AI) ─────────────────────────────────
function heuristicParseResume(rawText: string, fileName: string): ParsedResume {
  const text = rawText || '';

  // Name — prefer filename over regex (more reliable)
  const nameFromFile = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_\-\.]+/g, ' ')
    .replace(/resume|cv/gi, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const nameMatch = text.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})/m);
  const name = nameMatch?.[1] || nameFromFile || 'Unknown Candidate';

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch?.[0] || '';

  // Phone
  const phoneMatch = text.match(/(\+?[\d][\d\s\-().]{7,14}\d)/);
  const phone = phoneMatch?.[0]?.trim() || '';

  // Location
  const locationMatch = text.match(
    /([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|[A-Z][a-z]+)(?:,\s*[A-Z][a-z]+)?)/
  );
  const location = locationMatch?.[0] || '';

  // Skills — match against curated list
  const KNOWN_SKILLS = [
    'JavaScript','TypeScript','Python','Java','C++','C#','Go','Rust','Ruby','PHP','Swift','Kotlin',
    'React','Angular','Vue','Next.js','Node.js','Express','Django','Flask','FastAPI','Spring',
    'SQL','PostgreSQL','MySQL','MongoDB','Redis','Supabase','Firebase',
    'AWS','GCP','Azure','Docker','Kubernetes','Terraform','CI/CD','GitHub Actions',
    'HTML','CSS','Tailwind','GraphQL','REST','gRPC',
    'Machine Learning','Deep Learning','TensorFlow','PyTorch','NLP',
    'Git','Linux','Agile','Scrum',
  ];
  const skillsSectionMatch = text.match(
    /skills?[:\s]+([\s\S]{0,500}?)(?:\n{2,}|experience|education|projects|work|$)/i
  );
  const skillsRaw = skillsSectionMatch?.[1] || text;
  const skills = KNOWN_SKILLS.filter((s) =>
    new RegExp(`\\b${s.replace(/[.+]/g, '\\$&')}\\b`, 'i').test(skillsRaw)
  );

  // Experience years
  const expMatches = text.match(
    /(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi
  );
  let experienceYears = 0;
  if (expMatches) {
    const nums = expMatches.map((m) => parseInt(m, 10)).filter((n) => !isNaN(n) && n < 50);
    experienceYears = nums.length ? Math.max(...nums) : 0;
  }
  if (experienceYears === 0) {
    const years = text.match(/\b(19[89]\d|20[012]\d)\b/g) ?? [];
    if (years.length >= 2) {
      const sorted = years.map(Number).sort();
      experienceYears = Math.min(sorted[sorted.length - 1] - sorted[0], 30);
    }
  }

  // Companies
  const expSection = text.match(
    /(?:work\s*)?experience[:\s]+([\s\S]{0,800}?)(?:\n{2,}|education|skills|projects|$)/i
  )?.[1] || '';
  const companies = expSection
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 60 && /[A-Z]/.test(l) && !/^\d/.test(l))
    .slice(0, 5);

  // Education
  const eduSection = text.match(
    /education[:\s]+([\s\S]{0,400}?)(?:\n{2,}|experience|skills|projects|$)/i
  )?.[1] || '';
  const degreeMatch   = eduSection.match(/\b(B\.?Tech|M\.?Tech|B\.?E|M\.?E|B\.?Sc|M\.?Sc|MBA|PhD|B\.?S|M\.?S|Bachelor|Master|Associate)\b/i);
  const schoolMatch   = eduSection.match(/([A-Z][a-zA-Z\s&]{4,50}(?:University|College|Institute|School|Academy))/);
  const gradYearMatch = eduSection.match(/\b(19[89]\d|20[0-2]\d)\b/);

  return {
    name, email, phone, location, skills, experienceYears, companies,
    education: {
      degree: degreeMatch?.[1] || '',
      field: '',
      school: schoolMatch?.[1]?.trim() || '',
      graduationYear: gradYearMatch ? parseInt(gradYearMatch[1]) : 0,
    },
    resumeText: text.slice(0, 3000),
    parsedByFallback: true,
  };
}

// ─── Helper: heuristic screening scorer (no AI) ───────────────────────────────
function heuristicScreening(
  candidate: Partial<ParsedResume>,
  jobDescription: string
): ScreeningResult {
  const jd = jobDescription.toLowerCase();
  const candidateSkills = (candidate.skills ?? []).map((s) => s.toLowerCase());
  const resumeText      = (candidate.resumeText ?? '').toLowerCase();

  const STOP_WORDS = new Set([
    'the','and','for','with','will','have','from','this','that','are','our',
    'you','they','not','can','all','any','but','has','was','been','more',
    'your','their','work','team','also','into','over','such','than','then',
  ]);

  const jdTokens = [...new Set(
    jd.match(/\b[a-z][a-z.+#]{2,}\b/g)?.filter((t) => !STOP_WORDS.has(t)) ?? []
  )];

  const matchedSkills = candidateSkills.filter((s) =>
    jdTokens.some((t) => s.includes(t) || t.includes(s))
  );

  const skillScore = jdTokens.length > 0
    ? Math.min(100, Math.round((matchedSkills.length / Math.min(jdTokens.length, 15)) * 100))
    : 50;

  const expRequired = (() => {
    const m = jd.match(/(\d+)\+?\s*years?/);
    return m ? parseInt(m[1]) : 0;
  })();
  const expScore = expRequired === 0
    ? 70
    : (candidate.experienceYears ?? 0) >= expRequired
    ? 100
    : Math.round(((candidate.experienceYears ?? 0) / expRequired) * 100);

  const keywordHits  = jdTokens.filter((t) => resumeText.includes(t)).length;
  const keywordScore = jdTokens.length > 0
    ? Math.min(100, Math.round((keywordHits / Math.min(jdTokens.length, 20)) * 100))
    : 50;

  const score = Math.round(skillScore * 0.5 + expScore * 0.3 + keywordScore * 0.2);

  const strengths: string[] = [];
  const concerns:  string[] = [];

  if (matchedSkills.length > 0)
    strengths.push(`Matched skills: ${matchedSkills.slice(0, 5).join(', ')}`);
  if ((candidate.experienceYears ?? 0) >= expRequired && expRequired > 0)
    strengths.push(`Meets experience requirement (${candidate.experienceYears} yr(s))`);
  if (matchedSkills.length === 0)
    concerns.push('No direct skill matches found in resume');
  if (expRequired > 0 && (candidate.experienceYears ?? 0) < expRequired)
    concerns.push(`Experience below requirement (${candidate.experienceYears ?? 0} vs ${expRequired} yr(s))`);
  if (!candidate.email)
    concerns.push('Email not extracted — manual review recommended');

  const recommendation: ScreeningResult['recommendation'] =
    score >= 75 ? 'strong_yes' :
    score >= 55 ? 'yes' :
    score >= 35 ? 'maybe' : 'no';

  return {
    score,
    summary: `Heuristic screening score: ${score}/100. ${
      strengths.length ? 'Strengths: ' + strengths[0] + '. ' : ''
    }${concerns.length ? 'Note: ' + concerns[0] + '.' : ''}`,
    strengths, concerns, recommendation,
    scoredByFallback: true,
  };
}

// ─── /api/parse-resume ────────────────────────────────────────────────────────
/**
 * POST /api/parse-resume
 * Body: { fileBase64: string, fileName: string }
 *
 * Flow: extract text from PDF → send text to OpenRouter → heuristic fallback
 * ALWAYS returns HTTP 200 + ParsedResume JSON.
 *
 * Note: OpenRouter's free Llama model is text-only (no native PDF).
 * We extract text from the PDF first, then send that text to the model.
 */
app.post('/api/parse-resume', async (req: Request, res: Response) => {
  const { fileBase64, fileName } = req.body as { fileBase64?: string; fileName?: string };
  const safeFileName = fileName || 'resume.pdf';

  if (!fileBase64) {
    console.warn('[PARSE-RESUME] No fileBase64 received');
    return res.status(200).json({
      name: safeFileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
      email: '', phone: '', location: '',
      skills: [], experienceYears: 0, companies: [],
      education: { degree: '', field: '', school: '', graduationYear: 0 },
      resumeText: '',
      parsedByFallback: true,
    } satisfies ParsedResume);
  }

  // Step 1 — extract text from PDF bytes (no library needed)
  const rawText = extractTextFromBase64Pdf(fileBase64);

  if (!rawText || rawText.length < 50) {
    console.warn('[PARSE-RESUME] Could not extract readable text from PDF, using heuristic only');
    return res.status(200).json(heuristicParseResume(rawText, safeFileName));
  }

  // Step 2 — try OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      const prompt = `You are a resume parser. Extract structured data from the resume text below.
Return ONLY a valid JSON object — no markdown, no explanation, no backticks.

Use exactly this structure (use empty string or 0 for missing fields, empty array for missing lists):
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1234567890",
  "location": "City, State",
  "skills": ["skill1", "skill2"],
  "experienceYears": 3,
  "companies": ["Company A", "Company B"],
  "education": {
    "degree": "B.Tech",
    "field": "Computer Science",
    "school": "University Name",
    "graduationYear": 2022
  },
  "resumeText": "first 300 chars of the resume text"
}

RESUME TEXT:
${rawText.slice(0, 4000)}`;

      const raw    = await callOpenRouter(prompt, 800);
      const clean  = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(clean) as ParsedResume;
      parsed.parsedByFallback = false;

      console.log('[PARSE-RESUME] OpenRouter succeeded for', safeFileName);
      return res.status(200).json(parsed);

    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      console.warn(`[PARSE-RESUME FALLBACK] OpenRouter failed (status ${status ?? 'unknown'}), running heuristics`);
    }
  } else {
    console.warn('[PARSE-RESUME] No OPENROUTER_API_KEY set, using heuristics');
  }

  // Step 3 — heuristic fallback (always succeeds)
  console.log('[PARSE-RESUME] Using heuristic parser for', safeFileName);
  return res.status(200).json(heuristicParseResume(rawText, safeFileName));
});

// ─── runAiEvaluation ──────────────────────────────────────────────────────────
/**
 * Score a candidate against a job description.
 * Tries OpenRouter first; falls back to heuristicScreening on any error.
 * NEVER throws.
 */
async function runAiEvaluation(
  candidate: Partial<ParsedResume>,
  jobDescription: string
): Promise<ScreeningResult> {

  if (OPENROUTER_API_KEY) {
    try {
      const prompt = `You are a senior technical recruiter. Score this candidate for the job below.
Return ONLY a valid JSON object — no markdown, no explanation, no backticks.

Use exactly this structure:
{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence summary of fit>",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"],
  "recommendation": "<strong_yes|yes|maybe|no>"
}

JOB DESCRIPTION:
${jobDescription.slice(0, 1500)}

CANDIDATE PROFILE:
Name: ${candidate.name || 'Unknown'}
Skills: ${(candidate.skills ?? []).join(', ') || 'None listed'}
Experience: ${candidate.experienceYears ?? 0} years
Companies: ${(candidate.companies ?? []).join(', ') || 'None listed'}
Education: ${candidate.education?.degree || ''} ${candidate.education?.field || ''} — ${candidate.education?.school || ''}
Resume excerpt: ${(candidate.resumeText ?? '').slice(0, 800)}`;

      const raw    = await callOpenRouter(prompt, 600);
      const clean  = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(clean) as ScreeningResult;
      parsed.scoredByFallback = false;

      console.log('[SCREENING] OpenRouter succeeded for', candidate.name);
      return parsed;

    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      console.warn(`[SCREENING FALLBACK] OpenRouter failed (status ${status ?? 'unknown'}), using heuristic scoring`);
    }
  } else {
    console.warn('[SCREENING] No OPENROUTER_API_KEY set, using heuristic scoring');
  }

  return heuristicScreening(candidate, jobDescription);
}

// ─── /api/screen-candidate ────────────────────────────────────────────────────
/**
 * POST /api/screen-candidate
 * Body: { candidate: Partial<ParsedResume>, jobDescription: string }
 * Always returns 200 + ScreeningResult.
 */
app.post('/api/screen-candidate', async (req: Request, res: Response) => {
  const { candidate, jobDescription } = req.body as {
    candidate?: Partial<ParsedResume>;
    jobDescription?: string;
  };

  if (!candidate || !jobDescription) {
    return res.status(400).json({ error: 'candidate and jobDescription are required' });
  }

  const result = await runAiEvaluation(candidate, jobDescription);
  return res.status(200).json(result);
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    aiProvider: 'openrouter',
    model: OPENROUTER_MODEL,
    keyConfigured: !!OPENROUTER_API_KEY,
  });
});

// ─── Keep all your other existing routes below ────────────────────────────────
// e.g. app.get('/api/candidates', ...)
//      app.post('/api/candidates', ...)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[SERVER] AI provider: OpenRouter — ${OPENROUTER_MODEL}`);
  console.log(`[SERVER] API key configured: ${!!OPENROUTER_API_KEY}`);
});

export { app, runAiEvaluation, heuristicParseResume, heuristicScreening };
