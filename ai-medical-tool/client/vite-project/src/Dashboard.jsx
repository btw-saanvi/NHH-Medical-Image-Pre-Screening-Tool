import { useMemo } from 'react';
import './Dashboard.css';

const SAMPLE_CASES = [
  { caseId: 'A101', patient: 'Patient #1042', type: 'X-Ray', prediction: 'Abnormal', priority: 'Critical', confidence: 94, time: '2 min ago', organ: 'Chest', disease: 'Pneumonia' },
  { caseId: 'A102', patient: 'Patient #1039', type: 'CT Scan', prediction: 'Abnormal', priority: 'High', confidence: 87, time: '15 min ago', organ: 'Lung', disease: 'Pleural Effusion' },
  { caseId: 'A103', patient: 'Patient #1038', type: 'MRI', prediction: 'Normal', priority: 'Low', confidence: 96, time: '1 hr ago', organ: 'Brain', disease: 'No Finding' },
  { caseId: 'A104', patient: 'Patient #1037', type: 'X-Ray', prediction: 'Abnormal', priority: 'Medium', confidence: 78, time: '2 hr ago', organ: 'Spine', disease: 'Atelectasis' },
  { caseId: 'A105', patient: 'Patient #1035', type: 'CT Scan', prediction: 'Normal', priority: 'Low', confidence: 91, time: '3 hr ago', organ: 'Abdomen', disease: 'No Finding' },
];

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function PriorityBadge({ priority }) {
  const colors = {
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  };
  return (
    <span className={`dash-priority-badge ${colors[priority] || 'low'}`}>
      {priority}
    </span>
  );
}

function Dashboard({ newResult, preview, liveCases = [] }) {
  // Merge live cases with sample ones
  const allCases = useMemo(() => {
    const liveFormatted = liveCases.map((c, i) => ({
      caseId: c.caseId || `A${200 + i}`,
      patient: `Patient #${1050 + i}`,
      type: 'Upload',
      prediction: c.prediction,
      priority: c.priority,
      confidence: c.confidence || 88,
      time: c.timestamp ? getRelativeTime(c.timestamp) : 'Just now',
      organ: c.disease === 'No Finding' ? 'Chest' : 'Chest',
      disease: c.disease || '-',
      isNew: c.isNew,
    }));
    return [...liveFormatted, ...SAMPLE_CASES];
  }, [liveCases]);

  const sorted = [...allCases].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4));

  // Dynamic stats
  const stats = useMemo(() => {
    const total = allCases.length;
    const critical = allCases.filter(c => c.priority === 'Critical').length;
    const abnormal = allCases.filter(c => c.prediction === 'Abnormal').length;
    const avgConf = allCases.reduce((sum, c) => sum + c.confidence, 0) / (total || 1);
    const pending = allCases.filter(c => c.priority === 'Critical' || c.priority === 'High').length;

    return [
      { label: 'Total Scans', value: String(total), change: liveCases.length > 0 ? `+${liveCases.length}` : '+0', color: 'blue', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      )},
      { label: 'Critical Cases', value: String(critical), change: critical > 0 ? `${critical} flagged` : 'None', color: 'red', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      )},
      { label: 'Avg Confidence', value: `${avgConf.toFixed(1)}%`, change: avgConf >= 85 ? 'High' : 'Moderate', color: 'green', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      )},
      { label: 'Pending Review', value: String(pending), change: pending > 3 ? 'Review needed' : 'On track', color: 'yellow', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      )},
    ];
  }, [allCases, liveCases]);

  return (
    <div className="dashboard animate-fade-in">
      {/* Stats Row */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className={`stat-card stat-${stat.color}`}>
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-content">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
            <span className={`stat-change ${stat.change.startsWith('+') ? 'up' : ''}`}>
              {stat.change}
            </span>
          </div>
        ))}
      </div>

      {/* Distribution Chart */}
      <div className="distribution-row">
        <div className="distribution-card">
          <div className="dist-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
            <span>Priority Distribution</span>
          </div>
          <div className="dist-bars">
            {['Critical', 'High', 'Medium', 'Low'].map(p => {
              const count = allCases.filter(c => c.priority === p).length;
              const pct = allCases.length ? (count / allCases.length) * 100 : 0;
              return (
                <div key={p} className="dist-bar-row">
                  <span className={`dist-label ${p.toLowerCase()}`}>{p}</span>
                  <div className="dist-track">
                    <div className={`dist-fill ${p.toLowerCase()}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className="dist-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="distribution-card">
          <div className="dist-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            <span>Prediction Summary</span>
          </div>
          <div className="pred-summary">
            <div className="pred-item">
              <div className="pred-circle abnormal">
                <span className="pred-num">{allCases.filter(c => c.prediction === 'Abnormal').length}</span>
              </div>
              <span className="pred-label">Abnormal</span>
            </div>
            <div className="pred-divider"></div>
            <div className="pred-item">
              <div className="pred-circle normal">
                <span className="pred-num">{allCases.filter(c => c.prediction === 'Normal').length}</span>
              </div>
              <span className="pred-label">Normal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Case Table */}
      <div className="case-table-wrap">
        <div className="table-header">
          <div className="table-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3>Flagged Cases — Priority Queue</h3>
          </div>
          <div className="table-header-right">
            <span className="live-indicator">
              <span className="live-dot"></span>
              Live
            </span>
            <span className="case-count">{allCases.length} cases</span>
          </div>
        </div>

        <div className="case-table">
          <div className="table-head">
            <span>Case ID</span>
            <span>Patient</span>
            <span>Disease</span>
            <span>Prediction</span>
            <span>Confidence</span>
            <span>Priority</span>
            <span>Time</span>
            <span>Action</span>
          </div>

          <div className="table-body">
            {sorted.map((c) => (
              <div key={c.caseId} className={`table-row ${c.isNew ? 'row-new' : ''}`}>
                <span className="case-id">
                  {c.isNew && <span className="new-dot"></span>}
                  {c.caseId}
                </span>
                <span className="patient-name">{c.patient}</span>
                <span className="disease-col">{c.disease || '-'}</span>
                <span className={`prediction-text ${c.prediction === 'Abnormal' ? 'abnormal' : 'normal'}`}>
                  {c.prediction === 'Abnormal' ? '⚠ ' : '✓ '}{c.prediction}
                </span>
                <span className="confidence-cell">
                  <div className="mini-bar-track">
                    <div className="mini-bar" style={{ width: `${c.confidence}%`, background: c.confidence >= 85 ? 'var(--accent-green)' : c.confidence >= 70 ? 'var(--accent-yellow)' : 'var(--accent-orange)' }}></div>
                  </div>
                  <span className="conf-num">{c.confidence}%</span>
                </span>
                <span>
                  <PriorityBadge priority={c.priority} />
                </span>
                <span className="time-text">{c.time}</span>
                <span>
                  <button className="review-btn">Review</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getRelativeTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default Dashboard;
