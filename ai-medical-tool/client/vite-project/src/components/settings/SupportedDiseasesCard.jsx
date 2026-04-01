import { useState, useEffect } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

const CATEGORY_COLORS = {
  Pulmonary: { bg: 'rgba(108,99,255,0.08)', color: '#6c63ff' },
  Pleural:   { bg: 'rgba(20,184,166,0.08)', color: '#0d9488' },
  Cardiac:   { bg: 'rgba(239,68,68,0.08)',  color: '#ef4444' },
  Oncology:  { bg: 'rgba(249,115,22,0.08)', color: '#f97316' },
  Normal:    { bg: 'rgba(34,197,94,0.08)',  color: '#22c55e' },
};

export default function SupportedDiseasesCard() {
  const [diseases, setDiseases] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('All');

  useEffect(() => {
    fetch('http://localhost:5000/api/settings/supported-diseases')
      .then(r => r.json()).then(d => { setDiseases(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = ['All', ...new Set(diseases.map(d => d.category))];
  const filtered   = filter === 'All' ? diseases : diseases.filter(d => d.category === filter);

  return (
    <div className="sc-card">
      <div className="sc-card-header">
        <div className="sc-icon teal">🫁</div>
        <div><div className="sc-label">Detection Classes</div><h3 className="sc-title">Supported Diseases</h3></div>
        <span className="sc-badge blue">{diseases.length} classes</span>
      </div>
      <div className="sc-filter-tabs">
        {categories.map(c => (
          <button key={c} className={`sc-filter-tab ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>
      {loading ? <div className="sc-skeleton-rows" /> : (
        <div className="sc-disease-list">
          {filtered.map(d => {
            const meta = CATEGORY_COLORS[d.category] || CATEGORY_COLORS.Normal;
            return (
              <div key={d.id} className="sc-disease-row">
                <span className="sc-disease-dot" style={{ background: meta.color }} />
                <span className="sc-disease-name">{d.name}</span>
                <span className="sc-disease-cat" style={{ background: meta.bg, color: meta.color }}>{d.category}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
