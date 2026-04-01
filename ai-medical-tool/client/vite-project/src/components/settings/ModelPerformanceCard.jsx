import { useState, useEffect } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

const METRICS = [
  { key: 'accuracy',  label: 'Accuracy',  color: '#6c63ff' },
  { key: 'precision', label: 'Precision', color: '#14b8a6' },
  { key: 'recall',    label: 'Recall',    color: '#f59e0b' },
  { key: 'f1Score',   label: 'F1 Score',  color: '#22c55e' },
  { key: 'auc',       label: 'AUC Score', color: '#a78bfa' },
];

export default function ModelPerformanceCard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5000/api/settings/model-metrics')
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="sc-card">
      <div className="sc-card-header">
        <div className="sc-icon purple">📊</div>
        <div><div className="sc-label">AI Engine</div><h3 className="sc-title">Model Performance Metrics</h3></div>
        <span className="sc-badge green">Live</span>
      </div>
      {loading ? <div className="sc-skeleton-rows" /> : (
        <>
          <div className="sc-metrics-grid">
            {METRICS.map(({ key, label, color }) => (
              <div key={key} className="sc-metric-item">
                <div className="sc-metric-val" style={{ color }}>{data?.[key]}%</div>
                <div className="sc-metric-lbl">{label}</div>
                <div className="sc-metric-track">
                  <div className="sc-metric-fill" style={{ width: `${data?.[key]}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="sc-footer-row">
            <span className="sc-footer-item">🗓 Trained: {data?.lastTrained}</span>
            <span className="sc-footer-item">📦 Dataset: {data?.dataset}</span>
            <span className="sc-footer-item">🔁 Epochs: {data?.epochs}</span>
          </div>
        </>
      )}
    </div>
  );
}
