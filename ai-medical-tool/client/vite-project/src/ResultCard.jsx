import { useState } from 'react';
import './ResultCard.css';
import DiagnosisCard       from './components/DiagnosisCard';
import SymptomCorrelationForm from './components/SymptomCorrelationForm';
import TriagePanel         from './components/TriagePanel';
import ReportExportButton  from './components/ReportExportButton';
import ScanComparisonPanel from './components/ScanComparisonPanel';
import AIReasoningPanel    from './components/AIReasoningPanel';

function ResultCard({ result, preview, onBack }) {
  const isAbnormal  = result.prediction === 'Abnormal';
  const confidence  = result.confidence ?? 88;
  const hasRealHeatmap = !!result.heatmap;

  // Clinical engine state
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [triageResult, setTriageResult] = useState(null);
  const [activeTab, setActiveTab] = useState('report'); // 'report' | 'clinical' | 'compare' | 'ai'

  // Auto-run triage when diagnosis comes back
  const handleDiagnosisResult = async (data) => {
    setDiagnosisResult(data);
    // Also fetch triage
    try {
      const res = await fetch('http://localhost:5000/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: data.confidence, diagnosis: data.primaryDiagnosis }),
      });
      const triage = await res.json();
      setTriageResult(triage);
    } catch { /* silent */ }
  };

  return (
    <div className="diagnostic-view animate-fade-in">
      {/* Top bar */}
      <div className="diag-top-bar">
        <button className="back-link" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Analysis
        </button>
        <div className="diag-actions">
          <ReportExportButton caseId={result.caseId} compact />
          <button className="btn-primary sm">Notify Radiologist</button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="result-tabs">
        {[
          { id: 'report',   label: '📋 Report',   },
          { id: 'clinical', label: '🔬 Clinical Engine', },
          { id: 'compare',  label: '📊 Comparison', },
          { id: 'ai',       label: '🤖 AI Explainability', },
        ].map(tab => (
          <button
            key={tab.id}
            className={`result-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Main Report ── */}
      {activeTab === 'report' && (
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
                  <div className="g-bar" />
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
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%"   stopColor="#6c63ff" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="circle" strokeDasharray={`${confidence}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <text x="18" y="20.35" className="percentage">{confidence}%</text>
                </svg>
                <span className="gauge-lbl">AI Confidence Score</span>
              </div>
            </div>

            <div className="detail-card diagnosis-card">
              <div className="card-header-with-icon">
                <h4 className="card-subtitle">Automated AI Clinical Diagnosis</h4>
                <span className="badge-ai-model">V2.4 CLINICAL</span>
              </div>
              <div className="diagnosis-box">
                <div className="diag-icon-accent">🧬</div>
                <p className="diagnosis-text">{result.diagnosis || 'Processing formal diagnostic statement...'}</p>
              </div>
            </div>

            <div className="detail-card findings-list-card">
              <h4 className="card-subtitle">Key Radiographic Observations</h4>
              <ul className="findings-bullet-list">
                {(result.findings || []).map((f, i) => (
                  <li key={i}><div className="bullet-indicator" /><span>{f}</span></li>
                ))}
              </ul>
            </div>

            <div className="detail-card differential-card">
              <h4 className="card-subtitle">Differential Probability Analysis</h4>
              <div className="pathology-breakdown">
                {Object.entries(result.all_pathologies || {}).slice(0, 5).map(([name, prob]) => (
                  <div key={name} className="path-row">
                    <div className="p-header">
                      <span className="p-name">{name}</span>
                      <span className="p-val">{Math.round(prob * 100)}%</span>
                    </div>
                    <div className="p-track">
                      <div className={`p-fill ${prob > 0.6 ? 'high' : prob > 0.3 ? 'medium' : 'low'}`} style={{ width: `${prob * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`recommendation-box ${result.priority?.toLowerCase()}`}>
              <div className="rec-header">
                <div className="prio-tag">
                  <div className={`prio-dot ${result.priority?.toLowerCase()}`} />
                  <span className="rec-prio-lbl">{result.priority} CLINICAL PRIORITY</span>
                </div>
                <span className="rec-icon-shield">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </span>
              </div>
              <p className="rec-text">{result.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Clinical Engine ── */}
      {activeTab === 'clinical' && (
        <div className="clinical-tab-grid">
          <SymptomCorrelationForm
            finding={result.disease}
            location=""
            onResult={handleDiagnosisResult}
            onLoading={setDiagnosisLoading}
          />
          <div className="clinical-right-col">
            <DiagnosisCard data={diagnosisResult} loading={diagnosisLoading} />
            <TriagePanel   triage={triageResult}  loading={diagnosisLoading} />
          </div>
        </div>
      )}

      {/* ── TAB: Scan Comparison ── */}
      {activeTab === 'compare' && (
        <div className="compare-tab-wrap">
          {result.patientId || result.patientName ? (
            <ScanComparisonPanel
              patientId={result.patientId || result.patientName}
            />
          ) : (
            <div className="cm-card">
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                🔍 No patient ID linked to this scan. Submit a scan with patient details to enable comparison.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: AI Explainability ── */}
      {activeTab === 'ai' && (
        <div className="ai-tab-wrap">
          <AIReasoningPanel result={result} />
        </div>
      )}

      <div className="clinical-disclaimer">
        <p><strong>Clinical Disclaimer:</strong> This AI-generated insight is a preliminary pre-screening tool designed to assist in triage. It must not be interpreted as a final medical diagnosis. All findings and heatmaps must be validated by a licensed radiologist or clinical specialist prior to any medical intervention.</p>
      </div>
    </div>
  );
}

export default ResultCard;
