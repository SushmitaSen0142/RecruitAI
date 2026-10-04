import React, { useState, useRef, useEffect } from 'react';
import { Job, Candidate } from '../types';
import { UploadCloud, FileText, Sparkles, Layers, Search, Loader2, RefreshCw } from 'lucide-react';

interface Props {
  jobs: Job[];
  candidates: Candidate[];
  onUploadSingle: (data: Partial<Candidate> & { jobId: string }) => void;
  onUploadBulk: (list: Partial<Candidate>[], jobId: string) => void;
}

// ── Load PDF.js from CDN and extract text ─────────────────────────────────────
async function extractTextFromPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);

        // Load PDF.js from CDN if not already loaded
        if (!(window as any).pdfjsLib) {
          await new Promise<void>((res, rej) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => res();
            script.onerror = () => rej(new Error('PDF.js failed to load'));
            document.head.appendChild(script);
          });
        }

        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        resolve(fullText.trim());
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Send extracted text to backend for Gemini parsing ────────────────────────
async function parseResumeText(resumeText: string, fileName: string): Promise<Partial<Candidate>> {
  const res = await fetch('/api/parse-resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, fileName })
  });
  if (!res.ok) throw new Error(`Parse API failed: ${res.statusText}`);
  return res.json();
}

// ── Full pipeline: file → text → parsed candidate ─────────────────────────────
async function processResumeFile(file: File): Promise<Partial<Candidate>> {
  const text = await extractTextFromPDF(file);
  if (!text || text.trim().length < 30) throw new Error('Could not extract text from PDF — ensure the PDF has selectable text (not scanned image)');
  return parseResumeText(text, file.name);
}

export default function UploadParserView({ jobs, candidates, onUploadSingle, onUploadBulk }: Props) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');

  // Single form
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSkills, setFormSkills] = useState('');
  const [formExperience, setFormExperience] = useState('0');
  const [formEducation, setFormEducation] = useState('');
  const [formResumeText, setFormResumeText] = useState('');
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [isParsingManual, setIsParsingManual] = useState(false);
  const [manualStatus, setManualStatus] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Drag-drop
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; status: 'parsing' | 'completed' | 'error'; error?: string }[]>([]);
  const [parseLogs, setParseLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (jobs.length > 0 && !selectedJobId) setSelectedJobId(jobs[0].id); }, [jobs]);

  const addLog = (msg: string) => setParseLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));

  // ── Manual file upload → extract + fill form ──────────────────────────────
  const handleManualFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setManualFile(file);
    setIsParsingManual(true);
    setManualStatus('Reading PDF with AI...');
    try {
      const parsed = await processResumeFile(file);
      if (parsed.name) setFormName(parsed.name);
      if (parsed.email) setFormEmail(parsed.email);
      if (parsed.phone) setFormPhone(parsed.phone || '');
      if (parsed.location) setFormLocation(parsed.location || '');
      if (parsed.skills?.length) setFormSkills((parsed.skills as string[]).join(', '));
      if (parsed.experienceYears) setFormExperience(String(parsed.experienceYears));
      if (parsed.education) {
        const edu = parsed.education as any;
        setFormEducation(`${edu.degree || ''} ${edu.field || ''}`.trim());
      }
      if (parsed.resumeText) setFormResumeText(parsed.resumeText);
      setManualStatus('✓ PDF parsed! Review and edit fields below, then click Register.');
    } catch (err: any) {
      setManualStatus(`⚠ ${err.message || 'Could not parse PDF'}. Fill in details manually.`);
    } finally {
      setIsParsingManual(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;
    setFormSubmitting(true);
    onUploadSingle({
      name: formName.trim(), email: formEmail.trim(), phone: formPhone, location: formLocation,
      skills: formSkills.split(',').map(s => s.trim()).filter(Boolean),
      experienceYears: Number(formExperience) || 0, companies: [],
      education: { degree: formEducation.split(' ')[0] || '', field: formEducation.split(' ').slice(1).join(' ') || formEducation, school: '', graduationYear: 0 },
      resumeText: formResumeText, resumeFileName: manualFile ? manualFile.name : `${formName.replace(/\s+/g,'_')}_Resume.pdf`,
      jobId: selectedJobId
    } as any);
    setFormName(''); setFormEmail(''); setFormPhone(''); setFormLocation('');
    setFormSkills(''); setFormExperience('0'); setFormEducation('');
    setFormResumeText(''); setManualFile(null);
    setManualStatus('✓ Candidate registered successfully!');
    setTimeout(() => setManualStatus(''), 3000);
    setFormSubmitting(false);
  };

  // ── Drag-drop bulk upload ─────────────────────────────────────────────────
  const processFiles = async (files: FileList) => {
    setIsProcessing(true);
    const arr = Array.from(files);
    setUploadedFiles(arr.map(f => ({ name: f.name, size: (f.size/1024).toFixed(1)+' KB', status: 'parsing' as const })));
    addLog(`Processing ${arr.length} file(s)...`);
    for (const file of arr) {
      addLog(`Extracting text from "${file.name}"...`);
      try {
        const parsed = await processResumeFile(file);
        onUploadSingle({ ...parsed, resumeFileName: file.name, jobId: selectedJobId } as any);
        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'completed' } : f));
        addLog(`✓ "${parsed.name || file.name}" registered — Skills: ${(parsed.skills as string[] || []).slice(0,3).join(', ') || 'see profile'}`);
      } catch (err: any) {
        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', error: err.message } : f));
        addLog(`⚠ "${file.name}" failed: ${err.message}`);
      }
    }
    setIsProcessing(false);
    addLog('✓ All files processed.');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(e.target.files);
  };

  const filteredCandidates = candidates.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Resume Upload & Parser</h2>
        <p className="text-sm text-slate-500 mt-1">Upload PDF resumes — AI reads them and extracts real candidate data automatically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(['upload','manual'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-semibold transition ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:text-slate-800 bg-slate-50/60'}`}>
                {tab === 'upload' ? 'Drag & Drop Upload' : 'Single Candidate Entry'}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {/* Job selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Job *</label>
              <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-sm text-slate-800">
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.department})</option>)}
              </select>
            </div>

            {activeTab === 'upload' ? (
              <div className="space-y-5">
                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}>
                  <input ref={fileInputRef} type="file" multiple accept=".pdf" onChange={handleFileInputChange} className="hidden" />
                  <UploadCloud className={`w-10 h-10 mx-auto ${isDragging ? 'text-blue-500' : 'text-slate-300'}`} />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Drop PDF resumes here</p>
                  <p className="text-xs text-slate-400 mt-1">PDF.js extracts real text → Gemini parses name, email, skills, experience</p>
                  <button type="button" className="mt-4 px-4 py-2 border border-slate-200 hover:border-blue-500 rounded-lg text-xs font-bold text-slate-700 hover:text-blue-600 bg-white transition">
                    Browse PDFs
                  </button>
                  <p className="text-[10px] text-slate-400 mt-2">⚠ Only works with text-based PDFs (not scanned images)</p>
                </div>

                {/* File list */}
                {uploadedFiles.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Uploaded Files</p>
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-blue-400" />
                            <div>
                              <p className="text-xs font-bold text-slate-800">{f.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{f.size}</p>
                            </div>
                          </div>
                          {f.status === 'parsing' && <span className="flex items-center gap-1.5 text-xs text-blue-500 font-semibold"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> AI Reading...</span>}
                          {f.status === 'completed' && <span className="text-xs text-emerald-600 font-bold">✓ Registered</span>}
                          {f.status === 'error' && <span className="text-xs text-red-500 font-bold">⚠ Failed</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parse log */}
                {parseLogs.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Parse Log</p>
                    <div className="bg-slate-950 text-blue-400 p-4 rounded-xl text-xs font-mono max-h-36 overflow-y-auto space-y-1">
                      {parseLogs.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                {/* PDF auto-fill */}
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-blue-700">Upload PDF to auto-fill form</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input id="manual-pdf" type="file" accept=".pdf" className="hidden" onChange={handleManualFileSelect} />
                    <button type="button" onClick={() => document.getElementById('manual-pdf')?.click()}
                      className="flex items-center gap-2 px-3 py-2 border border-blue-200 bg-white rounded-lg text-xs font-bold text-blue-700 hover:border-blue-500 transition">
                      <UploadCloud className="w-4 h-4" />
                      {manualFile ? 'Change PDF' : 'Browse PDF'}
                    </button>
                    {manualFile && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 rounded-lg text-xs font-bold text-blue-800">
                        <FileText className="w-3 h-3" /> {manualFile.name}
                        <button type="button" onClick={() => setManualFile(null)} className="ml-1 text-red-500">✕</button>
                      </span>
                    )}
                  </div>
                  {isParsingManual && (
                    <p className="flex items-center gap-2 text-xs text-blue-600 font-semibold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI reading PDF...
                    </p>
                  )}
                  {manualStatus && (
                    <p className={`text-xs font-semibold p-2 rounded-lg ${manualStatus.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-100' : manualStatus.startsWith('⚠') ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-blue-50 text-blue-700'}`}>
                      {manualStatus}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[['Full Name *', formName, setFormName, 'text', true, 'Sarah Jenkins'], ['Email *', formEmail, setFormEmail, 'email', true, 'sarah@example.com']].map(([label, val, setter, type, required, ph]) => (
                    <div key={label as string}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{label as string}</label>
                      <input type={type as string} required={required as boolean} placeholder={ph as string}
                        value={val as string} onChange={e => (setter as any)(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800" />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[['Phone', formPhone, setFormPhone, '+1 (555) 000-0000'], ['Location', formLocation, setFormLocation, 'New York, NY']].map(([label, val, setter, ph]) => (
                    <div key={label as string}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{label as string}</label>
                      <input type="text" placeholder={ph as string} value={val as string}
                        onChange={e => (setter as any)(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Years Exp.</label>
                    <input type="number" min="0" value={formExperience} onChange={e => setFormExperience(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Skills (comma-separated) *</label>
                  <input type="text" required placeholder="React, TypeScript, Node.js" value={formSkills}
                    onChange={e => setFormSkills(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Education</label>
                  <input type="text" placeholder="BSc Computer Science" value={formEducation}
                    onChange={e => setFormEducation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Resume Text</label>
                  <textarea rows={3} placeholder="Auto-filled from PDF, or paste manually."
                    value={formResumeText} onChange={e => setFormResumeText(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 bg-white" />
                </div>

                <button type="submit" disabled={formSubmitting}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {formSubmitting ? 'Registering...' : 'Register Candidate'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right: candidate list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <Layers className="w-4 h-4 text-blue-600" /> Registered Candidates ({candidates.length})
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search name, email, skills..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700" />
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredCandidates.map(c => (
              <div key={c.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-slate-900 text-xs">{c.name}</p>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{c.experienceYears}y</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{c.email}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {c.skills.slice(0, 4).map((sk, i) => (
                    <span key={i} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{sk}</span>
                  ))}
                  {c.skills.length > 4 && <span className="text-[9px] text-slate-400">+{c.skills.length - 4}</span>}
                </div>
              </div>
            ))}
            {filteredCandidates.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-8">No candidates yet. Upload a resume above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
