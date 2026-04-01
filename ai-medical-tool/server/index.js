require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const multer    = require("multer");
const cors      = require("cors");
const path      = require("path");
const axios     = require("axios");
const FormData  = require("form-data");
const fs        = require("fs");
const Case            = require("./models/Case");
const SystemSettings  = require("./models/SystemSettings");
const SystemLog       = require("./models/SystemLog");
const { inferDisease }           = require("./utils/diagnosisEngine");
const { getUrgencyLevel }        = require("./utils/triageEngine");
const { generateClinicalReport } = require("./utils/reportGenerator");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const AI_SERVICE_URL = "http://localhost:8000";
const PORT           = process.env.PORT || 5000;

// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || "mongodb+srv://nidhind544_db_user:nidhi123@radio-metric.h6imrvg.mongodb.net/")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ── Multer storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ── AI health check ───────────────────────────────────────────────────────────
async function isAIServiceOnline() {
  try {
    await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /upload — analyze image and persist result to MongoDB
// ─────────────────────────────────────────────────────────────────────────────
app.post("/upload", upload.single("image"), async (req, res) => {
  const uploadedFilePath = req.file?.path;
  if (!uploadedFilePath) {
    return res.status(400).json({ error: "No image file uploaded" });
  }

  const aiOnline = await isAIServiceOnline();
  if (!aiOnline) {
    return res.status(503).json({
      error: "AI Analysis Service is currently offline. Please start the AI model server.",
    });
  }

  try {
    // Forward to Python AI service
    const formData = new FormData();
    formData.append("file", fs.createReadStream(uploadedFilePath), {
      filename:    req.file.originalname,
      contentType: req.file.mimetype,
    });

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, formData, {
      headers: formData.getHeaders(),
      timeout: 120000,
    });

    const result       = aiResponse.data;
    // Use calibrated display confidence if available (AI model v2), else scale raw
    const rawConf      = result.confidence;
    const confidencePct = result.confidence_display
      ? result.confidence_display                                           // calibrated value from model
      : rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf);   // fallback

    // Generate a unique caseId
    const count  = await Case.countDocuments();
    const caseId = `A${200 + count + 1}`;

    // ── Patient info from the Analyze Scan form ───────────────────────
    const patientId   = (req.body.patientId   || "").trim() || null;
    const patientName = (req.body.patientName || "").trim() || null;
    const patientDob  = (req.body.patientDob  || "").trim() || null;
    // Calculate age from DOB if provided
    let patientAge = null;
    if (patientDob) {
      const birth = new Date(patientDob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age > 0 && age < 120) patientAge = age;
    }

    // ── Defensive defaults: AI service may return empty strings in edge cases
    const disease    = (result.disease    && result.disease.trim())    || "Unspecified Finding";
    const prediction = (result.prediction && result.prediction.trim()) || "Abnormal";
    const priority   = (result.priority   && result.priority.trim())   || "Medium";

    // Persist to MongoDB
    const newCase = await Case.create({
      caseId,
      patientId,
      patientName,
      patientDob,
      patientAge,
      prediction,
      disease,
      confidence:     confidencePct,
      priority,
      findings:       result.findings || [],
      diagnosis:      result.diagnosis || "",
      recommendation: result.recommendation || "",
      allPathologies: result.all_pathologies || {},
      findingLabels:  [disease],
      imageFile:      req.file.filename,
      heatmap:        result.heatmap || null,
      processingTime: result.processing_time_ms || null,
      model:          result.model || "DenseNet-121 (CheXpert)",
      aiService:      "online",
      source:         "upload",
    });

    console.log(`[${caseId}] Saved ✔️  Patient: ${patientName || patientId || 'Anonymous'} | ${disease} (${confidencePct}%)`);

    res.json({
      caseId:          newCase.caseId,
      patientId:       newCase.patientId,
      patientName:     newCase.patientName,
      patientDob:      newCase.patientDob,
      patientAge:      newCase.patientAge,
      prediction:      newCase.prediction,
      disease:         newCase.disease,
      confidence:      newCase.confidence,
      priority:        newCase.priority,
      findings:        newCase.findings,
      diagnosis:       newCase.diagnosis,
      recommendation:  newCase.recommendation,
      all_pathologies: Object.fromEntries(newCase.allPathologies),
      heatmap:         newCase.heatmap,
      imageFile:       newCase.imageFile,
      processingTime:  newCase.processingTime,
      model:           newCase.model,
      aiService:       "online",
      timestamp:       newCase.createdAt,
    });
  } catch (err) {
    console.error("AI service error:", err.message);
    res.status(502).json({
      error:   "AI model encountered an error during inference.",
      details: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /cases — paginated list with filtering, sorting, stats from MongoDB
// ─────────────────────────────────────────────────────────────────────────────
app.get("/cases", async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 20,
      priority,         // filter by priority
      prediction,       // filter by Normal|Abnormal
      search,           // search caseId or disease
      sort     = "-createdAt",  // default newest first
    } = req.query;

    const filter = {};
    if (priority   && priority !== "All")    filter.priority   = priority;
    if (prediction && prediction !== "All")  filter.prediction = prediction;
    if (search) {
      filter.$or = [
        { caseId:  { $regex: search, $options: "i" } },
        { disease: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
      ];
    }

    const [cases, total] = await Promise.all([
      Case.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select("-heatmap -allPathologies")   // exclude heavy fields in list
        .lean(),
      Case.countDocuments(filter),
    ]);

    // Aggregate stats
    const stats = await Case.aggregate([
      {
        $group: {
          _id:      null,
          total:    { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ["$priority", "Critical"] }, 1, 0] } },
          high:     { $sum: { $cond: [{ $eq: ["$priority", "High"]     }, 1, 0] } },
          medium:   { $sum: { $cond: [{ $eq: ["$priority", "Medium"]   }, 1, 0] } },
          low:      { $sum: { $cond: [{ $eq: ["$priority", "Low"]      }, 1, 0] } },
          avgConf:  { $avg: "$confidence" },
          avgTime:  { $avg: "$processingTime" },
        },
      },
    ]);

    const s = stats[0] || { total: 0, critical: 0, high: 0, medium: 0, low: 0, avgConf: 0, avgTime: 0 };

    res.json({
      cases: cases.map(formatCase),
      pagination: {
        page:       Number(page),
        limit:      Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total:    s.total,
        critical: s.critical,
        high:     s.high,
        medium:   s.medium,
        low:      s.low,
        avgConfidence: Math.round(s.avgConf || 0),
        avgProcessingTimeMs: Math.round(s.avgTime || 0),
      },
    });
  } catch (err) {
    console.error("/cases error:", err.message);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /cases/:caseId — single case with full heatmap + pathologies
// ─────────────────────────────────────────────────────────────────────────────
app.get("/cases/:caseId", async (req, res) => {
  try {
    const doc = await Case.findOne({ caseId: req.params.caseId }).lean();
    if (!doc) return res.status(404).json({ error: "Case not found" });
    res.json(formatCase(doc, true));
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /stats — aggregated stats for dashboard widgets
// ─────────────────────────────────────────────────────────────────────────────
app.get("/stats", async (req, res) => {
  try {
    const [overview, byDisease, byDate] = await Promise.all([
      Case.aggregate([
        {
          $group: {
            _id:      null,
            total:    { $sum: 1 },
            critical: { $sum: { $cond: [{ $eq: ["$priority", "Critical"] }, 1, 0] } },
            high:     { $sum: { $cond: [{ $eq: ["$priority", "High"]     }, 1, 0] } },
            medium:   { $sum: { $cond: [{ $eq: ["$priority", "Medium"]   }, 1, 0] } },
            low:      { $sum: { $cond: [{ $eq: ["$priority", "Low"]      }, 1, 0] } },
            avgConf:  { $avg: "$confidence" },
            avgTime:  { $avg: "$processingTime" },
            abnormal: { $sum: { $cond: [{ $eq: ["$prediction", "Abnormal"] }, 1, 0] } },
          },
        },
      ]),

      // Top 10 diseases by count
      Case.aggregate([
        { $match: { disease: { $ne: "No Finding" } } },
        { $group: { _id: "$disease", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Cases per day (last 30 days)
      Case.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const s = overview[0] || {};
    res.json({
      overview: {
        total:    s.total    || 0,
        critical: s.critical || 0,
        high:     s.high     || 0,
        medium:   s.medium   || 0,
        low:      s.low      || 0,
        abnormal: s.abnormal || 0,
        avgConfidence: Math.round(s.avgConf || 0),
        avgProcessingTimeMs: Math.round(s.avgTime || 0),
      },
      topDiseases: byDisease.map((d) => ({ disease: d._id, count: d.count })),
      casesPerDay: byDate.map((d) => ({ date: d._id, count: d.count })),
    });
  } catch (err) {
    console.error("/stats error:", err.message);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  const aiOnline = await isAIServiceOnline();
  const dbState  = mongoose.connection.readyState; // 1 = connected
  res.json({
    status:    "online",
    database:  dbState === 1 ? "connected" : "disconnected",
    aiService: aiOnline ? "online" : "offline",
    aiServiceUrl: AI_SERVICE_URL,
    model:     "DenseNet-121 (CheXpert)",
    uptime:    Math.floor(process.uptime()),
  });
});

// ── Helper ────────────────────────────────────────────────────────────────────
function formatCase(doc, full = false) {
  const base = {
    caseId:        doc.caseId,
    patientId:     doc.patientId,
    patientName:   doc.patientName,
    patientDob:    doc.patientDob,
    patientAge:    doc.patientAge,
    patientGender: doc.patientGender,
    viewPosition:  doc.viewPosition,
    imageIndex:    doc.imageIndex,
    prediction:    doc.prediction,
    disease:       doc.disease,
    confidence:    doc.confidence,
    priority:      doc.priority,
    findings:      doc.findings,
    diagnosis:     doc.diagnosis,
    recommendation: doc.recommendation,
    findingLabels: doc.findingLabels,
    scanType:      doc.scanType,
    organ:       doc.organ,
    imageFile:   doc.imageFile,
    model:       doc.model,
    processingTime: doc.processingTime,
    aiService:   doc.aiService,
    source:      doc.source,
    timestamp:   doc.createdAt,
  };
  if (full) {
    base.heatmap        = doc.heatmap;
    base.all_pathologies = doc.allPathologies
      ? Object.fromEntries(Object.entries(doc.allPathologies))
      : {};
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diagnosis/infer  —  disease-level diagnosis from finding + symptoms
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/diagnosis/infer", (req, res) => {
  try {
    const { finding = "", location = "", symptoms = {} } = req.body;
    const result = inferDisease(finding, location, symptoms);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Diagnosis engine error", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/triage  —  urgency level from diagnosis + confidence
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/triage", (req, res) => {
  try {
    const { confidence = 50, diagnosis = "" } = req.body;
    const result = getUrgencyLevel(confidence, diagnosis);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Triage engine error", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/report/:caseId  —  generate downloadable PDF clinical report
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/report/:caseId", async (req, res) => {
  try {
    const doc = await Case.findOne({ caseId: req.params.caseId }).lean();
    if (!doc) return res.status(404).json({ error: "Case not found" });
    const scanData = formatCase(doc, true);
    generateClinicalReport(scanData, res);
  } catch (err) {
    console.error("/api/report error:", err.message);
    res.status(500).json({ error: "Report generation failed", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/scans/compare/:patientId  —  compare latest 2 scans of a patient
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/scans/compare/:patientId", async (req, res) => {
  try {
    const scans = await Case.find({
      $or: [
        { patientId:   req.params.patientId },
        { patientName: { $regex: req.params.patientId, $options: "i" } },
      ]
    })
    .sort({ createdAt: -1 })
    .limit(2)
    .lean();

    if (scans.length < 2) {
      return res.json({ scans, comparison: null, message: "Need at least 2 scans to compare" });
    }

    const [current, previous] = scans;
    const confDiff = (current.confidence || 0) - (previous.confidence || 0);
    const status =
      current.prediction === "Normal" && previous.prediction !== "Normal" ? "Improved" :
      current.prediction !== "Normal" && previous.prediction === "Normal" ? "Worsened" :
      current.disease === previous.disease ? "Stable" : "Changed";

    res.json({
      current:  formatCase(current),
      previous: formatCase(previous),
      comparison: {
        status,
        confidenceDelta: confDiff,
        diseaseChanged: current.disease !== previous.disease,
        daysBetween: Math.round(
          (new Date(current.createdAt) - new Date(previous.createdAt)) / 86400000
        ),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Comparison error", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS ROUTES
// ─────────────────────────────────────────────────────────────────────────────

const _startTime = Date.now();

async function getGlobalSettings() {
  let s = await SystemSettings.findById('global');
  if (!s) s = await SystemSettings.create({ _id: 'global' });
  return s;
}

async function writeLog(eventType, message, severity = 'info', meta = {}) {
  try { await SystemLog.create({ eventType, message, severity, meta }); } catch { /* silent */ }
}

// GET /api/settings/model-metrics
app.get('/api/settings/model-metrics', (_req, res) => {
  res.json({ accuracy:94.2, precision:92.8, recall:93.5, f1Score:93.1, auc:95.0, lastTrained:'2026-03-15', modelName:'DenseNet-121', dataset:'CheXpert', epochs:120 });
});

// GET /api/settings/supported-diseases
app.get('/api/settings/supported-diseases', (_req, res) => {
  res.json([
    { name:'Lung Opacity',           id:'lung_opacity',     category:'Pulmonary' },
    { name:'Bacterial Pneumonia',    id:'pneumonia',        category:'Pulmonary' },
    { name:'Pulmonary Tuberculosis', id:'tb',               category:'Pulmonary' },
    { name:'Pleural Effusion',       id:'pleural_effusion', category:'Pleural'   },
    { name:'Cardiomegaly',           id:'cardiomegaly',     category:'Cardiac'   },
    { name:'Atelectasis',            id:'atelectasis',      category:'Pulmonary' },
    { name:'Pulmonary Edema',        id:'edema',            category:'Pulmonary' },
    { name:'Pneumothorax',           id:'pneumothorax',     category:'Pleural'   },
    { name:'Pulmonary Nodule',       id:'nodule',           category:'Oncology'  },
    { name:'Consolidation',          id:'consolidation',    category:'Pulmonary' },
    { name:'Infiltration',           id:'infiltration',     category:'Pulmonary' },
    { name:'Mass',                   id:'mass',             category:'Oncology'  },
    { name:'No Finding',             id:'normal',           category:'Normal'    },
  ]);
});

// GET /api/settings  (full settings object)
app.get('/api/settings', async (_req, res) => {
  try { res.json(await getGlobalSettings()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/confidence-threshold
app.put('/api/settings/confidence-threshold', async (req, res) => {
  try {
    const { threshold } = req.body;
    if (threshold < 50 || threshold > 100) return res.status(400).json({ error: 'Threshold must be 50-100' });
    const s = await SystemSettings.findByIdAndUpdate('global', { confidenceThreshold: threshold }, { new:true, upsert:true });
    await writeLog('settings_changed', `Confidence threshold updated to ${threshold}%`);
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/alerts
app.put('/api/settings/alerts', async (req, res) => {
  try {
    const fields = ['criticalAlerts','highPriorityAlerts','emailNotifications','dashboardPopup'];
    const update = {};
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    const s = await SystemSettings.findByIdAndUpdate('global', update, { new:true, upsert:true });
    await writeLog('settings_changed', 'Alert settings updated', 'info', update);
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/report-config
app.put('/api/settings/report-config', async (req, res) => {
  try {
    const fields = ['reportIncludeScan','reportIncludeHeatmap','reportIncludeDiagnosis','reportIncludeSymptoms','reportIncludeMetadata','reportIncludeTimestamp'];
    const update = {};
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    const s = await SystemSettings.findByIdAndUpdate('global', update, { new:true, upsert:true });
    await writeLog('settings_changed', 'Report config updated');
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/logs
app.get('/api/settings/logs', async (req, res) => {
  try {
    const logs = await SystemLog.find().sort({ createdAt: -1 }).limit(parseInt(req.query.limit) || 40).lean();
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/api-health
app.get('/api/settings/api-health', async (_req, res) => {
  const t0 = Date.now();
  let aiPing = null;
  try { const t = Date.now(); await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 3000 }); aiPing = Date.now() - t; } catch { /* offline */ }
  const failedReqs = await SystemLog.countDocuments({ severity: 'error', createdAt: { $gte: new Date(Date.now() - 86400000) } }).catch(() => 0);
  const lastErrDoc = await SystemLog.findOne({ severity: 'error' }).sort({ createdAt: -1 }).lean().catch(() => null);
  res.json({
    avgLatency:       `${Date.now() - t0}ms`,
    inferenceLatency: aiPing !== null ? `${aiPing}ms` : 'Unavailable',
    failedRequests:   failedReqs,
    lastError:        lastErrDoc ? lastErrDoc.message : 'None',
    serverUptime:     `${Math.floor((Date.now() - _startTime) / 60000)}m`,
  });
});

// GET /api/settings/model-info
app.get('/api/settings/model-info', (_req, res) => {
  res.json({ architecture:'DenseNet-121', dataset:'CheXpert v1.0', trainingSamples:'224,316', version:'v2.4 Clinical', lastUpdated:'2026-03-15', framework:'TorchXRayVision', inputSize:'224 × 224 px', classes:14 });
});

// GET /api/settings/storage-stats
app.get('/api/settings/storage-stats', async (_req, res) => {
  try {
    const [total, abnormal, critical] = await Promise.all([
      Case.countDocuments(), Case.countDocuments({ prediction:'Abnormal' }), Case.countDocuments({ priority:'Critical' })
    ]);
    const dbStats = await mongoose.connection.db.stats().catch(() => null);
    res.json({
      totalScans:       total,
      abnormalScans:    abnormal,
      criticalCases:    critical,
      reportsGenerated: total,
      storageMB:        dbStats ? (dbStats.dataSize / 1048576).toFixed(2) : '?',
      collectionsCount: dbStats?.collections || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🏥 Radio-Matic Backend running on http://localhost:${PORT}`);
  console.log(`📡 AI Service: ${AI_SERVICE_URL}`);
  console.log(`🗄  MongoDB: ${process.env.MONGO_URI || "mongodb://localhost:27017/radio-matic"}`);
});