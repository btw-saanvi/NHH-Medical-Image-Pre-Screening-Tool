const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const AI_SERVICE_URL = "http://localhost:8000";

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

let caseCounter = 100;

// ─── Check AI service health ────────────────────────────────────────────────
async function isAIServiceOnline() {
  try {
    await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Mock fallback ───────────────────────────────────────────────────────────
const DISEASES = ["Pneumonia","Pleural Effusion","Cardiomegaly","Atelectasis","Nodule","No Finding","No Finding","No Finding"];
const FINDINGS_MAP = {
  "Pneumonia": ["Increased opacity in lower lobe","Possible consolidation pattern","Air-space disease noted"],
  "Pleural Effusion": ["Blunting of costophrenic angle","Homogeneous opacity at base","Possible mediastinal shift"],
  "Cardiomegaly": ["Cardiothoracic ratio > 0.5","Enlarged cardiac silhouette","Pulmonary vascular congestion"],
  "Atelectasis": ["Linear opacities noted","Volume loss in affected lobe","Displacement of fissures"],
  "Nodule": ["Rounded opacity < 3cm detected","Further characterization recommended","CT follow-up advised"],
  "No Finding": ["Clear lung fields bilaterally","Normal cardiac silhouette","No acute cardiopulmonary process"],
};
const RECS = {
  Critical: "URGENT: Immediate radiologist review required. Do not delay.",
  High: "Priority review within 2 hours recommended.",
  Medium: "Schedule radiologist review within 24 hours.",
  Low: "No immediate action required. Routine follow-up advised.",
};

function mockAnalysis() {
  const disease = DISEASES[Math.floor(Math.random() * DISEASES.length)];
  const isNormal = disease === "No Finding";
  const confidence = isNormal
    ? Math.floor(Math.random() * 10 + 88)
    : Math.floor(Math.random() * 18 + 78);
  const r = Math.random();
  const priority = isNormal
    ? "Low"
    : r > 0.7 ? "Critical" : r > 0.45 ? "High" : "Medium";

  return {
    prediction: isNormal ? "Normal" : "Abnormal",
    disease,
    confidence: confidence / 100,
    priority,
    findings: FINDINGS_MAP[disease] || FINDINGS_MAP["No Finding"],
    recommendation: RECS[priority],
    all_pathologies: {},
    heatmap: null,
    model: "mock (AI service offline)",
  };
}

// ─── Main upload route ───────────────────────────────────────────────────────
app.post("/upload", upload.single("image"), async (req, res) => {
  caseCounter++;
  const caseId = `A${caseCounter}`;
  const uploadedFilePath = req.file?.path;
  let result;

  const aiOnline = await isAIServiceOnline();

  if (aiOnline && uploadedFilePath) {
    try {
      // Forward to Python AI service
      const formData = new FormData();
      formData.append("file", fs.createReadStream(uploadedFilePath), {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, formData, {
        headers: formData.getHeaders(),
        timeout: 60000,
      });

      result = aiResponse.data;
      console.log(`[${caseId}] AI Analysis: ${result.disease} (${(result.confidence * 100).toFixed(1)}%) — ${result.priority}`);
    } catch (err) {
      console.warn(`[${caseId}] AI service error, using mock: ${err.message}`);
      result = mockAnalysis();
    }
  } else {
    if (!aiOnline) console.warn(`[${caseId}] AI service offline — using mock`);
    result = mockAnalysis();
  }

  // Format confidence as 0-100 integer for frontend
  const confidencePct = result.confidence <= 1
    ? Math.round(result.confidence * 100)
    : Math.round(result.confidence);

  res.json({
    caseId,
    prediction: result.prediction,
    disease: result.disease,
    confidence: confidencePct,
    priority: result.priority,
    findings: result.findings,
    recommendation: result.recommendation,
    all_pathologies: result.all_pathologies || {},
    heatmap: result.heatmap || null,
    imageFile: req.file ? req.file.filename : null,
    processingTime: result.processing_time_ms || null,
    model: result.model || "DenseNet-121",
    aiService: aiOnline ? "online" : "offline",
    timestamp: new Date().toISOString(),
  });
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  const aiOnline = await isAIServiceOnline();
  res.json({
    status: "online",
    aiService: aiOnline ? "online" : "offline",
    aiServiceUrl: AI_SERVICE_URL,
    model: "DenseNet-121 (CheXpert)",
    uptime: Math.floor(process.uptime()),
  });
});

app.get("/cases", (req, res) => {
  res.json({ total: 247, critical: 8, high: 23, medium: 41, low: 175 });
});

app.listen(5000, () => {
  console.log("🏥 MedAI Backend running on http://localhost:5000");
  console.log(`📡 Proxying AI requests to: ${AI_SERVICE_URL}`);
});