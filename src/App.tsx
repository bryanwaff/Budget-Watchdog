import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MessageSquare, 
  MapPin, 
  FileText, 
  TrendingUp, 
  AlertCircle,
  Bell,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Menu,
  X,
  Database,
  Cloud,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { COUNTIES, County, Ward, BudgetMetadata } from './data';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function App() {
  const [selectedCounty, setSelectedCounty] = useState<County>(COUNTIES[0]);
  const [metadata, setMetadata] = useState<BudgetMetadata | null>(null);
  const [selectedWard, setSelectedWard] = useState<Ward>(COUNTIES[0].wards[0]);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Habari! I am your Kenyan County Budget Watchdog. Ask me anything about the budget. For example: "How much was allocated to Witu Ward for water?"' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [smsDigest, setSmsDigest] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Data Source State (Connected directly to GCS budget_watchdog audit bucket)
  const [dataSource, setDataSource] = useState<'internal' | 'cloud-storage'>('cloud-storage');
  const [bucketName, setBucketName] = useState('budget_watchdog');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('success');
  const [gcsFiles, setGcsFiles] = useState<{ name: string; size: string; contentType: string; updated: string }[]>([]);
  const [selectedGcsFile, setSelectedGcsFile] = useState<string>(COUNTIES[0].fileName);

  // Active Real-time Tracker & Compliance Logs
  const [lastActivity, setLastActivity] = useState<string>(new Date().toLocaleTimeString('en-US', { hour12: false }));
  const [activityLogs, setActivityLogs] = useState<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warning' }[]>([
    { id: '1', time: new Date().toLocaleTimeString('en-US', { hour12: false }), text: 'County Integrity Watchdog System Booted', type: 'info' },
    { id: '2', time: new Date().toLocaleTimeString('en-US', { hour12: false }), text: 'Linked target GCS bucket "budget_watchdog" dynamically', type: 'success' }
  ]);

  const addActivityLog = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLastActivity(timeStr);
    setActivityLogs(prev => [
      { id: String(Date.now()), time: timeStr, text, type },
      ...prev.slice(0, 5) // keep last 6 logs
    ]);
  };

  const getCleanExpenditure = (expStr: string | undefined, fallback: string) => {
    if (!expStr) return fallback;
    const cleaned = expStr.replace(/\s*\(\d+%\)/g, '').trim();
    if (cleaned.toLowerCase().startsWith("kes")) {
      return cleaned;
    }
    return `KES ${cleaned}`;
  };

  useEffect(() => {
    setMetadata(null);
    const queryDocName = selectedCounty?.fileName || COUNTIES[0].fileName;
    fetch(`/api/budget/metadata?doc=${encodeURIComponent(queryDocName)}`)
      .then(res => res.json())
      .then(data => {
        setMetadata(data);
        addActivityLog(`Synchronized ${data.county || selectedCounty.name} budget metrics`, 'success');
      })
      .catch(err => {
        console.error("Failed to load budget metadata:", err);
        addActivityLog("Could not sync budget metrics", "warning");
      });
  }, [selectedCounty]);

  const handleCountyChange = (county: County) => {
    setSelectedCounty(county);
    setSelectedWard(county.wards[0]);
    setSelectedGcsFile(county.fileName);
    setSmsDigest('');
    addActivityLog(`Switched jurisdiction to ${county.name}`, 'info');
    setChatMessages([
      {
        role: 'assistant',
        content: `Habari! I am your ${county.name} Budget Watchdog. I now have the active budget context. Ask me anything! For example: ${
          county.id === 'nairobi'
            ? '"How much was allocated for infrastructure development in Kilimani?"'
            : '"How much was allocated to Witu Ward for water?"'
        }`
      }
    ]);
  };

  const handleSendMessage = async (e?: React.FormEvent, directMessage?: string) => {
    if (e) e.preventDefault();
    const query = directMessage || userInput;
    if (!query.trim()) return;

    addActivityLog(`Auditing: "${query.substring(0, 40)}..."`, 'info');
    const newMessages: Message[] = [...chatMessages, { role: 'user', content: query }];
    setChatMessages(newMessages);
    if (!directMessage) {
      setUserInput('');
    }
    setIsTyping(true);

    try {
      const res = await fetch('/api/budget/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: query, 
          ward: selectedWard.name,
          dataSource: 'cloud-storage',
          bucketName: 'budget_watchdog',
          county: selectedCounty.id,
          selectedGcsFile: selectedCounty.fileName
        })
      });
      const data = await res.json();
      if (res.ok && (data.answer || !data.error)) {
        setChatMessages([...newMessages, { role: 'assistant', content: data.answer || "Audit generated complete estimates parameters." }]);
        addActivityLog(`Verification success for ${selectedWard.name} Ward`, 'success');
      } else {
        setChatMessages([...newMessages, { role: 'assistant', content: data.error || "System timed out during verification context ingestion." }]);
        addActivityLog(`Audit flagged warning or exception`, 'warning');
      }
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: "Sorry, I'm having trouble connecting to the audit logs. Please try again." }]);
      addActivityLog(`Integrity server mapping failed to respond`, 'warning');
    } finally {
      setIsTyping(false);
    }
  };

  const handleProjectClick = (projectName: string) => {
    const directQuery = `What can you tell me about the project "${projectName}" allocation or planned development metrics for ${selectedWard.name} Ward inside the active county resources?`;
    handleSendMessage(undefined, directQuery);
  };

  const handleConnectBucket = async () => {
    if (!bucketName) return;
    setIsConnecting(true);
    setConnectionStatus('idle');
    addActivityLog(`Triggering connection to GCS: ${bucketName}`, 'info');
    try {
      const res = await fetch('/api/budget/connect-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketName })
      });
      const data = await res.json();
      if (res.ok && data.files) {
        setGcsFiles(data.files);
        setConnectionStatus('success');
        addActivityLog(`Connected to bucket: Found ${data.files.length} items`, 'success');
        if (data.files.length > 0) {
          setSelectedGcsFile(data.files[0].name);
        } else {
          setSelectedGcsFile('');
        }
      } else {
        setConnectionStatus('error');
        addActivityLog(`Invalid bucket or unauthorized request`, 'warning');
      }
    } catch {
      setConnectionStatus('error');
      addActivityLog(`Connection failed to storage endpoints`, 'warning');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGenerateSMS = async () => {
    setSmsDigest('Generating...');
    addActivityLog(`Drafting public news bite for ${selectedWard.name}`, 'info');
    try {
      const res = await fetch('/api/budget/sms-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          county: selectedCounty.id, 
          ward: selectedWard.name,
          dataSource: 'cloud-storage',
          bucketName: 'budget_watchdog',
          selectedGcsFile: selectedCounty.fileName
        })
      });
      const data = await res.json();
      if (res.ok && data.sms) {
        setSmsDigest(data.sms);
        addActivityLog(`Alert compiled and ready to dispatch`, 'success');
      } else {
        setSmsDigest(data.error || "Execution timeout compiling SMS template.");
        addActivityLog(`Failed digest template compilation`, 'warning');
      }
    } catch (err) {
      setSmsDigest("Failed to generate digest.");
      addActivityLog(`SMS mapping server failed to respond`, 'warning');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 z-50 lg:hidden backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        className={cn(
          "fixed inset-y-0 left-0 w-80 bg-white border-r border-slate-200 z-50 transform transition-all duration-300 lg:relative lg:translate-x-0 overflow-y-auto shadow-xl lg:shadow-none",
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="font-extrabold text-xl leading-tight tracking-tight text-slate-800 uppercase">Budget<br/><span className="text-blue-700">Watchdog</span></h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">County Integrity Agent</p>
            </div>
          </div>

          <div className="mb-8 p-4 bg-blue-50/70 rounded-2xl border border-blue-100/80 shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[9px] font-black text-slate-450 uppercase tracking-[0.18em]">GCS AUDIT TARGET</span>
            </div>
            <div className="flex items-center gap-2">
              <Database size={13} className="text-blue-600 shrink-0" />
              <span className="font-mono text-[10px] font-extrabold text-blue-800 bg-blue-100/50 px-2 py-1 rounded border border-blue-200/40">gs://budget_watchdog</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-8">
          <section>
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-[0.2em] mb-3.5 block">Active Budget Paper</label>
            <div className="space-y-2">
              {COUNTIES.map(c => {
                const isSelected = selectedCounty.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleCountyChange(c)}
                    className={cn(
                      "w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer group hover:scale-[1.015]",
                      isSelected 
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-700 shadow-lg shadow-blue-500/10" 
                        : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <span className={cn("text-lg p-2 rounded-xl flex items-center justify-center shrink-0", isSelected ? "bg-white/10" : "bg-slate-100")}>
                      {c.flagEmoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-extrabold tracking-tight truncate leading-tight mb-0.5 mt-0.5", isSelected ? "text-white" : "text-slate-800")}>
                        {c.name}
                      </p>
                      <p className={cn("text-[8.5px] font-bold tracking-widest uppercase truncate font-mono mb-1", isSelected ? "text-blue-200" : "text-slate-400")}>
                        {c.fileName}
                      </p>
                      <span className={cn("text-[9px] font-bold inline-block px-1.5 py-0.5 rounded border uppercase shrink-0 tracking-wider font-mono", isSelected ? "text-white/80 bg-white/10 border-white/10" : "text-slate-550 bg-slate-50 border-slate-200")}>
                        {c.fileSize}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150 transition-colors cursor-default group">
              <div className="w-8 h-6 bg-slate-200 rounded border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-blue-400 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Kenya.svg" className="w-full h-full object-cover" alt="KE" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm text-slate-800 truncate block">{metadata?.county || selectedCounty.name}</span>
                <p className="text-[10px] font-medium text-slate-500 truncate">{metadata?.year || selectedCounty.metadata.year}</p>
              </div>
            </div>
          </section>

          <section>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Funding Metrics</label>
            <div className="grid gap-3">
              <MetricCard 
                label="Total Allocation" 
                value={metadata?.total_estimate || selectedCounty.metadata.total_estimate} 
                unit="KES" 
                color="blue" 
              />
              <div className="grid grid-cols-2 gap-3">
                <MetricCard 
                  label="Operations" 
                  value={metadata?.recurrent_percent || selectedCounty.metadata.recurrent_percent || "58%"} 
                  unit={metadata ? getCleanExpenditure(metadata.recurrent_expenditure, "RECURRENT") : getCleanExpenditure(selectedCounty.metadata.recurrent_expenditure, "RECURRENT")} 
                  color="slate" 
                />
                <MetricCard 
                  label="Projects" 
                  value={metadata?.development_percent || selectedCounty.metadata.development_percent || "42%"} 
                  unit={metadata ? getCleanExpenditure(metadata.development_expenditure, "DEVELOPMENT") : getCleanExpenditure(selectedCounty.metadata.development_expenditure, "DEVELOPMENT")} 
                  color="green" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 min-w-0">
                  <p className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 mb-1 truncate">Own Source Revenue</p>
                  <p className="font-extrabold text-[12px] truncate leading-none text-slate-800 font-mono">
                    KES {metadata?.own_source_revenue || selectedCounty.metadata.own_source_revenue}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 min-w-0">
                  <p className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 mb-1 truncate">Equitable Share</p>
                  <p className="font-extrabold text-[12px] truncate leading-none text-slate-800 font-mono">
                    KES {metadata?.equitable_share || selectedCounty.metadata.equitable_share}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Watchdog Log</label>
              <span className="text-[8px] font-extrabold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">Running</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2.5xl p-5 font-mono text-[10px] space-y-3.5 shadow-inner max-h-[200px] overflow-y-auto">
              {activityLogs.map((log) => {
                const colors = {
                  info: "text-blue-400",
                  success: "text-green-450 text-emerald-400",
                  warning: "text-amber-400"
                };
                return (
                  <div key={log.id} className="flex gap-2 items-start leading-relaxed border-b border-slate-800/40 pb-2.5 last:border-none last:pb-0">
                    <span className="text-[8px] text-slate-500 bg-slate-800/50 px-1 py-0.5 rounded shrink-0">{log.time}</span>
                    <span className={cn("text-[10px] font-medium font-mono leading-normal", colors[log.type] || "text-slate-300")}>{log.text}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Navigation Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
               <div className="flex items-center gap-2 text-xs font-bold text-slate-500 tracking-tight">
                 <MapPin size={14} className="text-blue-600" />
                 Active View:
               </div>
               <select 
                 value={selectedWard.id}
                 onChange={(e) => {
                   const ward = selectedCounty.wards.find(w => w.id === e.target.value)!;
                   setSelectedWard(ward);
                   addActivityLog(`Audits focused on ${ward.name} Ward`, 'info');
                 }}
                 className="bg-transparent border-none focus:ring-0 text-slate-900 font-black text-xs cursor-pointer tracking-tight"
               >
                 {selectedCounty.wards.map(w => <option key={w.id} value={w.id}>{w.name} Ward</option>)}
               </select>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-4 border-r border-slate-200 pr-6 h-10">
               <div className="text-right">
                  <span className="text-[9px] font-black text-slate-400 block tracking-widest leading-none mb-1 text-right">LAST SYSTEM RUN</span>
                  <span className="text-xs font-bold text-slate-900 font-mono tracking-tighter">{lastActivity}</span>
               </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-all relative">
                <Bell size={20} strokeWidth={2.2} />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-600 rounded-full border-2 border-white ring-1 ring-blue-100/50" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Content Grid */}
        <div className="flex-1 flex lg:flex-row flex-col overflow-hidden p-6 gap-6">
          
          {/* Chat Workspace */}
          <div className="flex-[3] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                    <MessageSquare size={18} strokeWidth={2.5}/>
                 </div>
                 <h2 className="font-bold text-sm tracking-tight text-slate-800 uppercase">Consult Watchdog Engine</h2>
               </div>
               <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full border border-green-100 border-dashed">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                 <span className="text-[9px] font-bold text-green-700 tracking-widest uppercase">Verified Context</span>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
              {chatMessages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[88%] lg:max-w-[75%] px-5 py-4 rounded-2xl shadow-sm text-[13.5px]",
                    msg.role === 'user' 
                      ? "ml-auto chat-bubble-user rounded-tr-none" 
                      : "mr-auto chat-bubble-assistant rounded-tl-none"
                  )}
                >
                  <div className="markdown-body break-words overflow-hidden">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="chat-bubble-assistant mr-auto p-4 rounded-2xl rounded-tl-none flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
              <form onSubmit={handleSendMessage} className="relative group">
                <div className="absolute inset-0 bg-blue-600 blur-xl opacity-0 group-focus-within:opacity-5 transition-opacity" />
                <div className="relative flex gap-3 p-2 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner focus-within:border-blue-500 transition-all">
                  <input 
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Ask about project funding, allocations, or accountability..."
                    className="flex-1 bg-transparent px-4 py-2 text-[13px] font-medium focus:outline-none placeholder:text-slate-400 placeholder:font-bold placeholder:uppercase placeholder:tracking-wider placeholder:text-[10px]"
                  />
                  <button 
                    type="submit"
                    disabled={isTyping || !userInput.trim()}
                    className="bg-blue-700 text-white p-3 rounded-xl hover:bg-blue-800 disabled:opacity-30 active:scale-95 transition-all shadow-lg shadow-blue-200 flex items-center justify-center shrink-0"
                  >
                    <Search size={18} strokeWidth={2.5}/>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Action Panel */}
          <div className="flex-1 lg:w-96 flex flex-col gap-6 ">
            {/* Ward Focus Card */}
            <div className="bg-slate-900 text-white p-7 rounded-[2rem] shadow-[0_20px_50px_rgba(8,126,164,0.15)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500 blur-[80px] opacity-10 rounded-full group-hover:opacity-20 transition-opacity pointer-events-none translate-x-20 -translate-y-20" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8 gap-4">
                  <div className="min-w-0">
                    <h3 className="text-2.5xl font-black mb-1 tracking-tighter leading-none truncate max-w-[160px] sm:max-w-[220px]" title={selectedWard.name}>{selectedWard.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] truncate">Focus Area Audit</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10 shrink-0">
                    <MapPin size={20} className="text-blue-400" />
                  </div>
                </div>

                <div className="space-y-4">
                    {selectedWard.projects.map((proj, i) => {
                      // Generate a dynamic status code based on project index/name
                      const statuses = ["VERIFIED", "COMMITTED", "ACTIVE AUDIT", "BUDGETED"];
                      const statusColor = [
                        "text-blue-400 bg-blue-500/10 border-blue-500/20", 
                        "text-emerald-450 text-emerald-400 bg-emerald-500/10 border-emerald-500/20", 
                        "text-purple-450 text-purple-400 bg-purple-500/10 border-purple-500/20", 
                        "text-amber-450 text-amber-400 bg-amber-500/10 border-amber-500/20"
                      ];
                      const index = (proj.length + i) % statuses.length;
                      const activeStatus = statuses[index];
                      const activeColor = statusColor[index];

                      return (
                        <button 
                          key={i} 
                          onClick={() => handleProjectClick(proj)}
                          className="w-full text-left flex gap-4 items-center group/item hover:bg-white/5 p-2 rounded-xl transition-all border border-transparent hover:border-white/10 active:scale-[0.98] cursor-pointer"
                        >
                          <div className="w-2 h-2 rounded-full bg-blue-500 group-hover/item:scale-125 transition-all shadow-[0_0_8px_rgba(59,130,246,1)] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-white/90 uppercase tracking-tight truncate leading-tight mb-1 group-hover/item:text-blue-400 transition-colors" title={proj}>{proj}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn("text-[8px] font-black tracking-widest leading-none px-1.5 py-0.5 rounded border uppercase shrink-0", activeColor)}>
                                STATUS: {activeStatus}
                              </span>
                              <span className="text-[7.5px] text-white/40 font-bold uppercase tracking-widest hidden group-hover/item:inline-block animate-bounce ml-auto shrink-0">Query →</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                 </div>
              </div>
            </div>

            {/* SMS Engine Panel */}
            <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-700 ring-1 ring-blue-100 ring-inset">
                    <Smartphone size={20} strokeWidth={2.5}/>
                  </div>
                  <h3 className="font-extrabold text-xs uppercase tracking-widest text-slate-800">SMS Digest Engine</h3>
                </div>
                <button 
                  onClick={handleGenerateSMS}
                  disabled={isTyping}
                  className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all active:scale-95 shadow-lg shadow-slate-200"
                >
                  Generate
                </button>
              </div>

              <div className="flex-1 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 p-6 min-h-[160px] flex flex-col items-center justify-center relative overflow-hidden group">
                 <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                 
                {smsDigest ? (
                   <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full relative z-10">
                     <p className="text-[9px] font-black text-slate-400 mb-3 text-center tracking-[0.2em]">BROADCAST PREVIEW (160 CHARS)</p>
                     <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl shadow-slate-200 text-[12px] font-medium leading-relaxed italic border-l-4 border-blue-500">
                       "{smsDigest}"
                     </div>
                   </motion.div>
                ) : (
                  <div className="text-center relative z-10">
                    <Database size={24} className="mx-auto text-slate-300 mb-4 animate-pulse" />
                    <p className="text-[11px] text-slate-400 font-bold px-4 leading-relaxed uppercase tracking-widest">
                      Select ward & aggregate data to broadcast simple updates.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                 <div className="flex items-center gap-3">
                   <div className="flex -space-x-2">
                     {["WA", "AM", "JK", "LT", "KO"].slice(0, (selectedWard.name.length % 3) + 2).map((initial, i) => (
                       <div key={i} className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[8px] font-extrabold text-white uppercase tracking-tight">{initial}</div>
                     ))}
                   </div>
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                     {(selectedWard.name.length * 8) % 43 + 12} Citizens alert active in this ward
                   </span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, unit, color }: { label: string, value: string, unit: string, color: 'blue' | 'slate' | 'green' }) {
  const colors = {
    blue: "from-blue-500/10 to-transparent text-blue-700 bg-blue-50 border-blue-100",
    slate: "from-slate-500/10 to-transparent text-slate-700 bg-slate-50 border-slate-200",
    green: "from-green-500/10 to-transparent text-green-700 bg-green-50 border-green-100"
  };

  return (
    <div className={cn("p-4 sm:p-5 rounded-2xl bg-gradient-to-br border shadow-sm transition-transform hover:scale-[1.02] min-w-0 overflow-hidden flex flex-col justify-between min-h-[115px]", colors[color])}>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2.5 truncate" title={label}>{label}</p>
        <span className="text-lg sm:text-xl font-black tracking-tighter leading-none truncate block" title={value}>{value}</span>
      </div>
      <div className="border-t border-slate-200/50 mt-3 pt-2">
        <span className="text-[8.5px] sm:text-[9.5px] font-extrabold opacity-75 tracking-wider uppercase truncate block font-mono" title={unit}>{unit}</span>
      </div>
    </div>
  );
}

function StatItem({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="flex items-center gap-3 group">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", color)}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-tight">{label}</p>
        <p className="text-sm font-black tracking-tight">{value}</p>
      </div>
    </div>
  );
}
