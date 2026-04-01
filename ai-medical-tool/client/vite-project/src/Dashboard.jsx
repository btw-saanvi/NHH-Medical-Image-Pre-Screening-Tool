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
  return (
    <span className={`stitch-priority-badge ${priority.toLowerCase()}`}>
      {priority}
    </span>
  );
}

function Dashboard({ liveCases = [] }) {
  const allCases = useMemo(() => {
    const liveFormatted = liveCases.map((c, i) => ({
      caseId: c.caseId || `A${200 + i}`,
      patient: `Patient #${1050 + i}`,
      type: 'Upload',
      prediction: c.prediction,
      priority: c.priority,
      confidence: c.confidence || 88,
      time: c.timestamp ? getRelativeTime(c.timestamp) : 'Just now',
      organ: 'Chest',
      disease: c.disease || '-',
      isNew: c.isNew,
    }));
    return [...liveFormatted, ...SAMPLE_CASES];
  }, [liveCases]);

  const sorted = [...allCases].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4));

  const stats = useMemo(() => {
    const total = allCases.length;
    const critical = allCases.filter(c => c.priority === 'Critical').length;
    const avgConf = allCases.reduce((sum, c) => sum + parseInt(c.confidence), 0) / (total || 1);
    const responseTime = 4.2; // Mock avg response time

    return [
      { label: 'Total Analyses', value: total, sub: 'Scans processed', icon: '📊' },
      { label: 'Critical Finding', value: critical, sub: 'Needs immediate review', icon: '🚩', red: critical > 0 },
      { label: 'Avg Feedback time', value: responseTime, sub: 'Minutes per scan', icon: '⏱️' },
      { label: 'Detection Accuracy', value: `${avgConf.toFixed(0)}%`, sub: 'AI Confidence avg', icon: '🎯' },
    ];
  }, [allCases]);

  return (
    <div className="dashboard-v2 animate-fade-in">
      {/* Summary Row */}
      <div className="summary-grid">
        {stats.map(s => (
          <div key={s.label} className={`summary-card ${s.red ? 'critical-alert' : ''}`}>
            <div className="summary-header">
              <span className="summary-icon">{s.icon}</span>
              <span className="summary-label">{s.label}</span>
            </div>
            <div className="summary-body">
              <div className="summary-val">{s.value}</div>
              <div className="summary-sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-main-grid">
        {/* Left: Queue */}
        <div className="queue-section">
          <div className="section-header">
            <h3>Critical Cases Queue</h3>
            <div className="header-actions">
              <span className="live-pulse"></span>
              <span className="live-text">Real-time Feed</span>
            </div>
          </div>
          <div className="queue-table-wrap">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Patient</th>
                  <th>Findings</th>
                  <th>Prediction</th>
                  <th>Confidence</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(c => (
                  <tr key={c.caseId} className={c.isNew ? 'row-highlight' : ''}>
                    <td className="case-id-cell">{c.caseId}</td>
                    <td>{c.patient}</td>
                    <td className="disease-cell">{c.disease}</td>
                    <td>
                      <span className={`pred-tag ${c.prediction.toLowerCase()}`}>
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
                    <td><button className="table-action-btn">Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Distribution & Visuals */}
        <div className="stats-sidebar">
          <div className="sidebar-card">
            <h4>Priority Distribution</h4>
            <div className="dist-rows">
              {['Critical', 'High', 'Medium', 'Low'].map(p => {
                const count = allCases.filter(c => c.priority === p).length;
                const pct = allCases.length ? (count / allCases.length) * 100 : 0;
                return (
                  <div key={p} className="dist-row-v2">
                    <div className="dist-info">
                      <span className="dist-name">{p}</span>
                      <span className="dist-num">{count}</span>
                    </div>
                    <div className="dist-track-v2">
                      <div className={`dist-fill-v2 ${p.toLowerCase()}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sidebar-card promo-card">
            <div className="promo-badge">NEW</div>
            <h4>Batch Analysis Engine</h4>
            <p>Upload a whole medical directory for automated bulk processing.</p>
            <button className="promo-btn">Explore Engine</button>
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
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default Dashboard;
