import React, { useState } from 'react';
import { Job, Candidate, PipelineItem, Interview } from '../types';
import { 
  User, 
  MapPin, 
  CheckCircle, 
  Calendar, 
  HelpCircle, 
  MessageSquare, 
  Mail,
  UserCheck,
  Search,
  ChevronRight,
  GitPullRequest
} from 'lucide-react';

interface CandidatePortalViewProps {
  jobs: Job[];
  candidates: Candidate[];
  pipeline: PipelineItem[];
  interviews: Interview[];
}

export default function CandidatePortalView({ jobs, candidates, pipeline, interviews }: CandidatePortalViewProps) {
  // Safe default: let candidate enter or select their email to view status
  const [candidateEmail, setCandidateEmail] = useState(candidates[0]?.email || 'sarah.jenkins@dev-mail.io');
  const [lookupEmail, setLookupEmail] = useState(candidateEmail);
  const [portalStatus, setPortalStatus] = useState('');

  const activeCand = candidates.find(c => c.email.toLowerCase() === lookupEmail.toLowerCase());
  const activePip = activeCand ? pipeline.find(p => p.candidateId === activeCand.id) : null;
  const activeJob = activePip ? jobs.find(j => j.id === activePip.jobId) : null;
  const activeMets = activeCand ? interviews.filter(i => i.candidateId === activeCand.id) : [];
  const activeMeet = activeMets.find(i => i.status === 'scheduled');

  const handleUpdateLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupEmail(candidateEmail);
    setPortalStatus('Retrieved live progress logs successfully.');
    setTimeout(() => setPortalStatus(''), 2500);
  };

  const stagesSequence = ['applied', 'screening', 'shortlisted', 'interview', 'offer', 'hired'];

  // Map system stages to nice, generic user-facing progression info to avoid leaking internal notes
  const getStageUserDescription = (stage: string) => {
    switch(stage) {
      case 'applied':
        return 'We have successfully received your job application files and resume documents.';
      case 'screening':
        return 'Our talent acquisition reviewers are evaluating your competency alignments.';
      case 'shortlisted':
        return 'Congratulations! Your profile has qualified for active recruitment reviews.';
      case 'interview':
        return 'An interview coordinator is scheduling your live conversations.';
      case 'offer':
        return 'Our operations board is preparing package specifications for your review.';
      case 'hired':
        return 'Hiring complete. Welcome to our workspace team!';
      case 'rejected':
        return 'We appreciate your interest. Currently we decided to proceed with other portfolios aligning closer to immediate requirements.';
      default:
        return 'Application parameter currently under processing.';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 font-sans">
      <div className="pb-4 border-b border-slate-200/60">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" /> Candidate Progress Workspace
        </h2>
        <p className="text-sm text-slate-500 font-sans">Log in securely with your contact email to track application timelines and upcoming interviews.</p>
      </div>

      {/* Quick Lookup form */}
      <form onSubmit={handleUpdateLookup} className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-white flex flex-col sm:flex-row items-center gap-3 shrink-0">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="cand-portal-email-input"
            type="email"
            value={candidateEmail}
            onChange={(e) => setCandidateEmail(e.target.value)}
            placeholder="Enter application email (e.g. sarah.jenkins@dev-mail.io)"
            className="w-full pl-9 pr-4 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 bg-slate-900 rounded-lg text-xs text-white"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between">
          <span className="text-[10px] text-slate-400 font-mono">Suggested test emails:</span>
          <select 
            id="suggested-cand-selector"
            className="px-2 py-1 text-xs border border-slate-800 bg-slate-900 rounded text-slate-300 focus:outline-none"
            value={candidateEmail}
            onChange={(e) => {
              setCandidateEmail(e.target.value);
              setLookupEmail(e.target.value);
            }}
          >
            {candidates.map(c => (
              <option key={c.id} value={c.email}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          id="cand-find-status-btn"
          type="submit"
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shrink-0 select-none cursor-pointer transition shadow"
        >
          Track Progress
        </button>
      </form>

      {portalStatus && (
        <span className="text-xs text-blue-600 font-semibold block italic font-sans">
          ✓ {portalStatus}
        </span>
      )}

      {activeCand && activeJob && activePip ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-sm font-sans">
          
          {/* Main workspace layout: Progress checklist and clean public timelines */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 space-y-8">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded font-mono uppercase">
                Application File
              </span>
              <h3 className="text-xl font-bold text-slate-950 mt-1">{activeJob.title}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {activeJob.location} • Department: {activeJob.department}
              </p>
            </div>

            {/* Progress checklist/milestones */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-950 text-sm">Application Status Milestones</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                {stagesSequence.map((stageKey, idx) => {
                  const currentStageIndex = stagesSequence.indexOf(activePip.currentStage);
                  const isCompleted = currentStageIndex >= idx;
                  const isActive = activePip.currentStage === stageKey;

                  return (
                    <div 
                      key={stageKey}
                      className={`p-3 border rounded-xl flex flex-col justify-between text-center relative transition ${
                      isActive ? 'border-blue-500 bg-blue-50/20 shadow-xs' : 
                      isCompleted ? 'border-blue-150 bg-slate-50' : 'border-slate-100 text-slate-400'
                      }`}
                    >
                      <span className="text-[9px] uppercase font-bold tracking-wider font-mono">Stage #{idx+1}</span>
                      <span className="font-bold capitalize text-xs block py-1 text-slate-950">
                        {stageKey}
                      </span>
                      <div className="mx-auto mt-2">
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Upcoming slot booked */}
            {activeMeet && (
              <div className="p-4 bg-blue-50 border border-blue-200/40 rounded-xl space-y-3">
                <div className="flex justify-between items-start flex-col sm:flex-row gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-700 block font-mono bg-blue-500/10 px-2.5 py-1 rounded w-fit">
                      Action Required - Join Interview Meeting
                    </span>
                    <h4 className="font-bold text-slate-950 block text-sm mt-1.5 border-b border-blue-100/30 pb-1">Video Interview Scheduled</h4>
                    <p className="text-xs text-slate-600 mt-1">Interviewer Team: {activeMeet.interviewer}</p>
                  </div>
                  <div className="font-mono bg-white p-2 border border-blue-150 rounded-lg shrink-0 text-center shadow-xs">
                    <span className="text-xs font-bold text-slate-950 block">{activeMeet.date}</span>
                    <span className="text-xs font-bold text-blue-600 block mt-0.5">{activeMeet.time}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-blue-500/10">
                  <span className="text-slate-500 font-sans">Secure virtual workspace link:</span>
                  <a href={activeMeet.meetingLink} target="_blank" rel="noreferrer" className="text-blue-600 font-extrabold hover:underline text-xs">
                    Join Google Meet Room
                  </a>
                </div>
              </div>
            )}

            {/* Progression details (Point 2: Clean milestones without internal log files or Recruiter comments) */}
            <div className="space-y-4 pt-2">
              <span className="text-xs font-bold text-slate-500 uppercase font-mono block">Recruitment Tracking Steps</span>
              
              <div className="relative border-l border-blue-200 pl-6 ml-3 space-y-6">
                {activePip.stageHistory.map((h, i) => (
                  <div key={i} className="relative">
                    {/* Circle marker on line */}
                    <div className="absolute -left-[31px] top-1 bg-white p-1 rounded-full border border-blue-400 ring-4 ring-blue-50 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 font-mono block">
                        {new Date(h.changedAt).toLocaleDateString()}
                      </span>
                      <h5 className="font-bold text-slate-900 capitalize text-sm mt-0.5">
                        Application entered "{h.stage}" stage
                      </h5>
                      <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                        {getStageUserDescription(h.stage)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Hand Sidebar details: Recruiter details & FAQ */}
          <div className="space-y-6">
            
            <div className="bg-white rounded-xl border border-slate-200/60 p-6 space-y-4">
              <h4 className="font-bold text-slate-950 text-sm">Assigned Coordinator</h4>
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <h5 className="font-bold text-slate-950 text-xs">Isabella Sterling</h5>
                  <span className="text-[10px] text-slate-500 opacity-75 font-mono">Talent Operations Advisor</span>
                </div>
                <a 
                  href="mailto:talent@recruit-ai.com" 
                  className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1.5 pt-2 border-t border-slate-200/50"
                >
                  <Mail className="w-3.5 h-3.5" /> Contact Talent Coordinator
                </a>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/60 p-6 space-y-3">
              <h4 className="font-bold text-slate-950 text-sm">Candidate FAQ</h4>
              
              <div className="space-y-4 text-xs">
                <div>
                  <span className="font-semibold text-slate-800 block">How long does screening take?</span>
                  <span className="text-slate-500 block leading-safe shrink-0 mt-0.5">Normally within 24-48 hours our system evaluates alignment targets matching skills instantly.</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800 block">Can I update my uploaded documents?</span>
                  <span className="text-slate-500 block leading-safe shrink-0 mt-0.5">Reach out directly to your Talent Advisor to link the newest version instantly.</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200/60 text-slate-400 flex flex-col items-center justify-center gap-3">
          <HelpCircle className="w-12 h-12 text-slate-300" />
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase">No active candidate mapping</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">Please verify the lookup email matches a parsed application file on record.</p>
          </div>
        </div>
      )}
    </div>
  );
}
