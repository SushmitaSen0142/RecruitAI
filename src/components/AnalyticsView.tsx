import { useEffect, useState } from 'react';
import { Job, PipelineItem } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Award, 
  HelpCircle,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Briefcase
} from 'lucide-react';

interface AnalyticsViewProps {
  jobs: Job[];
  pipeline: PipelineItem[];
}

interface AnalyticsData {
  applied: number;
  screening: number;
  shortlisted: number;
  interview: number;
  offer: number;
  hired: number;
  rejected: number;
}

export default function AnalyticsView({ jobs, pipeline }: AnalyticsViewProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [funnel, setFunnel] = useState<AnalyticsData>({
    applied: 0,
    screening: 0,
    shortlisted: 0,
    interview: 0,
    offer: 0,
    hired: 0,
    rejected: 0
  });

  useEffect(() => {
    // Filter pipeline
    const list = selectedJobId === 'all' ? pipeline : pipeline.filter(p => p.jobId === selectedJobId);
    
    // Aggregate by stages
    const applied = list.length;
    const screening = list.filter(p => ['screening', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'].includes(p.currentStage)).length;
    const shortlisted = list.filter(p => ['shortlisted', 'interview', 'offer', 'hired'].includes(p.currentStage)).length;
    const interview = list.filter(p => ['interview', 'offer', 'hired'].includes(p.currentStage)).length;
    const offer = list.filter(p => ['offer', 'hired'].includes(p.currentStage)).length;
    const hired = list.filter(p => p.currentStage === 'hired').length;
    const rejected = list.filter(p => p.currentStage === 'rejected').length;

    setFunnel({ applied, screening, shortlisted, interview, offer, hired, rejected });
  }, [selectedJobId, pipeline]);

  const maxVal = Math.max(1, funnel.applied);

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/60">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Recruiter Operations Analytics</h2>
          <p className="text-sm text-slate-500 font-sans">Track drop-off ratios per stage, conversion efficiency indexes, and interview performance SLAs.</p>
        </div>
        <div className="shrink-0 flex items-center gap-2 font-sans text-xs">
          <label className="text-xs font-semibold text-slate-600">Filter Job Scope:</label>
          <select
            id="analytics-job-selector"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800"
          >
            <option value="all">Combined Active Catalog (All)</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid: Bento metrics and visual charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-sm">
        
        {/* Left Hand: Conversion Funnel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-950 text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" /> Progression Yield Funnel
            </h3>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Conversion drops</span>
          </div>

          <div className="space-y-4 pt-2">
            {[
              { label: 'Applied Raw Portfolio', val: funnel.applied, color: 'bg-slate-400' },
              { label: 'Screened (AI Model Match)', val: funnel.screening, color: 'bg-indigo-550 bg-indigo-500' },
              { label: 'Shortlisted Target Profile', val: funnel.shortlisted, color: 'bg-indigo-400' },
              { label: 'Interviewed Feedback Loop', val: funnel.interview, color: 'bg-amber-500' },
              { label: 'Offer Letter Extended', val: funnel.offer, color: 'bg-purple-500' },
              { label: 'Hired & Scheduled', val: funnel.hired, color: 'bg-blue-600' }
            ].map((bar, idx) => {
              const widthPct = Math.round((bar.val / maxVal) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold font-sans">
                    <span className="text-slate-700">{bar.label}</span>
                    <span className="text-slate-900 font-mono">{bar.val} candidates ({widthPct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-6.5 rounded-lg overflow-hidden flex items-center relative border border-slate-200/30 shadow-xs">
                    <div 
                      className={`h-full ${bar.color} transition-all duration-500 rounded-r`} 
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Hand: Channel Effectiveness and KPIs */}
        <div className="space-y-6">
          
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 space-y-4 font-sans">
            <h3 className="font-bold text-slate-950 text-sm">Operation Ratios</h3>
            
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Shortlist Success Rate</span>
                  <span className="text-xl font-extrabold text-slate-950 mt-1 block">
                    {funnel.applied ? Math.round((funnel.shortlisted / funnel.applied) * 100) : 0}%
                  </span>
                </div>
                <Award className="w-6 h-6 text-blue-600 shrink-0" />
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono font-bold">Hire conversion ratio</span>
                  <span className="text-xl font-extrabold text-slate-950 mt-1 block font-mono">
                    {funnel.applied ? Math.round((funnel.hired / funnel.applied) * 100) : 0}%
                  </span>
                </div>
                <Users className="w-6 h-6 text-blue-600 shrink-0 animate-pulse" />
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl flex items-center justify-between font-sans">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Average Ingestion Time SLA</span>
                  <span className="text-xl font-extrabold text-slate-950 mt-1 block font-sans">18 seconds</span>
                </div>
                <Clock className="w-6 h-6 text-amber-500 shrink-0" />
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 border border-slate-800">
            <span className="font-bold text-xs uppercase text-slate-400 font-mono block">AI Calibration Audit</span>
            <p className="text-xs text-slate-350 leading-relaxed text-slate-300 font-sans">
              Evaluations are performed using non-identifying parameters under strict compliance with EEO/FEPA regulations.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
