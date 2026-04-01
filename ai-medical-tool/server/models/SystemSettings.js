const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema({
  _id:                 { type: String, default: 'global' },
  confidenceThreshold: { type: Number, default: 75 },
  criticalAlerts:      { type: Boolean, default: true },
  highPriorityAlerts:  { type: Boolean, default: true },
  emailNotifications:  { type: Boolean, default: false },
  dashboardPopup:      { type: Boolean, default: true },
  reportIncludeScan:   { type: Boolean, default: true },
  reportIncludeHeatmap:{ type: Boolean, default: true },
  reportIncludeDiagnosis: { type: Boolean, default: true },
  reportIncludeSymptoms:  { type: Boolean, default: false },
  reportIncludeMetadata:  { type: Boolean, default: true },
  reportIncludeTimestamp: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', SystemSettingsSchema);
