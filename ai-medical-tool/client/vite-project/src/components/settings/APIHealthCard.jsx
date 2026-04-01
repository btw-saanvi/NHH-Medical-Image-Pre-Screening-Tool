import { useState, useEffect, useCallback } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

export default function APIHealthCard({ aiHealth }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(() => {
    fetch('http://localhost:5000/api/settings/api-health')
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetch_(); const i = setInterval(fetch_, 30000); return () => clearInterval(i); }, [fetch_]);

  const rows = data ? [
    { label: 'API Response Time',   value: data.avgLatency,       ok: parseInt(data.avgLatency) < 500 },
    { label: 'AI Inference Latency',value: data.inferenceLatency, ok: data.inferenceLatency !== 'Unavailable' },
    { label: 'Failed Requests (24h)',value: String(data.failedRequests), ok: data.failedRequests === 0 },
    { label: 'Server Uptime',       value: data.serverUptime,     ok: true },
    { label: 'Last Error',          value: data.lastError,        ok: data.lastError === 'None' },
  ] : [];

  return (
    <div className="sc-card">
      <div className="sc-card-header">
        <div className="sc-icon teal">⚡</div>
        <div><div className="sc-label">Performance</div><h3 className="sc-title">API Health Monitor</h3></div>
        <button className="sc-refresh-btn" onClick={fetch_} title="Refresh">↻</button>
      </div>

      {/* Connection status chips */}
      <div className="sc-health-chips">
        <div className={`sc-health-chip ${aiHealth?.backend ? 'ok' : 'err'}`}>
          <span className="sc-hc-dot" /> Backend {aiHealth?.backend ? 'Online' : 'Offline'}
        </div>
        <div className={`sc-health-chip ${aiHealth?.ai === 'online' ? 'ok' : 'err'}`}>
          <span className="sc-hc-dot" /> AI Model {aiHealth?.ai === 'online' ? 'Connected' : 'Offline'}
        </div>
        <div className={`sc-health-chip ${aiHealth?.database === 'connected' ? 'ok' : 'err'}`}>
          <span className="sc-hc-dot" /> DB {aiHealth?.database || 'Unknown'}
        </div>
      </div>

      {loading ? <div className="sc-skeleton-rows" /> : (
        <div className="sc-health-rows">
          {rows.map(({ label, value, ok }) => (
            <div key={label} className="sc-health-row">
              <span className="sc-hr-label">{label}</span>
              <span className={`sc-hr-val ${ok ? 'ok' : 'err'}`}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
