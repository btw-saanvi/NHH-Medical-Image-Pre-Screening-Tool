import { useMemo, useState, useEffect, useCallback } from 'react';
import { getCases, getStats } from './api';
import './Dashboard.css';

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function PriorityBadge({ priority }) {
  return (
    <span className={`stitch-priority-badge ${priority.toLowerCase()}`}>
      {priority}
    </span>
  );
}

function StatCard({ label, value, sub, icon, red, loading }) {
  return (
    <div className={`summary-card ${red ? 'critical-alert' : ''}`}>
      <div className="summary-header">
        <span className="summary-icon">{icon}</span>
        <span className="summary-label">{label}</span>
      </div>
      <div className="summary-body">
        <div className="summary-val">{loading ? '…' : value}</div>
        <div className="summary-sub">{sub}</div>
      </div>
    </div>
  );
}

function Dashboard({ liveCases = [] }) {
  const [dbCases,  setDbCases]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [filterPriority, setFilterPriority] = useState('All');
  const [search,   setSearch]   = useState('');

  // Auto-refresh every 30 s
  const fetchData = useCallback(async () => {
    try {
      const [casesRes, statsRes] = await Promise.all([
        getCases({ page, limit: 15, priority: filterPriority, search: search || undefined }),
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

  // Merge live (just-uploaded) cases at the top
  const allCases = useMemo(() => {
    const liveFormatted = liveCases.map((c, i) => ({
      caseId:        c.caseId || `LIVE-${i}`,
      // Use real patient details from the upload response
      patientId:     c.patientId   || null,
      patientName:   c.patientName || null,
      patientAge:    c.patientAge  || null,
      patientGender: c.patientGender || null,
      scanType:      'Upload',
      prediction:    c.prediction,
      priority:      c.priority,
      confidence:    c.confidence || 88,
      timestamp:     c.timestamp || new Date().toISOString(),
      disease:       c.disease || '-',
      isNew:         true,
      source:        'upload',
    }));
    return [...liveFormatted, ...dbCases];
  }, [liveCases, dbCases]);

  const sorted = useMemo(
    () => [...allCases].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)),
    [allCases]
  );

  // Stats cards using real DB data
  const statCards = useMemo(() => {
    if (!stats) return [];
    const { overview } = stats;
    return [
      { label: 'Total Analyses',    value: overview.total,    sub: 'Scans processed',       icon: '📊' },
      { label: 'Critical Finding',  value: overview.critical, sub: 'Needs immediate review', icon: '🚩', red: overview.critical > 0 },
      { label: 'Avg Confidence',    value: `${overview.avgConfidence}%`, sub: 'AI model confidence', icon: '🎯' },
      { label: 'Abnormal Scans',    value: overview.abnormal, sub: 'Out of total',           icon: '⚠️' },
    ];
  }, [stats]);

  const priorityDist = useMemo(() => {
    if (!stats) return [];
    const { overview } = stats;
    const total = overview.total || 1;
    return ['Critical', 'High', 'Medium', 'Low'].map(p => ({
      label: p,
      count: overview[p.toLowerCase()] || 0,
      pct:   ((overview[p.toLowerCase()] || 0) / total) * 100,
    }));
  }, [stats]);

  return (
    <div className="dashboard-v2 animate-fade-in">

      {/* ── Summary Stats ── */}
      <div className="summary-grid">
        {loading && !stats
          ? [1,2,3,4].map(n => <StatCard key={n} label="Loading…" value="…" sub="" icon="⏳" loading />)
          : statCards.map(s => <StatCard key={s.label} {...s} />)
        }
      </div>

      <div className="dashboard-main-grid">

        {/* ── Left: Cases Queue ── */}
        <div className="queue-section">
          <div className="section-header">
            <h3>Priority Cases Queue</h3>
            <div className="header-actions">
              <span className="live-pulse"></span>
              <span className="live-text">Live · {pagination.total} total</span>
            </div>
          </div>

          {/* Filters */}
          <div className="queue-filters">
            <div className="search-input-wrap sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
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
              className="filter-select sm"
              value={filterPriority}
              onChange={e => { setFilterPriority(e.target.value); setPage(1); }}
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <button className="table-action-btn" onClick={fetchData}>↻ Refresh</button>
          </div>

          <div className="queue-table-wrap">
            {loading ? (
              <div className="table-loading">
                <div className="loading-spinner-circle sm"></div>
                <span>Loading from database…</span>
              </div>
            ) : (
              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Patient</th>
                    <th>Findings</th>
                    <th>Scan</th>
                    <th>Prediction</th>
                    <th>Confidence</th>
                    <th>Priority</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(c => (
                    <tr key={c.caseId} className={c.isNew ? 'row-highlight' : ''}>
                      <td className="case-id-cell">
                        {c.caseId}
                        {c.source === 'nih_seed' && <span className="source-tag">NIH</span>}
                        {c.isNew && <span className="source-tag new">NEW</span>}
                      </td>
                      <td>
                        <div className="patient-cell">
                          {/* Show entered name if available, else patient ID, else dash */}
                          <span>{c.patientName || c.patientId || <span style={{color:'#94a3b8'}}>Anonymous</span>}</span>
                          {(c.patientAge || c.patientGender) && (
                            <span className="meta-sub">
                              {c.patientAge ? `${c.patientAge}y` : ''}
                              {c.patientAge && c.patientGender ? ' · ' : ''}
                              {c.patientGender || ''}
                            </span>
                          )}
                          {c.patientDob && !c.patientAge && (
                            <span className="meta-sub">DOB: {c.patientDob}</span>
                          )}
                        </div>
                      </td>
                      <td className="disease-cell">{c.disease}</td>
                      <td className="scan-type-cell">{c.scanType || 'X-Ray'}</td>
                      <td>
                        <span className={`pred-tag ${c.prediction?.toLowerCase()}`}>
                          {c.prediction}
                        </span>
                      </td>
                      <td>
                        <div className="conf-progress">
                          <div className="conf-bar" style={{ width: `${c.confidence}%` }}></div>
                          <span className="conf-label">{c.confidence}%</span>
                        </div>
                      </td>
                      <td><PriorityBadge priority={c.priority} /></td>
                      <td className="date-cell">
                        {c.timestamp ? new Date(c.timestamp).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan="8" className="empty-row">No cases found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination-row">
              <button
                className="table-action-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span className="page-info">Page {page} / {pagination.totalPages}</span>
              <button
                className="table-action-btn"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Distribution + Top Diseases ── */}
        <div className="stats-sidebar">
          <div className="sidebar-card">
            <h4>Priority Distribution</h4>
            <div className="dist-rows">
              {priorityDist.map(({ label, count, pct }) => (
                <div key={label} className="dist-row-v2">
                  <div className="dist-info">
                    <span className="dist-name">{label}</span>
                    <span className="dist-num">{count}</span>
                  </div>
                  <div className="dist-track-v2">
                    <div className={`dist-fill-v2 ${label.toLowerCase()}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Diseases from DB */}
          {stats?.topDiseases?.length > 0 && (
            <div className="sidebar-card">
              <h4>Top Pathologies <span className="badge-nih">NIH Data</span></h4>
              <div className="dist-rows">
                {stats.topDiseases.slice(0, 7).map(({ disease, count }) => {
                  const maxCount = stats.topDiseases[0].count || 1;
                  return (
                    <div key={disease} className="dist-row-v2">
                      <div className="dist-info">
                        <span className="dist-name">{disease}</span>
                        <span className="dist-num">{count}</span>
                      </div>
                      <div className="dist-track-v2">
                        <div
                          className="dist-fill-v2 medium"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="sidebar-card promo-card">
            <div className="promo-badge">NIH</div>
            <h4>ChestX-ray14 Dataset</h4>
            <p>Seeded with realistic NIH chest pathology records. Real uploads persist here too.</p>
            <button className="promo-btn" onClick={() => window.open('https://www.kaggle.com/datasets/nih-chest-xrays/data', '_blank')}>
              View Dataset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
