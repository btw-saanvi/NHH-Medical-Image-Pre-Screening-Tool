const mongoose = require("mongoose");

const CaseSchema = new mongoose.Schema(
  {
    // ── Case identity ────────────────────────────────────────────
    caseId: { type: String, required: true, unique: true, index: true },

    // ── NIH ChestX-ray14 patient metadata ───────────────────────
    patientId:     { type: String, default: null },   // e.g. "00001" or user-entered ID
    patientName:   { type: String, default: null },   // user-entered display name
    patientDob:    { type: String, default: null },   // user-entered DOB (YYYY-MM-DD)
    patientAge:    { type: Number, default: null },
    patientGender: { type: String, enum: ["M", "F", null], default: null },
    viewPosition:  { type: String, default: "PA" },   // PA | AP
    imageIndex:    { type: String, default: null },   // original file name

    // ── AI analysis result ───────────────────────────────────────
    prediction:      { type: String, enum: ["Normal", "Abnormal"], required: true },
    disease:         { type: String, required: true },
    confidence:      { type: Number, required: true },   // 0-100 integer
    priority:        { type: String, enum: ["Critical", "High", "Medium", "Low"], required: true },
    findings:        [{ type: String }],
    recommendation:  { type: String, default: "" },
    allPathologies:  { type: Map, of: Number, default: {} },  // { "Pneumonia": 0.94, ... }
    findingLabels:   [{ type: String }],                       // raw NIH multi-label array

    // ── Scan metadata ────────────────────────────────────────────
    scanType:        { type: String, default: "X-Ray" },      // X-Ray | CT Scan | MRI
    organ:           { type: String, default: "Chest" },

    // ── File / model info ────────────────────────────────────────
    imageFile:       { type: String, default: null },
    heatmap:         { type: String, default: null },         // base64 Grad-CAM
    model:           { type: String, default: "DenseNet-121 (CheXpert)" },
    processingTime:  { type: Number, default: null },         // ms
    aiService:       { type: String, default: "online" },

    // ── Source flag ──────────────────────────────────────────────
    source: {
      type: String,
      enum: ["upload", "nih_seed"],
      default: "upload",
    },
  },
  { timestamps: true }   // adds createdAt + updatedAt
);

module.exports = mongoose.model("Case", CaseSchema);
