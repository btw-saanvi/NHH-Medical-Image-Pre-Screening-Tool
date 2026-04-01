const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ['scan_upload','inference_completed','report_generated','alert_triggered','diagnosis_updated','settings_changed','error'],
    required: true,
  },
  message:   { type: String, required: true },
  meta:      { type: mongoose.Schema.Types.Mixed, default: {} },
  severity:  { type: String, enum: ['info','warning','error','success'], default: 'info' },
}, { timestamps: true });

SystemLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SystemLog', SystemLogSchema);
