# Machine Reading Automation System

A human-in-the-loop lab instrument reading capture system with AI-powered OCR extraction.

## Quick Start

### 1. Prerequisites

```bash
# Python 3.11+
# Install Tesseract OCR (system package)

# Ubuntu/Debian:
sudo apt-get install tesseract-ocr

# macOS:
brew install tesseract

# Windows:
# Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
```

### 2. Install Python dependencies

```bash
cd machine_reading_system
pip install -r requirements.txt
```

### 3. Run the server

```bash
python app.py
```

Then open: **http://localhost:5000**

---

## User Workflow

1. **Select Lab** from dropdown (CL01–CL10)
2. **Select Machine ID** from the filtered list (e.g. VLL/CEN/048)
3. Optionally fill **Sample ID** and **Reference ID**
4. Click **Continue to Upload**
5. **Upload a photo** of the machine (drag-drop or browse)
6. Click **Extract Readings** — AI analyses the image
7. **Review the extracted values** — edit any incorrect fields
8. Click **Confirm & Save** — data is stored only after human approval

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/labs` | List all labs |
| GET | `/api/machines/<lab_id>` | Machines for a lab |
| GET | `/api/machine_info/<machine_id>` | Machine type + field schema |
| POST | `/api/extract` | Submit image → get extracted values |
| POST | `/api/confirm` | Save confirmed reading to DB |
| GET | `/api/readings` | All readings |
| GET | `/api/readings/<machine_id>` | Readings by machine |
| GET | `/api/lims/pull` | LIMS endpoint (confirmed only) |

---

## Machine Types

| Code | Machine | Extracted Fields |
|------|---------|-----------------|
| CEN | Centrifuge | speed (RPM), temperature (°C), time (min) |
| OSMO | Osmometer | osmolarity (mOsm/kg) |
| UVS | UV Spectrophotometer | absorbance, wavelength (nm) |
| MIXR | ThermoMixer | speed (RPM), temperature (°C), time (min) |
| MAGS | Magnetic Stirrer | speed (RPM) |
| WAB | Water Bath | temperature (°C) |
| FMS | Headspace Analyzer | CO₂ (%), pressure (bar) |

---

## Project Structure

```
machine_reading_system/
├── app.py            # Flask app + all routes
├── extractor.py      # CV pipeline: detect sticker, display, extract values
├── machine_router.py # Machine ID → type + field schema mapping
├── ocr_engine.py     # Pluggable OCR (Tesseract; swap for Gemini/PaddleOCR)
├── database.py       # SQLite CRUD
├── config.py         # All constants: labs, machines, field schemas
├── requirements.txt
├── uploads/          # Uploaded images (auto-created)
├── instance/         # SQLite DB (auto-created)
├── templates/
│   └── index.html    # Single-page UI
└── static/
    ├── style.css     # Full dark industrial theme
    └── script.js     # All frontend logic
```

---

## Extending

- **Swap OCR engine**: Replace `run_ocr()` in `ocr_engine.py` with Gemini Vision or PaddleOCR
- **Add machines**: Update `MACHINE_TYPE_MAP`, `MACHINE_REGISTRY`, and `READING_FIELDS` in `config.py`
- **Add labs**: Add to `LABS` list and `MACHINE_REGISTRY` dict in `config.py`
- **YOLO display detection**: Replace `detect_display_region()` in `extractor.py`
