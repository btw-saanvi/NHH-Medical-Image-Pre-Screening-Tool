import { useMemo, useState, useEffect, useCallback } from 'react';
import { getCases, getStats } from './api';
import './Dashboard.css';

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const PRIORITY_META = {
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', glow: '0 0 0 3px rgba(239,68,68,0.18)' },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.10)', glow: '' },
  Medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', glow: '' },
  Low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  glow: '' },
};

function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.Low;
  return (
    <span className="priority-chip" style={{ color: meta.color, background: meta.bg }}>
      <span className="priority-chip-dot" style={{ background: meta.color }} />
      {priority}
    </span>
  );
}

function StatCard({ label, value, sub, icon, accent, loading }) {
  return (
    <div className={`stat-card ${accent || ''}`}>
      <div className="stat-card-top">
        <div className="stat-icon-wrap">{icon}</div>
        <div className="stat-trend">↑</div>
      </div>
      <div className="stat-value">{loading ? <span className="stat-skeleton" /> : value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function Dashboard({ liveCases = [] }) {
  const [dbCases,    setDbCases]    = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [filterPriority, setFilterPriority] = useState('All');
  const [search,     setSearch]     = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [casesRes, statsRes] = await Promise.all([
        getCases({ page, limit: 12, priority: filterPriority, search: search || undefined }),
        getStats(),
      ]);
      setDbCases(casesRes.cases || []);
      setPagination(casesRes.pagination || { total: 0, totalPages: 1 });
      setStats(statsRes);
    } catch (err) {
      console.error('Dashboard fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterPriority, search]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const allCases = useMemo(() => {
    const liveFormatted = liveCases.map((c, i) => ({
      caseId:      c.caseId || `LIVE-${i}`,
      patientId:   c.patientId   || null,
      patientName: c.patientName || null,
      patientAge:  c.patientAge  || null,
      patientGender: c.patientGender || null,
      scanType:    'Upload',
      prediction:  c.prediction,
      priority:    c.priority,
      confidence:  c.confidence || 88,
      timestamp:   c.timestamp || new Date().toISOString(),
      disease:     c.disease || '-',
      isNew:       true,
      source:      'upload',
    }));
    return [...liveFormatted, ...dbCases];
  }, [liveCases, dbCases]);

  const sorted = useMemo(
    () => [...allCases].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)),
    [allCases]
  );

  const statCards = useMemo(() => {
    if (!stats) return [];
    const { overview } = stats;
    return [
      { label: 'Total Scans',      value: overview.total,                sub: 'All-time records',       icon: '🗂️', accent: '' },
      { label: 'Critical Cases',   value: overview.critical,             sub: 'Needs immediate review', icon: '🚨', accent: overview.critical > 0 ? 'danger' : '' },
      { label: 'AI Confidence',    value: `${overview.avgConfidence}%`,  sub: 'Average model accuracy', icon: '🎯', accent: '' },
      { label: 'Abnormal Scans',   value: overview.abnormal,             sub: `of ${overview.total} total`, icon: '⚠️', accent: '' },
    ];
  }, [stats]);

  const priorityDist = useMemo(() => {
    if (!stats) return [];
    const { overview } = stats;
    const total = overview.total || 1;
    return ['Critical', 'High', 'Medium', 'Low'].map(p => ({
      label: p,
      count: overview[p.toLowerCase()] || 0,
      pct:   Math.round(((overview[p.toLowerCase()] || 0) / total) * 100),
    }));
  }, [stats]);

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="dashboard-v2 animate-fade-in">

      {/* ── Header row ── */}
      <div className="dash-header-row">
        <div>
          <h2 className="dash-title">Clinical Dashboard</h2>
          <p className="dash-sub">Real-time AI-assisted radiology triage · {pagination.total} cases indexed</p>
        </div>
        <button className="dash-refresh-btn" onClick={fetchData}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="summary-grid">
        {loading && !stats
          ? [1,2,3,4].map(n => <div key={n} className="stat-card loading-card"><div className="stat-skeleton-block" /></div>)
          : statCards.map(s => <StatCard key={s.label} {...s} />)
        }
      </div>

      <div className="dashboard-main-grid">

        {/* ── LEFT: Case Queue ── */}
        <div className="queue-section">
          <div className="queue-toolbar">
            <div className="queue-title-row">
              <span className="live-dot" />
              <span className="queue-title">Priority Queue</span>
              <span className="queue-count-badge">{pagination.total}</span>
            </div>
            <div className="queue-controls">
              <div className="search-box">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search case or disease…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <select
                className="prio-select"
                value={filterPriority}
                onChange={e => { setFilterPriority(e.target.value); setPage(1); }}
              >
                <option value="All">All Priorities</option>
                <option value="Critical">🚨 Critical</option>
                <option value="High">🔶 High</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">🟢 Low</option>
              </select>
            </div>
          </div>

          <div className="queue-table-wrap">
            {loading ? (
              <div className="table-loading-state">
                <div className="loading-spinner-circle sm" />
                <span>Loading from database…</span>
              </div>
            ) : (
              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Patient</th>
                    <th>Findings</th>
                    <th>Type</th>
                    <th>Result</th>
                    <th>Confidence</th>
                    <th>Priority</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(c => (
                    <tr key={c.caseId} className={c.isNew ? 'row-new' : ''}>
                      <td>
                        <div className="case-id-group">
                          <span className="case-id-chip">{c.caseId}</span>
                          {c.isNew && <span className="tag-new">NEW</span>}
                          {c.source === 'nih_seed' && <span className="tag-nih">NIH</span>}
                        </div>
                      </td>
                      <td>
                        <div className="patient-cell">
                          <span className="patient-name">
                            {c.patientName || c.patientId || <span className="anon">Anonymous</span>}
                          </span>
                          {(c.patientAge || c.patientGender) && (
                            <span className="patient-meta">
                              {c.patientAge ? `${c.patientAge}y` : ''}
                              {c.patientAge && c.patientGender ? ' · ' : ''}
                              {c.patientGender || ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="disease-cell">{c.disease}</td>
                      <td><span className="scan-type-tag">{c.scanType || 'X-Ray'}</span></td>
                      <td>
                        <span className={`pred-pill ${c.prediction?.toLowerCase()}`}>
                          {c.prediction}
                        </span>
                      </td>
                      <td>
                        <div className="conf-col">
                          <span className="conf-num">{c.confidence}%</span>
                          <div className="conf-track">
                            <div
                              className="conf-fill"
                              style={{ width: `${c.confidence}%`,
                                background: c.confidence >= 80 ? 'linear-gradient(90deg,#22c55e,#4ade80)'
                                  : c.confidence >= 60 ? 'linear-gradient(90deg,#f59e0b,#fcd34d)'
                                  : 'linear-gradient(90deg,#ef4444,#f97316)'
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td><PriorityBadge priority={c.priority} /></td>
                      <td className="date-cell">{formatDate(c.timestamp)}</td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr><td colSpan="8" className="empty-state-row">
                      <div className="empty-state-inner">
                        <span className="empty-icon">🔍</span>
                        <span>No cases found matching criteria</span>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination-row">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="page-info">Page {page} / {pagination.totalPages}</span>
              <button className="page-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="stats-sidebar">

          {/* Priority Distribution */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <span>Priority Distribution</span>
              <span className="sidebar-card-total">{stats?.overview?.total || 0} total</span>
            </div>
            <div className="dist-rows">
              {priorityDist.map(({ label, count, pct }) => (
                <div key={label} className="dist-row">
                  <div className="dist-meta">
                    <span className="dist-label">{label}</span>
                    <span className="dist-count">{count} · {pct}%</span>
                  </div>
                  <div className="dist-track">
                    <div className={`dist-fill ${label.toLowerCase()}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Pathologies */}
          {stats?.topDiseases?.length > 0 && (
            <div className="sidebar-card">
              <div className="sidebar-card-title">
                <span>Top Pathologies</span>
                <span className="nih-badge">NIH</span>
              </div>
              <div className="top-disease-list">
                {stats.topDiseases.slice(0, 7).map(({ disease, count }, idx) => {
                  const maxCount = stats.topDiseases[0].count || 1;
                  return (
                    <div key={disease} className="top-disease-row">
                      <span className="td-rank">#{idx + 1}</span>
                      <span className="td-name">{disease}</span>
                      <div className="td-bar-wrap">
                        <div className="td-bar" style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
                      <span className="td-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NIH Dataset promo */}
          <div className="sidebar-card promo-card">
            <div className="promo-header">
              <div className="promo-icon">🫁</div>
              <span className="promo-badge-pill">NIH Dataset</span>
            </div>
            <div className="promo-title">ChestX-ray14</div>
            <p className="promo-desc">Seeded with realistic chest pathology records from the NIH dataset. Real uploads persist here automatically.</p>
            <button
              className="promo-cta"
              onClick={() => window.open('https://www.kaggle.com/datasets/nih-chest-xrays/data', '_blank')}
            >
              View on Kaggle →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Dashboard;
