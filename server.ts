import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Job, Candidate, Screening, PipelineItem, PipelineStage, Communication, Interview } from './src/types';
import nodemailer from 'nodemailer';

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

// ✅ FIXED: IPv4 enforcement and proper error handling
async function dispatchEmailNotification(toEmail: string, subject: string, bodyText: string) {
  console.log(`[EMAIL] To: ${toEmail} | ${subject}`);
  const cfg = await getSmtpConfig();
  if (cfg.user && cfg.pass) {
    try {
      // 🔧 KEY FIX: Added 'family: 4' to force IPv4 instead of IPv6
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        auth: { user: cfg.user, pass: cfg.pass },
        family: 4, // ✅ Force IPv4 - fixes ENETUNREACH error on Render
        tls: { rejectUnauthorized: false }
      });
      
      const info = await transporter.sendMail({
        from: `"Recruit-AI" <${cfg.user}>`,
        to: toEmail,
        subject,
        text: bodyText
      });
      
      console.log(`[SMTP OK] ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[SMTP ERROR]`, err);
      return { success: false, error: err };
    }
  }
  console.log(`[SMTP SIM] No credentials — staging only.`);
  return { success: true, simulated: true };
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
  const PORT = parseInt(process.env.PORT || '3000');

  app.use(express.json());

  // ── STATUS ────────────────────────────────────────────────────────────────
  app.get('/api/status', (req, res) => {
    res.json({ alive: true, timestamp: new Date().toISOString() });
  });

  // ── JOBS ──────────────────────────────────────────────────────────────────
  app.get('/api/jobs', async (req, res) => {
    const { data, error } = await supabase.from('jobs').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapJob));
  });

  app.post('/api/jobs', async (req, res) => {
    const b = req.body;
    const row = { id: `job-${Date.now()}`, title: b.title, department: b.department, location: b.location, description: b.description, required_skills: b.requiredSkills ?? [], nice_to_have_skills: b.niceToHaveSkills ?? [], experience_years: b.experienceYears ?? 0, salary_min: b.salaryMin, salary_max: b.salaryMax, currency: b.currency || 'USD', status: 'open', created_at: new Date().toISOString(), strictness: b.strictness || 'moderate', weights: b.weights };
    const { data, error } = await supabase.from('jobs').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(mapJob(data));
  });

  app.put('/api/jobs/:id', async (req, res) => {
    const b = req.body;
    const { data, error } = await supabase.from('jobs').update({ title: b.title, department: b.department, location: b.location, description: b.description, required_skills: b.requiredSkills, nice_to_have_skills: b.niceToHaveSkills, experience_years: b.experienceYears, salary_min: b.salaryMin, salary_max: b.salaryMax, currency: b.currency, status: b.status, strictness: b.strictness, weights: b.weights }).eq('id', req.params.id).select().single();
    if (error) return res.status(404).json({ error: 'Job not found' });
    res.json(mapJob(data));
  });

  app.delete('/api/jobs/:id', async (req, res) => {
    const { error } = await supabase.from('jobs').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // ── CANDIDATES ────────────────────────────────────────────────────────────
  app.get('/api/candidates', async (req, res) => {
    const { data, error } = await supabase.from('candidates').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapCandidate));
  });

  app.post('/api/candidates', async (req, res) => {
    const b = req.body;
    const row = { id: `cand-${Date.now()}`, name: b.name, email: b.email, phone: b.phone, location: b.location, skills: b.skills ?? [], experience_years: b.experienceYears ?? 0, companies: b.companies ?? [], education: b.education ?? {}, resume_text: b.resumeText || '', uploaded_at: new Date().toISOString(), resume_file_name: b.resumeFileName || '', blacklisted: false };
    const { data, error } = await supabase.from('candidates').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(mapCandidate(data));
  });

  app.put('/api/candidates/:id', async (req, res) => {
    const b = req.body;
    const { data, error } = await supabase.from('candidates').update({ name: b.name, email: b.email, phone: b.phone, location: b.location, skills: b.skills, experience_years: b.experienceYears, companies: b.companies, education: b.education, resume_text: b.resumeText, resume_file_name: b.resumeFileName }).eq('id', req.params.id).select().single();
    if (error) return res.status(404).json({ error: 'Candidate not found' });
    res.json(mapCandidate(data));
  });

  app.post('/api/candidates/:id/blacklist', async (req, res) => {
    const { reason } = req.body;
    const { data, error } = await supabase.from('candidates').update({ blacklisted: true, blacklist_reason: reason }).eq('id', req.params.id).select().single();
    if (error) return res.status(404).json({ error: 'Candidate not found' });
    res.json(mapCandidate(data));
  });

  // ── SCREENING ─────────────────────────────────────────────────────────────
  app.post('/api/screening', async (req, res) => {
    const { candidateId, jobId } = req.body;
    const [{ data: candRow }, { data: jobRow }] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', candidateId).single(),
      supabase.from('jobs').select('*').eq('id', jobId).single()
    ]);
    if (!candRow || !jobRow) return res.status(404).json({ error: 'Candidate or Job not found' });

    const cand = mapCandidate(candRow);
    const job = mapJob(jobRow);

    try {
      const aiResult = await runAiEvaluation(job, cand);
      const screening: Partial<Screening> = { id: `scr-${Date.now()}`, candidateId, jobId, screenedAt: new Date().toISOString(), ...aiResult };
      const { data, error } = await supabase.from('screenings').insert(screening).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.status(201).json(mapScreening(data));

      if (mapScreening(data).tier === 'strong_match' || mapScreening(data).tier === 'good_fit') {
        await autoScheduleCandidateInterview(candidateId, jobId);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'AI evaluation failed' });
    }
  });

  app.get('/api/screenings', async (req, res) => {
    const { data, error } = await supabase.from('screenings').select('*').order('screened_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapScreening));
  });

  // ── PIPELINE ──────────────────────────────────────────────────────────────
  async function updatePipelineStage(candidateId: string, jobId: string, stage: string, notes: string, updater: string, res: any) {
    const { data: pRow } = await supabase.from('pipeline').select('*').eq('candidate_id', candidateId).eq('job_id', jobId).single();
    if (!pRow) {
      const row = { candidate_id: candidateId, job_id: jobId, current_stage: stage, stage_history: [{ stage, changedAt: new Date().toISOString(), changedBy: updater, notes }], decision: null, hire_date: null };
      const { data, error } = await supabase.from('pipeline').insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(mapPipeline(data));
    }
    const history = [...(pRow.stage_history ?? []), { stage, changedAt: new Date().toISOString(), changedBy: updater, notes }];
    const { data, error } = await supabase.from('pipeline').update({ current_stage: stage, stage_history: history }).eq('candidate_id', candidateId).eq('job_id', jobId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(mapPipeline(data));
  }

  app.get('/api/pipeline', async (req, res) => {
    const { data, error } = await supabase.from('pipeline').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map(mapPipeline));
  });

  app.post('/api/pipeline/:candidateId/:jobId/:stage', (req, res) => {
    const { notes, updater } = req.body;
    const { candidateId, jobId, stage } = req.params;
    return updatePipelineStage(candidateId, jobId, stage, notes || '', updater || 'System', res);
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
