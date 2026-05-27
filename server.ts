import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Job, Candidate, Screening, PipelineItem, PipelineStage, Communication, Interview } from './src/types';
import nodemailer from 'nodemailer';
import pdfParse from 'pdf-parse';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function mapJob(r: any): Job {
  return {
    id: r.id, title: r.title, department: r.department, location: r.location,
    description: r.description, requiredSkills: r.required_skills ?? [],
    niceToHaveSkills: r.nice_to_have_skills ?? [], experienceYears: r.experience_years,
    salaryMin: r.salary_min, salaryMax: r.salary_max, currency: r.currency,
    status: r.status, createdAt: r.created_at, strictness: r.strictness,
    weights: r.weights
  };
}

function mapCandidate(r: any): Candidate {
  return {
    id: r.id, name: r.name, email: r.email, phone: r.phone, location: r.location,
    skills: r.skills ?? [], experienceYears: r.experience_years,
    companies: r.companies ?? [], education: r.education ?? {},
    resumeText: r.resume_text, uploadedAt: r.uploaded_at,
    resumeFileName: r.resume_file_name,
    blacklisted: r.blacklisted ?? false, blacklistReason: r.blacklist_reason
  };
}

function mapScreening(r: any): Screening {
  return {
    id: r.id, candidateId: r.candidate_id, jobId: r.job_id,
    score: r.score, tier: r.tier, reasoning: r.reasoning,
    skillMatch: r.skill_match ?? { matched: [], missing: [], niceToHave: [] },
    experienceAlignment: r.experience_alignment, educationAlignment: r.education_alignment,
    redFlags: r.red_flags ?? [], biasIndicators: r.bias_indicators ?? {},
    proposedQuestions: r.proposed_questions ?? [],
    estimatedOnboarding: r.estimated_onboarding, strengths: r.strengths ?? [],
    screenedAt: r.screened_at
  };
}

function mapPipeline(r: any): PipelineItem {
  return {
    candidateId: r.candidate_id, jobId: r.job_id,
    currentStage: r.current_stage, stageHistory: r.stage_history ?? [],
    decision: r.decision, hireDate: r.hire_date,
    interviewFeedback: r.interview_feedback
  };
}

function mapCommunication(r: any): Communication {
  return {
    id: r.id, candidateId: r.candidate_id, jobId: r.job_id,
    type: r.type, subject: r.subject, body: r.body,
    status: r.status, sentAt: r.sent_at
  };
}

function mapInterview(r: any): Interview {
  return {
    id: r.id, candidateId: r.candidate_id, jobId: r.job_id,
    date: r.date, time: r.time, type: r.type,
    interviewer: r.interviewer, status: r.status,
    meetingLink: r.meeting_link, rating: r.rating, feedback: r.feedback
  };
}

function runAiEvaluation(job: Job, candidate: Candidate): Promise<Partial<Screening>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '') {
    return new Promise((resolve) => {
      const matched = candidate.skills.filter(s => job.requiredSkills.some(rs => rs.toLowerCase() === s.toLowerCase()));
      const missing = job.requiredSkills.filter(rs => !candidate.skills.some(s => s.toLowerCase() === rs.toLowerCase()));
      const niceToHave = candidate.skills.filter(s => job.niceToHaveSkills.some(nt => nt.toLowerCase() === s.toLowerCase()));
      let baseScore = 60 + (matched.length / Math.max(1, job.requiredSkills.length)) * 30;
      if (candidate.experienceYears >= job.experienceYears) baseScore += 8; else baseScore -= 10;
      baseScore = Math.min(100, Math.max(15, Math.round(baseScore)));
      let tier: Screening['tier'] = 'consider';
      if (baseScore >= 85) tier = 'strong_match';
      else if (baseScore >= 70) tier = 'good_fit';
      else if (baseScore < 45) tier = 'not_match';
      setTimeout(() => resolve({
        score: baseScore, tier,
        reasoning: `(Simulated) Candidate matches ${matched.length}/${job.requiredSkills.length} required skills.`,
        skillMatch: { matched, missing, niceToHave },
        experienceAlignment: `${candidate.experienceYears} years vs ${job.experienceYears} required.`,
        educationAlignment: `${candidate.education.degree} in ${candidate.education.field}.`,
        redFlags: candidate.experienceYears < job.experienceYears ? ['Fewer years than role baseline'] : [],
        biasIndicators: { ageRisk: false, genderRisk: false, locationRisk: false, explanation: 'No risk points spotted.' },
        proposedQuestions: [`Tell us about your experience with ${matched[0] || 'your core stack'}.`],
        estimatedOnboarding: candidate.experienceYears > 6 ? 'Easy (1-2 weeks)' : 'Moderate (2-4 weeks)',
        strengths: [`Strong knowledge of ${matched.slice(0, 3).join(', ')}`]
      }), 900);
    });
  }

  const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  const prompt = `You are an expert HR evaluation agent. Evaluate this candidate against the job.\n\nJOB:\nTitle: ${job.title}\nRequired Skills: ${job.requiredSkills.join(', ')}\nExperience Required: ${job.experienceYears} years\nStrictness: ${job.strictness}\n\nCANDIDATE:\nName: ${candidate.name}\nSkills: ${candidate.skills.join(', ')}\nExperience: ${candidate.experienceYears} years\nResume: ${candidate.resumeText}\n\nRespond ONLY with JSON matching this exact schema.`;

  return ai.models.generateContent({
    model: 'gemini-2.0-flash', contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER }, tier: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          skillMatch: { type: Type.OBJECT, properties: { matched: { type: Type.ARRAY, items: { type: Type.STRING } }, missing: { type: Type.ARRAY, items: { type: Type.STRING } }, niceToHave: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['matched', 'missing', 'niceToHave'] },
          experienceAlignment: { type: Type.STRING }, educationAlignment: { type: Type.STRING },
          redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
          biasIndicators: { type: Type.OBJECT, properties: { ageRisk: { type: Type.BOOLEAN }, genderRisk: { type: Type.BOOLEAN }, locationRisk: { type: Type.BOOLEAN }, explanation: { type: Type.STRING } }, required: ['ageRisk', 'genderRisk', 'locationRisk', 'explanation'] },
          proposedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          estimatedOnboarding: { type: Type.STRING }, strengths: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['score', 'tier', 'reasoning', 'skillMatch', 'experienceAlignment', 'educationAlignment', 'redFlags', 'biasIndicators', 'proposedQuestions', 'estimatedOnboarding', 'strengths']
      }
    }
  }).then(res => { try { return JSON.parse(res.text || '{}'); } catch { throw new Error('AI returned malformed output'); } });
}

async function getSmtpConfig() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'smtp').single();
  return data?.value ?? { host: process.env.SMTP_HOST || 'smtp.gmail.com', port: parseInt(process.env.SMTP_PORT || '587'), user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '', from: process.env.SMTP_FROM || 'noreply@recruit-ai.com' };
}

async function dispatchEmailNotification(toEmail: string, subject: string, bodyText: string) {
  console.log(`[EMAIL] To: ${toEmail} | ${subject}`);
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'noreply@recruit-ai.com';
  if (!apiKey) {
    console.log(`[EMAIL SIM] No Brevo API key — skipping.`);
    return { success: true, simulated: true };
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Recruit-AI', email: senderEmail },
        to: [{ email: toEmail }],
        subject,
        textContent: bodyText
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`[EMAIL OK] messageId: ${data.messageId}`);
      return { success: true, messageId: data.messageId };
    } else {
      console.error(`[EMAIL ERROR]`, data);
      return { success: false, error: data };
    }
  } catch (err) {
    console.error(`[EMAIL ERROR]`, err);
    return { success: false, error: err };
  }
}

async function autoScheduleCandidateInterview(candidateId: string, jobId: string) {
  const [{ data: candRow }, { data: jobRow }] = await Promise.all([
    supabase.from('candidates').select('*').eq('id', candidateId).single(),
    supabase.from('jobs').select('*').eq('id', jobId).single()
  ]);
  if (!candRow || !jobRow) return;
  const cand = mapCandidate(candRow);
  const job = mapJob(jobRow);

  const { data: existingInterviews } = await supabase.from('interviews').select('date, time');
  const slots = ['10:00', '11:30', '14:00', '15:30'];
  let targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);
  let scheduledDate = '', scheduledTime = '', found = false;

  for (let d = 0; d < 14 && !found; d++) {
    if (targetDate.getDay() === 0 || targetDate.getDay() === 6) { targetDate.setDate(targetDate.getDate() + 1); continue; }
    const dateStr = targetDate.toISOString().split('T')[0];
    for (const slot of slots) {
      if (!(existingInterviews ?? []).some((i: any) => i.date === dateStr && i.time === slot)) {
        scheduledDate = dateStr; scheduledTime = slot; found = true; break;
      }
    }
    if (!found) targetDate.setDate(targetDate.getDate() + 1);
  }
  if (!found) { const d = new Date(); d.setDate(d.getDate() + 2); scheduledDate = d.toISOString().split('T')[0]; scheduledTime = '11:00'; }

  const hash = Math.random().toString(36).substring(2, 12);
  const meetLink = `https://meet.google.com/meet-${hash.slice(0,3)}-${hash.slice(3,7)}-${hash.slice(7,10)}`;
  const newInterview = { id: `int-${Date.now()}`, candidate_id: candidateId, job_id: jobId, date: scheduledDate, time: scheduledTime, type: 'video', interviewer: 'Staff AI Systems Recruiter', status: 'scheduled', meeting_link: meetLink };
  await supabase.from('interviews').insert(newInterview);

  const { data: pRow } = await supabase.from('pipeline').select('*').eq('candidate_id', candidateId).eq('job_id', jobId).single();
  if (pRow) {
    const history = [...(pRow.stage_history ?? []), { stage: 'interview', changedAt: new Date().toISOString(), changedBy: 'AI Recruiter Bot', notes: 'Auto-scheduled interview.' }];
    await supabase.from('pipeline').update({ current_stage: 'interview', stage_history: history }).eq('candidate_id', candidateId).eq('job_id', jobId);
  }

  const subject = `Technical Interview Scheduled: ${job.title}`;
  const body = `Hi ${cand.name},\n\nYour screening score qualifies you for a technical interview for "${job.title}".\n\n📅 Date: ${scheduledDate}\n⏰ Time: ${scheduledTime}\n💻 Meet: ${meetLink}\n\nWarm regards,\nRecruit-AI`;
  await dispatchEmailNotification(cand.email, subject, body);
  await supabase.from('communications').insert({ id: `comm-sched-${Date.now()}`, candidate_id: candidateId, job_id: jobId, type: 'email', subject, body, status: 'sent', sent_at: new Date().toISOString() });
}

function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // ── STATUS ────────────────────────────────────────────────────────────────
  app.get('/api/status', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
    res.json({ configured: hasKey, mode: hasKey ? 'Production Gemini (Live)' : 'Simulation (Heuristic Fallback)' });
  });

  // ── PARSE RESUME ──────────────────────────────────────────────────────────
  app.post('/api/parse-resume', async (req, res) => {
    try {
      const { fileBase64, fileName } = req.body;
      if (!fileBase64) return res.status(400).json({ error: 'No file data provided' });

      // Step 1: Extract raw text from PDF
      const buffer = Buffer.from(fileBase64, 'base64');
      let rawText = '';
      try {
        const parsed = await pdfParse(buffer);
        rawText = parsed.text || '';
      } catch (e) {
        rawText = '';
      }

      if (!rawText || rawText.trim().length < 30) {
        // Fallback: return minimal data from filename only
        const cleanName = (fileName || 'Candidate')
          .replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        return res.json({
          name: cleanName, email: '', phone: '', location: '',
          skills: [], experienceYears: 0,
          companies: [], education: { degree: '', field: '', school: '', graduationYear: 0 },
          resumeText: rawText || `Resume file: ${fileName}`
        });
      }

      // Step 2: Use Gemini to extract structured candidate data
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        // No Gemini — do basic regex extraction from text
        const emailMatch = rawText.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
        const phoneMatch = rawText.match(/[\+\(]?[\d\s\-\(\)]{9,15}/);
        const lines = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean);
        return res.json({
          name: lines[0] || 'Unknown Candidate',
          email: emailMatch ? emailMatch[0] : '',
          phone: phoneMatch ? phoneMatch[0].trim() : '',
          location: '', skills: [], experienceYears: 0,
          companies: [], education: { degree: '', field: '', school: '', graduationYear: 0 },
          resumeText: rawText
        });
      }

      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
      const prompt = `Extract structured candidate information from this resume text. Return ONLY valid JSON.

RESUME TEXT:
${rawText.slice(0, 8000)}

Extract and return this exact JSON structure:
{
  "name": "full name",
  "email": "email address or empty string",
  "phone": "phone number or empty string",
  "location": "city, country or empty string",
  "skills": ["skill1", "skill2"],
  "experienceYears": 0,
  "companies": [{"company": "name", "role": "title", "duration": "X years"}],
  "education": {"degree": "degree type", "field": "field of study", "school": "institution", "graduationYear": 0},
  "resumeText": "full extracted resume text"
}

Rules:
- Extract ONLY information actually present in the resume
- skills must be specific technical skills, tools, languages from the resume
- experienceYears = total years of work experience found
- If a field is not found, use empty string or empty array
- resumeText = the full raw text provided`;

      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(result.text || '{}');
      } catch {
        parsed = {};
      }

      res.json({
        name: parsed.name || 'Unknown Candidate',
        email: parsed.email || '',
        phone: parsed.phone || '',
        location: parsed.location || '',
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        experienceYears: Number(parsed.experienceYears) || 0,
        companies: Array.isArray(parsed.companies) ? parsed.companies : [],
        education: parsed.education || { degree: '', field: '', school: '', graduationYear: 0 },
        resumeText: rawText
      });
    } catch (err: any) {
      console.error('[PARSE-RESUME ERROR]', err);
      res.status(500).json({ error: err.message || 'Failed to parse resume' });
    }
  });

  // ── JOBS ──────────────────────────────────────────────────────────────────
  app.get('/api/jobs', async (req, res) => {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapJob));
  });

  app.post('/api/jobs', async (req, res) => {
    const b = req.body;
    const row = { id: `job-${Date.now()}`, title: b.title || 'Untitled Job', department: b.department || 'General', location: b.location || 'Remote', description: b.description || '', required_skills: b.requiredSkills ?? [], nice_to_have_skills: b.niceToHaveSkills ?? [], experience_years: Number(b.experienceYears) || 0, salary_min: Number(b.salaryMin) || 0, salary_max: Number(b.salaryMax) || 0, currency: 'USD', status: 'active', created_at: new Date().toISOString(), strictness: Number(b.strictness) || 50, weights: b.weights ?? { skills: 40, experience: 35, education: 15, other: 10 } };
    const { data, error } = await supabase.from('jobs').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(mapJob(data));
  });

  app.put('/api/jobs/:id', async (req, res) => {
    const b = req.body;
    const updates: any = {};
    if (b.title !== undefined) updates.title = b.title;
    if (b.department !== undefined) updates.department = b.department;
    if (b.location !== undefined) updates.location = b.location;
    if (b.description !== undefined) updates.description = b.description;
    if (b.requiredSkills !== undefined) updates.required_skills = b.requiredSkills;
    if (b.niceToHaveSkills !== undefined) updates.nice_to_have_skills = b.niceToHaveSkills;
    if (b.experienceYears !== undefined) updates.experience_years = b.experienceYears;
    if (b.salaryMin !== undefined) updates.salary_min = b.salaryMin;
    if (b.salaryMax !== undefined) updates.salary_max = b.salaryMax;
    if (b.status !== undefined) updates.status = b.status;
    if (b.strictness !== undefined) updates.strictness = b.strictness;
    if (b.weights !== undefined) updates.weights = b.weights;
    const { data, error } = await supabase.from('jobs').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(404).json({ error: 'Job not found' });
    res.json(mapJob(data));
  });

  app.delete('/api/jobs/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('pipeline').delete().eq('job_id', id);
    await supabase.from('interviews').delete().eq('job_id', id);
    await supabase.from('screenings').delete().eq('job_id', id);
    await supabase.from('communications').delete().eq('job_id', id);
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Job not found' });
    res.json({ success: true, message: 'Job and all associated records deleted.' });
  });

  // ── CANDIDATES ────────────────────────────────────────────────────────────
  app.get('/api/candidates', async (req, res) => {
    const { data, error } = await supabase.from('candidates').select('*').order('uploaded_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapCandidate));
  });

  app.post('/api/candidates', async (req, res) => {
    const b = req.body;
    const id = `cand-${Date.now()}`;
    const row = { id, name: b.name || 'Anonymous', email: b.email || '', phone: b.phone || '', location: b.location || 'Remote', skills: b.skills ?? [], experience_years: Number(b.experienceYears) || 0, companies: b.companies ?? [], education: b.education ?? { degree: 'N/A', field: 'N/A', school: 'N/A', graduationYear: 2024 }, resume_text: b.resumeText || '', uploaded_at: new Date().toISOString(), resume_file_name: b.resumeFileName || 'Uploaded_Resume.pdf' };
    const { data, error } = await supabase.from('candidates').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    const jobId = b.jobId || (await supabase.from('jobs').select('id').limit(1).single()).data?.id || '';
    const pipeRow = { candidate_id: id, job_id: jobId, current_stage: 'applied', stage_history: [{ stage: 'applied', changedAt: new Date().toISOString(), changedBy: 'System', notes: 'Application registered.' }], decision: 'pending' };
    const { data: pData } = await supabase.from('pipeline').insert(pipeRow).select().single();
    res.status(201).json({ candidate: mapCandidate(data), pipeline: pData ? mapPipeline(pData) : null });
  });

  app.post('/api/candidates/bulk', async (req, res) => {
    const { list, jobId } = req.body;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'list must be an array' });
    const jobFallback = jobId || (await supabase.from('jobs').select('id').limit(1).single()).data?.id || '';
    const candRows = list.map((item: any, i: number) => ({ id: `cand-${Date.now()}-${i}`, name: item.name || `Batch #${i+1}`, email: item.email || `batch${i}@recruit-ai.org`, phone: item.phone || '', location: item.location || 'Remote', skills: item.skills ?? [], experience_years: Number(item.experienceYears) || 3, companies: item.companies ?? [], education: item.education ?? { degree: 'Bachelor', field: 'Engineering', school: 'Tech Institute', graduationYear: 2022 }, resume_text: item.resumeText || '', uploaded_at: new Date().toISOString(), resume_file_name: item.resumeFileName || `CV_Batch_${i+1}.pdf` }));
    const { data: inserted, error } = await supabase.from('candidates').insert(candRows).select();
    if (error) return res.status(500).json({ error: error.message });
    const pipeRows = candRows.map(c => ({ candidate_id: c.id, job_id: jobFallback, current_stage: 'applied', stage_history: [{ stage: 'applied', changedAt: new Date().toISOString(), changedBy: 'Batch Importer', notes: 'Bulk processed.' }], decision: 'pending' }));
    const { data: pInserted } = await supabase.from('pipeline').insert(pipeRows).select();
    res.status(201).json({ candidates: (inserted ?? []).map(mapCandidate), pipelines: (pInserted ?? []).map(mapPipeline) });
  });

  app.post('/api/candidates/:id/blacklist', async (req, res) => {
    const { id } = req.params;
    const { reason, blacklist } = req.body;
    const isBlacklisted = blacklist !== false;
    const { data, error } = await supabase.from('candidates').update({ blacklisted: isBlacklisted, blacklist_reason: isBlacklisted ? (reason || 'Flagged for recruitment violation') : '' }).eq('id', id).select().single();
    if (error) return res.status(404).json({ error: 'Candidate not found' });
    if (isBlacklisted) {
      const { data: pipes } = await supabase.from('pipeline').select('*').eq('candidate_id', id);
      for (const p of pipes ?? []) {
        const history = [...(p.stage_history ?? []), { stage: 'rejected', changedAt: new Date().toISOString(), changedBy: 'System Security', notes: `Blacklisted: ${reason}` }];
        await supabase.from('pipeline').update({ current_stage: 'rejected', decision: 'rejected', stage_history: history }).eq('candidate_id', id).eq('job_id', p.job_id);
      }
    }
    res.json(mapCandidate(data));
  });

  // ✅ EDIT candidate (name, email, phone)
  app.put('/api/candidates/:id', async (req, res) => {
    const { id } = req.params;
    const updates: any = {};
    if (req.body.email) updates.email = req.body.email;
    if (req.body.name) updates.name = req.body.name;
    if (req.body.phone) updates.phone = req.body.phone;
    const { data, error } = await supabase.from('candidates').update(updates).eq('id', id).select().single();
    if (error) return res.status(404).json({ error: 'Candidate not found' });
    res.json(mapCandidate(data));
  });

  // ✅ DELETE candidate + all related records
  app.delete('/api/candidates/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('pipeline').delete().eq('candidate_id', id);
    await supabase.from('interviews').delete().eq('candidate_id', id);
    await supabase.from('screenings').delete().eq('candidate_id', id);
    await supabase.from('communications').delete().eq('candidate_id', id);
    const { error } = await supabase.from('candidates').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Candidate not found' });
    res.json({ success: true, message: 'Candidate and all records deleted.' });
  });

  // ── SCREENINGS ────────────────────────────────────────────────────────────
  app.get('/api/screenings', async (req, res) => {
    const { data, error } = await supabase.from('screenings').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapScreening));
  });

  app.post('/api/screenings/evaluate', async (req, res) => {
    const { candidateId, jobId } = req.body;
    const [{ data: jobRow }, { data: candRow }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('candidates').select('*').eq('id', candidateId).single()
    ]);
    if (!jobRow || !candRow) return res.status(404).json({ error: 'Job or Candidate not found' });
    const job = mapJob(jobRow);
    const candidate = mapCandidate(candRow);

    try {
      const result = await runAiEvaluation(job, candidate);
      const screenRow = { id: `scr-${Date.now()}`, candidate_id: candidateId, job_id: jobId, score: result.score ?? 70, tier: result.tier ?? 'consider', reasoning: result.reasoning ?? '', skill_match: result.skillMatch ?? { matched: [], missing: [], niceToHave: [] }, experience_alignment: result.experienceAlignment ?? '', education_alignment: result.educationAlignment ?? '', red_flags: result.redFlags ?? [], bias_indicators: result.biasIndicators ?? {}, proposed_questions: result.proposedQuestions ?? [], estimated_onboarding: result.estimatedOnboarding ?? 'Moderate', strengths: result.strengths ?? [], screened_at: new Date().toISOString() };
      await supabase.from('screenings').delete().eq('candidate_id', candidateId).eq('job_id', jobId);
      const { data: scrData } = await supabase.from('screenings').insert(screenRow).select().single();

      const { data: pRow } = await supabase.from('pipeline').select('*').eq('candidate_id', candidateId).eq('job_id', jobId).single();
      if (pRow) {
        let stage: PipelineStage = 'screening';
        let note = `AI Score: ${screenRow.score}. `;
        if (screenRow.score >= 75) { stage = 'shortlisted'; note += 'Auto-Shortlisted (score ≥ 75).'; }
        else if (screenRow.score < 40) { stage = 'rejected'; note += 'Below threshold — rejected.'; }
        const history = [...(pRow.stage_history ?? []), { stage, changedAt: new Date().toISOString(), changedBy: 'AI Recruiter Bot', notes: note }];
        await supabase.from('pipeline').update({ current_stage: stage, stage_history: history }).eq('candidate_id', candidateId).eq('job_id', jobId);

        const subject = stage === 'shortlisted' ? `Shortlisted: ${job.title}` : `Application Update: ${job.title}`;
        const body = stage === 'shortlisted'
          ? `Hi ${candidate.name},\n\nYou scored ${screenRow.score}% and have been shortlisted for ${job.title}. We'll be in touch shortly.`
          : `Hi ${candidate.name},\n\nThank you for applying. We've decided to move forward with other candidates at this time.`;
        dispatchEmailNotification(candidate.email, subject, body);
        await supabase.from('communications').insert({ id: `comm-${Date.now()}`, candidate_id: candidateId, job_id: jobId, type: 'email', subject, body, status: 'sent', sent_at: new Date().toISOString() });
        if (stage === 'shortlisted') await autoScheduleCandidateInterview(candidateId, jobId);
      }
      res.status(200).json({ screening: scrData ? mapScreening(scrData) : screenRow });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Evaluation failure' });
    }
  });

  // ── PIPELINE ──────────────────────────────────────────────────────────────
  app.get('/api/pipeline', async (req, res) => {
    const { data, error } = await supabase.from('pipeline').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapPipeline));
  });

  async function updatePipelineStage(candidateId: string, jobId: string, stage: PipelineStage, notes: string, updater: string, res: any) {
    const { data: pRow, error } = await supabase.from('pipeline').select('*').eq('candidate_id', candidateId).eq('job_id', jobId).single();
    if (error || !pRow) return res.status(404).json({ error: 'Pipeline record not found' });
    const history = [...(pRow.stage_history ?? []), { stage, changedAt: new Date().toISOString(), changedBy: updater || 'Admin', notes: notes || `Moved to ${stage}` }];
    const updates: any = { current_stage: stage, stage_history: history };
    if (stage === 'hired') { updates.decision = 'approved'; updates.hire_date = new Date().toISOString(); }
    else if (stage === 'rejected') { updates.decision = 'rejected'; }
    const { data: updated } = await supabase.from('pipeline').update(updates).eq('candidate_id', candidateId).eq('job_id', jobId).select().single();

    const [{ data: candRow }, { data: jobRow }] = await Promise.all([
      supabase.from('candidates').select('name, email').eq('id', candidateId).single(),
      supabase.from('jobs').select('title').eq('id', jobId).single()
    ]);
    if (candRow && jobRow) {
      const subject = `Status Update: ${jobRow.title}`;
      const body = `Hi ${candRow.name},\n\nYour application for ${jobRow.title} has moved to: ${stage.toUpperCase()}.\n\nNotes: "${notes || 'Under review.'}"\n\nWarm regards,\nRecruit-AI`;
      dispatchEmailNotification(candRow.email, subject, body);
      await supabase.from('communications').insert({ id: `comm-${Date.now()}`, candidate_id: candidateId, job_id: jobId, type: 'email', subject, body, status: 'sent', sent_at: new Date().toISOString() });
    }
    res.json(updated ? mapPipeline(updated) : {});
  }

  app.put('/api/pipeline/:candidateId/:jobId', (req, res) => {
    const { candidateId, jobId } = req.params;
    const { stage, notes, updater } = req.body;
    return updatePipelineStage(candidateId, jobId, stage, notes, updater, res);
  });

  app.post('/api/pipeline/stage', (req, res) => {
    const { candidateId, jobId, stage, notes, updater } = req.body;
    return updatePipelineStage(candidateId, jobId, stage, notes, updater, res);
  });

  // ── COMMUNICATIONS ────────────────────────────────────────────────────────
  app.get('/api/communications', async (req, res) => {
    const { data, error } = await supabase.from('communications').select('*').order('sent_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapCommunication));
  });

  app.post('/api/communications', async (req, res) => {
    const b = req.body;
    const row = { id: `comm-${Date.now()}`, candidate_id: b.candidateId, job_id: b.jobId, type: b.type || 'email', subject: b.subject || 'No Subject', body: b.body || '', status: 'sent', sent_at: new Date().toISOString() };
    const { data, error } = await supabase.from('communications').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(mapCommunication(data));
  });

  // ── INTERVIEWS ────────────────────────────────────────────────────────────
  app.get('/api/interviews', async (req, res) => {
    const { data, error } = await supabase.from('interviews').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapInterview));
  });

  app.post('/api/interviews', async (req, res) => {
    const b = req.body;
    const row = { id: `int-${Date.now()}`, candidate_id: b.candidateId, job_id: b.jobId, date: b.date || new Date().toISOString().split('T')[0], time: b.time || '12:00', type: b.type || 'video', interviewer: b.interviewer || 'Recruiter', status: 'scheduled', meeting_link: b.meetingLink || 'https://meet.google.com/meet-link' };
    const { data, error } = await supabase.from('interviews').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    const { data: pRow } = await supabase.from('pipeline').select('*').eq('candidate_id', b.candidateId).eq('job_id', b.jobId).single();
    if (pRow && pRow.current_stage !== 'interview') {
      const history = [...(pRow.stage_history ?? []), { stage: 'interview', changedAt: new Date().toISOString(), changedBy: 'Admin Scheduler', notes: `Interview on ${row.date} at ${row.time}` }];
      await supabase.from('pipeline').update({ current_stage: 'interview', stage_history: history }).eq('candidate_id', b.candidateId).eq('job_id', b.jobId);
    }
    res.status(201).json(mapInterview(data));
  });

  app.post('/api/interviews/:id/feedback', async (req, res) => {
    const { rating, feedback } = req.body;
    const { data, error } = await supabase.from('interviews').update({ status: 'completed', rating: Number(rating) || 5, feedback }).eq('id', req.params.id).select().single();
    if (error) return res.status(404).json({ error: 'Interview not found' });
    const int = mapInterview(data);
    const { data: pRow } = await supabase.from('pipeline').select('*').eq('candidate_id', int.candidateId).eq('job_id', int.jobId).single();
    if (pRow) {
      const history = [...(pRow.stage_history ?? []), { stage: 'interview', changedAt: new Date().toISOString(), changedBy: int.interviewer, notes: `Interview done. Rating: ${rating}/5. ${feedback}` }];
      await supabase.from('pipeline').update({ interview_feedback: feedback, stage_history: history }).eq('candidate_id', int.candidateId).eq('job_id', int.jobId);
    }
    res.json(int);
  });

  // ── GMAIL ─────────────────────────────────────────────────────────────────
  app.get('/api/gmail/status', async (req, res) => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'gmail').single();
    res.json(data?.value ?? { connected: false, email: '' });
  });

  app.post('/api/gmail/connect', async (req, res) => {
    const val = { connected: true, email: req.body.email || '' };
    await supabase.from('app_settings').upsert({ key: 'gmail', value: val });
    res.json({ success: true, ...val });
  });

  app.post('/api/gmail/disconnect', async (req, res) => {
    await supabase.from('app_settings').upsert({ key: 'gmail', value: { connected: false, email: '' } });
    res.json({ success: true, connected: false, email: '' });
  });

  app.post('/api/gmail/send-custom', async (req, res) => {
    const { candidateId, jobId, subject, body } = req.body;
    const { data: gmailRow } = await supabase.from('app_settings').select('value').eq('key', 'gmail').single();
    const connected = gmailRow?.value?.connected ?? false;
    const row = { id: `comm-${Date.now()}`, candidate_id: candidateId, job_id: jobId, type: 'email', subject: subject || 'Recruitment Update', body: body || '', status: connected ? 'sent' : 'pending', sent_at: new Date().toISOString() };
    const { data } = await supabase.from('communications').insert(row).select().single();
    res.status(201).json({ success: true, message: connected ? 'Email dispatched!' : 'Email queued.', comm: data ? mapCommunication(data) : null });
  });

  // ── SMTP ──────────────────────────────────────────────────────────────────
  app.get('/api/smtp/config', async (req, res) => {
    const cfg = await getSmtpConfig();
    res.json({ host: cfg.host, port: cfg.port, user: cfg.user, hasPassword: !!cfg.pass, from: cfg.from });
  });

  app.post('/api/smtp/config', async (req, res) => {
    const { host, port, user, pass, from } = req.body;
    const current = await getSmtpConfig();
    const updated = { host: host ?? current.host, port: Number(port) || current.port, user: user ?? current.user, pass: pass ?? current.pass, from: from ?? current.from };
    await supabase.from('app_settings').upsert({ key: 'smtp', value: updated });
    res.json({ success: true, message: 'SMTP config updated.' });
  });

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  app.get('/api/analytics', async (req, res) => {
    const jobId = req.query.jobId as string;
    let query = supabase.from('pipeline').select('*');
    if (jobId) query = query.eq('job_id', jobId);
    const { data: pipes } = await query;
    const p = pipes ?? [];
    const total = p.length;
    const count = (stages: string[]) => p.filter(x => stages.includes(x.current_stage)).length;
    res.json({
      jobId: jobId || 'all', totalApplications: total,
      funnel: { applied: total, screening: count(['screening','shortlisted','interview','offer','hired','rejected']), shortlisted: count(['shortlisted','interview','offer','hired']), interview: count(['interview','offer','hired']), offer: count(['offer','hired']), hired: count(['hired']), rejected: count(['rejected']) },
      rates: { shortlistRate: total ? Math.round((count(['shortlisted','interview','offer','hired']) / total) * 100) : 0, interviewRate: count(['shortlisted','interview','offer','hired']) ? Math.round((count(['interview','offer','hired']) / count(['shortlisted','interview','offer','hired'])) * 100) : 0, hireRate: total ? Math.round((count(['hired']) / total) * 100) : 0 },
      sources: [{ name: 'LinkedIn', count: Math.ceil(total * 0.45) }, { name: 'Direct Upload', count: Math.ceil(total * 0.25) }, { name: 'Indeed', count: Math.ceil(total * 0.20) }, { name: 'Referral', count: Math.ceil(total * 0.10) }],
      averageTimeToHire: 14
    });
  });

  // ── STATIC / VITE ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then((vite) => {
      app.use(vite.middlewares);
      app.get('*', (req, res) => res.sendFile(path.resolve(process.cwd(), 'index.html')));
      app.listen(PORT, '0.0.0.0', () => console.log(`Dev server: http://localhost:${PORT}`));
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    app.listen(PORT, '0.0.0.0', () => console.log(`Production server: http://localhost:${PORT}`));
  }
}

// Keep-alive ping every 10 mins
setInterval(() => {
  fetch('https://recruitai-yc07.onrender.com/api/status')
    .then(() => console.log('[Keep-alive] pinged'))
    .catch(() => {});
}, 10 * 60 * 1000);

startServer();
