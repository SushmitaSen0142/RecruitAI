import React, { useState, useRef } from 'react';
import { Job, Candidate } from '../types';
import {
  UploadCloud, PlusCircle, FileText, Sparkles, Trash2,
  Search, Layers, CheckCircle, AlertCircle, Loader2, RefreshCw
} from 'lucide-react';

interface UploadParserViewProps {
  jobs: Job[];
  candidates: Candidate[];
  onUploadSingle: (candData: Partial<Candidate> & { jobId: string }) => void;
  onUploadBulk: (list: Partial<Candidate>[], jobId: string) => void;
}

function nameFallback(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function parseResumeFile(file: File): Promise<Partial<Candidate>> {
  return new Promise((resolve) => {
    const fallback = {
      name: nameFallback(file.name),
      email: '', phone: '', location: '',
      skills: [], experienceYears: 0, companies: [],
      education: { degree: '', field: '', school: '', graduationYear: 0 },
      resumeText: `Resume: ${file.name}`
    };
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(',')[1];
        const res = await fetch('/api/parse-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: base64, fileName: file.name })
        });
        const data = await res.json();
        // Use API data if valid, otherwise fallback
        resolve({
          name: data.name || fallback.name,
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || '',
          skills: Array.isArray(data.skills) && data.skills.length > 0 ? data.skills : [],
          experienceYears: Number(data.experienceYears) || 0,
          companies: Array.isArray(data.companies) ? data.companies : [],
          education: data.education || fallback.education,
          resumeText: data.resumeText || fallback.resumeText
        });
      } catch {
        // API completely unreachable — still register candidate with name from filename
        resolve(fallback);
      }
    };
    reader.onerror = () => resolve(fallback);
    reader.readAsDataURL(file);
  });
}

export default function UploadParserView({ jobs, candidates, onUploadSingle, onUploadBulk }: UploadParserViewProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id || '');

  // Manual form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSkills, setFormSkills] = useState('');
  const [formExperience, setFormExperience] = useState('0');
  const [formEducation, setFormEducation] = useState('');
  const [formResumeText, setFormResumeText] = useState('');
  const [manualStatus, setManualStatus] = useState('');
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [isParsingManual, setIsParsingManual] = useState(false);

  // Drag-drop states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; status: 'uploading' | 'parsing' | 'completed' | 'error'; error?: string }[]>([]);
  const [parseLogs, setParseLogs] = useState<string[]>([]);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const addLog = (msg: string) => setParseLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // Manual file select — actually parse the PDF
  const handleManualFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setManualFile(file);
    setIsParsingManual(true);
    setManualStatus(`Parsing "${file.name}" with AI...`);
    try {
      const parsed = await parseResumeFile(file);
      if (parsed.name && !formName) setFormName(parsed.name);
      if (parsed.email && !formEmail) setFormEmail(parsed.email);
      if (parsed.phone && !formPhone) setFormPhone(parsed.phone || '');
      if (parsed.location && !formLocation) setFormLocation(parsed.location || '');
      if (parsed.skills?.length && !formSkills) setFormSkills((parsed.skills as string[]).join(', '));
      if (parsed.experienceYears && formExperience === '0') setFormExperience(String(parsed.experienceYears));
      if (parsed.education) {
        const edu = parsed.education as any;
        setFormEducation(`${edu.degree || ''} ${edu.field || ''}`.trim());
      }
      if (parsed.resumeText) setFormResumeText(parsed.resumeText);
      setManualStatus(`✓ Parsed "${file.name}" successfully. Review and edit the fields below before submitting.`);
    } catch {
      // Gemini unavailable — just use filename, let user fill in the rest
      if (!formName) setFormName(nameFallback(file.name));
      setManualStatus(`⚠ AI parsing unavailable. Name filled from filename — please complete the other fields manually.`);
    } finally {
      setIsParsingManual(false);
    }
  };

  const handleRemoveManualFile = () => { setManualFile(null); };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) return;
    setManualStatus('Registering candidate...');
    onUploadSingle({
      name: formName,
      email: formEmail,
      phone: formPhone || '',
      location: formLocation || '',
      skills: formSkills.split(',').map(s => s.trim()).filter(Boolean),
      experienceYears: Number(formExperience) || 0,
      companies: [],
      education: {
        degree: formEducation.split(' ')[0] || '',
        field: formEducation.split(' ').slice(1).join(' ') || formEducation,
        school: '',
        graduationYear: 0
      },
      resumeText: formResumeText || `${formName} — Skills: ${formSkills}`,
      resumeFileName: manualFile ? manualFile.name : `${formName.replace(/\s+/g, '_')}_Resume.pdf`,
      jobId: selectedJobId
    });
    setFormName(''); setFormEmail(''); setFormPhone(''); setFormLocation('');
    setFormSkills(''); setFormExperience('0'); setFormEducation('');
    setFormResumeText(''); setManualFile(null);
    setManualStatus('✓ Candidate registered successfully!');
    setTimeout(() => setManualStatus(''), 3000);
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const processFiles = async (files: FileList) => {
    setIsParsingFiles(true);
    const fileArr = Array.from(files);
    const newFiles = fileArr.map(f => ({
      name: f.name, size: (f.size / 1024).toFixed(1) + ' KB',
      status: 'uploading' as const, type: f.name.split('.').pop() || 'pdf'
    }));
    setUploadedFiles(prev => [...newFiles, ...prev]);
    addLog(`Started processing ${files.length} file(s)...`);

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      // Mark as parsing
      setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'parsing' } : f));
      addLog(`Extracting text from "${file.name}"...`);
      try {
        const parsed = await parseResumeFile(file);
        onUploadSingle({ ...parsed, resumeFileName: file.name, jobId: selectedJobId } as any);
        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'completed' } : f));
        addLog(`✓ "${parsed.name || file.name}" registered — Skills: ${(parsed.skills as string[] || []).slice(0, 3).join(', ')}`);
      } catch (err: any) {
        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', error: err.message } : f));
        addLog(`⚠ Failed to parse "${file.name}": ${err.message}`);
      }
    }
    setIsParsingFiles(false);
    addLog('✓ All files processed.');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length > 0) processFiles(e.target.files);
  };

  const filteredCandidates = candidates.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 font-sans">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Resume Upload & Parser</h2>
        <p className="text-sm text-slate-500">Upload PDF resumes — AI extracts real candidate data and registers them for screening.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-sm">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
          <div>
            <div className="flex border-b border-slate-100 bg-slate-50/70 shrink-0">
              <button onClick={() => setActiveTab('upload')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition ${activeTab === 'upload' ? 'bg-white text-blue-600 border-t-2 border-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800 bg-slate-50'}`}>
                Drag & Drop Upload
              </button>
              <button onClick={() => setActiveTab('manual')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition ${activeTab === 'manual' ? 'bg-white text-blue-600 border-t-2 border-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800 bg-slate-50'}`}>
                Single Candidate Entry
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Job *</label>
                <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-sm">
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.department})</option>)}
                </select>
              </div>

              {activeTab === 'upload' ? (
                <div className="space-y-6">
                  <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${isDragging ? 'border-blue-500 bg-blue-50/20' : 'border-slate-250 hover:border-blue-400 hover:bg-slate-50/60'}`}>
                    <input ref={fileInputRef} type="file" multiple accept=".pdf" onChange={handleFileSelect} className="hidden" />
                    <UploadCloud className="w-10 h-10 text-blue-500 mx-auto" />
                    <h4 className="mt-4 text-sm font-semibold text-slate-900">Drop PDF resumes here</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">AI extracts real name, email, skills, experience and education from each PDF.</p>
                    <button type="button" className="mt-4 px-4 py-2 border border-slate-200 hover:border-blue-500 rounded-xl text-xs font-bold transition-all inline-block hover:text-blue-600 text-slate-700 bg-white">
                      Browse PDFs
                    </button>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-slate-500 uppercase font-mono block">Uploaded Files</span>
                      <div className="divide-y divide-slate-150 border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50">
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} className="p-3.5 flex justify-between items-center text-xs">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white border border-slate-200 rounded-lg">
                                <FileText className="w-4 h-4 text-blue-500" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{file.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{file.size}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {file.status === 'uploading' && <span className="flex items-center gap-1.5 text-xs text-orange-500 font-bold"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</span>}
                              {file.status === 'parsing' && <span className="flex items-center gap-1.5 text-xs text-blue-500 font-bold animate-pulse"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> AI Parsing...</span>}
                              {file.status === 'completed' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-extrabold">✓ Registered</span>}
                              {file.status === 'error' && <span className="flex items-center gap-1 text-xs text-red-500 font-bold">⚠ Failed</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {parseLogs.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-500 uppercase font-mono block">Parse Log</span>
                      <div className="bg-slate-950 text-blue-400 p-4 rounded-xl border border-slate-900 max-h-40 overflow-y-auto text-xs font-mono divide-y divide-slate-900/40">
                        {parseLogs.map((log, i) => <div key={i} className="py-1">{log}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  {/* File upload for auto-fill */}
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                    <span className="text-xs font-bold text-blue-700 block">Upload PDF to auto-fill form</span>
                    <div className="flex items-center gap-3">
                      <input type="file" id="manual-file-input" accept=".pdf" className="hidden" onChange={handleManualFileSelect} />
                      <button type="button" onClick={() => document.getElementById('manual-file-input')?.click()}
                        className="flex items-center gap-1.5 px-3.5 py-2 border border-blue-200 hover:border-blue-500 rounded-lg text-xs font-bold text-blue-700 bg-white cursor-pointer">
                        <UploadCloud className="w-4 h-4 text-blue-500" />
                        {manualFile ? 'Change File' : 'Browse PDF'}
                      </button>
                      {manualFile && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 rounded-lg text-xs text-blue-800">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-bold truncate max-w-[150px]">{manualFile.name}</span>
                          <button type="button" onClick={handleRemoveManualFile} className="text-red-500 ml-1 font-bold">✕</button>
                        </div>
                      )}
                    </div>
                    {isParsingManual && (
                      <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI is reading your PDF...
                      </div>
                    )}
                    {manualStatus && (
                      <div className={`p-2 rounded-lg flex items-center gap-2 text-xs font-sans ${manualStatus.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                        {manualStatus}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                      <input type="text" required placeholder="e.g. Sarah Jenkins" value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                      <input type="email" required placeholder="e.g. sarah@example.com" value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                      <input type="text" placeholder="+1 (555) 000-0000" value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                      <input type="text" placeholder="e.g. New York, NY" value={formLocation}
                        onChange={(e) => setFormLocation(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Years Experience</label>
                      <input type="number" min="0" value={formExperience}
                        onChange={(e) => setFormExperience(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Skills (comma-separated) *</label>
                    <input type="text" required placeholder="e.g. React, TypeScript, Node.js" value={formSkills}
                      onChange={(e) => setFormSkills(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Education / Degree</label>
                    <input type="text" placeholder="e.g. BSc Computer Science" value={formEducation}
                      onChange={(e) => setFormEducation(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Resume Text (paste or auto-filled from PDF)</label>
                    <textarea rows={4} placeholder="Paste resume content here, or upload a PDF above to auto-fill."
                      value={formResumeText} onChange={(e) => setFormResumeText(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 bg-white" />
                  </div>

                  <button type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                    <Sparkles className="w-4 h-4 text-blue-200" /> Register Candidate
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right: Candidate list */}
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-950 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Layers className="w-4 h-4 text-blue-600" /> Candidates
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search candidates or skills..."
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs" />
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredCandidates.map((c) => (
                <div key={c.id} className="p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-slate-950 text-xs">{c.name}</p>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{c.experienceYears}y exp</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{c.email}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.skills.slice(0, 4).map((sk, idx) => (
                      <span key={idx} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{sk}</span>
                    ))}
                    {c.skills.length > 4 && <span className="text-[9px] text-slate-400 self-center">+{c.skills.length - 4}</span>}
                  </div>
                </div>
              ))}
              {filteredCandidates.length === 0 && (
                <p className="text-center py-6 text-slate-400 text-xs">No candidates found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
