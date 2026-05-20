export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  experienceYears: number;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  strictness: number;
  weights: {
    skills: number;
    experience: number;
    education: number;
    other: number;
  };
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experienceYears: number;
  companies: {
    company: string;
    role: string;
    duration: string;
  }[];
  education: {
    degree: string;
    field: string;
    school: string;
    graduationYear: number;
  };
  resumeText: string;
  uploadedAt: string;
  resumeFileName?: string;
  blacklisted?: boolean;
  blacklistReason?: string;
}

export interface Screening {
  id: string;
  candidateId: string;
  jobId: string;
  score: number;
  tier: 'strong_match' | 'good_fit' | 'consider' | 'not_match';
  reasoning: string;
  skillMatch: {
    matched: string[];
    missing: string[];
    niceToHave: string[];
  };
  experienceAlignment: string;
  educationAlignment: string;
  redFlags: string[];
  biasIndicators: {
    ageRisk: boolean;
    genderRisk: boolean;
    locationRisk: boolean;
    explanation: string;
  };
  proposedQuestions: string[];
  estimatedOnboarding: string;
  screenedAt: string;
  strengths?: string[];
}

export type PipelineStage = 'applied' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';

export interface PipelineItem {
  candidateId: string;
  jobId: string;
  currentStage: PipelineStage;
  stageHistory: {
    stage: PipelineStage;
    changedAt: string;
    changedBy: string;
    notes: string;
  }[];
  decision: 'approved' | 'rejected' | 'on_hold' | 'pending';
  interviewDate?: string;
  interviewFeedback?: string;
  offerDate?: string;
  hireDate?: string;
  timeToHire?: number;
}

export interface Communication {
  id: string;
  candidateId: string;
  jobId: string;
  type: 'email' | 'sms' | 'notification';
  subject: string;
  body: string;
  status: 'sent' | 'pending' | 'failed';
  sentAt: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  jobId: string;
  date: string;
  time: string;
  type: 'phone' | 'video' | 'in_person';
  interviewer: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  meetingLink: string;
  rating?: number;
  feedback?: string;
}
