/**
 * diagnosisEngine.js
 * Converts radiographic findings + symptoms into structured clinical diagnoses.
 */

// ── Core rule-base ─────────────────────────────────────────────────────────────
const RULES = [
  {
    id: "PTB",
    primary: "Pulmonary Tuberculosis",
    match: (f, loc, s) =>
      /opacity|infiltrate|consolidation/i.test(f) &&
      /upper/i.test(loc) &&
      (s.weightLoss || s.nightSweats || s.chronicCough),
    differentials: ["Lung Abscess", "Fungal Pneumonia", "Sarcoidosis"],
    reasoning: "Upper lobe opacity with systemic symptoms (weight loss / night sweats) strongly correlates with Mycobacterium tuberculosis infection.",
    severity: "High",
    baseConfidence: 0.82,
  },
  {
    id: "PNA",
    primary: "Bacterial Pneumonia",
    match: (f, loc, s) =>
      /opacity|consolidation/i.test(f) &&
      /lower|middle/i.test(loc) &&
      (s.fever || s.productiveCough),
    differentials: ["Viral Pneumonia", "Atypical Pneumonia", "Pulmonary Edema"],
    reasoning: "Lower/middle lobe consolidation with acute fever and productive cough is the classic presentation of bacterial lobar pneumonia.",
    severity: "High",
    baseConfidence: 0.79,
  },
  {
    id: "PED",
    primary: "Pulmonary Edema",
    match: (f, loc, s) =>
      /bilateral|diffuse|edema/i.test(f) ||
      (/opacity/i.test(f) && /bilateral/i.test(loc)),
    differentials: ["ARDS", "Bilateral Pneumonia", "Pulmonary Hemorrhage"],
    reasoning: "Bilateral diffuse opacification with perihilar distribution is classic for cardiogenic pulmonary edema.",
    severity: "Critical",
    baseConfidence: 0.75,
  },
  {
    id: "ATE",
    primary: "Atelectasis",
    match: (f, loc, s) =>
      /atelectasis|collapse|linear|volume loss/i.test(f) ||
      (/collapse/i.test(loc) && /opacity/i.test(f)),
    differentials: ["Mucus Plugging", "Pleural Effusion", "Diaphragm Elevation"],
    reasoning: "Localized alveolar collapse is identified by linear opacities and volume loss, consistent with subsegmental or lobar atelectasis.",
    severity: "Moderate",
    baseConfidence: 0.78,
  },
  {
    id: "PLF",
    primary: "Pleural Effusion",
    match: (f, loc, s) =>
      /effusion|fluid|blunting/i.test(f) ||
      /pleural/i.test(loc),
    differentials: ["Hemothorax", "Empyema", "Chylothorax"],
    reasoning: "Fluid pattern with blunting of costophrenic angles and dependent opacity indicates pleural space fluid accumulation.",
    severity: "High",
    baseConfidence: 0.84,
  },
  {
    id: "PTX",
    primary: "Pneumothorax",
    match: (f, loc, s) =>
      /pneumothorax|pneumo|pleural line/i.test(f),
    differentials: ["Bullous Emphysema", "Tension Pneumothorax", "Pneumomediastinum"],
    reasoning: "Visceral pleural line visible without peripheral lung markings with hyper-lucent hemithorax indicates intrapleural air.",
    severity: "Critical",
    baseConfidence: 0.91,
  },
  {
    id: "CMG",
    primary: "Cardiomegaly",
    match: (f, loc, s) =>
      /cardiomegaly|cardiac|cardiothoracic/i.test(f) ||
      s.shortBreath && s.legSwelling,
    differentials: ["Pericardial Effusion", "Dilated Cardiomyopathy", "Hypertensive Heart Disease"],
    reasoning: "Enlarged cardiac silhouette with CTR > 0.5 combined with dyspnea suggests structural cardiac enlargement.",
    severity: "High",
    baseConfidence: 0.77,
  },
  {
    id: "NOD",
    primary: "Pulmonary Nodule",
    match: (f, loc, s) =>
      /nodule|mass|lesion/i.test(f),
    differentials: ["Lung Carcinoma", "Pulmonary Metastasis", "Benign Granuloma"],
    reasoning: "Focal pulmonary opacity < 3cm warrants serial monitoring. Spiculated margins raise suspicion of malignancy.",
    severity: "High",
    baseConfidence: 0.68,
  },
  {
    id: "NOR",
    primary: "No Significant Pathology",
    match: (f, loc, s) => /no finding|normal|clear/i.test(f),
    differentials: ["Early Infiltrate", "Technical Limitation"],
    reasoning: "Lung fields appear clear with no acute radiographic abnormality.",
    severity: "Routine",
    baseConfidence: 0.88,
  },
];

// ── Confidence adjuster based on symptom count ─────────────────────────────────
function adjustConfidence(base, symptoms) {
  const positiveCount = Object.values(symptoms).filter(Boolean).length;
  const boost = Math.min(positiveCount * 0.03, 0.12);
  return Math.min(Math.round((base + boost) * 100), 97);
}

// ── Main inference function ────────────────────────────────────────────────────
function inferDisease(finding = "", location = "", symptoms = {}) {
  const matches = RULES.filter((r) => r.match(finding, location, symptoms));

  if (matches.length === 0) {
    return {
      primaryDiagnosis: "Unspecified Radiographic Abnormality",
      differentialDiagnoses: ["Clinical correlation required", "Expert review recommended"],
      reasoning: "The provided finding does not match any specific diagnostic pattern. Clinical correlation with patient history is essential.",
      confidence: 50,
      severity: "Moderate",
    };
  }

  // Pick highest base confidence match
  const top = matches.sort((a, b) => b.baseConfidence - a.baseConfidence)[0];
  const others = matches
    .filter((r) => r.id !== top.id)
    .map((r) => r.primary)
    .slice(0, 2);

  return {
    primaryDiagnosis: top.primary,
    differentialDiagnoses: [...others, ...top.differentials].slice(0, 3),
    reasoning: top.reasoning,
    confidence: adjustConfidence(top.baseConfidence, symptoms),
    severity: top.severity,
  };
}

module.exports = { inferDisease };
