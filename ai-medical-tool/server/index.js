require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const multer    = require("multer");
const cors      = require("cors");
const path      = require("path");
const axios     = require("axios");
const FormData  = require("form-data");
const fs        = require("fs");
const Case      = require("./models/Case");

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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🏥 Radio-Matic Backend running on http://localhost:${PORT}`);
  console.log(`📡 AI Service: ${AI_SERVICE_URL}`);
  console.log(`🗄  MongoDB: ${process.env.MONGO_URI || "mongodb://localhost:27017/radio-matic"}`);
});