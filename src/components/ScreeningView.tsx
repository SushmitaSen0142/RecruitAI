import { useState } from 'react';
import { Job, Candidate, Screening, PipelineItem } from '../types';
import { 
  Sparkles, 
  Search, 
  HelpCircle,
  TrendingUp, 
  CheckCircle2, 
  X, 
  ShieldAlert, 
  Clock, 
  Heart, 
  FileText,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

interface ScreeningViewProps {
  jobs: Job[];
  candidates: Candidate[];
  screenings: Screening[];
  pipeline: PipelineItem[];
  onTriggerScreening: (candId: string, jobId: string) => Promise<void>;
  onUpdatePipelineStage: (candId: string, jobId: string, stage: string, notes: string) => void;
}

export default function ScreeningView({ 
  jobs, 
  candidates, 
  screenings, 
  pipeline, 
  onTriggerScreening,
  onUpdatePipelineStage
}: ScreeningViewProps) {
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id || '');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<string | null>(null);

  // Get candidates mapped to this job inside the pipeline
  const relativePipeline = pipeline.filter(p => p.jobId === selectedJobId);
  const currentJob = jobs.find(j => j.id === selectedJobId);

  const getScreening = (candId: string) => {
    return screenings.find(s => s.candidateId === candId && s.jobId === selectedJobId);
  };

  const handleRunEvaluation = async (candId: string) => {
    setIsEvaluating(candId);
    try {
      await onTriggerScreening(candId, selectedJobId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEvaluating(null);
    }
  };

  const currentScreening = selectedCandidate ? getScreening(selectedCandidate.id) : null;

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/60">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">AI Screening Room</h2>
          <p className="text-sm text-slate-500 font-sans">Trigger fine-tuned Gemini content evaluations against active strictness criteria on candidate CVs.</p>
        </div>
        <div className="shrink-0">
          <select
            id="screening-job-selector"
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              setSelectedCandidate(null);
            }}
            className="px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
          >
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>
      </div>

      {currentJob && (
        <div className="p-4 bg-slate-50 border border-slate-200/50 text-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-sans">
          <div>
            <span className="font-bold text-slate-900 block font-sans">Rule Strictness Matrix: {currentJob.strictness}/100</span>
            <span className="text-slate-500">Required Skills: {currentJob.requiredSkills.join(', ')}</span>
          </div>
          <div className="flex gap-4 font-mono text-slate-500">
            <span>Skills Weight: {currentJob.weights?.skills || 40}%</span>
            <span>Experience: {currentJob.weights?.experience || 40}%</span>
            <span>Culture/Other: {(currentJob.weights?.education || 10) + (currentJob.weights?.other || 10)}%</span>
          </div>
        </div>
      )}

      {/* Grid: Columns of candidate list vs selected detail report */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Candidates List Column */}
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <h3 className="font-bold text-slate-950 text-sm">Hiring Backlog</h3>
          </div>
          
          <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
            {relativePipeline.map(item => {
              const cand = candidates.find(c => c.id === item.candidateId);
              if (!cand) return null;
              const scr = getScreening(cand.id);

              return (
                <div 
                  key={item.candidateId}
                  id={`screen-cand-item-${cand.id}`}
                  onClick={() => setSelectedCandidate(cand)}
                  className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition duration-150 ${selectedCandidate?.id === cand.id ? 'bg-blue-50/50 border-l-4 border-blue-600' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950 text-xs truncate flex items-center gap-1">
                      {cand.blacklisted && <span className="text-[9px] bg-red-100 text-red-650 px-1 py-0.2 rounded font-extrabold uppercase">Reject</span>}
                      {cand.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{cand.experienceYears} Years Experience • {item.currentStage.toUpperCase()}</p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {scr ? (
                      <span className={`w-8.5 h-8.5 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                        scr.score >= 85 ? 'bg-blue-50 text-blue-700 border border-blue-200/40' : 
                        scr.score >= 70 ? 'bg-amber-50 text-amber-700' : 
                        'bg-red-50 text-red-700'
                      }`}>
                        {scr.score}
                      </span>
                    ) : (
                      <button
                        id={`run-scr-btn-${cand.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunEvaluation(cand.id);
                        }}
                        disabled={isEvaluating === cand.id}
                        className="p-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        {isEvaluating === cand.id ? (
                          <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-blue-200" />
                        )}
                        Screen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {relativePipeline.length === 0 && (
              <p className="text-center py-10 text-slate-400 text-xs font-sans">No active applications found for this job opening.</p>
            )}
          </div>
        </div>

        {/* Selected Candidate Detailed Evaluation Report Card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 flex flex-col justify-between">
          {selectedCandidate ? (
            <div className="space-y-6">
              
              {/* Header block with match score and metadata */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                    {selectedCandidate.name}
                    {selectedCandidate.blacklisted && <span className="text-[10px] bg-red-105 border border-red-200 text-red-700 px-2 py-0.5 rounded font-extrabold font-mono uppercase">Blacklisted CV</span>}
                  </h3>
                  <a href={`mailto:${selectedCandidate.email}`} className="text-xs text-blue-600 font-semibold hover:underline mt-0.5 block">{selectedCandidate.email}</a>
                  <button
  onClick={() => {
    const newEmail = prompt('Edit candidate email:', selectedCandidate.email);
    if (newEmail && newEmail !== selectedCandidate.email) {
      onEditCandidate(selectedCandidate.id, { email: newEmail });
    }
  }}
  className="text-xs text-blue-500 underline mt-1"
>
  ✏️ Edit Email
</button>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">Location Match: {selectedCandidate.location} • Degree: {selectedCandidate.education?.degree || 'Parsed Record'}</p>
                </div>
                
                {currentScreening ? (
                  <div className="text-right flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200/50 shrink-0 self-start">
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono block">Match Score</span>
                      <span className={`text-4xl font-extrabold font-mono ${
                        currentScreening.score >= 85 ? 'text-blue-600' : 
                        currentScreening.score >= 70 ? 'text-amber-500' : 
                        'text-red-500'
                      }`}>{currentScreening.score}%</span>
                    </div>
                    <div className="border-l border-slate-200 pl-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono block">Tier Classification</span>
                      <span className={`text-xs uppercase font-extrabold tracking-wide px-2 py-0.5 rounded ${
                        currentScreening.tier === 'strong_match' ? 'bg-blue-100 text-blue-800' : 
                        currentScreening.tier === 'good_fit' ? 'bg-blue-50 text-blue-600' : 
                        currentScreening.tier === 'consider' ? 'bg-amber-50 text-amber-600' : 
                        'bg-red-50 text-red-650'
                      }`}>
                        {currentScreening.tier.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    id="trigger-screening-detail-btn"
                    onClick={() => handleRunEvaluation(selectedCandidate.id)}
                    disabled={isEvaluating === selectedCandidate.id}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow cursor-pointer"
                  >
                    {isEvaluating === selectedCandidate.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-blue-200" />
                    )}
                    Run Interactive Gemini Screening
                  </button>
                )}
              </div>

              {/* Custom detailed evaluation tabs */}
              {currentScreening ? (
                <div className="space-y-6">
                  
                  {/* Reasoning block */}
                  <div className="space-y-1.5 p-4 bg-slate-50 border border-slate-250/30 rounded-xl">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block font-mono">Gemini Matching Assessment Reasoning</span>
                    <p className="text-sm font-medium leading-relaxed italic text-slate-700 font-sans">
                      "{currentScreening.reasoning}"
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Skills Breakdown */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block font-mono">Core Skills Breakdown</span>
                      
                      <div className="space-y-2 text-xs">
                        {currentScreening.skillMatch.matched.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-semibold text-blue-700 font-sans">Matched Requirements:</span>
                            <div className="flex flex-wrap gap-1">
                              {currentScreening.skillMatch.matched.map((s, i) => (
                                <span key={i} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-[10px] font-semibold border border-blue-105">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {currentScreening.skillMatch.missing.length > 0 ? (
                          <div className="space-y-1">
                            <span className="font-semibold text-red-600 font-sans">Missing Target Criteria:</span>
                            <div className="flex flex-wrap gap-1">
                              {currentScreening.skillMatch.missing.map((s, i) => (
                                <span key={i} className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-mono text-[10px] font-semibold border border-red-500/10">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-blue-50 border border-blue-200/50 text-blue-800 rounded-lg text-xs font-semibold leading-relaxed">
                            ✓ Meets all fundamental technical expectations
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Alignments and Indicators */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block font-mono">Structural Continuity</span>
                      
                      <div className="space-y-2.5 p-3.5 bg-slate-50/70 border border-slate-150 rounded-lg text-xs">
                        <p>
                          <strong className="text-slate-900 block font-sans">Experience Context:</strong>
                          <span className="text-slate-600">{currentScreening.experienceAlignment}</span>
                        </p>
                        <p>
                          <strong className="text-slate-900 block font-sans">Education Validity:</strong>
                          <span className="text-slate-600">{currentScreening.educationAlignment}</span>
                        </p>
                        <p>
                          <strong className="text-slate-900 block font-sans">Expected SLA Onboarding:</strong>
                          <span className="text-slate-600">{currentScreening.estimatedOnboarding}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Red flags & Compliance Audit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
                    <div className="space-y-2">
                      <span className="text-[11px] font-mono font-bold uppercase text-slate-400 block">Bias Mitigation Assurance</span>
                      <div className="space-y-2.5 p-3.5 bg-slate-950 border border-slate-800 text-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="font-semibold text-white">FEO Neutral Evaluation Mode</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Evaluating purely based on core engineering skills and work durations, shielding identity metrics. Age assessment: <span className={currentScreening.biasIndicators.ageRisk ? 'text-amber-400 font-bold' : 'text-blue-400 font-bold'}>{currentScreening.biasIndicators.ageRisk ? 'Flagged Risk' : 'Clear'}</span>.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-mono font-bold uppercase text-slate-400 block">Identified Caveats & Suggested Inquiries</span>
                      {currentScreening.redFlags.length > 0 ? (
                        <div className="space-y-1">
                          {currentScreening.redFlags.map((rf, idx) => (
                            <div key={idx} className="p-2 bg-red-50 border border-red-100 rounded text-[11px] text-red-800 flex items-center gap-1.5 font-sans">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span>{rf}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded text-blue-800 text-[11px] font-sans">
                          No technical gaps or employment timeline warnings raised.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 border border-dashed border-slate-100 rounded-2xl flex flex-col justify-center items-center gap-3">
                  <Clock className="w-10 h-10 text-slate-355 text-slate-300" />
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs uppercase font-sans">No Active Evaluation File</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">Trigger the live language module matching system to generate a complete visual alignment score and bias audit report for this CV.</p>
                  </div>
                </div>
              )}
              
            </div>
          ) : (
            <div className="text-center py-24 text-slate-400 flex flex-col justify-center items-center gap-3">
              <UserCheck className="w-12 h-12 text-slate-300" />
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase font-sans">Please select a candidate</h4>
                <p className="text-xs text-slate-400 mt-1">Pick an applicant from the hiring backlog to review or run screening checks.</p>
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t border-slate-100 font-mono text-[9px] text-slate-400 flex justify-between uppercase">
            
          </div>
        </div>

      </div>
    </div>
  );
}
