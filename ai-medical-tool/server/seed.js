/**
 * seed.js — Populate MongoDB with NIH ChestX-ray14 dataset-style records.
 *
 * The NIH ChestX-ray14 dataset (Data_Entry_2017.csv) contains:
 *   Image Index, Finding Labels (pipe-separated), Follow-up #,
 *   Patient ID, Patient Age, Patient Gender, View Position, ...
 *
 * We replicate that schema and enrich each record with the same
 * AI-analysis fields the live /upload endpoint produces.
 *
 * Run: node seed.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Case = require("./models/Case");

// ── NIH ChestX-ray14 pathologies ──────────────────────────────────────────────
const NIH_PATHOLOGIES = [
  "Atelectasis", "Consolidation", "Infiltration", "Pneumothorax",
  "Edema",       "Emphysema",    "Fibrosis",     "Effusion",
  "Pneumonia",   "Pleural Thickening", "Cardiomegaly", "Nodule",
  "Mass",        "Hernia",       "No Finding",
];

const HIGH_SEVERITY = new Set([
  "Pneumothorax", "Pneumonia", "Effusion", "Consolidation", "Edema",
]);
const MEDIUM_SEVERITY = new Set([
  "Atelectasis", "Infiltration", "Fibrosis", "Nodule",
  "Mass", "Cardiomegaly", "Emphysema",
]);

const SCAN_TYPES = ["X-Ray", "X-Ray", "X-Ray", "CT Scan", "MRI"];   // weighted toward X-Ray
const ORGANS     = ["Chest", "Chest", "Chest", "Lung", "Thorax"];

// Per-disease realistic findings (matches ai-model/main.py)
const FINDINGS_MAP = {
  Pneumonia:            ["Increased opacity in lower lobe", "Possible consolidation pattern", "Air-space disease noted"],
  "Pleural Thickening": ["Pleural margin irregularity", "Thickened pleural surface noted", "No significant effusion"],
  Effusion:             ["Fluid accumulation detected in pleural space", "Blunted costophrenic angle", "Increased basal density"],
  Cardiomegaly:         ["Cardiothoracic ratio > 0.5", "Enlarged cardiac silhouette", "Pulmonary vascular congestion noted"],
  Atelectasis:          ["Linear opacities consistent with atelectasis", "Volume loss in affected lobe", "Possible displacement of fissures"],
  Pneumothorax:         ["Visible pleural line without lung markings", "Possible partial lung collapse", "Urgent decompression may be required"],
  Edema:                ["Bilateral perihilar opacities", "Cephalization of pulmonary vessels", "Possible Kerley B lines"],
  Nodule:               ["Rounded opacity < 3 cm detected", "Further characterization recommended", "Low-dose CT follow-up advised"],
  Fibrosis:             ["Reticular opacities in lung bases", "Honeycombing pattern possible", "Restrictive lung disease suspected"],
  Emphysema:            ["Hyperinflation of lung fields", "Flattening of diaphragm", "Decreased vascular markings"],
  Mass:                 ["Soft tissue density mass detected", "Spiculated margins noted", "CT correlation recommended urgently"],
  Consolidation:        ["Air-space consolidation noted", "Air bronchograms may be present", "Infectious vs. non-infectious etiology to exclude"],
  Infiltration:         ["Patchy infiltrates in lung parenchyma", "Non-specific interstitial pattern", "Follow-up imaging recommended"],
  Hernia:               ["Bowel gas visible in thoracic cavity", "Diaphragmatic defect suspected", "Surgical referral recommended"],
  "No Finding":         ["Clear lung fields bilaterally", "Normal cardiac silhouette", "No acute cardiopulmonary process"],
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pad(n, len = 5) { return String(n).padStart(len, "0"); }

function assignPriority(disease, confidence) {
  if (disease === "No Finding") return "Low";
  if (HIGH_SEVERITY.has(disease))   return confidence > 60 ? "Critical" : "High";
  if (MEDIUM_SEVERITY.has(disease)) return confidence > 70 ? "High"     : "Medium";
  return "Medium";
}

function buildAllPathologies(primaryDisease, primaryConf) {
  const result = {};
  NIH_PATHOLOGIES.forEach((p) => {
    if (p === primaryDisease) {
      result[p] = primaryConf / 100;
    } else if (p === "No Finding") {
      result[p] = primaryDisease === "No Finding" ? primaryConf / 100 : rand(2, 15) / 100;
    } else {
      result[p] = rand(1, 30) / 100;
    }
  });
  return result;
}

function buildRecord(index) {
  const patientId   = pad(rand(1, 32717));
  const patientAge  = rand(18, 85);
  const patientGender = pick(["M", "F"]);
  const viewPosition  = pick(["PA", "AP", "PA", "PA"]);   // mostly PA
  const imageIndex    = `${pad(rand(1, 9999), 8)}_${pad(rand(0, 9), 3)}.png`;
  const followUpNum   = rand(0, 5);

  // NIH multi-label: 70 % single label, 30 % two labels
  const numFindings = Math.random() < 0.3 ? 2 : 1;
  const chosen = [];
  for (let i = 0; i < numFindings; i++) {
    let p;
    do { p = pick(NIH_PATHOLOGIES); } while (chosen.includes(p));
    chosen.push(p);
  }
  // primary (for AI output) is the first
  const primaryDisease = chosen[0] === "No Finding" && chosen.length > 1 ? chosen[1] : chosen[0];
  const isNormal       = primaryDisease === "No Finding";
  const confidence     = isNormal ? rand(88, 98) : rand(55, 97);
  const priority       = assignPriority(primaryDisease, confidence);
  const scanType       = pick(SCAN_TYPES);
  const organ          = pick(ORGANS);
  const processingTime = rand(180, 2400);

  const recommendations = {
    Critical: `URGENT: Immediate radiologist review for ${primaryDisease}. Do not delay clinical intervention.`,
    High:     `Priority review required within 2 hours. ${primaryDisease} pattern detected with high confidence.`,
    Medium:   `Schedule radiologist review within 24 hours. ${primaryDisease} findings noted.`,
    Low:      "No acute findings. Routine follow-up as clinically indicated.",
  };

  const caseId = `A${100 + index}`;

  // Spread createdAt over the last 90 days (most recent first for lower indices)
  const daysAgo    = rand(0, 90);
  const createdAt  = new Date(Date.now() - daysAgo * 86400000 - rand(0, 86400000));

  return {
    caseId,
    patientId,
    patientAge,
    patientGender,
    viewPosition,
    imageIndex,
    prediction:     isNormal ? "Normal" : "Abnormal",
    disease:        primaryDisease,
    confidence,
    priority,
    findings:       FINDINGS_MAP[primaryDisease] || [`${primaryDisease} pattern detected`, "Clinical correlation advised"],
    recommendation: recommendations[priority],
    allPathologies: buildAllPathologies(primaryDisease, confidence),
    findingLabels:  chosen,
    scanType,
    organ,
    imageFile:      null,
    heatmap:        null,
    model:          "DenseNet-121 (CheXpert)",
    processingTime,
    aiService:      "online",
    source:         "nih_seed",
    createdAt,
    updatedAt:      createdAt,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/radio-matic");
  console.log("✅ Connected to MongoDB");

  // Remove only seeded records (preserve real uploads)
  const deleted = await Case.deleteMany({ source: "nih_seed" });
  console.log(`🗑  Removed ${deleted.deletedCount} old seed records`);

  const records = Array.from({ length: 120 }, (_, i) => buildRecord(i + 1));
  await Case.insertMany(records, { ordered: false });

  console.log(`✅ Seeded ${records.length} NIH ChestX-ray14 style cases into MongoDB`);

  const stats = await Case.aggregate([
    { $group: { _id: "$priority", count: { $sum: 1 } } },
  ]);
  console.log("📊 Priority distribution:", Object.fromEntries(stats.map((s) => [s._id, s.count])));

  await mongoose.disconnect();
  console.log("🔌 Disconnected.");
}

seed().catch((err) => { console.error(err); process.exit(1); });
