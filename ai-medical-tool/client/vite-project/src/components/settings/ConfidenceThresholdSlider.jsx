import { useState, useEffect } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

export default function ConfidenceThresholdSlider() {
  const [threshold, setThreshold] = useState(75);
  const [saved,     setSaved]     = useState(false);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/settings')
      .then(r => r.json()).then(d => { if (d.confidenceThreshold) setThreshold(d.confidenceThreshold); })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('http://localhost:5000/api/settings/confidence-threshold', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const color = threshold >= 85 ? '#22c55e' : threshold >= 70 ? '#f59e0b' : '#ef4444';
  const label = threshold >= 85 ? 'High Precision' : threshold >= 70 ? 'Balanced' : 'High Recall';

  return (
    <div className="sc-card">
      <div className="sc-card-header">
        <div className="sc-icon amber">🎯</div>
        <div><div className="sc-label">Clinical Config</div><h3 className="sc-title">Confidence Threshold</h3></div>
        <span className="sc-badge" style={{ background: `${color}20`, color }}>{label}</span>
      </div>

      <div className="sc-threshold-display">
        <span className="sc-thresh-val" style={{ color }}>{threshold}%</span>
        <span className="sc-thresh-sub">AI confidence must exceed this to flag as Abnormal</span>
      </div>

      <div className="sc-slider-wrap">
        <span className="sc-slider-lbl">50%</span>
        <input
          type="range" min={50} max={100} value={threshold}
          className="sc-slider"
          style={{ '--fill': `${((threshold - 50) / 50) * 100}%`, '--color': color }}
          onChange={e => setThreshold(Number(e.target.value))}
        />
        <span className="sc-slider-lbl">100%</span>
      </div>

      <div className="sc-threshold-ticks">
        <span style={{ color: '#ef4444' }}>High Recall (50%)</span>
        <span style={{ color: '#f59e0b' }}>Balanced (70%)</span>
        <span style={{ color: '#22c55e' }}>High Precision (85%+)</span>
      </div>

      <button className={`sc-save-btn ${saved ? 'saved' : ''}`} onClick={save} disabled={saving}>
        {saving ? '⏳ Saving…' : saved ? '✓ Saved!' : 'Save Threshold'}
      </button>
    </div>
  );
}
