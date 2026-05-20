import React, { useState } from 'react';
import { Job } from '../types';
import { 
  PlusCircle, 
  Briefcase, 
  MapPin, 
  DollarSign, 
  ShieldAlert, 
  ChevronRight,
  TrendingUp,
  FileText,
  X,
  Edit,
  Trash2
} from 'lucide-react';

interface JobManagementViewProps {
  jobs: Job[];
  onCreateJob: (jobData: Partial<Job>) => void;
  onEditJob: (id: string, jobData: Partial<Job>) => void;
  onDeleteJob: (id: string) => void;
}

export default function JobManagementView({ jobs, onCreateJob, onEditJob, onDeleteJob }: JobManagementViewProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const [newJob, setNewJob] = useState<Partial<Job>>({
    title: '',
    department: 'Engineering',
    location: 'Remote',
    description: '',
    requiredSkills: [],
    niceToHaveSkills: [],
    experienceYears: 3,
    salaryMin: 90000,
    salaryMax: 120000,
    strictness: 70
  });

  const [skillInput, setSkillInput] = useState('');
  const [prefSkillInput, setPrefSkillInput] = useState('');

  const addSkill = (type: 'req' | 'pref') => {
    if (type === 'req' && skillInput.trim()) {
      setNewJob({
        ...newJob,
        requiredSkills: [...(newJob.requiredSkills || []), skillInput.trim()]
      });
      setSkillInput('');
    } else if (type === 'pref' && prefSkillInput.trim()) {
      setNewJob({
        ...newJob,
        niceToHaveSkills: [...(newJob.niceToHaveSkills || []), prefSkillInput.trim()]
      });
      setPrefSkillInput('');
    }
  };

  const removeSkill = (type: 'req' | 'pref', skillName: string) => {
    if (type === 'req') {
      setNewJob({
        ...newJob,
        requiredSkills: (newJob.requiredSkills || []).filter(s => s !== skillName)
      });
    } else {
      setNewJob({
        ...newJob,
        niceToHaveSkills: (newJob.niceToHaveSkills || []).filter(s => s !== skillName)
      });
    }
  };

  const openCreateModal = () => {
    setNewJob({
      title: '',
      department: 'Engineering',
      location: 'Remote',
      description: '',
      requiredSkills: [],
      niceToHaveSkills: [],
      experienceYears: 3,
      salaryMin: 90000,
      salaryMax: 120000,
      strictness: 70
    });
    setIsEditing(false);
    setCurrentJobId(null);
    setShowWizard(true);
  };

  const openEditModal = (job: Job) => {
    setNewJob({
      title: job.title,
      department: job.department,
      location: job.location,
      description: job.description,
      requiredSkills: job.requiredSkills || [],
      niceToHaveSkills: job.niceToHaveSkills || [],
      experienceYears: job.experienceYears,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      strictness: job.strictness
    });
    setIsEditing(true);
    setCurrentJobId(job.id);
    setShowWizard(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && currentJobId) {
      onEditJob(currentJobId, newJob);
    } else {
      onCreateJob(newJob);
    }
    setShowWizard(false);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-4 border-b border-slate-200/60 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Job Openings</h2>
          <p className="text-sm text-slate-500">Configure parameters, skill weight matrixes, and strictness thresholds for active openings.</p>
        </div>
        <button
          id="btn-trigger-wizard"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4.5 py-2.5 rounded-xl text-sm shadow transition"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Job Opening
        </button>
      </div>

      {/* Grid List of current job openings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white border border-slate-200/50 rounded-2xl">
            No active job openings listed yet. Click "Create New Job Opening" to add your first position.
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} id={`job-card-${job.id}`} className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden hover:shadow-md transition flex flex-col justify-between">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-sans">
                    {job.department}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      title="Edit Job"
                      onClick={() => openEditModal(job)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete Job"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${job.title}? This action is permanent.`)) {
                          onDeleteJob(job.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${job.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      {job.status}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">{job.title}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {job.location}
                  </p>
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {job.description}
                </p>

                {/* Requirement highlights */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-xs text-slate-500 font-mono">
                    Experience target: <span className="text-slate-950 font-sans font-medium">{job.experienceYears} years+</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {job.requiredSkills.slice(0, 3).map((s, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-50 border border-slate-200/50 rounded px-1.5 py-0.5 text-slate-700">
                        {s}
                      </span>
                    ))}
                    {job.requiredSkills.length > 3 && (
                      <span className="text-[10px] text-slate-400 self-center ml-1">
                        +{job.requiredSkills.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 flex items-center gap-0.5 font-mono">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  {job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()} / year
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  Strictness: <span className="font-bold text-slate-700">{job.strictness}/100</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Creation/Edit wizard modal dialog */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200/60 flex flex-col max-h-[85vh] animate-fade-in font-sans">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-500" /> {isEditing ? 'Edit Job Parameters' : 'Create Job Opening Parameters'}
              </h3>
              <button 
                id="close-wizard-btn"
                onClick={() => setShowWizard(false)} 
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-sm text-slate-705">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Role Title *</label>
                  <input
                    id="new-job-title"
                    type="text"
                    required
                    value={newJob.title}
                    onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                    placeholder="e.g. Lead React Developer"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                  <select
                    id="new-job-department"
                    value={newJob.department}
                    onChange={(e) => setNewJob({ ...newJob, department: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition bg-white text-slate-800"
                  >
                    <option>Engineering</option>
                    <option>Artificial Intelligence</option>
                    <option>Design</option>
                    <option>Product Management</option>
                    <option>Sales & Operations</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Location / Setup</label>
                  <input
                    id="new-job-location"
                    type="text"
                    value={newJob.location}
                    onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                    placeholder="e.g. San Francisco, CA (Hybrid)"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Target Experience (Years) *</label>
                  <input
                    id="new-job-experience"
                    type="number"
                    required
                    value={newJob.experienceYears}
                    onChange={(e) => setNewJob({ ...newJob, experienceYears: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Recruiting Description & Context</label>
                <textarea
                  id="new-job-desc"
                  rows={4}
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  placeholder="Describe details regarding candidate requirements, roles, key features of their day-to-day stack, etc."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition text-slate-800 text-sm"
                />
              </div>

              {/* Skills builders */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Required Skills (Strict Check)</label>
                  <div className="flex gap-2">
                    <input
                      id="req-skill-input"
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      placeholder="e.g. TypeScript"
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-830"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill('req'); } }}
                    />
                    <button
                      id="add-req-skill"
                      type="button"
                      onClick={() => addSkill('req')}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs hover:bg-slate-800 transition"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newJob.requiredSkills?.map((s, i) => (
                      <span key={i} className="text-xs bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 text-blue-700 flex items-center gap-1 font-sans">
                        {s}
                        <X className="w-3 h-3 hover:text-red-500 cursor-pointer" onClick={() => removeSkill('req', s)} />
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred Skills (Plus points)</label>
                  <div className="flex gap-2">
                    <input
                      id="pref-skill-input"
                      type="text"
                      value={prefSkillInput}
                      onChange={(e) => setPrefSkillInput(e.target.value)}
                      placeholder="e.g. Docker"
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-830"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill('pref'); } }}
                    />
                    <button
                      id="add-pref-skill"
                      type="button"
                      onClick={() => addSkill('pref')}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs hover:bg-slate-800 transition"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newJob.niceToHaveSkills?.map((s, i) => (
                      <span key={i} className="text-xs bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 text-slate-700 flex items-center gap-1 font-sans">
                        {s}
                        <X className="w-3 h-3 hover:text-red-500 cursor-pointer" onClick={() => removeSkill('pref', s)} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Salary Band Setting */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Min Salary Budget (USD)</label>
                  <input
                    id="new-job-salary-min"
                    type="number"
                    value={newJob.salaryMin}
                    onChange={(e) => setNewJob({ ...newJob, salaryMin: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Max Salary Budget (USD)</label>
                  <input
                    id="new-job-salary-max"
                    type="number"
                    value={newJob.salaryMax}
                    onChange={(e) => setNewJob({ ...newJob, salaryMax: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none text-slate-800"
                  />
                </div>
              </div>

              {/* AI Strictness Calibration */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <span className="text-xs font-semibold text-slate-705 block">AI Screening Strictness Calibration</span>
                <div className="flex items-center gap-4">
                  <input
                    id="new-job-strictness"
                    type="range"
                    min="0"
                    max="100"
                    value={newJob.strictness}
                    onChange={(e) => setNewJob({ ...newJob, strictness: Number(e.target.value) })}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="font-mono text-sm font-bold text-slate-800 w-12 text-right">{newJob.strictness}/100</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  High values force the AI screening agent to evaluate experience targets strictly. Lower parameters permit matching transferable developer competencies.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  id="cancel-job-btn"
                  type="button"
                  onClick={() => setShowWizard(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-600 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  id="submit-job-btn"
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-md"
                >
                  {isEditing ? 'Save Changes' : 'Publish and Map'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
