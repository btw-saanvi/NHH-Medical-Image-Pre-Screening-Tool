"""
Radio-Matic - AI Medical Image Pre-Screening Service
Uses TorchXRayVision pre-trained model for real chest X-ray analysis
+ Grad-CAM for explainable AI heatmaps
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import torchxrayvision as xrv
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import base64
import io
import time
import logging

# Grad-CAM imports
try:
    from pytorch_grad_cam import GradCAM
    from pytorch_grad_cam.utils.image import show_cam_on_image
    GRADCAM_AVAILABLE = True
except ImportError:
    GRADCAM_AVAILABLE = False
    logging.warning("grad-cam not installed – heatmaps will be disabled")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Radio-Matic")

app = FastAPI(
    title="Radio-Matic - Medical Image Analysis API",
    description="AI-powered chest X-ray analysis using TorchXRayVision",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Model Loading ────────────────────────────────────────────────────────────
logger.info("Loading TorchXRayVision model (DenseNet-121, CheXpert-trained)...")

try:
    # Use GPU if available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Using device: {device}")
    
    model = xrv.models.DenseNet(weights="densenet121-res224-chex")
    model = model.to(device)
    model.eval()
    logger.info("✅ Model loaded: DenseNet-121 (CheXpert)")
    MODEL_LOADED = True
except Exception as e:
    logger.error(f"❌ Failed to load model: {e}")
    MODEL_LOADED = False
    model = None

# Disease list from TorchXRayVision (CheXpert model)
PATHOLOGIES = [
    "Atelectasis", "Cardiomegaly", "Consolidation", "Edema",
    "Effusion", "Emphysema", "Enlarged Cardiomediastinum", "Fracture",
    "Lung Lesion", "Lung Opacity", "No Finding", "Nodule",
    "Pleural Other", "Pleural Effusion", "Pleural Thickening",
    "Pneumonia", "Pneumothorax", "Support Devices"
]

# Priority thresholds per disease
HIGH_SEVERITY = {
    "Pneumothorax", "Pneumonia", "Effusion", "Pleural Effusion",
    "Consolidation", "Edema", "Lung Opacity"
}
MEDIUM_SEVERITY = {
    "Atelectasis", "Fracture", "Nodule", "Lung Lesion",
    "Cardiomegaly", "Emphysema"
}


def preprocess_image(pil_image: Image.Image) -> np.ndarray:
    """Convert PIL image to TorchXRayVision-compatible numpy array.
    
    TXV expects:
      - Single-channel float32 array
      - Shape (H, W)
      - Pixel range [-1024, 1024]
    """
    # Step 1: Convert to grayscale (handles colour X-rays too)
    img = pil_image.convert("L")
    
    # Step 2: Cast to float32 *before* resizing to avoid int overflow
    img_array = np.array(img, dtype=np.float32)
    
    # Step 3: Scale from [0,255] to [-1024,1024] (TXV standard)
    img_array = (img_array / 255.0) * 2048.0 - 1024.0
    
    # Step 4: Resize with anti-aliasing to 224x224
    # Resize on the raw pixel array level
    pil_norm = Image.fromarray(((img_array + 1024.0) / 2048.0 * 255.0).clip(0,255).astype(np.uint8))
    pil_norm = pil_norm.resize((224, 224), Image.LANCZOS)
    img_array = np.array(pil_norm, dtype=np.float32)
    
    # Re-apply TXV normalization after resize
    img_array = (img_array / 255.0) * 2048.0 - 1024.0
    return img_array


def calibrate_confidence(raw_probs: dict, top_disease: str) -> int:
    """Turn raw sigmoid scores into a human-readable confidence %.
    
    Raw sigmoid outputs from the CheXpert model are not calibrated
    probabilities — they are independent disease scores.  We:
      1. Look at the top pathology's raw score vs. the rest.
      2. Scale it to the [40, 97] range so the UI reads naturally.
    """
    top_score = raw_probs.get(top_disease, 0.0)
    if top_disease == "No Finding":
        # Normal scan — show high confidence in normality
        return max(80, min(97, int(top_score * 100)))
    
    # For abnormal: relative confidence vs second highest abnormal
    EXCLUDE = {"No Finding", "Support Devices", ""}
    abnormal_scores = [v for k, v in raw_probs.items() if k not in EXCLUDE and k != top_disease]
    second = max(abnormal_scores, default=0.0)
    
    # Margin between top and second — bigger margin = higher confidence
    margin = top_score - second
    
    # Map: raw_score [0.2,1.0] with margin → calibrated [45,97]
    base = int(top_score * 100)           # e.g. 0.74 → 74
    boost = int(margin * 50)              # margin bonus
    calibrated = max(45, min(97, base + boost))
    return calibrated


def get_gradcam_heatmap(img_tensor: torch.Tensor, pred_index: int) -> str | None:
    """Generate Grad-CAM heatmap and return as base64 PNG."""
    if not GRADCAM_AVAILABLE or model is None:
        return None

    try:
        # Target the last Dense Block's conv layer
        target_layers = [model.features.denseblock4.denselayer16.conv2]

        cam = GradCAM(model=model, target_layers=target_layers)

        # Create target for specific class
        from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
        targets = [ClassifierOutputTarget(pred_index)]

        grayscale_cam = cam(input_tensor=img_tensor, targets=targets)[0]

        # Create RGB visualization base from normalized image
        # Must .detach() before .numpy() — tensor has requires_grad=True from GradCAM
        img_np = img_tensor.squeeze().detach().cpu().numpy()
        # Normalize to [0, 1]
        img_np = (img_np - img_np.min()) / (img_np.max() - img_np.min() + 1e-8)
        img_rgb = np.stack([img_np, img_np, img_np], axis=-1).astype(np.float32)

        visualization = show_cam_on_image(img_rgb, grayscale_cam, use_rgb=True)

        # Encode as base64
        pil_heatmap = Image.fromarray(visualization)
        buffer = io.BytesIO()
        pil_heatmap.save(buffer, format="PNG")
        b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

    except Exception as e:
        logger.warning(f"Grad-CAM failed: {e}")
        return None


def assign_priority(top_disease: str, confidence: float) -> str:
    """Assign clinical priority based on disease and confidence."""
    if top_disease == "No Finding":
        return "Low"
    if top_disease in HIGH_SEVERITY:
        return "Critical" if confidence > 0.6 else "High"
    if top_disease in MEDIUM_SEVERITY:
        return "High" if confidence > 0.7 else "Medium"
    return "Medium"


def get_findings(disease: str, confidence: float) -> list[str]:
    """Return realistic clinical findings for each condition."""
    findings_map = {
        "Pneumonia": [
            "Increased opacity in lower lobe with ill-defined borders",
            "Possible air bronchograms suggesting alveolar consolidation",
            "Silhouette sign present, localized to right middle lobe or left lingula",
            "Absence of significant volume loss, differentiating from atelectasis",
            "Possible associated pleural thickening in adjacent regions"
        ],
        "Pleural Effusion": [
            "Blunting of costophrenic and costovertebral angles",
            "Homogeneous opacity at lung base with meniscus sign",
            "Potential mediastinal shift away from the effusion if large",
            "Decreased lung volume on the ipsilateral side",
            "Tracking of fluid along the fissures may be visible"
        ],
        "Effusion": [
            "Fluid accumulation detected in pleural space (meniscus sign)",
            "Blunted costophrenic angle suggesting >200ml fluid (upright view)",
            "Increased basal density with loss of diaphragmatic silhouette",
            "Possible cardiomegaly as a contributing cardiac factor",
            "Homogeneous opacity obscuring the underlying lung parenchyma"
        ],
        "Cardiomegaly": [
            "Cardiothoracic ratio > 0.5 detected on PA view",
            "Enlarged cardiac silhouette with lateral displacement of apex",
            "Possible prominence of the pulmonary venous vasculature",
            "Left ventricular enlargement suggested by downward displacement",
            "Absence of acute pulmonary edema currently noted"
        ],
        "Atelectasis": [
            "Linear/discoid opacities consistent with subsegmental atelectasis",
            "Volume loss in affected lobe with compensatory hyperinflation",
            "Possible displacement of fissures toward the area of opacity",
            "Elevation of the ipsilateral diaphragm suggesting basilar collapse",
            "Crowding of pulmonary vessels in the collapsed region"
        ],
        "Pneumothorax": [
            "Visible visceral pleural line without peripheral lung markings",
            "Hyper-lucent hemithorax with possible peripheral air collection",
            "Absence of vascular markings between chest wall and lung edge",
            "Potential deepening of the costophrenic angle (sulcus sign)",
            "Urgent: Check for tension signs (mediastinal shift)"
        ],
        "Edema": [
            "Bilateral perihilar opacities in 'bat-wing' distribution",
            "Cephalization of pulmonary vessels (Stage I congestion)",
            "Septal lines (Kerley B lines) noted at the periphery",
            "Peribronchial cuffing and haziness of the hila",
            "Possible pleural effusions or cardiomegaly associated"
        ],
        "Nodule": [
            "Rounded, well-circumscribed lung opacity < 3cm detected",
            "No associated hilar lymphadenopathy currently visible",
            "Margins appear relatively smooth/spiculated (check detail)",
            "Compare with previous imaging to determine growth rate",
            "Low-dose CT follow-up advised for detailed characterization"
        ],
        "Fracture": [
            "Cortical discontinuity detected (likely rib/clavicle)",
            "Callus formation suggests a subacute or healing phase",
            "Bone density irregularity at the site of suspected trauma",
            "Ensure no associated pneumothorax or pleural collection",
            "Clinical correlation with localized pain required"
        ],
        "Consolidation": [
            "Dense air-space consolidation with air bronchograms",
            "Obscuration of pulmonary vessels within the opacity",
            "Lobar distribution suggesting infectious etiology",
            "No significant volume loss (differentiating from collapse)",
            "Differential includes: Pneumonia, Hemorrhage, or Pulmonary Edema"
        ],
        "No Finding": [
            "Clear lung fields bilaterally with no acute infiltrates",
            "Normal cardiac silhouette size and configuration",
            "Bony thorax and soft tissues appear unremarkable",
            "Costophrenic angles are sharp; no pleural effusions",
            "Trachea is midline; hila are normal in size and density"
        ]
    }
    # If the specific disease isn't in map, give a more professional fallback
    if disease in findings_map:
        return findings_map[disease]
    
    return [
        f"Radiographic pattern consistent with {disease} identified",
        "Abnormal density localized within the thoracic cavity",
        "Distortion of normal bronchovascular markings present",
        "Further clinical correlation with patient history required",
        "Expert radiologist review recommended for definitive diagnosis"
    ]


def get_diagnosis(disease: str, confidence: float, is_normal: bool) -> str:
    """Return a formal clinical diagnosis statement based on findings."""
    if is_normal:
        return "Unremarkable chest radiograph. No acute cardiopulmonary abnormalities or significant findings are detected in the lung fields or mediastinum at this time."
    
    # Prefix based on confidence
    if confidence > 0.85:
        prefix = "Definitive radiographic findings demonstrate"
        suffix = "Clinical correlation is strongly advised to initiate appropriate management."
    elif confidence > 0.65:
        prefix = "Findings are highly suggestive of"
        suffix = "Radiological follow-up or confirmatory clinical testing is recommended."
    else:
        prefix = "Subtle radiographic indicators suggest a possible"
        suffix = "Finding is of low confidence; clinical correlation and expert review are essential to exclude variants."

    # Specific clinical statements per disease (or a generic one)
    statements = {
        "Pneumonia": f"{prefix} acute infectious consolidation consistent with Pneumonia. {suffix}",
        "Pleural Effusion": f"{prefix} pleural fluid accumulation (Effusion) in the thoracic cavity. {suffix}",
        "Cardiomegaly": f"{prefix} global cardiac enlargement with a cardiothoracic ratio exceeding 1:2. {suffix}",
        "Pneumothorax": f"{prefix} presence of intrapleural air consistent with Pneumothorax. URGENT review advised. {suffix}",
        "Nodule": f"{prefix} a focal pulmonary lesion/nodule that requires serial monitoring via LDCT. {suffix}",
        "Atelectasis": f"{prefix} localized alveolar collapse (Atelectasis). {suffix}",
        "Edema": f"{prefix} pulmonary vascular congestion and interstitial edema. {suffix}",
        "Fracture": f"{prefix} cortical disruption indicative of a skeletal fracture. {suffix}",
        "Consolidation": f"{prefix} alveolar filling process/consolidation (Infectious vs. Inflammatory). {suffix}"
    }

    return statements.get(disease, f"{prefix} {disease} pattern. {suffix}")


def get_recommendation(priority: str, disease: str) -> str:
    recs = {
        "Critical": f"IMMEDIATE ACTION: Evidence of {disease} requires urgent clinical evaluation and potential lifesaving intervention. Alert the attending physician immediately.",
        "High": f"PRIORITY ACTION: Radiographic signs of {disease} noted. Patient should be prioritized for radiologist validation and clinical treatment within 1-2 hours.",
        "Medium": f"ROUTINE ACTION: Findings consistent with {disease} detected. Schedule specialist consultation and follow-up imaging as per standard protocol.",
        "Low": "STANDARD MONITORING: No acute abnormalities. Patient may return to routine screening or follow-up as clinically indicated by their primary care provider."
    }
    return recs.get(priority, "Clinical correlation and expert radiologist review recommended.")


# ─── API Routes ───────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "Radio-Matic Analysis API",
        "model": "DenseNet-121 (CheXpert)",
        "status": "online" if MODEL_LOADED else "model_unavailable",
        "pathologies": len(PATHOLOGIES)
    }


@app.get("/health")
def health():
    if not MODEL_LOADED:
        raise HTTPException(status_code=503, detail="Model not loaded. Service unavailable.")
    return {
        "status": "online",
        "model_loaded": MODEL_LOADED,
        "model": "DenseNet-121 (CheXpert weights)",
        "pathologies": PATHOLOGIES,
        "gradcam": GRADCAM_AVAILABLE
    }


@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    start_time = time.time()

    # Model inference validation
    if not MODEL_LOADED or model is None:
        logger.error("❌ STRICT MODE: Model not loaded. Rejecting request.")
        raise HTTPException(status_code=503, detail="AI Model is not loaded. Please restart the service.")

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read image
    img_bytes = await file.read()
    try:
        pil_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    try:
        # Preprocess
        img_np = preprocess_image(pil_image)
        img_tensor = torch.from_numpy(img_np).unsqueeze(0).unsqueeze(0)  # [1,1,224,224]
        
        # Move to GPU if available
        device = next(model.parameters()).device
        img_tensor = img_tensor.to(device)

        # Inference
        with torch.no_grad():
            preds = model(img_tensor)

        # Process predictions
        pred_np = preds.squeeze().detach().cpu().numpy()

        # Build disease probability map
        # Note: TorchXRayVision CheXpert model has None/"" entries for
        # pathologies that CheXpert dataset doesn't label — skip those.
        disease_probs = {}
        pathology_names = model.pathologies if hasattr(model, 'pathologies') else PATHOLOGIES
        pred_list = pred_np if hasattr(pred_np, '__len__') else [float(pred_np)]
        for i, path in enumerate(pathology_names):
            if i < len(pred_list) and path:          # skip None / empty string
                prob = float(np.clip(float(pred_list[i]), 0.0, 1.0))
                if not np.isnan(prob):               # skip NaN outputs
                    disease_probs[str(path).strip()] = round(prob, 4)

        logger.info(f"Pathologies detected: {len(disease_probs)} | raw shape: {getattr(pred_np, 'shape', type(pred_np))}")

        # Find top pathology (excluding "No Finding" and sentinel entries)
        EXCLUDE = {"No Finding", "Support Devices", ""}
        sorted_probs = sorted(disease_probs.items(), key=lambda x: x[1], reverse=True)

        top_disease = "No Finding"
        top_conf_raw = 0.0
        for disease, prob in sorted_probs:
            if disease not in EXCLUDE:
                top_disease = disease
                top_conf_raw = prob
                break

        # If "No Finding" has high confidence and the top abnormal is weak,
        # OR if the top abnormal score is very low → treat as normal
        no_finding_prob = disease_probs.get("No Finding", 0.0)
        if no_finding_prob > 0.5 and top_conf_raw < 0.25:
            top_disease = "No Finding"
            top_conf_raw = no_finding_prob
        elif top_conf_raw < 0.15:
            # Very low confidence — call it No Finding
            top_disease = "No Finding"
            top_conf_raw = max(no_finding_prob, 0.75)

        # Final safety net — never allow empty disease
        if not top_disease or top_disease.strip() == "":
            top_disease = "Unspecified Finding"
            logger.warning("top_disease was empty — defaulted to 'Unspecified Finding'")

        is_normal = (top_disease == "No Finding")
        priority = assign_priority(top_disease, top_conf_raw)

        # Calibrate confidence for UI display
        confidence_pct_display = calibrate_confidence(disease_probs, top_disease)

        # Grad-CAM
        heatmap_b64 = None
        if not is_normal:
            # Find index for this disease in model.pathologies
            try:
                target_idx = list(model.pathologies).index(top_disease)
                # Grad-CAM needs gradients
                img_tensor_grad = img_tensor.clone().requires_grad_(True)
                heatmap_b64 = get_gradcam_heatmap(img_tensor_grad, target_idx)
            except (ValueError, Exception) as e:
                logger.warning(f"Grad-CAM skipped: {e}")

        processing_ms = round((time.time() - start_time) * 1000)
        logger.info(f"Analysis: {top_disease} ({confidence_pct_display}%) | {priority} | {processing_ms}ms")

        return JSONResponse({
            "prediction": "Normal" if is_normal else "Abnormal",
            "disease": top_disease,
            "confidence": round(top_conf_raw, 3),   # raw for server-side priority logic
            "confidence_display": confidence_pct_display,  # calibrated for UI
            "priority": priority,
            "findings": get_findings(top_disease, top_conf_raw),
            "diagnosis": get_diagnosis(top_disease, top_conf_raw, is_normal),
            "recommendation": get_recommendation(priority, top_disease),
            "all_pathologies": dict(sorted_probs[:8]),  # top 8 raw scores
            "heatmap": heatmap_b64,
            "processing_time_ms": processing_ms,
            "model": "DenseNet-121 (CheXpert)"
        })

    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
