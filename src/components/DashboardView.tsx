import { useEffect, useState } from 'react';
import { 
  Briefcase, 
  Users, 
  CheckCircle, 
  Calendar, 
  ArrowRight,
  PlusCircle, 
  Upload, 
  Zap, 
  Clock, 
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';
import { Job, Candidate, Interview, PipelineItem } from '../types';

interface DashboardViewProps {
  jobs: Job[];
  candidates: Candidate[];
  pipeline: PipelineItem[];
  interviews: Interview[];
  onNavigate: (tab: string) => void;
  onSelectCandidateJob?: (candId: string, jobId: string) => void;
}

export default function DashboardView({ 
  jobs, 
  candidates, 
  pipeline, 
  interviews, 
  onNavigate,
  onSelectCandidateJob
}: DashboardViewProps) {
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalCandidates: 0,
    shortlistedCount: 0,
    averageTimeToHire: 14, // default days
    shortlistRate: 0
  });

  useEffect(() => {
    const activeJobs = jobs.filter(j => j.status === 'active').length;
    const totalCandidates = candidates.length;
    const shortlistedCount = pipeline.filter(p => ['shortlisted', 'interview', 'offer', 'hired'].includes(p.currentStage)).length;
    const shortlistRate = totalCandidates ? Math.round((shortlistedCount / totalCandidates) * 100) : 0;
    
    setStats({
      activeJobs,
      totalCandidates,
      shortlistedCount,
      averageTimeToHire: 14,
      shortlistRate
    });
  }, [jobs, candidates, pipeline]);

  // Next 3 scheduled interviews
  const upcomingInterviews = interviews
    .filter(i => i.status === 'scheduled')
    .slice(0, 3);

  // Recent activity log generated from pipeline changes
  const lastActivities = pipeline
    .flatMap(p => p.stageHistory.map(h => ({
      candidateId: p.candidateId,
      jobId: p.jobId,
      stage: h.stage,
      changedAt: h.changedAt,
      changedBy: h.changedBy,
      notes: h.notes
    })))
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Visual Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 p-8 rounded-2xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-700/50">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            Hiring Optimization Active
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight mt-3">Welcome to Recruit-AI System</h2>
          <p className="text-slate-300 mt-2 text-sm max-w-xl">
            Our language modeling service is calibrated to screen resumes, cross-validate skills alignment, and rank candidate portfolios instantly.
          </p>
        </div>
        <div className="flex gap-4 shrink-0">
          <button 
            id="dash-add-job-btn"
            onClick={() => onNavigate('jobs')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition shadow-md"
          >
            <PlusCircle className="w-4 h-4" />
            Create Job
          </button>
          <button
            id="dash-upload-btn"
            onClick={() => onNavigate('upload')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-700 transition"
          >
            <Upload className="w-4 h-4" />
            Parse Resumes
          </button>
        </div>
      </div>

      {/* KPI Cards Bento Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold tracking-tight text-slate-500">Active Openings</span>
            <div className="p-2.5 bg-slate-50 text-slate-700 rounded-lg">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-950">{stats.activeJobs}</p>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-blue-500" /> Currently receiving submissions
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold tracking-tight text-slate-500">Applicant Pool</span>
            <div className="p-2.5 bg-slate-50 text-slate-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-950">{stats.totalCandidates}</p>
          <p className="text-xs text-slate-400 mt-2">Parsed into active data catalog</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold tracking-tight text-slate-500">Shortlist Match Rate</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-950">{stats.shortlistRate}%</p>
          <p className="text-xs text-slate-400 mt-2">Passing score &gt;= 75% benchmarks</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold tracking-tight text-slate-500">Time-to-Hire</span>
            <div className="p-2.5 bg-slate-50 text-slate-700 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-950">{stats.averageTimeToHire} Days</p>
          <p className="text-xs text-slate-400 mt-2">Target optimization limit 18 days</p>
        </div>
      </div>

      {/* Two-Column Analytics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200/60 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" /> Pipeline Activity Log
            </h3>
            <button 
              id="goto-pipeline-btn"
              onClick={() => onNavigate('pipeline')}
              className="text-xs text-slate-400 hover:text-blue-600 transition flex items-center gap-1"
            >
              Pipeline Grid <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {lastActivities.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No recent activity logged in the pipeline yet. Upload candidates to start tracking.
              </div>
            ) : (
              lastActivities.map((act, i) => {
                const cand = candidates.find(c => c.id === act.candidateId);
                const j = jobs.find(jb => jb.id === act.jobId);
                return (
                  <div key={i} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-lg transition duration-150">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase">
                      {cand?.name ? cand.name.split(' ').map(n=>n[0]).join('') : 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 font-mono flex items-center justify-between">
                        <span>{act.changedBy}</span>
                        <span>{new Date(act.changedAt).toLocaleDateString()}</span>
                      </p>
                      <p className="text-sm font-semibold text-slate-950 mt-0.5">
                        {cand?.name || 'Someone'} was transitioned to{' '}
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[11px] uppercase tracking-wide">
                          {act.stage}
                        </span>{' '}
                        for <span className="font-medium text-slate-600">{j?.title}</span>
                      </p>
                      {act.notes && (
                        <p className="text-xs text-slate-500 italic mt-1 line-clamp-1">
                          "{act.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Calendar / Upcoming Interviews */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/60 shadow-sm space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-4 font-sans">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" /> Upcoming Interviews
              </h3>
              <button 
                id="goto-interviews-btn"
                onClick={() => onNavigate('interviews')}
                className="text-xs text-slate-400 hover:text-blue-600 transition"
              >
                Full Calendar
              </button>
            </div>

            <div className="space-y-4">
              {upcomingInterviews.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No interview meetings scheduled this week.
                </div>
              ) : (
                upcomingInterviews.map((meet) => {
                  const cand = candidates.find(c => c.id === meet.candidateId);
                  const j = jobs.find(jb => jb.id === meet.jobId);
                  return (
                    <div key={meet.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-mono font-bold text-slate-900 uppercase">
                          {meet.type} Meeting
                        </h4>
                        <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                          {meet.time}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-950 mt-1">{cand?.name || 'Candidate'}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 shrink-0">{j?.title}</p>
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400 italic">By: {meet.interviewer}</span>
                        {meet.meetingLink && (
                          <a 
                            href={meet.meetingLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] text-blue-600 font-bold hover:underline hover:text-blue-700 font-sans"
                          >
                            Meet Link
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button 
              id="screening-link-btn"
              onClick={() => onNavigate('screening')}
              className="group text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-500 transition"
            >
              Verify Active Shortlists <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
