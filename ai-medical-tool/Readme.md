# AI Medical Image Pre-Screening Tool

An AI-powered healthcare web application that assists radiologists and medical staff by automatically analyzing medical images, detecting potential abnormalities, highlighting suspicious regions, and prioritizing critical cases for faster diagnosis.

---

## Problem Statement

Hospitals generate large volumes of medical imaging data every day, including:

* X-rays
* CT scans
* MRI scans

Radiologists often need to manually review hundreds of scans, which can lead to:

* delayed diagnosis
* increased workload
* fatigue-related errors
* slower emergency response

This project provides an AI-assisted pre-screening system that helps healthcare professionals quickly identify suspicious cases and improve diagnostic efficiency.

---

## Objective

The goal of this project is to build a system that:

1. Accepts medical images as input
2. Uses deep learning to detect abnormalities
3. Highlights suspicious regions using explainable AI
4. Prioritizes urgent cases
5. Displays results on a review dashboard

---

## Key Features

* Medical image upload (X-ray / CT / MRI)
* AI-based abnormality detection
* Grad-CAM heatmap visualization
* Smart case prioritization (Critical / High / Medium / Low)
* Dashboard for flagged cases
* Radiologist feedback loop
* Scalable for multiple diseases

---

## Tech Stack

### Frontend

* React.js / Next.js
* Tailwind CSS

### Backend

* Node.js
* Express.js

### AI / ML

* Python
* FastAPI
* TensorFlow / PyTorch
* CNN (ResNet50 / MobileNet)
* Transfer Learning
* Grad-CAM

### Database

* MongoDB

---

## AI Methodology

### 1. CNN Model

We use Convolutional Neural Networks for image feature extraction.

Recommended architectures:

* **ResNet50**: high accuracy for subtle abnormalities
* **MobileNet**: lightweight and faster inference

### 2. Transfer Learning

A pretrained CNN model is fine-tuned on medical imaging datasets.

Benefits:

* faster training
* better accuracy
* works with limited datasets

### 3. Grad-CAM

Used for explainable AI.

Generates heatmaps to show which regions influenced the prediction.

Example:

* infected lung region
* tumor spot
* fracture line

---

## Workflow

```markdown
User uploads image
        ↓
Frontend sends image to backend
        ↓
AI API processes image
        ↓
Prediction + heatmap generated
        ↓
Priority assigned
        ↓
Results shown on dashboard
```

---

## System Architecture

```markdown
Frontend → Backend → AI Model → Database → Dashboard
                     ↓
                 Heatmap Output
```

---

## Output Example

```json
{
  "caseId": "A102",
  "prediction": "Pneumonia",
  "confidence": 0.94,
  "priority": "Critical",
  "heatmap": "heatmap_A102.png"
}
```

---

## Future Enhancements

* DICOM image support
* hospital PACS integration
* previous scan comparison
* doctor feedback retraining loop
* email / emergency alerts
* rural low-bandwidth deployment

---

## Healthcare Impact

This system aims to:

* reduce radiologist workload
* accelerate diagnosis
* improve emergency response time
* support early disease detection
* improve patient outcomes

---

## Team

**Team Name:** Covid
**Hackathon:** National Healthcare Hackathon (NHH) 2.0
**Institution:** JECRC University

---

## License

This project is deve
