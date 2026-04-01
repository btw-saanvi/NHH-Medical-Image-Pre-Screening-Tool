/**
 * reportGenerator.js
 * Generates a styled PDF clinical report using pdfkit.
 */
const PDFDocument = require("pdfkit");

function generateClinicalReport(scanData, res) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  // Pipe to HTTP response
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Report-${scanData.caseId || "unknown"}.pdf`
  );
  doc.pipe(res);

  const BRAND  = "#6c63ff";
  const DARK   = "#111827";
  const MUTED  = "#6b7280";
  const RED    = "#ef4444";
  const GREEN  = "#22c55e";
  const WARN   = "#f97316";

  // ── Header bar ────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 72).fill(BRAND);
  doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold")
     .text("Radio-Matic", 50, 20);
  doc.fontSize(10).font("Helvetica")
     .text("AI Medical Image Pre-Screening System", 50, 46);
  doc.fontSize(10)
     .text(`Generated: ${new Date().toLocaleString("en-IN")}`, 350, 20, { align: "right", width: 200 })
     .text(`Case ID: ${scanData.caseId || "N/A"}`, 350, 36, { align: "right", width: 200 });

  doc.moveDown(3);

  // ── Patient section ────────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(13).font("Helvetica-Bold").text("PATIENT INFORMATION", 50, 90);
  doc.moveTo(50, 106).lineTo(545, 106).strokeColor("#e4e8f0").lineWidth(1).stroke();

  const patRow = (label, value, x, y) => {
    doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(label.toUpperCase(), x, y);
    doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text(value || "—", x, y + 12);
  };

  patRow("Patient Name", scanData.patientName, 50, 115);
  patRow("Patient ID",   scanData.patientId,   200, 115);
  patRow("Date of Birth", scanData.patientDob, 350, 115);
  patRow("Scan Type",    scanData.scanType || "Chest X-Ray", 50, 150);
  patRow("Model Used",   scanData.model || "DenseNet-121 (CheXpert)", 200, 150);
  patRow("Age",          scanData.patientAge ? `${scanData.patientAge} yrs` : "—", 350, 150);

  // ── Divider ────────────────────────────────────────────────────────────
  doc.moveTo(50, 185).lineTo(545, 185).strokeColor("#e4e8f0").lineWidth(1).stroke();

  // ── AI Result ─────────────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(13).font("Helvetica-Bold").text("AI ANALYSIS RESULT", 50, 195);

  const predColor = scanData.prediction === "Abnormal" ? RED : GREEN;
  doc.roundedRect(50, 215, 240, 60, 6).fill(predColor + "18");
  doc.fillColor(predColor).fontSize(10).font("Helvetica-Bold").text("PREDICTION", 64, 222);
  doc.fontSize(16).text(scanData.prediction || "—", 64, 236);

  doc.roundedRect(310, 215, 235, 60, 6).fill(BRAND + "18");
  doc.fillColor(BRAND).fontSize(10).font("Helvetica-Bold").text("CONFIDENCE", 324, 222);
  doc.fontSize(16).text(`${scanData.confidence || 0}%`, 324, 236);

  // Priority badge
  const pColor = { Critical: RED, High: WARN, Medium: "#f59e0b", Low: GREEN }[scanData.priority] || MUTED;
  doc.roundedRect(50, 285, 495, 34, 6).fill(pColor + "22");
  doc.fillColor(pColor).fontSize(11).font("Helvetica-Bold")
     .text(`PRIORITY: ${(scanData.priority || "").toUpperCase()}  ·  PRIMARY FINDING: ${scanData.disease || "N/A"}`, 64, 297);

  // ── Diagnosis ─────────────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(13).font("Helvetica-Bold").text("CLINICAL DIAGNOSIS", 50, 335);
  doc.moveTo(50, 351).lineTo(545, 351).strokeColor("#e4e8f0").lineWidth(1).stroke();

  doc.fillColor(MUTED).fontSize(9).font("Helvetica").text("PRIMARY DIAGNOSIS", 50, 358);
  doc.fillColor(DARK).fontSize(12).font("Helvetica-Bold")
     .text(scanData.diagnosis || "Clinical correlation required.", 50, 370, { width: 495 });

  // ── Findings ──────────────────────────────────────────────────────────
  const fy = doc.y + 14;
  doc.fillColor(DARK).fontSize(13).font("Helvetica-Bold").text("RADIOGRAPHIC FINDINGS", 50, fy);
  doc.moveTo(50, fy + 16).lineTo(545, fy + 16).strokeColor("#e4e8f0").lineWidth(1).stroke();

  let cy = fy + 24;
  (scanData.findings || []).forEach((f, i) => {
    doc.fillColor(BRAND).fontSize(10).font("Helvetica-Bold").text(`${i + 1}.`, 50, cy);
    doc.fillColor(DARK).fontSize(10).font("Helvetica").text(f, 68, cy, { width: 477 });
    cy += 18;
  });

  // ── Recommendation ────────────────────────────────────────────────────
  cy += 8;
  doc.fillColor(DARK).fontSize(13).font("Helvetica-Bold").text("CLINICAL RECOMMENDATION", 50, cy);
  doc.moveTo(50, cy + 16).lineTo(545, cy + 16).strokeColor("#e4e8f0").lineWidth(1).stroke();
  cy += 24;
  doc.roundedRect(50, cy, 495, 50, 6).fill(pColor + "14");
  doc.fillColor(DARK).fontSize(10).font("Helvetica")
     .text(scanData.recommendation || "Clinical correlation required.", 64, cy + 10, { width: 467 });

  // ── Footer ────────────────────────────────────────────────────────────
  doc.rect(0, doc.page.height - 44, doc.page.width, 44).fill("#f8fafd");
  doc.fillColor(MUTED).fontSize(8).font("Helvetica")
     .text(
       "⚠ DISCLAIMER: This report is AI-generated and is intended for preliminary pre-screening only. It must be validated by a licensed radiologist before clinical use.",
       50, doc.page.height - 32, { align: "center", width: doc.page.width - 100 }
     );

  doc.end();
}

module.exports = { generateClinicalReport };
