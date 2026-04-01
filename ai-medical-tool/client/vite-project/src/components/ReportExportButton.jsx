import { useState } from 'react';
import './ClinicalModules.css';

export default function ReportExportButton({ caseId, compact }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const downloadPDF = async () => {
    if (!caseId) return alert('No case ID available.');
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch(`http://localhost:5000/api/report/${caseId}`);
      if (!res.ok) throw new Error('Report generation failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ClinicalReport-${caseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      alert('Could not generate PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`cm-report-btn ${compact ? 'sm' : ''} ${done ? 'done' : ''}`}
      onClick={downloadPDF}
      disabled={loading || !caseId}
      title={caseId ? `Download PDF for ${caseId}` : 'No case selected'}
    >
      {loading ? (
        <><span className="cm-spin" /> Generating PDF…</>
      ) : done ? (
        <>✓ Downloaded!</>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Clinical Report
        </>
      )}
    </button>
  );
}
