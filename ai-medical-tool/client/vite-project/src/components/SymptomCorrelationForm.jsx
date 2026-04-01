import { useState } from 'react';
import './ClinicalModules.css';

const FIELD_DEFS = [
  { key: 'fever',         label: 'Fever',               type: 'checkbox' },
  { key: 'cough',         label: 'Cough',                type: 'checkbox' },
  { key: 'productiveCough', label: 'Productive Cough',  type: 'checkbox' },
  { key: 'chestPain',     label: 'Chest Pain',          type: 'checkbox' },
  { key: 'shortBreath',   label: 'Shortness of Breath', type: 'checkbox' },
  { key: 'weightLoss',    label: 'Weight Loss',          type: 'checkbox' },
  { key: 'nightSweats',   label: 'Night Sweats',         type: 'checkbox' },
  { key: 'legSwelling',   label: 'Leg Swelling',         type: 'checkbox' },
  { key: 'chronicCough',  label: 'Chronic Cough (>3wk)', type: 'checkbox' },
];

const DEFAULT_SYMPTOMS = Object.fromEntries(FIELD_DEFS.map(f => [f.key, false]));

export default function SymptomCorrelationForm({ finding, location, onResult, onLoading }) {
  const [symptoms,  setSymptoms]  = useState(DEFAULT_SYMPTOMS);
  const [loc,       setLoc]       = useState(location || '');
  const [duration,  setDuration]  = useState('');
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]     = useState(null);

  const toggle = (key) => setSymptoms(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    onLoading?.(true);
    try {
      const body = { finding: finding || '', location: loc, symptoms: { ...symptoms, duration } };
      const res  = await fetch('http://localhost:5000/api/diagnosis/infer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      onResult?.(data);
    } catch (err) {
      setError('Failed to connect to diagnosis engine.');
    } finally {
      setSubmitting(false);
      onLoading?.(false);
    }
  };

  const activeCount = Object.values(symptoms).filter(Boolean).length;

  return (
    <div className="cm-card cm-symptom-form">
      <div className="cm-card-header">
        <div className="cm-card-icon blue">🩺</div>
        <div>
          <div className="cm-card-label">Clinical Correlation</div>
          <h3 className="cm-card-title">Symptom Input Form</h3>
        </div>
        {activeCount > 0 && (
          <span className="cm-active-badge">{activeCount} active</span>
        )}
      </div>

      {/* Location field */}
      <div className="cm-field-group">
        <label className="cm-field-label">Lesion Location</label>
        <select
          className="cm-select"
          value={loc}
          onChange={e => setLoc(e.target.value)}
        >
          <option value="">-- Select location --</option>
          <option value="upper">Upper Lobe</option>
          <option value="middle">Middle Lobe</option>
          <option value="lower">Lower Lobe</option>
          <option value="bilateral">Bilateral</option>
          <option value="pleural">Pleural Space</option>
          <option value="mediastinum">Mediastinum</option>
          <option value="diffuse">Diffuse</option>
        </select>
      </div>

      {/* Duration */}
      <div className="cm-field-group">
        <label className="cm-field-label">Symptom Duration</label>
        <select className="cm-select" value={duration} onChange={e => setDuration(e.target.value)}>
          <option value="">-- Select --</option>
          <option value="<3days">Less than 3 days</option>
          <option value="3-7days">3–7 days</option>
          <option value="1-4weeks">1–4 weeks</option>
          <option value=">1month">More than 1 month</option>
        </select>
      </div>

      {/* Symptom grid */}
      <div className="cm-field-label" style={{ marginTop: 12 }}>Presenting Symptoms</div>
      <div className="cm-symptom-grid">
        {FIELD_DEFS.map(({ key, label }) => (
          <label key={key} className={`cm-symptom-chip ${symptoms[key] ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={symptoms[key]}
              onChange={() => toggle(key)}
              hidden
            />
            <span className="cm-chip-dot" />
            {label}
          </label>
        ))}
      </div>

      {error && <div className="cm-error-msg">{error}</div>}

      <button
        className="cm-submit-btn"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <><span className="cm-spin" /> Analyzing…</>
        ) : (
          '🔬 Run Differential Diagnosis'
        )}
      </button>
    </div>
  );
}
