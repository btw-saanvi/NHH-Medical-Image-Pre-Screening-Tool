import { useState, useEffect, useRef, useCallback } from "react";
import UploadZone from "./UploadZone";
import ResultCard from "./ResultCard";
import Dashboard from "./Dashboard";
import SiteEffects from "./Effects";
import { getHealth, getCases, uploadScan } from "./api";
import ModelPerformanceCard     from './components/settings/ModelPerformanceCard';
import SupportedDiseasesCard    from './components/settings/SupportedDiseasesCard';
import ConfidenceThresholdSlider from './components/settings/ConfidenceThresholdSlider';
import TriageAlertSettings      from './components/settings/TriageAlertSettings';
import ReportSettingsCard       from './components/settings/ReportSettingsCard';
import SystemLogsPanel          from './components/settings/SystemLogsPanel';
import APIHealthCard            from './components/settings/APIHealthCard';
import ModelInfoCard            from './components/settings/ModelInfoCard';
import StorageUsageCard         from './components/settings/StorageUsageCard';
import "./App.css";

const NAV_ITEMS = [
  {
    id: "landing",
    label: "Overview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "analyze",
    label: "Analyze Scan",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3h6l2 3h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 13 4.68a1.65 1.65 0 0 0 1 1.51V19.4a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const LOADING_STEPS = [
  "Pre-processing Imaging Data",
  "Executing DenseNet-121 Inference",
  "Mapping Pathological Activation",
  "Assigning Triage Priority",
];

function LoadingSpinner({ loadingStep }) {
  return (
    <div className="loading-wrap">
      <div className="loading-spinner-circle"></div>
      <div className="loading-steps-list">
        {LOADING_STEPS.map((step, i) => (
          <div key={i} className={`loading-step-item ${i <= loadingStep ? 'active' : ''}`}>
            <span className="step-check">
              {i < loadingStep ? '✓' : i === loadingStep ? '•' : ''}
            </span>
            {step}
          </div>
        ))}
      </div>
      <div className="loading-progress-container">
        <div className="loading-progress-bar" style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}></div>
      </div>
    </div>
  );
}

function LandingPage({ onStart }) {
  return (
    <div className="landing-page animate-fade-in">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <span className="hero-tag">AI-Assisted Diagnostics</span>
          <h1 className="hero-title">Early Detection for Faster Diagnosis</h1>
          <p className="hero-description">
            Upload medical scans, detect abnormalities, highlight suspicious regions, and prioritize urgent cases in seconds with our clinical-grade pre-screening toolkit.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => onStart('analyze')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Scan
            </button>
            <button className="btn-secondary" onClick={() => onStart('dashboard')}>
              View Dashboard
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-card">
            <div className="visual-header">
              <div className="v-dot"></div>
              <div className="v-line"></div>
            </div>
            <div className="visual-body">
              <div className="v-image-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="v-stats">
                <div className="v-stat-row"><div className="v-s-lbl"></div><div className="v-s-val"></div></div>
                <div className="v-stat-row"><div className="v-s-lbl"></div><div className="v-s-val"></div></div>
              </div>
            </div>
          </div>
          <div className="visual-badge">
             <div className="v-b-icon">AI</div>
             <div>
               <div className="v-b-txt">94% Confidence</div>
               <div className="v-b-sub">DenseNet-121 model</div>
             </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-grid">
         <div className="feature-card">
           <div className="feat-icon blue">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
               <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
             </svg>
           </div>
           <h3>Abnormality Detection</h3>
           <p>Pre-trained models detect patterns across thousands of validated scans to assist in identification.</p>
         </div>
         <div className="feature-card">
           <div className="feat-icon green">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
               <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
           </div>
           <h3>Grad-CAM Heatmaps</h3>
           <p>Explainable AI highlights the regions that influenced the diagnostic suggestion.</p>
         </div>
         <div className="feature-card">
           <div className="feat-icon orange">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
               <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
             </svg>
           </div>
           <h3>Smart Triage</h3>
           <p>Case prioritization based on severity, allowing radiologists to focus on critical cases first.</p>
         </div>
      </section>

      {/* Impact Stats */}
      <section className="impact-section">
        <div className="impact-card">
          <div className="impact-val">40%</div>
          <div className="impact-lbl">Faster Analysis Time</div>
          <p>Decrease time to preliminary findings in emergency imaging.</p>
        </div>
        <div className="impact-card">
          <div className="impact-val">25%</div>
          <div className="impact-lbl">Workload Reduction</div>
          <p>Automated pre-screening filters critical findings for radiologists.</p>
        </div>
        <div className="impact-card">
          <div className="impact-val">15%</div>
          <div className="impact-lbl">Improved Accuracy</div>
          <p>Secondary validation layer during the diagnostic workflow.</p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-banner">
        <h2>Ready to transform clinical efficiency?</h2>
        <p>Join healthcare institutions using Radio-Matic to augment diagnostic precision.</p>
        <div className="cta-actions">
           <button className="btn-white" onClick={() => onStart('analyze')}>Get Started Now</button>
           <button className="btn-outline-white">Contact Sales</button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-cols">
          <div className="f-col"><h4>Product</h4><p>Features</p><p>Security</p></div>
          <div className="f-col"><h4>Resources</h4><p>Documentation</p><p>API Docs</p></div>
          <div className="f-col"><h4>Company</h4><p>About Us</p><p>Compliance</p></div>
        </div>
        <div className="f-bottom">© 2026 Radio-Matic Technologies. All clinical results require radiologist validation.</div>
      </footer>
    </div>
  );
}

function HistoryPage({ onViewCase }) {
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCases({
        page,
        limit: 24,
        priority: filterPriority !== 'All' ? filterPriority : undefined,
        search: search || undefined,
        sort: '-createdAt',
      });
      setCases(res.cases || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error('History fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterPriority, search]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const exportCSV = () => {
    const header = 'Case ID,Patient ID,Disease,Prediction,Confidence,Priority,Scan Type,Date\n';
    const rows = cases.map(h =>
      `${h.caseId},${h.patientId || ''},"${h.disease}",${h.prediction},${h.confidence}%,${h.priority},${h.scanType || 'X-Ray'},${h.timestamp ? new Date(h.timestamp).toLocaleDateString() : ''}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'radio-matic-history.csv'; a.click();
  };

  return (
    <div className="history-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Digital Archive</h2>
          <p className="page-desc">Historical data pulled from MongoDB — {pagination.total} total records</p>
        </div>
        <button className="btn-secondary sm" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      <div className="history-search-row">
        <div className="search-input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search case ID, disease, patient…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="filter-select" value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1); }}>
          <option value="All">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {loading ? (
        <div className="table-loading"><div className="loading-spinner-circle sm"></div><span>Loading from database…</span></div>
      ) : (
        <>
          <div className="archive-grid">
            {cases.map(h => (
              <div key={h.caseId} className="archive-card" onClick={() => onViewCase?.(h)}>
                 <div className="arch-header">
                   <span className="arch-id">{h.caseId}</span>
                   <span className={`priority-dot ${h.priority?.toLowerCase()}`}></span>
                 </div>
                 <div className="arch-body">
                   <div className="arch-disease">{h.disease || 'No Finding'}</div>
                   <div className="arch-meta">{h.prediction} • {h.confidence}% conf.</div>
                   {(h.patientName || h.patientId) && (
                     <div className="arch-meta">
                       👤 {h.patientName || h.patientId}
                       {h.patientAge ? ` · ${h.patientAge}y` : ''}
                     </div>
                   )}
                   {h.scanType && <div className="arch-meta">{h.scanType}</div>}
                   {h.source === 'nih_seed' && <div className="arch-meta" style={{color:'#64748b'}}>NIH ChestX-ray14 record</div>}
                 </div>
                 <div className="arch-footer">
                   <span>{h.timestamp ? new Date(h.timestamp).toLocaleDateString() : 'Today'}</span>
                   <button className="text-btn">View Result</button>
                 </div>
              </div>
            ))}
            {cases.length === 0 && <div className="empty-archive">No records found.</div>}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination-row">
              <button className="btn-secondary sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="page-info">Page {page} / {pagination.totalPages}</span>
              <button className="btn-secondary sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function SettingsPage({ aiHealth, onRefreshHealth }) {
  const [tab, setTab] = useState('system');

  const uptimeFmt = aiHealth.uptime
    ? `${Math.floor(aiHealth.uptime / 3600)}h ${Math.floor((aiHealth.uptime % 3600) / 60)}m`
    : 'N/A';

  const TABS = [
    { id: 'system',  label: 'System' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'config',  label: 'Config' },
    { id: 'logs',    label: 'Logs' },
  ];

  return (
    <div className="settings-page animate-fade-in">
      {/* Compact header */}
      <div className="sp-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-desc">System diagnostics &amp; clinical configuration</p>
        </div>
        <button className="btn-secondary sm" onClick={onRefreshHealth}>↻ Refresh</button>
      </div>

      {/* Quick status strip */}
      <div className="sp-status-strip">
        <div className={`sp-status-pill ${aiHealth.backend ? 'ok' : 'err'}`}>
          <span className="sp-pill-dot" /> Backend {aiHealth.backend ? 'Online' : 'Offline'}
        </div>
        <div className={`sp-status-pill ${aiHealth.ai === 'online' ? 'ok' : 'err'}`}>
          <span className="sp-pill-dot" /> AI {aiHealth.ai === 'online' ? 'Connected' : 'Offline'}
        </div>
        <div className="sp-status-pill ok">
          <span className="sp-pill-dot" /> {aiHealth.model || 'DenseNet-121'}
        </div>
        {aiHealth.uptime > 0 && (
          <div className="sp-status-pill ok">
            <span className="sc-uptime-dot" /> {uptimeFmt}
          </div>
        )}
        <button className="sp-conn-btn" onClick={onRefreshHealth}>Run Connectivity Test</button>
      </div>

      {/* Tab bar */}
      <div className="sp-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`sp-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: System */}
      {tab === 'system' && (
        <div className="sp-tab-content">
          <div className="settings-grid-2">
            <APIHealthCard aiHealth={aiHealth} />
            <StorageUsageCard />
          </div>
        </div>
      )}

      {/* Tab: Metrics */}
      {tab === 'metrics' && (
        <div className="sp-tab-content">
          <ModelPerformanceCard />
          <div className="settings-grid-2" style={{ marginTop: 14 }}>
            <ModelInfoCard />
            <SupportedDiseasesCard />
          </div>
        </div>
      )}

      {/* Tab: Config */}
      {tab === 'config' && (
        <div className="sp-tab-content">
          <div className="settings-grid-3">
            <ConfidenceThresholdSlider />
            <TriageAlertSettings />
            <ReportSettingsCard />
          </div>
        </div>
      )}

      {/* Tab: Logs */}
      {tab === 'logs' && (
        <div className="sp-tab-content">
          <SystemLogsPanel />
        </div>
      )}
    </div>
  );
}

function Toast({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast-card toast-${t.type} animate-slide-in`}>
          <div className="toast-msg-body">
            <strong>{t.title}</strong>
            <p>{t.message}</p>
          </div>
          <button className="toast-dismiss" onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [page, setPage] = useState("landing");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cases, setCases] = useState([]);
  const [aiHealth, setAiHealth] = useState({ backend: false, ai: 'offline', model: '', uptime: 0 });
  const [toasts, setToasts] = useState([]);
  const [patientInfo, setPatientInfo] = useState({ name: '', dob: '', id: '' });
  const loadingTimerRef = useRef(null);
  const toastIdRef = useRef(0);

  const addToast = useCallback((title, message = '', type = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const firstConnectRef = useRef(true);

  const checkHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setAiHealth({
        backend: true,
        ai: data.aiService || 'offline',
        model: data.model || 'DenseNet-121',
        uptime: data.uptime || 0,
        database: data.database || 'disconnected',
      });
      if (firstConnectRef.current) {
        addToast("System Ready", `Radio-Matic server online · DB: ${data.database}`);
        firstConnectRef.current = false;
      }
    } catch {
      setAiHealth({ backend: false, ai: 'offline', model: '', uptime: 0, database: 'disconnected' });
    }
  }, [addToast]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleFileSelect = (selected) => {
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setResult(null);

    loadingTimerRef.current = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        clearInterval(loadingTimerRef.current);
        return prev;
      });
    }, 1200);

    try {
      const newResult = await uploadScan(file, patientInfo);


      clearInterval(loadingTimerRef.current);
      setLoadingStep(LOADING_STEPS.length - 1);
      await new Promise(r => setTimeout(r, 800));

      setResult(newResult);
      // Still track live cases in memory for the dashboard real-time merge
      setCases(prev => [{ ...newResult, isNew: true, timestamp: newResult.timestamp || new Date().toISOString() }, ...prev]);
      addToast("Analysis Complete", `Saved to DB — Case #${newResult.caseId}`, "success");
      checkHealth();
    } catch (err) {
      clearInterval(loadingTimerRef.current);
      const msg = err.response?.data?.error || err.message || "Analysis failed. Check AI service.";
      setError(msg);
      addToast("Error", msg, "error");
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handleViewCase = (caseData) => {
    setResult(caseData);
    setPage("analyze");
  };

  const handlePatientChange = (field, val) => setPatientInfo(prev => ({ ...prev, [field]: val }));

  return (
    <div className="app-shell stretch-design">
      <SiteEffects />
      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${sidebarOpen ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">M</div>
          <span className="brand-name">Radio-Matic</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setResult(null); }}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
           <div className={`status-pill ${aiHealth.ai === 'online' ? 'active' : 'inactive'}`}>
             {aiHealth.ai === 'online' ? 'AI Sync Active' : 'Offline'}
           </div>
        </div>
      </aside>

      <div className="app-main">
        {/* Top Header */}
        <header className="app-header">
           <div className="header-breadcrumbs">
             <span>Portal</span>
             <span className="sep">/</span>
             <span className="active">{NAV_ITEMS.find(n => n.id === page)?.label}</span>
           </div>
        </header>

        <main className="content-area">
          {page === "landing" && <LandingPage onStart={(p) => setPage(p)} />}

          {page === "analyze" && (
            <div className="scan-upload-container animate-fade-in">
              <div className="portal-header">
                <h2 className="portal-title">{result ? 'Diagnostic Analysis' : 'Analyze Medical Scan'}</h2>
                <p className="portal-desc">Upload clinical imaging data for automated pre-screening</p>
              </div>

              {!result ? (
                <div className="upload-portal-grid">
                  <div className="portal-col left">
                    <div className="form-card">
                      <div className="card-lbl">Patient Information</div>
                      <div className="input-group">
                        <label>Patient ID</label>
                        <input type="text" placeholder="e.g. PX-402" value={patientInfo.id} onChange={e => handlePatientChange('id', e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label>Display Name</label>
                        <input type="text" placeholder="Patient Full Name" value={patientInfo.name} onChange={e => handlePatientChange('name', e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label>Date of Birth</label>
                        <input type="date" value={patientInfo.dob} onChange={e => handlePatientChange('dob', e.target.value)} />
                      </div>
                    </div>

                    {file && (
                      <button className={`btn-primary full-width ${loading ? 'loading' : ''}`} onClick={handleAnalyze} disabled={loading}>
                        {loading ? 'Analyzing...' : 'Start AI Screening'}
                      </button>
                    )}
                  </div>
                  <div className="portal-col right">
                    <UploadZone onFileSelect={handleFileSelect} file={file} preview={preview} />
                    {loading && <LoadingSpinner loadingStep={loadingStep} />}
                  </div>
                </div>
              ) : (
                <div className="results-portal-view animate-fade-in">
                  <ResultCard result={result} preview={preview} onBack={() => setResult(null)} />
                </div>
              )}
            </div>
          )}

          {page === "dashboard" && <Dashboard newResult={result} preview={preview} liveCases={cases} />}
          {page === "history" && <HistoryPage onViewCase={handleViewCase} />}
          {page === "settings" && <SettingsPage aiHealth={aiHealth} onRefreshHealth={checkHealth} />}
        </main>
      </div>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;