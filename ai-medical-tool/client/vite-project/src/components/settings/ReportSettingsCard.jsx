import { useState, useEffect } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

const OPTIONS = [
  { key: 'reportIncludeScan',      label: 'Original Scan',      icon: '🖼️' },
  { key: 'reportIncludeHeatmap',   label: 'Grad-CAM Heatmap',   icon: '🔥' },
  { key: 'reportIncludeDiagnosis', label: 'AI Diagnosis',        icon: '🧬' },
  { key: 'reportIncludeSymptoms',  label: 'Symptom Correlation', icon: '📝' },
  { key: 'reportIncludeMetadata',  label: 'Patient Metadata',    icon: '👤' },
  { key: 'reportIncludeTimestamp', label: 'Timestamp',           icon: '⏱️' },
];

export default function ReportSettingsCard() {
  const [config,  setConfig]  = useState(Object.fromEntries(OPTIONS.map(o => [o.key, true])));
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/settings').then(r => r.json()).then(d => {
      const next = {};
      OPTIONS.forEach(o => { if (d[o.key] !== undefined) next[o.key] = d[o.key]; });
      setConfig(prev => ({ ...prev, ...next }));
    }).catch(() => {});
  }, []);

  const toggle = (key) => setConfig(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch('http://localhost:5000/api/settings/report-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const activeCount = Object.values(config).filter(Boolean).length;

  return (
    <div className="sc-card">
      <div className="sc-card-header">
        <div className="sc-icon blue">📄</div>
        <div><div className="sc-label">PDF Export</div><h3 className="sc-title">Report Configuration</h3></div>
        <span className="sc-badge blue">{activeCount}/{OPTIONS.length} active</span>
      </div>
      <div className="sc-checkbox-grid">
        {OPTIONS.map(({ key, label, icon }) => (
          <label key={key} className={`sc-checkbox-item ${config[key] ? 'checked' : ''}`} onClick={() => toggle(key)}>
            <span className="sc-cb-icon">{icon}</span>
            <span className="sc-cb-label">{label}</span>
            <span className={`sc-checkbox ${config[key] ? 'checked' : ''}`}>
              {config[key] && '✓'}
            </span>
          </label>
        ))}
      </div>
      <button className={`sc-save-btn ${saved ? 'saved' : ''}`} onClick={save} disabled={saving}>
        {saving ? '⏳ Saving…' : saved ? '✓ Saved!' : 'Save Report Config'}
      </button>
    </div>
  );
}
