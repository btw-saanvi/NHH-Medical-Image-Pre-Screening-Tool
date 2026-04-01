/**
 * api.js — Central API service layer for MedAI frontend.
 * All backend calls go through here so components stay clean.
 */
import axios from "axios";

const BASE = "http://localhost:5000";

const api = axios.create({ baseURL: BASE, timeout: 10000 });

// ── Health ─────────────────────────────────────────────────────────────────
export async function getHealth() {
  const { data } = await api.get("/health");
  return data;
}

// ── Cases (paginated, filterable) ──────────────────────────────────────────
export async function getCases({ page = 1, limit = 20, priority, prediction, search, sort } = {}) {
  const params = { page, limit };
  if (priority   && priority   !== "All") params.priority   = priority;
  if (prediction && prediction !== "All") params.prediction = prediction;
  if (search)  params.search = search;
  if (sort)    params.sort   = sort;
  const { data } = await api.get("/cases", { params });
  return data; // { cases, pagination, stats }
}

// ── Single case ─────────────────────────────────────────────────────────────
export async function getCaseById(caseId) {
  const { data } = await api.get(`/cases/${caseId}`);
  return data;
}

// ── Dashboard stats ─────────────────────────────────────────────────────────
export async function getStats() {
  const { data } = await api.get("/stats");
  return data; // { overview, topDiseases, casesPerDay }
}

// ── Upload image for analysis ────────────────────────────────────────────────
export async function uploadScan(file, patientInfo = {}) {
  const formData = new FormData();
  formData.append("image", file);
  // Forward patient fields so the server can persist them
  if (patientInfo.id)   formData.append("patientId",   patientInfo.id.trim());
  if (patientInfo.name) formData.append("patientName", patientInfo.name.trim());
  if (patientInfo.dob)  formData.append("patientDob",  patientInfo.dob);
  const { data } = await api.post("/upload", formData, { timeout: 120000 });
  return data;
}

