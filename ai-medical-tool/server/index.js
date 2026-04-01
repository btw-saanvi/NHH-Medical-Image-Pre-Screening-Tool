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

// ─── Main upload route ───────────────────────────────────────────────────────
app.post("/upload", upload.single("image"), async (req, res) => {
  caseCounter++;
  const caseId = `A${caseCounter}`;
  const uploadedFilePath = req.file?.path;

  if (!uploadedFilePath) {
    return res.status(400).json({ error: "No image file uploaded" });
  }

  const aiOnline = await isAIServiceOnline();

  if (!aiOnline) {
    console.error(`[${caseId}] AI Service Offline — Failing request`);
    return res.status(503).json({ 
      error: "AI Analysis Service is currently offline. Please start the AI model server.",
      caseId 
    });
  }

  try {
    // Forward to Python AI service
    const formData = new FormData();
    formData.append("file", fs.createReadStream(uploadedFilePath), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    console.log(`[${caseId}] Forwarding to AI service...`);
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, formData, {
      headers: formData.getHeaders(),
      timeout: 120000, // Increased timeout for real model inference
    });

    const result = aiResponse.data;
    
    // Format confidence as 0-100 integer for frontend
    const confidencePct = result.confidence <= 1
      ? Math.round(result.confidence * 100)
      : Math.round(result.confidence);

    console.log(`[${caseId}] AI Analysis Success: ${result.disease} (${confidencePct}%)`);

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
      imageFile: req.file.filename,
      processingTime: result.processing_time_ms || null,
      model: result.model || "DenseNet-121",
      aiService: "online",
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error(`[${caseId}] AI service error: ${err.message}`);
    res.status(502).json({ 
      error: "AI model encountered an error during inference. Please check ai-model logs.",
      details: err.message,
      caseId
    });
  }
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
  // In a real app this would query a database
  res.json({ total: 247, critical: 8, high: 23, medium: 41, low: 175 });
});

app.listen(5000, () => {
  console.log("🏥 MedAI Backend running on http://localhost:5000");
  console.log(`📡 STRICT MODE: Proxying all requests to: ${AI_SERVICE_URL}`);
  console.log("⚠️ MOCK FALLBACKS HAVE BEEN REMOVED.");
});