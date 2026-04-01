import './ClinicalModules.css';

const REGION_LABELS = {
  upper:      'Upper Lobe',
  lower:      'Lower Lobe',
  middle:     'Middle Lobe',
  bilateral:  'Bilateral',
  pleural:    'Pleural Space',
  diffuse:    'Diffuse',
  mediastinum:'Mediastinum',
};

const FEATURE_TIPS = {
  Pneumonia:       ['Lobar consolidation', 'Air bronchograms', 'No volume loss'],
  Atelectasis:     ['Linear opacities', 'Volume loss', 'Fissure displacement'],
  'Pleural Effusion': ['Meniscus sign', 'Blunted angles', 'Dependent opacity'],
  Cardiomegaly:    ['CTR > 0.5', 'Apex displacement', 'Vascular engorgement'],
  Pneumothorax:    ['Visceral pleural line', 'Absent markings', 'Hyper-lucency'],
  'Pulmonary Edema':['Bat-wing opacity', 'Kerley-B lines', 'Perihilar haziness'],
  'Pulmonary Tuberculosis': ['Upper lobe opacity', 'Cavitation', 'Miliary pattern'],
};

export default function AIReasoningPanel({ result }) {
  if (!result) return null;

  const disease  = result.disease  || '';
  const heatmap  = result.heatmap;
  const features = FEATURE_TIPS[disease] || ['Radiographic pattern detected', 'Abnormal density', 'Bronchovascular distortion'];

  return (
    <div className="cm-card cm-ai-panel">
      <div className="cm-card-header">
        <div className="cm-card-icon purple">🤖</div>
        <div>
          <div className="cm-card-label">Explainable AI</div>
          <h3 className="cm-card-title">Model Reasoning</h3>
        </div>
        <span className="cm-model-chip">DenseNet-121</span>
      </div>

      {/* Why diagnosis */}
      <div className="cm-section-label">Why this diagnosis?</div>
      <div className="cm-reason-box">
        <p>{result.diagnosis || 'The model identified radiographic patterns consistent with the predicted pathology based on CheXpert training weights.'}</p>
      </div>

      {/* Key features */}
      <div className="cm-section-label" style={{ marginTop: 14 }}>Key Radiographic Features</div>
      <div className="cm-feature-list">
        {features.map((f, i) => (
          <div key={i} className="cm-feature-item">
            <span className="cm-feat-num">{i + 1}</span>
            <span>{f}</span>
          </div>
        ))}
      </div>

      {/* Heatmap legend */}
      {heatmap && (
        <>
          <div className="cm-section-label" style={{ marginTop: 14 }}>Grad-CAM Heatmap Guide</div>
          <div className="cm-heatmap-legend">
            <div className="cm-legend-bar" />
            <div className="cm-legend-labels">
              <span>Low activation</span>
              <span>Medium</span>
              <span>High activation</span>
            </div>
            <p className="cm-legend-note">Brighter regions indicate areas the model weighted most heavily in its decision.</p>
          </div>
        </>
      )}

      {/* Affected region */}
      <div className="cm-section-label" style={{ marginTop: 14 }}>Scan Metadata</div>
      <div className="cm-meta-grid">
        <div className="cm-meta-item"><span className="cm-meta-lbl">Model</span><span className="cm-meta-val">{result.model || 'DenseNet-121 (CheXpert)'}</span></div>
        <div className="cm-meta-item"><span className="cm-meta-lbl">Processing</span><span className="cm-meta-val">{result.processingTime ? `${result.processingTime} ms` : 'N/A'}</span></div>
        <div className="cm-meta-item"><span className="cm-meta-lbl">Prediction</span><span className="cm-meta-val">{result.prediction}</span></div>
        <div className="cm-meta-item"><span className="cm-meta-lbl">Priority</span><span className="cm-meta-val">{result.priority}</span></div>
      </div>
    </div>
  );
}
