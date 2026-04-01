import { useState, useEffect, useCallback } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

export default function StorageUsageCard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(() => {
    fetch('http://localhost:5000/api/settings/storage-stats')
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const stats = data ? [
    { label: 'Total Scans',          value: data.totalScans,       icon: '🗂️', color: '#6c63ff' },
    { label: 'Abnormal Scans',       value: data.abnormalScans,    icon: '⚠️',  color: '#f97316' },
    { label: 'Critical Cases',       value: data.criticalCases,    icon: '🚨', color: '#ef4444' },
    { label: 'Reports Generated',    value: data.reportsGenerated, icon: '📄', color: '#22c55e' },
    { label: 'DB Storage',           value: `${data.storageMB} MB`,icon: '💾', color: '#a78bfa' },
    { label: 'Collections',          value: data.collectionsCount, icon: '📁', color: '#14b8a6' },
  ] : [];

  return (
    <div className="sc-card">
      <div className="sc-card-header">
        <div className="sc-icon green">💾</div>
        <div><div className="sc-label">MongoDB</div><h3 className="sc-title">Storage &amp; Usage Stats</h3></div>
        <button className="sc-refresh-btn" onClick={fetch_} title="Refresh">↻</button>
      </div>
      {loading ? <div className="sc-skeleton-rows" /> : (
        <div className="sc-storage-grid">
          {stats.map(({ label, value, icon, color }) => (
            <div key={label} className="sc-storage-item" style={{ borderTopColor: color }}>
              <div className="sc-storage-icon" style={{ color }}>{icon}</div>
              <div className="sc-storage-val" style={{ color }}>{value}</div>
              <div className="sc-storage-lbl">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
