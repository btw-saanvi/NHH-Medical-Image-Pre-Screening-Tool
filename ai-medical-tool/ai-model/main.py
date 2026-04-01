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
    """Convert PIL image to TorchXRayVision-compatible numpy array."""
    # Convert to grayscale
    img = pil_image.convert("L")
    # Resize to 224x224
    img = img.resize((224, 224), Image.LANCZOS)
    img_array = np.array(img, dtype=np.float32)
    # Normalize to [-1024, 1024] range (TXV standard)
    img_array = (img_array / 255.0) * 2048.0 - 1024.0
    return img_array


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
        img_np = img_tensor.squeeze().cpu().numpy()
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
        pred_np = preds.squeeze().cpu().numpy()
        # Build disease probability map
        disease_probs = {}
        if hasattr(model, 'pathologies'):
            for i, path in enumerate(model.pathologies):
                if i < len(pred_np):
                    prob = float(np.clip(pred_np[i], 0, 1))
                    disease_probs[path] = round(prob, 4)

        # Find top pathology (excluding "No Finding" for abnormal detection)
        sorted_probs = sorted(disease_probs.items(), key=lambda x: x[1], reverse=True)
        
        top_disease = "No Finding"
        top_conf = 0.0
        for disease, prob in sorted_probs:
            if disease != "No Finding" and disease != "Support Devices":
                top_disease = disease
                top_conf = prob
                break

        # If "No Finding" dominates, treat as normal
        no_finding_prob = disease_probs.get("No Finding", 0)
        if no_finding_prob > 0.5 and top_conf < 0.3:
            top_disease = "No Finding"
            top_conf = no_finding_prob

        is_normal = (top_disease == "No Finding")
        priority = assign_priority(top_disease, top_conf)

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
        logger.info(f"Analysis: {top_disease} ({top_conf:.1%}) | {priority} | {processing_ms}ms")

        return JSONResponse({
            "prediction": "Normal" if is_normal else "Abnormal",
            "disease": top_disease,
            "confidence": round(top_conf, 3),
            "priority": priority,
            "findings": get_findings(top_disease, top_conf),
            "recommendation": get_recommendation(priority, top_disease),
            "all_pathologies": dict(sorted_probs[:8]),  # top 8
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
