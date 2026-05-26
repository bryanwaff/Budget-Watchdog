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
  
  // Data Source State
  const [dataSource, setDataSource] = useState<'internal' | 'cloud-storage'>('internal');
  const [bucketName, setBucketName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [gcsFiles, setGcsFiles] = useState<{ name: string; size: string; contentType: string; updated: string }[]>([]);
  const [selectedGcsFile, setSelectedGcsFile] = useState<string>('');

  useEffect(() => {
    setMetadata(null);
    fetch(`/api/budget/metadata?county=${selectedCounty.id}`)
      .then(res => res.json())
      .then(setMetadata);
  }, [selectedCounty]);

  const handleCountyChange = (county: County) => {
    setSelectedCounty(county);
    setSelectedWard(county.wards[0]);
    setSmsDigest('');
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const newMessages: Message[] = [...chatMessages, { role: 'user', content: userInput }];
    setChatMessages(newMessages);
    setUserInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/budget/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userInput, 
          ward: selectedWard.name,
          dataSource,
          bucketName: dataSource === 'cloud-storage' ? bucketName : undefined,
          county: selectedCounty.id,
          selectedGcsFile: dataSource === 'cloud-storage' ? selectedGcsFile : undefined
        })
      });
      const data = await res.json();
      setChatMessages([...newMessages, { role: 'assistant', content: data.answer || data.error }]);
    } catch (err) {
      setChatMessages([...newMessages, { role: 'assistant', content: "Sorry, I'm having trouble connecting to the audit logs. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleConnectBucket = async () => {
    if (!bucketName) return;
    setIsConnecting(true);
    setConnectionStatus('idle');
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
        if (data.files.length > 0) {
          setSelectedGcsFile(data.files[0].name);
        } else {
          setSelectedGcsFile('');
        }
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGenerateSMS = async () => {
    setSmsDigest('Generating...');
    try {
      const res = await fetch('/api/budget/sms-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          county: selectedCounty.id, 
          ward: selectedWard.name,
          dataSource,
          bucketName: dataSource === 'cloud-storage' ? bucketName : undefined,
          selectedGcsFile: dataSource === 'cloud-storage' ? selectedGcsFile : undefined
        })
      });
      const data = await res.json();
      setSmsDigest(data.sms || data.error);
    } catch (err) {
      setSmsDigest("Failed to generate digest.");
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

          <div id="data-source-config" className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Data Infrastructure</label>
            
            <div className="flex p-1 bg-slate-200 rounded-lg mb-4">
              <button 
                onClick={() => setDataSource('internal')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[11px] font-bold transition-all",
                  dataSource === 'internal' ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <HardDrive size={14} /> Internal
              </button>
              <button 
                onClick={() => setDataSource('cloud-storage')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[11px] font-bold transition-all",
                  dataSource === 'cloud-storage' ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Cloud size={14} /> GCS Bucket
              </button>
            </div>

            {dataSource === 'cloud-storage' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div className="relative">
                  <input 
                    type="text"
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value)}
                    placeholder="gs://my-budget-pdfs"
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                  />
                  {connectionStatus === 'success' && <CheckCircle2 size={16} className="absolute right-3 top-2.5 text-green-500" />}
                </div>
                <button 
                  onClick={handleConnectBucket}
                  disabled={isConnecting || !bucketName}
                  className="w-full bg-blue-700 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-blue-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-sm cursor-pointer"
                >
                  {isConnecting ? 'Connecting...' : 'Synchronize Source'}
                </button>

                {connectionStatus === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 pt-3 border-t border-slate-200/60"
                  >
                    <span className="text-[10px] font-black text-slate-450 uppercase tracking-[0.15em] block mb-2">Source Documents ({gcsFiles.length})</span>
                    {gcsFiles.length === 0 ? (
                      <div className="p-2 border border-dashed border-slate-200 rounded-lg bg-orange-50 text-orange-850 text-[10px] leading-relaxed">
                        No compatible files found (.pdf, .txt, .json). Add some files to your bucket.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {gcsFiles.map((f) => {
                          const isSelected = selectedGcsFile === f.name;
                          return (
                            <button
                              key={f.name}
                              onClick={() => setSelectedGcsFile(f.name)}
                              className={cn(
                                "w-full text-left p-2 rounded-lg border transition-all flex items-start gap-2.5 cursor-pointer group",
                                isSelected 
                                  ? "bg-blue-500 text-white border-blue-600 font-bold shadow-md animate-none"
                                  : "bg-white border-slate-200/65 hover:border-slate-350 text-slate-705"
                              )}
                            >
                              <FileText size={13} className={cn("mt-0.5 shrink-0 uppercase", isSelected ? "text-blue-100" : "text-slate-400 group-hover:text-slate-600")} />
                              <div className="min-w-0 flex-1">
                                <p className={cn("text-[11px] truncate leading-tight", isSelected ? "text-white" : "text-slate-900 font-semibold")} title={f.name}>
                                  {f.name}
                                </p>
                                <p className={cn("text-[9px] font-medium mt-0.5", isSelected ? "text-blue-100" : "text-slate-400")}>
                                  {f.size}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        <div className="px-6 pb-8 space-y-8">
          <section>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Regional Jurisdiction</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner mb-4">
              {COUNTIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleCountyChange(c)}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-2 rounded-lg text-center transition-all cursor-pointer",
                    selectedCounty.id === c.id 
                      ? "bg-white text-blue-700 shadow-sm font-extrabold border border-slate-200/50" 
                      : "text-slate-550 hover:text-slate-800 font-bold"
                  )}
                >
                  <span className="text-xs">{c.id === 'lamu' ? '🏝️' : '🏙️'}</span>
                  <span className="text-[9px] leading-tight tracking-tight uppercase mt-0.5">{c.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors cursor-default group">
              <div className="w-8 h-6 bg-slate-200 rounded border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-blue-400 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Kenya.svg" className="w-full h-full object-cover" alt="KE" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-800">{metadata?.county || 'Loading...'} County</span>
                <p className="text-[10px] font-medium text-slate-500">{metadata ? `${metadata.year}` : 'Resource Dashboard'}</p>
              </div>
            </div>
          </section>

          <section>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Funding Metrics</label>
            <div className="grid gap-3">
              <MetricCard label="Total Allocation" value={metadata?.total_estimate ? `${metadata.total_estimate}` : '...'} unit="KES" color="blue" />
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Operations" value={metadata?.recurrent_percent || "58%"} unit="RECURRENT" color="slate" />
                <MetricCard label="Projects" value={metadata?.development_percent || "42%"} unit="DEVELOPMENT" color="green" />
              </div>
            </div>
          </section>

          <section>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Official Gazette Feed</label>
            <div className="bg-amber-50 rounded-2xl border border-amber-100/50 p-5 relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-200/20 rounded-full blur-xl group-hover:bg-amber-200/40 transition-all" />
              <div className="flex items-center gap-2 text-amber-800 font-black text-[10px] tracking-tighter mb-2 relative z-10">
                <AlertCircle size={14} strokeWidth={2.5} />
                MONITORING SYSTEM ACTIVE
              </div>
              <p className="text-[11px] text-amber-700/80 leading-relaxed font-semibold italic relative z-10">
                Scanning notices for amendments... No critical budget variances found in latest 24/25 gazette cycle.
              </p>
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
                 onChange={(e) => setSelectedWard(selectedCounty.wards.find(w => w.id === e.target.value)!)}
                 className="bg-transparent border-none focus:ring-0 text-slate-900 font-black text-xs cursor-pointer tracking-tight"
               >
                 {selectedCounty.wards.map(w => <option key={w.id} value={w.id}>{w.name} Ward</option>)}
               </select>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-4 border-r border-slate-200 pr-6 h-10">
               <div className="text-right">
                  <span className="text-[9px] font-black text-slate-400 block tracking-widest leading-none mb-1 text-right">AUDIT TIMESTAMP</span>
                  <span className="text-xs font-bold text-slate-900 font-mono tracking-tighter">16 MAY 2026</span>
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
                  <div className="markdown-body">
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
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black mb-1 tracking-tighter leading-none">{selectedWard.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Focus Area Audit</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10">
                    <MapPin size={20} className="text-blue-400" />
                  </div>
                </div>

                <div className="space-y-5">
                   {selectedWard.projects.map((proj, i) => (
                    <div key={i} className="flex gap-4 items-center group/item hover:translate-x-1 transition-transform">
                      <div className="w-2 h-2 rounded-full bg-blue-500 group-hover/item:scale-125 transition-transform shadow-[0_0_8px_rgba(59,130,246,1)]" />
                      <div>
                        <p className="text-xs font-black text-white/90 uppercase tracking-tight leading-none mb-1.5">{proj}</p>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={10} className="text-blue-400/60" />
                          <span className="text-[9px] text-slate-500 font-bold tracking-widest leading-none">ALLOCATION_STATUS: VERIFIED</span>
                        </div>
                      </div>
                    </div>
                  ))}
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
                     {[1,2,3].map(i => (
                       <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">WA</div>
                     ))}
                   </div>
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">12 Citizens active in this ward</span>
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
    <div className={cn("p-5 rounded-2xl bg-gradient-to-br border shadow-sm transition-transform hover:scale-[1.02]", colors[color])}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black tracking-tighter leading-none">{value}</span>
        <span className="text-[10px] font-bold opacity-60">{unit}</span>
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
