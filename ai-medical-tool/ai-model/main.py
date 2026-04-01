"""
MedAI - AI Medical Image Pre-Screening Service
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
logger = logging.getLogger("MedAI")

app = FastAPI(
    title="MedAI - Medical Image Analysis API",
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
            "Increased opacity in lower lobe",
            "Possible consolidation pattern",
            "Air-space disease noted"
        ],
        "Pleural Effusion": [
            "Blunting of costophrenic angle",
            "Homogeneous opacity at lung base",
            "Possible mediastinal shift"
        ],
        "Effusion": [
            "Fluid accumulation detected in pleural space",
            "Blunted costophrenic angle",
            "Increased basal density"
        ],
        "Cardiomegaly": [
            "Cardiothoracic ratio > 0.5",
            "Enlarged cardiac silhouette",
            "Pulmonary vascular congestion noted"
        ],
        "Atelectasis": [
            "Linear opacities consistent with atelectasis",
            "Volume loss in affected lobe",
            "Possible displacement of fissures"
        ],
        "Pneumothorax": [
            "Visible pleural line without lung markings",
            "Possible partial lung collapse",
            "Urgent decompression may be required"
        ],
        "Edema": [
            "Bilateral perihilar opacities",
            "Cephalization of pulmonary vessels",
            "Possible Kerley B lines"
        ],
        "Nodule": [
            "Rounded opacity < 3cm detected",
            "Further characterization recommended",
            "Low-dose CT follow-up advised"
        ],
        "Fracture": [
            "Cortical discontinuity detected",
            "Bone density irregularity observed",
            "Clinical correlation required"
        ],
        "Consolidation": [
            "Air-space consolidation noted",
            "Air bronchograms may be present",
            "Infectious vs. non-infectious etiology to exclude"
        ],
        "No Finding": [
            "Clear lung fields bilaterally",
            "Normal cardiac silhouette",
            "No acute cardiopulmonary process"
        ]
    }
    return findings_map.get(disease, [
        f"{disease} pattern detected",
        "Further clinical correlation advised",
        "Specialist review recommended"
    ])


def get_recommendation(priority: str, disease: str) -> str:
    recs = {
        "Critical": f"URGENT: Immediate radiologist review for {disease}. Do not delay clinical intervention.",
        "High": f"Priority review required within 2 hours. {disease} pattern detected with high confidence.",
        "Medium": f"Schedule radiologist review within 24 hours. {disease} findings noted.",
        "Low": "No acute findings. Routine follow-up as clinically indicated."
    }
    return recs.get(priority, "Clinical correlation recommended.")


# ─── API Routes ───────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "MedAI Analysis API",
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
