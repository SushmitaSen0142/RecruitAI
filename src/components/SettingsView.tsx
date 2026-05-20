import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Mail, 
  Slack, 
  Calendar, 
  Video, 
  ShieldCheck, 
  Key, 
  Database,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface SettingsViewProps {
  statusMode: string;
}

export default function SettingsView({ statusMode }: SettingsViewProps) {
  const [templateSubject, setTemplateSubject] = useState('Next steps with Recruit-AI');
  const [templateBody, setTemplateBody] = useState(`Hi {{candidate_name}},\n\nThank you for sharing your qualifications for the {{job_title}} opening. We completed our language screening and would love to coordinate next steps!`);
  const [saveStatus, setSaveStatus] = useState('');

  // Credentials visual state
  const [geminiVar, setGeminiVar] = useState( '••••••••••••••••••••••••••••');

  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('noreply@recruit-ai.com');
  const [smtpStatusMsg, setSmtpStatusMsg] = useState('');

  useEffect(() => {
    fetch('/api/smtp/config')
      .then(r => r.json())
      .then(data => {
        if (data) {
          setSmtpHost(data.host || 'smtp.gmail.com');
          setSmtpPort(data.port || 587);
          setSmtpUser(data.user || '');
          setSmtpFrom(data.from || 'noreply@recruit-ai.com');
        }
      })
      .catch(err => console.error('Failed to load SMTP config:', err));
  }, []);

  const handleSaveSMTP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/smtp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort),
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom
        })
      }).then(r => r.json());

      if (res && res.success) {
        setSmtpStatusMsg('SMTP and Gmail delivery parameters updated in real time successfully!');
        setSmtpPass('');
        setTimeout(() => setSmtpStatusMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
      setSmtpStatusMsg('Failed to synchronize server SMTP attributes.');
    }
  };

  const handleSaveTemplates = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('Template settings saved to temporary memory cache.');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 font-sans">
      <div className="pb-4 border-b border-slate-200/60 shrink-0">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" /> Admin Settings Workspace
        </h2>
        <p className="text-sm text-slate-500 font-sans">Configure visual alignment parameters, customize email merge templates, and map integrations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-sm">
        
        {/* Left Hand Options: Email templates & API variables (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Email Customization tab */}
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-950 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-650" /> Communication Templates
            </h3>

            <form onSubmit={handleSaveTemplates} className="space-y-4 text-xs font-semibold text-slate-650">
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-sans">Subject merge template</label>
                <input
                  id="set-template-sub"
                  type="text"
                  required
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-slate-955 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1 font-sans">Body Text template (Supports {"{{candidate_name}}"}, {"{{job_title}}"} merges)</label>
                <textarea
                  id="set-template-body"
                  rows={4}
                  required
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium text-xs font-mono"
                />
              </div>

              {saveStatus && (
                <span className="text-[11px] text-blue-600 font-bold block">✓ {saveStatus}</span>
              )}

              <button
                id="save-templates-btn"
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Save Merge Templates
              </button>
            </form>
          </div>

          {/* Key Secrets mapping panel */}
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 space-y-4 text-xs font-semibold text-slate-600">
            <h3 className="font-bold text-slate-950 text-sm flex items-center gap-2 text-slate-950">
              <Key className="w-4 h-4 text-blue-600" /> Model Secrets & Environment
            </h3>

            <div className="space-y-3 font-medium">
              <div>
                <span className="text-slate-500 block text-[11px]">GEMINI_API_KEY (Defined server side)</span>
                <input
                  id="gemini-env-dummy"
                  type="text"
                  disabled
                  value={geminiVar}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 mt-1 text-xs"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-mono italic">
                Defined inside .env.example. Users can configure live keys via the Secrets panel inside Google AI Studio for production execution.
              </p>
            </div>
          </div>

          {/* SMTP Server Configuration card */}
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-950 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" /> Automated SMTP & Gmail Delivery Integration
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Configure SMTP, Gmail SMTP, or transactional mail server parameters. When username and password are saved, the system delivers real email updates to candidates instantly.
            </p>

            <form onSubmit={handleSaveSMTP} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
              <div>
                <label className="block text-xs text-slate-600 mb-1">SMTP Outbound Host</label>
                <input
                  id="smtp-host-input"
                  type="text"
                  required
                  placeholder="e.g. smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">SMTP Output Port</label>
                <input
                  id="smtp-port-input"
                  type="number"
                  required
                  placeholder="e.g. 587 or 465"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Sender Email Username</label>
                <input
                  id="smtp-user-input"
                  type="text"
                  placeholder="e.g. testrecruits@gmail.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Mail Password / App Password</label>
                <input
                  id="smtp-pass-input"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-slate-600 mb-1">Sender Name Default Address</label>
                <input
                  id="smtp-from-input"
                  type="email"
                  required
                  placeholder="e.g. noreply@domain.com"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold"
                />
              </div>

              {smtpStatusMsg && (
                <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-105 text-blue-800 rounded-lg font-medium text-xs">
                  ✓ {smtpStatusMsg}
                </div>
              )}

              <div className="md:col-span-2 flex justify-end">
                <button
                  id="save-smtp-btn"
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Save Integration Parameters
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Hand: Integrations Checklist mapping */}
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 space-y-4 h-fit">
          <h3 className="font-bold text-slate-950 text-sm">Active Integrations</h3>
          
          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block font-sans">Google Calendar</span>
                  <span className="text-[10px] text-slate-400 font-mono">Live Sync</span>
                </div>
              </div>
              <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold font-sans">ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-600 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold text-slate-900 block font-sans">Google Meet API</span>
                  <span className="text-[10px] text-slate-400 font-mono">Auto Video generator</span>
                </div>
              </div>
              <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold font-sans font-bold">ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl">
              <div className="flex items-center gap-2">
                <Slack className="w-4 h-4 text-purple-500 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block font-sans">Slack updates channel</span>
                  <span className="text-[10px] text-slate-400 font-mono">#team-recruits</span>
                </div>
              </div>
              <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold font-sans">ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block font-sans">Memory Cache store</span>
                  <span className="text-[10px] text-slate-400 font-mono">Real-time state sync</span>
                </div>
              </div>
              <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold font-sans">ACTIVE</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
