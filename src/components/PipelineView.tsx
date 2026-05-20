import React, { useState } from 'react';
import { Job, Candidate, PipelineItem, PipelineStage } from '../types';
import { 
  GitPullRequest, 
  HelpCircle, 
  CheckCircle, 
  X, 
  ChevronRight, 
  Clock, 
  MessageSquare
} from 'lucide-react';

interface PipelineViewProps {
  jobs: Job[];
  candidates: Candidate[];
  pipeline: PipelineItem[];
  onUpdatePipelineStage: (candId: string, jobId: string, stage: PipelineStage, notes: string) => void;
}

export default function PipelineView({ jobs, candidates, pipeline, onUpdatePipelineStage }: PipelineViewProps) {
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id || '');
  const [activeCandidate, setActiveCandidate] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');

  const targetPipeline = pipeline.filter(p => p.jobId === selectedJobId);

  const stages: { key: PipelineStage; label: string; color: string }[] = [
    { key: 'applied', label: 'Applied', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
    { key: 'screening', label: 'Screening', color: 'bg-indigo-55 text-indigo-700 hover:bg-indigo-100 font-medium' },
    { key: 'shortlisted', label: 'Shortlisted', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium' },
    { key: 'interview', label: 'Interview', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium' },
    { key: 'offer', label: 'Offer', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
    { key: 'hired', label: 'Hired', color: 'bg-blue-100 text-blue-850 hover:bg-blue-200 font-bold' },
    { key: 'rejected', label: 'Rejected', color: 'bg-red-50 text-red-750 hover:bg-red-100 font-medium' }
  ];

  const handleStageChange = (candId: string, targetStage: PipelineStage) => {
    onUpdatePipelineStage(candId, selectedJobId, targetStage, statusNote || `Manual progression to ${targetStage} stage`);
    setStatusNote('');
    setActiveCandidate(null);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-850 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/60 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 font-sans">
            <GitPullRequest className="w-5 h-5 text-blue-600" /> Pipeline Progression Floor
          </h2>
          <p className="text-sm text-slate-500 font-sans">Track milestones, schedule interview status, and execute manual approvals on candidates.</p>
        </div>
        <div className="shrink-0 font-sans">
          <select
            id="pipeline-job-select"
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              setActiveCandidate(null);
            }}
            className="px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-sm font-semibold focus:outline-none focus:border-blue-500"
          >
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4 gap-4 flex shrink-0">
        {stages.map((stageItem) => {
          const itemsInStage = targetPipeline.filter(p => p.currentStage === stageItem.key);
          
          return (
            <div 
              key={stageItem.key} 
              id={`pipeline-col-${stageItem.key}`}
              className="w-72 bg-slate-50/70 rounded-xl p-4 border border-slate-200/50 shrink-0 flex flex-col justify-between"
            >
              <div className="space-y-3 font-sans">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                  <span className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500">
                    {stageItem.label}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-200/60 text-slate-800 px-2 py-0.5 rounded-full">
                    {itemsInStage.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {itemsInStage.map((pItem) => {
                    const cand = candidates.find(c => c.id === pItem.candidateId);
                    if (!cand) return null;
                    const isEditingThis = activeCandidate === cand.id;

                    return (
                      <div 
                        key={cand.id} 
                        id={`pipeline-card-${cand.id}`}
                        className="bg-white p-3.5 rounded-xl border border-shadow border-slate-200/60 hover:shadow-md shadow-xs transition space-y-2.5 relative group"
                      >
                        <div>
                          <h4 className="font-bold text-slate-950 text-xs flex items-center gap-1">
                            {cand.blacklisted && <span className="text-[8px] bg-red-100 text-red-650 px-1 py-0.2 rounded font-extrabold uppercase shrink-0">Reject</span>}
                            {cand.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">{cand.email}</p>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {cand.skills.slice(0, 3).map((s, i) => (
                            <span key={i} className="text-[9px] bg-slate-50 border border-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono">
                              {s}
                            </span>
                          ))}
                        </div>

                        {/* Dropdown status transition controllers */}
                        {isEditingThis ? (
                          <div className="p-2 border border-slate-200 rounded-lg space-y-2 bg-slate-50 relative z-30 font-sans">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Transition to stage:</span>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              {stages.map(st => (
                                <button
                                  id={`trans-btn-${cand.id}-${st.key}`}
                                  key={st.key}
                                  type="button"
                                  onClick={() => handleStageChange(cand.id, st.key)}
                                  className={`px-1.5 py-1 text-left rounded hover:bg-slate-200 font-semibold ${st.key === pItem.currentStage ? 'bg-blue-100 text-blue-800 border-l border-blue-500' : 'text-slate-655 text-slate-600'}`}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>
                            <input
                              id={`input-prog-note-${cand.id}`}
                              type="text"
                              placeholder="Add reason note..."
                              value={statusNote}
                              onChange={(e) => setStatusNote(e.target.value)}
                              className="w-full text-[10px] px-1.5 py-1 border border-slate-200 bg-white rounded focus:outline-noneFocus"
                            />
                            <button
                              id={`cancel-trans-${cand.id}`}
                              type="button"
                              onClick={() => {
                                setActiveCandidate(null);
                                setStatusNote('');
                              }}
                              className="text-[9px] text-red-500 font-bold block"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs font-sans">
                            <button 
                              id={`edit-proc-btn-${cand.id}`}
                              onClick={() => setActiveCandidate(cand.id)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-500 hover:underline"
                            >
                              Move status
                            </button>
                            <span className="text-[9px] font-mono text-slate-400">
                              {cand.experienceYears}yr Exp
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {itemsInStage.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg font-sans">
                      Clear backlog
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
