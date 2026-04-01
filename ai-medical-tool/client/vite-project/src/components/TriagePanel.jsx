import './ClinicalModules.css';

const LEVEL_META = {
  Critical: { bg: '#fff5f5', border: '#ef4444', color: '#ef4444', icon: '🚨', barWidth: '100%' },
  High:     { bg: '#fff8f0', border: '#f97316', color: '#f97316', icon: '🔶', barWidth: '75%'  },
  Moderate: { bg: '#fffdf0', border: '#f59e0b', color: '#f59e0b', icon: '⚠️',  barWidth: '50%'  },
  Routine:  { bg: '#f0fdf8', border: '#22c55e', color: '#22c55e', icon: '✅',  barWidth: '20%'  },
};

export default function TriagePanel({ triage, loading }) {
  if (loading) {
    return (
      <div className="cm-card cm-loading">
        <div className="cm-skeleton-title" />
        <div className="cm-skeleton-line" />
      </div>
    );
  }
  if (!triage) return null;

  const meta = LEVEL_META[triage.level] || LEVEL_META.Routine;

  return (
    <div className="cm-card cm-triage-card" style={{ background: meta.bg, borderTopColor: meta.border }}>
      <div className="cm-card-header">
        <div className="cm-card-icon" style={{ background: `${meta.color}18`, color: meta.color }}>
          🏥
        </div>
        <div>
          <div className="cm-card-label">Clinical Triage System</div>
          <h3 className="cm-card-title">Urgency Assessment</h3>
        </div>
      </div>

      {/* Urgency level */}
      <div className="cm-triage-level-row">
        <span className="cm-triage-icon">{meta.icon}</span>
        <span className="cm-triage-level" style={{ color: meta.color }}>{triage.level}</span>
      </div>

      {/* Emergency bar */}
      <div className="cm-urgency-bar-wrap">
        <div className="cm-urgency-track">
          <div className="cm-urgency-fill" style={{ width: meta.barWidth, background: meta.color }} />
        </div>
        <div className="cm-urgency-labels">
          <span>Routine</span><span>Moderate</span><span>High</span><span>Critical</span>
        </div>
      </div>

      {/* Details */}
      <div className="cm-triage-details">
        <div className="cm-triage-detail-row">
          <div className="cm-td-icon">⏱</div>
          <div>
            <div className="cm-td-label">RESPONSE TIME</div>
            <div className="cm-td-val">{triage.responseTime}</div>
          </div>
        </div>
        <div className="cm-triage-detail-row">
          <div className="cm-td-icon">📋</div>
          <div>
            <div className="cm-td-label">NEXT CLINICAL STEP</div>
            <div className="cm-td-val">{triage.nextAction}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
