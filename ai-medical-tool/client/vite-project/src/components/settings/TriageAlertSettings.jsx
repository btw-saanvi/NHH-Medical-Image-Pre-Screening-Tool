import { useState, useEffect } from 'react';
import '../ClinicalModules.css';
import './Settings.css';

const TOGGLES = [
  { key: 'criticalAlerts',     label: 'Critical Alerts',       desc: 'Notify when Critical priority case detected',    color: '#ef4444' },
  { key: 'highPriorityAlerts', label: 'High Priority Alerts',  desc: 'Notify when High priority case detected',       color: '#f97316' },
  { key: 'emailNotifications', label: 'Email Notifications',   desc: 'Send email to radiologist on critical finding', color: '#6c63ff' },
  { key: 'dashboardPopup',     label: 'Dashboard Popups',      desc: 'Show in-app toast notifications',               color: '#14b8a6' },
];

export default function TriageAlertSettings() {
  const [settings, setSettings] = useState({ criticalAlerts: true, highPriorityAlerts: true, emailNotifications: false, dashboardPopup: true });
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/settings').then(r => r.json()).then(d => {
      setSettings({ criticalAlerts: d.criticalAlerts, highPriorityAlerts: d.highPriorityAlerts, emailNotifications: d.emailNotifications, dashboardPopup: d.dashboardPopup });
    }).catch(() => {});
  }, []);

  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch('http://localhost:5000/api/settings/alerts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  return (
    <div className="sc-card">
      <div className="sc-card-header">
        <div className="sc-icon red">🔔</div>
        <div><div className="sc-label">Alerting</div><h3 className="sc-title">Triage Alert Settings</h3></div>
      </div>
      <div className="sc-toggle-list">
        {TOGGLES.map(({ key, label, desc, color }) => (
          <div key={key} className={`sc-toggle-row ${settings[key] ? 'on' : ''}`} onClick={() => toggle(key)}>
            <div className="sc-toggle-info">
              <span className="sc-toggle-dot" style={{ background: settings[key] ? color : '#d1d5db' }} />
              <div>
                <div className="sc-toggle-label">{label}</div>
                <div className="sc-toggle-desc">{desc}</div>
              </div>
            </div>
            <div className={`sc-switch ${settings[key] ? 'on' : ''}`} style={{ '--on-color': color }}>
              <div className="sc-switch-thumb" />
            </div>
          </div>
        ))}
      </div>
      <button className={`sc-save-btn ${saved ? 'saved' : ''}`} onClick={save} disabled={saving}>
        {saving ? '⏳ Saving…' : saved ? '✓ Saved!' : 'Save Alert Config'}
      </button>
    </div>
  );
}
