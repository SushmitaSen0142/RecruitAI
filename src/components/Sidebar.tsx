import { 
  LayoutDashboard, 
  Briefcase, 
  UploadCloud, 
  FileCheck, 
  GitPullRequest, 
  Calendar, 
  BarChart3, 
  User, 
  Settings,
  ShieldCheck,
  BrainCircuit,
  Eye,
  EyeOff,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  recruiterMode: boolean;
  setRecruiterMode: (mode: boolean) => void;
  statusMode: string;
  onSignOut: () => void;
}

export default function Sidebar({ currentTab, setTab, recruiterMode, setRecruiterMode, statusMode, onSignOut }: SidebarProps) {
  const recruiterMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jobs', label: 'Job Openings', icon: Briefcase },
    { id: 'upload', label: 'Upload & Parser', icon: UploadCloud },
    { id: 'screening', label: 'AI Screening', icon: BrainCircuit },
    { id: 'pipeline', label: 'Hiring Pipeline', icon: GitPullRequest },
    { id: 'interviews', label: 'Interviews & Feedback', icon: Calendar },
    { id: 'analytics', label: 'Analytics & Trends', icon: BarChart3 },
    { id: 'settings', label: 'Admin Settings', icon: Settings },
  ];

  const candidateMenuItems = [
    { id: 'portal', label: 'My Progress Tracker', icon: User },
  ];

  const activeMenu = recruiterMode ? recruiterMenuItems : candidateMenuItems;

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800 shrink-0 h-full font-sans">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg text-white">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-white leading-none">Recruit-AI</h1>
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">Workstation 2.0</span>
          </div>
        </div>
      </div>

      {/* Role Indicator Banner */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
          {recruiterMode ? 'Recruiter Mode' : 'Candidate Portal'}
        </span>
        <button 
          id="sign-out-sidebar-btn"
          onClick={onSignOut}
          title="Sign Out of Session"
          className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-red-400 hover:text-red-300 transition"
        >
          <LogOut className="w-3 h-3" />
          Exit
        </button>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {activeMenu.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              id={`nav-tab-${item.id}`}
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                isActive 
                  ? 'bg-blue-500/10 text-blue-400 font-semibold border-l-2 border-blue-500' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-all duration-250 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer State Indicators */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusMode.includes('Live') ? 'bg-blue-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          <div className="text-[11px] font-mono leading-tight">
            <span className="block text-slate-400 font-sans font-bold">API Gateway Status:</span>
            <span className={statusMode.includes('Live') ? 'text-blue-400' : 'text-amber-400'}>
              {statusMode}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
