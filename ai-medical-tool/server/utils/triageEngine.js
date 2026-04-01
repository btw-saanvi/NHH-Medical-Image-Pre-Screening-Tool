/**
 * triageEngine.js
 * Maps diagnosis + confidence into clinical urgency levels.
 */

const CRITICAL_CONDITIONS = new Set([
  "Pneumothorax", "Pulmonary Edema", "Tension Pneumothorax",
  "ARDS", "Pulmonary Embolism", "Pulmonary Hemorrhage",
]);

const HIGH_CONDITIONS = new Set([
  "Bacterial Pneumonia", "Pulmonary Tuberculosis", "Pleural Effusion",
  "Cardiomegaly", "Pulmonary Nodule", "Lung Abscess",
  "Bilateral Pneumonia", "Empyema",
]);

const TRIAGE_CONFIG = {
  Critical: {
    level: "Critical",
    color: "#ef4444",
    responseTime: "Immediate — within 15 minutes",
    nextAction: "Alert on-call physician immediately. Begin emergency stabilization. Consider ICU admission.",
    icon: "🚨",
  },
  High: {
    level: "High",
    color: "#f97316",
    responseTime: "Urgent — within 1–2 hours",
    nextAction: "Prioritize radiologist review. Initiate diagnostic workup. Contact attending physician.",
    icon: "🔶",
  },
  Moderate: {
    level: "Moderate",
    color: "#f59e0b",
    responseTime: "Semi-urgent — within 24 hours",
    nextAction: "Schedule specialist consultation. Order confirmatory labs or CT scan. Monitor vitals.",
    icon: "🟡",
  },
  Routine: {
    level: "Routine",
    color: "#22c55e",
    responseTime: "Standard — within 72 hours",
    nextAction: "Routine follow-up. Document findings. Advise patient on preventive measures.",
    icon: "🟢",
  },
};

function getUrgencyLevel(confidence = 50, diagnosis = "") {
  let level;

  if (CRITICAL_CONDITIONS.has(diagnosis) || confidence >= 85 && CRITICAL_CONDITIONS.has(diagnosis)) {
    level = "Critical";
  } else if (CRITICAL_CONDITIONS.has(diagnosis) && confidence >= 60) {
    level = "Critical";
  } else if (HIGH_CONDITIONS.has(diagnosis) && confidence >= 70) {
    level = "High";
  } else if (HIGH_CONDITIONS.has(diagnosis)) {
    level = "Moderate";
  } else if (diagnosis === "No Significant Pathology") {
    level = "Routine";
  } else if (confidence >= 80) {
    level = "High";
  } else if (confidence >= 60) {
    level = "Moderate";
  } else {
    level = "Routine";
  }

  return { ...TRIAGE_CONFIG[level] };
}

module.exports = { getUrgencyLevel };
