import { useState, useEffect, useCallback } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

const EVENT_META = {
  scan_upload:          { icon: '📤', color: '#6c63ff', label: 'Scan Upload' },
  inference_completed:  { icon: '🤖', color: '#14b8a6', label: 'AI Inference' },
  report_generated:     { icon: '📄', color: '#22c55e', label: 'Report' },
  alert_triggered:      { icon: '🚨', color: '#ef4444', label: 'Alert' },
  diagnosis_updated:    { icon: '🧬', color: '#a78bfa', label: 'Diagnosis' },
  settings_changed:     { icon: '⚙️', color: '#f59e0b', label: 'Settings' },
  error:                { icon: '❌', color: '#ef4444', label: 'Error' },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
}

export default function SystemLogsPanel() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('All');

  const fetchLogs = useCallback(() => {
    fetch('http://localhost:5000/api/settings/logs?limit=50')
      .then(r => r.json()).then(d => { setLogs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLogs(); const i = setInterval(fetchLogs, 15000); return () => clearInterval(i); }, [fetchLogs]);

  const types    = ['All', ...Object.keys(EVENT_META)];
  const filtered = filter === 'All' ? logs : logs.filter(l => l.eventType === filter);

  return (
    <div className="sc-card sc-logs-card">
      <div className="sc-card-header">
        <div className="sc-icon dark">📋</div>
        <div><div className="sc-label">Audit Trail</div><h3 className="sc-title">System Logs</h3></div>
        <button className="sc-refresh-btn" onClick={fetchLogs} title="Refresh">↻</button>
      </div>

      <div className="sc-log-filter-row">
        {types.slice(0, 6).map(t => (
          <button key={t} className={`sc-log-tab ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
            {t === 'All' ? 'All' : EVENT_META[t]?.label || t}
          </button>
        ))}
      </div>

      <div className="sc-log-timeline">
        {loading && <div className="sc-skeleton-rows" />}
        {!loading && filtered.length === 0 && (
          <div className="sc-empty-logs">
            <span>📭</span><p>No log entries yet. Actions will appear here automatically.</p>
          </div>
        )}
        {filtered.map((log) => {
          const meta = EVENT_META[log.eventType] || { icon: '📌', color: '#6b7280', label: log.eventType };
          return (
            <div key={log._id} className="sc-log-entry">
              <div className="sc-log-icon" style={{ background: `${meta.color}18`, color: meta.color }}>{meta.icon}</div>
              <div className="sc-log-body">
                <div className="sc-log-msg">{log.message}</div>
                <div className="sc-log-meta">
                  <span className="sc-log-type" style={{ color: meta.color }}>{meta.label}</span>
                  <span className="sc-log-time">{timeAgo(log.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
