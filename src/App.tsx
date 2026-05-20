import React, { useEffect, useState } from 'react';
import { Job, Candidate, Screening, PipelineItem, PipelineStage, Communication, Interview } from './types';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import JobManagementView from './components/JobManagementView';
import UploadParserView from './components/UploadParserView';
import ScreeningView from './components/ScreeningView';
import PipelineView from './components/PipelineView';
import InterviewsView from './components/InterviewsView';
import AnalyticsView from './components/AnalyticsView';
import CandidatePortalView from './components/CandidatePortalView';
import SettingsView from './components/SettingsView';
import { Sparkles, BrainCircuit, Lock, Shield, UserCheck, Key, HelpCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setTab] = useState<string>('dashboard');
  const [recruiterMode, setRecruiterMode] = useState<boolean>(true);
  const [statusMode, setStatusMode] = useState<string>('Querying system status...');

  // State caches synced with server API endpoints
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);

  // Authentication & Permissions Role State (Point 5 Compliance)
  const [userRole, setUserRole] = useState<'guest' | 'recruiter' | 'candidate'>('guest');
  const [candidateEmailSession, setCandidateEmailSession] = useState<string>('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [candidateSelectorEmail, setCandidateSelectorEmail] = useState('');
  const [authError, setAuthError] = useState('');

  // 1. Fetch initialization datasets from REST Server
  const syncStateData = async () => {
    try {
      const [jobsRes, candRes, scrRes, pipeRes, meetRes, statusRes] = await Promise.all([
        fetch('/api/jobs').then(r => r.json()),
        fetch('/api/candidates').then(r => r.json()),
        fetch('/api/screenings').then(r => r.json()),
        fetch('/api/pipeline').then(r => r.json()),
        fetch('/api/interviews').then(r => r.json()),
        fetch('/api/status').then(r => r.json())
      ]);

      setJobs(jobsRes);
      setCandidates(candRes);
      setScreenings(scrRes);
      setPipeline(pipeRes);
      setInterviews(meetRes);
      setStatusMode(statusRes.mode);

      // Default candidate preset
      if (candRes && candRes.length > 0 && !candidateSelectorEmail) {
        setCandidateSelectorEmail(candRes[0].email);
      }
    } catch (e) {
      console.error('Failed to sync server model statistics:', e);
      setStatusMode('Offline Sandbox heuristics fallback mode');
    }
  };

  useEffect(() => {
    syncStateData();
    // Real-time synchronization: Poll datasets from backend every 3 seconds to coordinate with background changes
    const interval = setInterval(syncStateData, 3000);
    return () => clearInterval(interval);
  }, []);

  // 2. Action triggers linked to backend systems
  const handleCreateJob = async (jobInput: Partial<Job>) => {
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobInput)
      }).then(r => r.json());

      setJobs(prev => [...prev, response]);
    } catch (err) {
      console.error('Job creation request failed:', err);
    }
  };

  const handleEditJob = async (id: string, jobInput: Partial<Job>) => {
    try {
      const response = await fetch(`/api/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobInput)
      }).then(r => r.json());

      await syncStateData();
    } catch (err) {
      console.error('Job modification request failed:', err);
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await fetch(`/api/jobs/${id}`, { method: 'DELETE' }).then(r => r.json());
      await syncStateData();
    } catch (err) {
      console.error('Job deletion request failed:', err);
    }
  };

  const handleUploadSingleCandidate = async (input: Partial<Candidate> & { jobId: string }) => {
    try {
      const response = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }).then(r => r.json());

      // Refresh database pool state logs
      await syncStateData();
    } catch (err) {
      console.error('Candidate upload failed:', err);
    }
  };

  const handleUploadBulkCandidates = async (list: Partial<Candidate>[], jobId: string) => {
    try {
      const response = await fetch('/api/candidates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list, jobId })
      }).then(r => r.json());

      await syncStateData();
    } catch (err) {
      console.error('Bulk parsing trigger failed:', err);
    }
  };

  const handleTriggerScreening = async (candidateId: string, jobId: string) => {
    try {
      const response = await fetch('/api/screenings/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, jobId })
      }).then(r => r.json());

      // Refresh screenings & pipeline immediately
      await syncStateData();
    } catch (err) {
      console.error('Evaluation call failed:', err);
    }
  };

  const handleUpdatePipelineStage = async (candidateId: string, jobId: string, stage: string, notes: string) => {
    try {
      const response = await fetch('/api/pipeline/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, jobId, stage, notes })
      }).then(r => r.json());

      // Force synchronized data reload (candidate automations trigger state updates on the server)
      await syncStateData();
    } catch (err) {
      console.error('Pipeline status update failed:', err);
    }
  };

  const handleBookInterview = async (meetData: Partial<Interview>) => {
    try {
      const response = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetData)
      }).then(r => r.json());

      // Refresh appointments calendar
      await syncStateData();
    } catch (err) {
      console.error('Meeting booking request rejected:', err);
    }
  };

  const handleSubmitFeedback = async (meetId: string, rating: number, feedback: string) => {
    try {
      const response = await fetch(`/api/interviews/${meetId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback })
      }).then(r => r.json());

      await syncStateData();
    } catch (err) {
      console.error('Consensus rating post failed:', err);
    }
  };

  // Portal Authentication Router (Point 5)
  const handleRecruiterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPasscode === 'admin') {
      setUserRole('recruiter');
      setRecruiterMode(true);
      setTab('dashboard');
      setAuthError('');
    } else {
      setAuthError('Invalid administrator credential token. (Tip: Enter "admin")');
    }
  };

  const handleCandidateLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (candidateSelectorEmail.trim()) {
      setUserRole('candidate');
      setCandidateEmailSession(candidateSelectorEmail.trim());
      setRecruiterMode(false);
      setTab('portal');
      setAuthError('');
    } else {
      setAuthError('Please select or specify a test applicant email address.');
    }
  };

  const handleSignOut = () => {
    setUserRole('guest');
    setCandidateEmailSession('');
    setLoginPasscode('');
    setAuthError('');
  };

  // Switch recruiter toggles safely
  const handleSetRecruiterTabMode = (tab: string) => {
    if (userRole === 'candidate') {
      // Retrict candidates to only access portal tracking and profile views 
      if (tab === 'portal' || tab === 'settings') {
        setTab(tab);
      }
    } else {
      setTab(tab);
    }
  };

  // 3. Tab Routing View layout selectors
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView 
            jobs={jobs} 
            candidates={candidates} 
            pipeline={pipeline} 
            interviews={interviews} 
            onNavigate={setTab}
          />
        );
      case 'jobs':
        return (
          <JobManagementView 
            jobs={jobs} 
            onCreateJob={handleCreateJob}
            onEditJob={handleEditJob}
            onDeleteJob={handleDeleteJob}
          />
        );
      case 'upload':
        return (
          <UploadParserView 
            jobs={jobs} 
            candidates={candidates} 
            onUploadSingle={handleUploadSingleCandidate} 
            onUploadBulk={handleUploadBulkCandidates}
          />
        );
      case 'screening':
        return (
          <ScreeningView 
            jobs={jobs} 
            candidates={candidates} 
            screenings={screenings} 
            pipeline={pipeline} 
            onTriggerScreening={handleTriggerScreening} 
            onUpdatePipelineStage={handleUpdatePipelineStage}
          />
        );
      case 'pipeline':
        return (
          <PipelineView 
            jobs={jobs} 
            candidates={candidates} 
            pipeline={pipeline} 
            onUpdatePipelineStage={handleUpdatePipelineStage}
          />
        );
      case 'interviews':
        return (
          <InterviewsView 
            jobs={jobs} 
            candidates={candidates} 
            interviews={interviews} 
            onBookInterview={handleBookInterview} 
            onSubmitFeedback={handleSubmitFeedback}
          />
        );
      case 'analytics':
        return (
          <AnalyticsView 
            jobs={jobs} 
            pipeline={pipeline}
          />
        );
      case 'portal':
        // Pin email session directly if signed in as candidate
        return (
          <CandidatePortalView 
            jobs={jobs} 
            candidates={candidates} 
            pipeline={pipeline} 
            interviews={interviews}
          />
        );
      case 'settings':
        return (
          <SettingsView 
            statusMode={statusMode}
          />
        );
      default:
        return (
          <div className="text-center py-12 text-slate-400">
            Navigation destination module not registered yet. Loading default dashboard...
          </div>
        );
    }
  };

  // Gated workspace login page (Point 5)
  if (userRole === 'guest') {
    return (
      <div className="min-h-screen w-screen bg-slate-50 flex items-center justify-center p-4 font-sans select-none antialiased text-slate-800">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 w-full max-w-4xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          
          {/* Left Panel: Hero Section */}
          <div className="md:col-span-5 bg-slate-900 p-8 flex flex-col justify-between text-white relative">
            <div className="absolute inset-0 bg-blue-600/10 pointer-events-none" />
            
            <div className="space-y-3 relative z-10">
              <div className="p-2.5 bg-blue-600 w-fit rounded-xl">
                <BrainCircuit className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight mt-4">Recruit-AI</h1>
              <p className="text-xs text-slate-300 leading-relaxed font-sans mt-1">Autonomous cognitive screening, live pipeline execution, and candidate status dashboarding synced seamlessly.</p>
            </div>

            <div className="space-y-4 relative z-10 pt-8">
              <span className="text-[10px] uppercase font-bold text-blue-400 font-mono tracking-wider block">Workspace Integrity Assurance</span>
              <div className="space-y-3.5 text-xs text-slate-300 font-sans">
                <div className="flex gap-2.5 items-start">
                  <Shield className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Fair Employment Compliance shields metrics automatically.</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Real-time applicant progress tracker sync matrices.</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-400 block pt-4">
              <span>ACTIVE METADATA INTERFACE VERSION 2.0</span>
            </div>
          </div>

          {/* Right Panel: Multiple Authentication Forms (Point 5) */}
          <div className="md:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">Identity Authentication Desk</h2>
              <p className="text-xs text-slate-400 font-sans">Access Recruiter systems console or candidate progress workflows below.</p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-750 font-sans font-semibold">
                ⚠ {authError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs font-sans">
              
              {/* Recruiter Login */}
              <div className="p-5 border border-slate-200/60 rounded-xl shadow-xs space-y-4 bg-slate-50 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider font-mono">Operations Team</span>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-650" /> Recruiters Console
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-normal">Access job configurations, models evaluators, and candidates pool.</p>
                </div>

                <form onSubmit={handleRecruiterLogin} className="space-y-2 pt-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 block mb-1">ENTER PASSCODE (admin)</span>
                    <input
                      id="recruiter-passcode-input"
                      type="password"
                      required
                      placeholder="e.g. admin"
                      value={loginPasscode}
                      onChange={(e) => setLoginPasscode(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500 text-slate-900 bg-white"
                    />
                  </div>
                  <button
                    id="admin-login-btn"
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-1.5 text-xs font-bold rounded cursor-pointer transition"
                  >
                    Enter Workstation
                  </button>
                </form>
              </div>

              {/* Candidate Portal Login */}
              <div className="p-5 border border-slate-200/60 rounded-xl shadow-xs space-y-4 bg-slate-50 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-455 tracking-wider font-mono">Applicants Workspace</span>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-650" /> Candidate Portal
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-normal">Track your personal timeline, schedule slot, and join meet rooms.</p>
                </div>

                <form onSubmit={handleCandidateLogin} className="space-y-2 pt-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 block mb-1">SELECT EMAIL FOR TESTING</span>
                    <select
                      id="candidate-email-selector"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                      value={candidateSelectorEmail}
                      onChange={(e) => setCandidateSelectorEmail(e.target.value)}
                    >
                      <option value="">-- Choose Candidate --</option>
                      {candidates.map(cand => (
                        <option key={cand.id} value={cand.email}>{cand.name} ({cand.email.split('@')[0]})</option>
                      ))}
                    </select>
                  </div>
                  <button
                    id="cand-login-btn"
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-1.5 text-xs font-bold rounded cursor-pointer transition shadow-sm"
                  >
                    Track Progress
                  </button>
                </form>
              </div>

            </div>

            <div className="text-[11px] text-slate-400 leading-snug border-t border-slate-100 pt-4 flex gap-2 justify-center items-center">
              <HelpCircle className="w-4 h-4 text-slate-300" />
              <span>Use <strong>admin</strong> code to experience recruiter tools, or choose an applicant from list to test candidate workflow.</span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Loaded Workstation Dashboard View Screen
  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden text-slate-800 antialiased font-sans">
      
      {/* Sidebar navigation */}
      <Sidebar 
        currentTab={currentTab} 
        setTab={handleSetRecruiterTabMode} 
        recruiterMode={recruiterMode} 
        setRecruiterMode={setRecruiterMode} 
        statusMode={statusMode}
        onSignOut={handleSignOut}
      />

      {/* Main viewport canvas */}
      <main id="main-viewport-content" className="flex-1 flex flex-col min-w-0 bg-slate-100/30 overflow-y-auto">
        <header className="px-8 py-4 bg-white border-b border-slate-200/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold font-mono text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/15">
              {recruiterMode ? 'Secure Recruiters Workstation' : 'Candidate Workspace'}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 font-mono">Date: 2026-05-20</span>
          </div>
        </header>

        {/* Content body wrapper */}
        <div className="p-8 max-w-7xl w-full mx-auto flex-1">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
