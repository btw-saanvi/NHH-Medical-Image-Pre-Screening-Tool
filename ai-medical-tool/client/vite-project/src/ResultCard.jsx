import { useRef } from 'react';
import './ResultCard.css';

function ResultCard({ result, preview, onBack }) {
  const isAbnormal = result.prediction === 'Abnormal';
  const confidence = result.confidence ?? 88;
  const hasRealHeatmap = !!result.heatmap;
  
  const exportReport = () => {
    const reportDate = new Date().toLocaleString();
    const caseId = result.caseId || 'A???';
    const report = `
══════════════════════════════════════════════════════════
          Radio-Matic DIAGNOSTIC REPORT
══════════════════════════════════════════════════════════
  Case ID:         ${caseId}
  Date:            ${reportDate}
  Prediction:      ${result.prediction}
  Disease:         ${result.disease || 'N/A'}
  Confidence:      ${confidence}%
  Priority:        ${result.priority}
──────────────────────────────────────────────────────────
  DIAGNOSIS:
  ${result.diagnosis || 'Clinical correlation required.'}
──────────────────────────────────────────────────────────
  FINDINGS:
  ${(result.findings || []).map((f, i) => `${i + 1}. ${f}`).join('\n  ')}
──────────────────────────────────────────────────────────
  RECOMMENDATION:
  ${result.recommendation || 'Clinical correlation required.'}
══════════════════════════════════════════════════════════
`;
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report-${caseId}.txt`;
    a.click();
  };

  return (
    <div className="diagnostic-view animate-fade-in">
      <div className="diag-top-bar">
        <button className="back-link" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Analysis
        </button>
        <div className="diag-actions">
          <button className="btn-secondary sm" onClick={exportReport}>Download Report</button>
          <button className="btn-primary sm">Notify Radiologist</button>
        </div>
      </div>

      <div className="diag-grid">
        {/* Left: Imaging */}
        <div className="diag-imaging">
          <div className="imaging-card">
            <div className="img-lbl">Original Scan</div>
            <img src={preview} alt="Original Scan" className="main-scan" />
          </div>
          <div className="imaging-card">
             <div className="img-lbl">Diagnostic Heatmap (Grad-CAM)</div>
             <div className="heatmap-container">
               {hasRealHeatmap ? (
                 <img src={result.heatmap} alt="AI Heatmap" className="main-scan" />
               ) : (
                 <div className="heatmap-fallback">
                   <img src={preview} alt="Fallback" className="main-scan grayscale" />
                   <div className="fallback-overlay">Generating visualization...</div>
                 </div>
               )}
               <div className="heatmap-gradient-bar">
                 <span>Low Probability</span>
                 <div className="g-bar"></div>
                 <span>High Probability</span>
               </div>
             </div>
          </div>
        </div>

        {/* Right: Analysis Details */}
        <div className="diag-details">
          <div className="detail-card main">
            <div className={`prediction-badge ${isAbnormal ? 'abnormal' : 'normal'}`}>
               {isAbnormal ? '⚠ Abnormal Discovery' : '✓ Normal Findings'}
            </div>
            <h2 className="disease-title">{result.disease || 'No Significant Finding'}</h2>
            
            <div className="confidence-gauge">
               <svg viewBox="0 0 36 36" className="circular-chart">
                 <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                 <path className="circle" strokeDasharray={`${confidence}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                 <text x="18" y="20.35" className="percentage">{confidence}%</text>
               </svg>
               <span className="gauge-lbl">AI Confidence Score</span>
            </div>
          </div>

          {/* AI Diagnosis Section */}
          <div className="detail-card diagnosis-card">
            <div className="card-header-with-icon">
              <h4 className="card-subtitle">Automated AI Clinical Diagnosis</h4>
              <span className="badge-ai-model">V2.4 CLINICAL</span>
            </div>
            <div className="diagnosis-box">
              <div className="diag-icon-accent">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <p className="diagnosis-text">{result.diagnosis || 'Processing formal diagnostic statement...'}</p>
            </div>
          </div>

          <div className="detail-card findings-list-card">
            <h4 className="card-subtitle">Key Radiographic Observations</h4>
            <ul className="findings-bullet-list">
              {(result.findings || []).map((f, i) => (
                <li key={i}>
                  <div className="bullet-indicator"></div>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="detail-card differential-card">
            <h4 className="card-subtitle">Differential Probability Analysis</h4>
            <p className="differential-desc">Probability distribution across top weighted pathologies:</p>
            <div className="pathology-breakdown">
               {Object.entries(result.all_pathologies || {}).slice(0, 5).map(([name, prob]) => (
                 <div key={name} className="path-row">
                    <div className="p-header">
                      <span className="p-name">{name}</span>
                      <span className="p-val">{Math.round(prob * 100)}%</span>
                    </div>
                    <div className="p-track">
                       <div 
                         className={`p-fill ${prob > 0.6 ? 'high' : prob > 0.3 ? 'medium' : 'low'}`} 
                         style={{ width: `${prob * 100}%` }}
                       ></div>
                    </div>
                 </div>
               ))}
            </div>
          </div>

          <div className={`recommendation-box ${result.priority?.toLowerCase()}`}>
             <div className="rec-header">
                <div className="prio-tag">
                  <div className={`prio-dot ${result.priority?.toLowerCase()}`}></div>
                  <span className="rec-prio-lbl">{result.priority} CLINICAL PRIORITY</span>
                </div>
                <span className="rec-icon-shield">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>
             </div>
             <p className="rec-text">{result.recommendation}</p>
          </div>
        </div>
      </div>

      <div className="clinical-disclaimer">
         <p><strong>Clinical Disclaimer:</strong> This AI-generated insight is a preliminary pre-screening tool designed to assist in triage. It must not be interpreted as a final medical diagnosis. All findings and heatmaps must be validated by a licensed radiologist or clinical specialist prior to any medical intervention.</p>
      </div>
    </div>
  );
}

export default ResultCard;
