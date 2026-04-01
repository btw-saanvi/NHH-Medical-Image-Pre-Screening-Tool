import { useState, useEffect } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

export default function ModelInfoCard() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/settings/model-info')
      .then(r => r.json()).then(setInfo).catch(() => {});
  }, []);

  const rows = info ? [
    { label: 'Model Architecture', value: info.architecture,    icon: '🏗️' },
    { label: 'Training Dataset',   value: info.dataset,         icon: '📦' },
    { label: 'Training Samples',   value: info.trainingSamples, icon: '🗂️' },
    { label: 'Model Version',      value: info.version,         icon: '🏷️' },
    { label: 'Framework',          value: info.framework,       icon: '⚙️' },
    { label: 'Input Resolution',   value: info.inputSize,       icon: '📐' },
    { label: 'Disease Classes',    value: `${info.classes} conditions`, icon: '🎯' },
    { label: 'Last Updated',       value: info.lastUpdated,     icon: '🗓️' },
  ] : [];

  return (
    <div className="sc-card">
      <div className="sc-card-header">
        <div className="sc-icon purple">🧪</div>
        <div><div className="sc-label">Transparency</div><h3 className="sc-title">Model Information</h3></div>
        <span className="sc-badge purple">DenseNet-121</span>
      </div>
      {!info ? <div className="sc-skeleton-rows" /> : (
        <div className="sc-info-grid">
          {rows.map(({ label, value, icon }) => (
            <div key={label} className="sc-info-item">
              <span className="sc-info-icon">{icon}</span>
              <div>
                <div className="sc-info-label">{label}</div>
                <div className="sc-info-val">{value}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
