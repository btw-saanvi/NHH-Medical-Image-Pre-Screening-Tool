import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import UploadZone from "./UploadZone";
import ResultCard from "./ResultCard";
import Dashboard from "./Dashboard";
import "./App.css";

const BACKEND_URL = "http://localhost:5000";

const NAV_ITEMS = [
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
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const LOADING_STEPS = [
  "Preprocessing image",
  "Running DenseNet-121 model",
  "Generating Grad-CAM heatmap",
  "Assigning clinical priority",
];

function LoadingSpinner({ loadingStep }) {
  return (
    <div className="loading-wrap">
      <div className="loading-orbital">
        <div className="orbital-ring ring-1"></div>
        <div className="orbital-ring ring-2"></div>
        <div className="orbital-ring ring-3"></div>
        <div className="orbital-core">AI</div>
      </div>
      <div className="loading-steps">
        {LOADING_STEPS.map((step, i) => (
          <div key={i} className={`loading-step ${i <= loadingStep ? 'active' : ''} ${i === loadingStep ? 'current' : ''} ${i < loadingStep ? 'done' : ''}`}>
            <span className="step-dot">
              {i < loadingStep && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </span>
            {step}
          </div>
        ))}
      </div>
      <div className="loading-progress-bar">
        <div className="loading-progress-fill" style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}></div>
      </div>
    </div>
  );
}

function HistoryPage({ cases, onViewCase }) {
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterPrediction, setFilterPrediction] = useState('All');

  const filtered = cases.filter(h => {
    const matchSearch = !search || h.caseId?.toLowerCase().includes(search.toLowerCase()) || h.disease?.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === 'All' || h.priority === filterPriority;
    const matchPred = filterPrediction === 'All' || h.prediction === filterPrediction;
    return matchSearch && matchPriority && matchPred;
  });

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Case ID', 'Date', 'Prediction', 'Disease', 'Confidence', 'Priority', 'Model'];
    const rows = filtered.map(h => [
      h.caseId, h.timestamp || '-', h.prediction, h.disease || '-',
      `${h.confidence}%`, h.priority, h.model || '-'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medai-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="history-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Scan History</h2>
          <p className="page-desc">All previously analyzed medical images ({filtered.length} results)</p>
        </div>
        <div className="header-actions">
          <button className="hdr-btn secondary" onClick={exportCSV}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="history-filters">
        <div className="search-filter">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by case ID or disease..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="All">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select className="filter-select" value={filterPrediction} onChange={e => setFilterPrediction(e.target.value)}>
          <option value="All">All Predictions</option>
          <option value="Normal">Normal</option>
          <option value="Abnormal">Abnormal</option>
        </select>
      </div>

      <div className="history-table-wrap">
        <div className="table-head">
          <span>Case ID</span>
          <span>Date</span>
          <span>Disease</span>
          <span>Prediction</span>
          <span>Confidence</span>
          <span>Priority</span>
          <span>Model</span>
          <span>Action</span>
        </div>
        <div className="table-body">
          {filtered.length === 0 ? (
            <div className="empty-history">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3h6l2 3h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              </svg>
              <p>{cases.length === 0 ? 'No scans analyzed yet. Upload an image to start.' : 'No results match your filters.'}</p>
            </div>
          ) : (
            filtered.map((h) => (
              <div key={h.caseId} className={`table-row ${h.isNew ? 'row-new' : ''}`}>
                <span className="case-id">{h.caseId}</span>
                <span className="time-text">{h.timestamp ? new Date(h.timestamp).toLocaleDateString() : '-'}</span>
                <span className="disease-text">{h.disease || '-'}</span>
                <span className={`prediction-text ${h.prediction === 'Abnormal' ? 'abnormal' : 'normal'}`}>
                  {h.prediction === 'Abnormal' ? '⚠ ' : '✓ '}{h.prediction}
                </span>
                <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{h.confidence}%</span>
                <span>
                  <span className={`dash-priority-badge ${h.priority?.toLowerCase()}`}>{h.priority}</span>
                </span>
                <span className="model-tag">{h.model ? h.model.replace('mock (AI service offline)', 'Mock').replace('DenseNet-121 (CheXpert)', 'DenseNet') : '-'}</span>
                <span>
                  <button className="review-btn" onClick={() => onViewCase?.(h)}>View</button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ aiHealth, onRefreshHealth }) {
  return (
    <div className="settings-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-desc">AI model configuration and system preferences</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* AI Service Status */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
            <span>AI Service Status</span>
          </div>
          <div className="settings-card-body">
            <div className="status-row">
              <span className="status-label">Backend Server</span>
              <span className={`status-value ${aiHealth.backend ? 'online' : 'offline'}`}>
                <span className="status-indicator"></span>
                {aiHealth.backend ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">AI Model Service</span>
              <span className={`status-value ${aiHealth.ai === 'online' ? 'online' : 'offline'}`}>
                <span className="status-indicator"></span>
                {aiHealth.ai === 'online' ? 'Online' : 'Offline (Mock Mode)'}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Model</span>
              <span className="status-value model-name-val">{aiHealth.model || 'DenseNet-121 (CheXpert)'}</span>
            </div>
            <div className="status-row">
              <span className="status-label">Grad-CAM</span>
              <span className={`status-value ${aiHealth.ai === 'online' ? 'online' : 'offline'}`}>
                <span className="status-indicator"></span>
                {aiHealth.ai === 'online' ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Uptime</span>
              <span className="status-value">{aiHealth.uptime ? `${Math.floor(aiHealth.uptime / 60)}m ${aiHealth.uptime % 60}s` : '-'}</span>
            </div>
            <button className="settings-btn" onClick={onRefreshHealth}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Refresh Status
            </button>
          </div>
        </div>

        {/* Supported Pathologies */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>Detectable Pathologies</span>
          </div>
          <div className="settings-card-body">
            <div className="pathology-tags">
              {[
                "Atelectasis", "Cardiomegaly", "Consolidation", "Edema",
                "Effusion", "Emphysema", "Fracture", "Lung Lesion",
                "Lung Opacity", "Nodule", "Pleural Effusion",
                "Pneumonia", "Pneumothorax"
              ].map(p => (
                <span key={p} className="pathology-tag">{p}</span>
              ))}
            </div>
          </div>
        </div>

        {/* API Endpoints */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>API Endpoints</span>
          </div>
          <div className="settings-card-body">
            <div className="endpoint-row">
              <span className="endpoint-method get">GET</span>
              <code className="endpoint-url">/health</code>
              <span className="endpoint-desc">Service health check</span>
            </div>
            <div className="endpoint-row">
              <span className="endpoint-method post">POST</span>
              <code className="endpoint-url">/upload</code>
              <span className="endpoint-desc">Upload and analyze image</span>
            </div>
            <div className="endpoint-row">
              <span className="endpoint-method get">GET</span>
              <code className="endpoint-url">/cases</code>
              <span className="endpoint-desc">Get case statistics</span>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>About MedAI</span>
          </div>
          <div className="settings-card-body">
            <div className="about-info">
              <p><strong>MedAI Pre-Screening Tool</strong> v1.0.0</p>
              <p className="about-desc">AI-powered medical image analysis using TorchXRayVision's DenseNet-121 model trained on CheXpert data. Features real-time Grad-CAM explainability, clinical priority assignment, and automated triage recommendations.</p>
              <div className="tech-stack">
                <span className="tech-tag">React</span>
                <span className="tech-tag">Node.js</span>
                <span className="tech-tag">FastAPI</span>
                <span className="tech-tag">PyTorch</span>
                <span className="tech-tag">Grad-CAM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("analyze");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cases, setCases] = useState([]);
  const [aiHealth, setAiHealth] = useState({ backend: false, ai: 'offline', model: '', uptime: 0 });
  const loadingTimerRef = useRef(null);

  // Check AI health on mount
  const checkHealth = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/health`, { timeout: 3000 });
      setAiHealth({
        backend: true,
        ai: res.data.aiService || 'offline',
        model: res.data.model || 'DenseNet-121',
        uptime: res.data.uptime || 0,
      });
    } catch {
      setAiHealth({ backend: false, ai: 'offline', model: '', uptime: 0 });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Re-check every 30s
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

    // Animate loading steps sequentially
    loadingTimerRef.current = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        clearInterval(loadingTimerRef.current);
        return prev;
      });
    }, 800);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await axios.post(`${BACKEND_URL}/upload`, formData, { timeout: 60000 });

      // Ensure all loading steps finish before showing result
      clearInterval(loadingTimerRef.current);
      setLoadingStep(LOADING_STEPS.length - 1);
      await new Promise(r => setTimeout(r, 600));

      const newResult = res.data;
      setResult(newResult);
      
      // Add to history
      setCases(prev => [{ ...newResult, isNew: true, timestamp: new Date().toISOString() }, ...prev]);

      // Refresh health status after analysis
      checkHealth();
    } catch (err) {
      clearInterval(loadingTimerRef.current);
      if (err.code === 'ECONNABORTED') {
        setError("Analysis timed out. The AI model may be loading. Please try again.");
      } else {
        setError("Failed to connect to analysis server. Make sure the backend is running on port 5000.");
      }
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleViewCase = (caseData) => {
    setResult(caseData);
    setPage("analyze");
  };

  const criticalCount = cases.filter(c => c.priority === 'Critical').length;
  const totalToday = cases.length;

  return (
    <div className="app-shell">
      {/* Top Nav Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="brand">
            <div className="brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">MedAI</span>
              <span className="brand-tag">Pre-Screening</span>
            </div>
          </div>
        </div>

        <div className="top-bar-center">
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Search cases, patients..." />
          </div>
        </div>

        <div className="top-bar-right">
          <div className={`system-status ${!aiHealth.backend ? 'offline' : ''}`}>
            <span className={`status-dot ${aiHealth.backend ? 'active' : 'inactive'}`}></span>
            <span>{aiHealth.backend ? (aiHealth.ai === 'online' ? 'AI Online' : 'Mock Mode') : 'Offline'}</span>
          </div>
          <div className="notif-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {criticalCount > 0 && <span className="notif-count">{criticalCount}</span>}
          </div>
          <div className="user-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => setPage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.id === "dashboard" && totalToday > 0 && (
                  <span className="nav-badge">{totalToday}</span>
                )}
                {item.id === "history" && cases.length > 0 && (
                  <span className="nav-badge history-badge">{cases.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="ai-status-card">
              <div className="ai-status-header">
                <span className={`ai-status-dot ${aiHealth.backend && aiHealth.ai === 'online' ? '' : 'warning'}`}></span>
                <span className="ai-status-title">AI Model</span>
              </div>
              <span className="ai-model-name">
                {aiHealth.model || 'DenseNet-121'}
              </span>
              <div className="ai-accuracy">
                <span>Status</span>
                <span className={`accuracy-val ${aiHealth.ai !== 'online' ? 'mock-val' : ''}`}>
                  {aiHealth.ai === 'online' ? 'Real AI' : 'Mock'}
                </span>
              </div>
              <div className="ai-accuracy">
                <span>Cases today</span>
                <span className="accuracy-val">{totalToday}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {page === "analyze" && (
            <div className="analyze-page animate-fade-in">
              {/* Page Header */}
              <div className="page-header">
                <div>
                  <h2 className="page-title">Analyze Medical Image</h2>
                  <p className="page-desc">
                    Upload X-Ray, CT Scan, or MRI — AI will detect abnormalities in seconds
                  </p>
                </div>
                {(file || result) && (
                  <button className="hdr-btn secondary" onClick={handleReset}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    New Analysis
                  </button>
                )}
              </div>

              <div className="analyze-layout">
                {/* Left: Upload */}
                <div className="analyze-left">
                  <div className="section-card">
                    <div className="section-card-header">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Upload Image</span>
                    </div>
                    <UploadZone
                      onFileSelect={handleFileSelect}
                      file={file}
                      preview={preview}
                    />
                  </div>

                  {/* Analyze Button */}
                  {file && !result && !loading && (
                    <button
                      className="analyze-btn animate-fade-in"
                      onClick={handleAnalyze}
                    >
                      <div className="analyze-btn-glow"></div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      Run AI Analysis
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="error-banner animate-fade-in">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {error}
                    </div>
                  )}

                  {/* Info Card */}
                  {!file && (
                    <div className="info-card animate-fade-in">
                      <div className="info-card-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        How it works
                      </div>
                      <div className="info-steps">
                        {[
                          "Upload a medical scan (X-Ray, CT, MRI)",
                          "DenseNet-121 CNN runs inference on image",
                          "Grad-CAM highlights suspicious regions",
                          "Results prioritized for radiologist review",
                        ].map((step, i) => (
                          <div key={i} className="info-step">
                            <span className="info-step-num">{i + 1}</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Results */}
                <div className="analyze-right">
                  {loading && <LoadingSpinner loadingStep={loadingStep} />}
                  {result && !loading && (
                    <ResultCard result={result} preview={preview} />
                  )}
                  {!loading && !result && (
                    <div className="empty-result">
                      <div className="empty-result-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      </div>
                      <h3>AI Analysis Results</h3>
                      <p>Upload a medical image and click "Run AI Analysis" to see the results here.</p>
                      <div className="empty-result-features">
                        {["Abnormality Detection", "Grad-CAM Heatmap", "Priority Scoring", "Clinical Recommendation"].map((f) => (
                          <span key={f} className="feature-chip">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {page === "dashboard" && (
            <div className="animate-fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Case Dashboard</h2>
                  <p className="page-desc">Real-time priority queue for flagged medical cases</p>
                </div>
                <div className="header-actions">
                  <button className="hdr-btn secondary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    Filter
                  </button>
                  <button className="hdr-btn primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export
                  </button>
                </div>
              </div>
              <Dashboard newResult={result} preview={preview} liveCases={cases} />
            </div>
          )}

          {page === "history" && <HistoryPage cases={cases} onViewCase={handleViewCase} />}

          {page === "settings" && <SettingsPage aiHealth={aiHealth} onRefreshHealth={checkHealth} />}
        </main>
      </div>
    </div>
  );
}

export default App;