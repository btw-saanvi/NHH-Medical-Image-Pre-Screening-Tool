import { useState, useEffect } from 'react';
import './ClinicalModules.css';

const STATUS_META = {
  Improved: { color: '#22c55e', icon: '📈', bg: '#f0fdf4' },
  Worsened: { color: '#ef4444', icon: '📉', bg: '#fff5f5' },
  Stable:   { color: '#6c63ff', icon: '➡️',  bg: '#f5f3ff' },
  Changed:  { color: '#f59e0b', icon: '🔄', bg: '#fffdf0' },
};

export default function ScanComparisonPanel({ patientId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    fetch(`http://localhost:5000/api/scans/compare/${encodeURIComponent(patientId)}`)
      .then(r => r.json())
      .then(d  => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [patientId]);

  if (!patientId) return null;
  if (loading) return <div className="cm-card cm-loading"><div className="cm-skeleton-title" /><div className="cm-skeleton-line" /></div>;
  if (error)   return <div className="cm-card cm-error">{error}</div>;
  if (!data)   return null;

  if (!data.comparison) {
    return (
      <div className="cm-card cm-compare-card">
        <div className="cm-card-header"><div className="cm-card-icon blue">📊</div><div><div className="cm-card-label">Scan History</div><h3 className="cm-card-title">Scan Comparison</h3></div></div>
        <div className="cm-empty-compare">
          <span style={{ fontSize: 28 }}>🔍</span>
          <p>{data.message || 'Need at least 2 scans to compare.'}</p>
        </div>
      </div>
    );
  }

  const { current, previous, comparison } = data;
  const meta = STATUS_META[comparison.status] || STATUS_META.Stable;

  const ScanMini = ({ label, scan }) => (
    <div className="cm-scan-mini">
      <div className="cm-scan-mini-label">{label}</div>
      <div className="cm-scan-mini-disease">{scan.disease}</div>
      <div className="cm-scan-mini-meta">
        <span className={`pred-pill ${scan.prediction?.toLowerCase()}`}>{scan.prediction}</span>
        <span className="cm-conf-sm">{scan.confidence}%</span>
      </div>
      <div className="cm-scan-mini-date">{new Date(scan.timestamp).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</div>
    </div>
  );

  return (
    <div className="cm-card cm-compare-card">
      <div className="cm-card-header">
        <div className="cm-card-icon blue">📊</div>
        <div>
          <div className="cm-card-label">Patient History</div>
          <h3 className="cm-card-title">Scan Comparison</h3>
        </div>
        <span className="cm-status-badge" style={{ background: meta.bg, color: meta.color }}>
          {meta.icon} {comparison.status}
        </span>
      </div>

      {/* Compare panels */}
      <div className="cm-compare-grid">
        <ScanMini label="Previous Scan" scan={previous} />
        <div className="cm-compare-arrow">→</div>
        <ScanMini label="Current Scan" scan={current} />
      </div>

      {/* Delta metrics */}
      <div className="cm-delta-row">
        <div className="cm-delta-item">
          <div className="cm-delta-label">Confidence Δ</div>
          <div className="cm-delta-val" style={{ color: comparison.confidenceDelta >= 0 ? '#22c55e' : '#ef4444' }}>
            {comparison.confidenceDelta >= 0 ? '+' : ''}{comparison.confidenceDelta}%
          </div>
        </div>
        <div className="cm-delta-item">
          <div className="cm-delta-label">Days Between</div>
          <div className="cm-delta-val">{Math.abs(comparison.daysBetween)} days</div>
        </div>
        <div className="cm-delta-item">
          <div className="cm-delta-label">Disease</div>
          <div className="cm-delta-val">{comparison.diseaseChanged ? '⚠ Changed' : '✓ Same'}</div>
        </div>
      </div>
    </div>
  );
}
