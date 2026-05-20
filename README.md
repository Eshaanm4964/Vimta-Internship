# VIMTA Labs — Machine Reading System

A web-based lab instrument reading capture system with AI-powered OCR and human-in-the-loop verification.

---

## Features

- **AI OCR** — Google Gemini Vision (free) extracts readings from machine display photos
- **Human verification** — every reading is reviewed and edited before saving
- **Role-based access** — Admin and User roles with approval workflow
- **Multi-machine support** — Centrifuge, Osmometer, UV Spectrophotometer, ThermoMixer, and more
- **LIMS integration** — REST endpoint for confirmed readings export

---

## Quick Start

### 1. Prerequisites

- Python 3.10+
- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) *(optional fallback)*

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure API key

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
# Get a free key at: https://aistudio.google.com
```

### 4. Run

```bash
python app.py
```

Open **http://localhost:5000**

---

## Default Login

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | `admin`  | `admin123` |
| User  | `0007`   | `eshaan`   |

---

## Workflow

1. Select **Lab** and **Machine ID**
2. Optionally add **Sample ID** and **Reference ID**
3. Upload a photo of the machine display
4. Click **Extract Readings** — AI analyses the image
5. Review and edit the extracted values
6. Click **Confirm & Save** — data stored only after human approval

---

## OCR Pipeline

Three-tier cascade (best to fallback):

| Tier | Engine | Notes |
|------|--------|-------|
| 1 | Google Gemini Flash | Free, set `GEMINI_API_KEY` in `.env` |
| 2 | PaddleOCR | `pip install paddlepaddle paddleocr` |
| 3 | Tesseract | Install system package, free |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login` | Authenticate user |
| `POST` | `/api/signup` | Register new user |
| `GET` | `/api/labs` | List all labs |
| `GET` | `/api/machines/<lab_id>` | Machines for a lab |
| `POST` | `/api/extract` | Submit image → extracted values |
| `POST` | `/api/confirm` | Save confirmed reading |
| `GET` | `/api/readings` | All saved readings |
| `GET` | `/api/lims/pull` | LIMS export (confirmed only) |
| `GET` | `/api/users` | List users (admin) |
| `POST` | `/api/users/approve/<id>` | Approve pending user |

---

## Supported Machines

| Code | Machine | Fields |
|------|---------|--------|
| `CEN` | Centrifuge | speed (RPM), temperature (°C), time |
| `OSMO` | Osmometer | osmolarity (mOsm/kg) |
| `UVS` | UV Spectrophotometer | absorbance, wavelength (nm) |
| `MIXR` | ThermoMixer | speed (RPM), temperature (°C), time |
| `MAGS` | Magnetic Stirrer | speed (RPM) |
| `WAB` | Water Bath | temperature (°C) |
| `FMS` | Headspace Analyzer | CO₂ (%), pressure (bar) |

---

## Project Structure

```
machine_reading_system/
├── app.py              # Flask app + all REST API routes
├── config.py           # Paths and constants
├── database.py         # SQLite CRUD (users, readings, labs, machines)
├── machine_router.py   # Machine ID → type + field schema
├── extractor.py        # OCR pipeline orchestration
├── vision_ocr.py       # Gemini Vision API (primary OCR)
├── enhanced_ocr.py     # PaddleOCR with LED-optimised preprocessing
├── ocr_engine.py       # Tesseract + QR/barcode decoder
├── requirements.txt
├── .env.example        # Environment variable template
├── static/
│   ├── script.js       # SPA frontend (vanilla JS)
│   ├── style.css       # Dark industrial theme
│   └── vimta_logo.png
├── templates/
│   └── index.html      # Single-page app shell
└── uploads/            # Uploaded images (auto-created, git-ignored)
```

---

## Extending

- **Add a machine type** — update `MACHINE_TYPE_MAP` and `READING_FIELDS` in `config.py`
- **Add a lab** — update `LABS` list in `config.py`
- **Swap OCR engine** — replace `extract_with_vision()` in `vision_ocr.py`
