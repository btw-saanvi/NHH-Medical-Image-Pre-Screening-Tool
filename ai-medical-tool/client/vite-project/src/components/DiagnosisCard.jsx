import { useState } from 'react';
import './ClinicalModules.css';

const SEVERITY_CONFIG = {
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: '🚨', border: '#ef4444' },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: '🔶', border: '#f97316' },
  Moderate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '🟡', border: '#f59e0b' },
  Routine:  { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  icon: '🟢', border: '#22c55e' },
};

export default function DiagnosisCard({ data, loading }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="cm-card cm-loading">
        <div className="cm-skeleton-title" />
        <div className="cm-skeleton-line" />
        <div className="cm-skeleton-line short" />
      </div>
    );
  }
  if (!data) return null;

  const sev    = SEVERITY_CONFIG[data.severity] || SEVERITY_CONFIG.Routine;
  const confPct = Math.min(data.confidence || 0, 100);

  return (
    <div className="cm-card cm-diagnosis-card" style={{ borderTopColor: sev.border }}>
      <div className="cm-card-header">
        <div className="cm-card-icon" style={{ background: sev.bg, color: sev.color }}>
          🧬
        </div>
        <div>
          <div className="cm-card-label">AI Diagnosis Engine</div>
          <h3 className="cm-card-title">Disease Inference</h3>
        </div>
        <span className="cm-severity-badge" style={{ background: sev.bg, color: sev.color, borderColor: sev.border }}>
          {sev.icon} {data.severity}
        </span>
      </div>

      {/* Primary Diagnosis */}
      <div className="cm-primary-dx">
        <div className="cm-dx-label">Primary Diagnosis</div>
        <div className="cm-dx-name">{data.primaryDiagnosis}</div>
      </div>

      {/* Confidence gauge bar */}
      <div className="cm-conf-row">
        <span className="cm-conf-label-sm">AI Confidence</span>
        <div className="cm-conf-track">
          <div
            className="cm-conf-fill"
            style={{ width: `${confPct}%`, background: sev.color }}
          />
        </div>
        <span className="cm-conf-pct" style={{ color: sev.color }}>{confPct}%</span>
      </div>

      {/* Differentials */}
      <div className="cm-section-label">Top Differential Diagnoses</div>
      <div className="cm-differentials">
        {(data.differentialDiagnoses || []).slice(0, 3).map((dx, i) => (
          <div key={i} className="cm-diff-pill">
            <span className="cm-diff-rank">#{i + 1}</span>
            {dx}
          </div>
        ))}
      </div>

      {/* Reasoning toggle */}
      <button className="cm-expand-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▲ Hide' : '▼ Show'} Clinical Reasoning
      </button>

      {expanded && (
        <div className="cm-reasoning-box">
          <div className="cm-section-label">Radiologist Reasoning</div>
          <p className="cm-reasoning-text">{data.reasoning}</p>
        </div>
      )}
    </div>
  );
}
