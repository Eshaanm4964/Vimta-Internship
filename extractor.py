import re
import cv2
import numpy as np
import threading

from machine_router import get_machine_by_id, detect_machine_type
from ocr_engine import (
    decode_qr_or_barcode,
    ocr_text,
    extract_machine_id_from_text,
    extract_inst_group,
)


# ---------------------------------------------------------------------------
# Region helpers
# ---------------------------------------------------------------------------

def _crop_lower_half(image):
    h, w = image.shape[:2]
    return image[int(h * 0.42):h, 0:w]


def _crop_display_region(image):
    h, w = image.shape[:2]
    return image[int(h * 0.12):int(h * 0.70), int(w * 0.02):int(w * 0.98)]


def _crop_centrifuge_display(image):
    h, w = image.shape[:2]
    return image[int(h * 0.25):int(h * 0.55), int(w * 0.12):int(w * 0.90)]


def _get_display_crop(image, machine_type):
    """Return the display region crop for the given machine type."""
    try:
        h, w = image.shape[:2]
        if h <= 200 and w <= 200:
            return image  # already a small crop
        if machine_type == "centrifuge":
            crop = _crop_centrifuge_display(image)
        else:
            crop = _crop_display_region(image)
        return crop if crop is not None and crop.size > 0 else image
    except Exception:
        return image


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------

def _preprocess_display_for_ocr(display):
    gray = cv2.cvtColor(display, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    gray = cv2.equalizeHist(gray)
    _, thresh1 = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
    thresh2 = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharp = cv2.filter2D(gray, -1, kernel)
    return [gray, thresh1, thresh2, sharp]


# ---------------------------------------------------------------------------
# Image quality analysis
# ---------------------------------------------------------------------------

def _analyze_image_quality(image, machine_type_info):
    machine_type = machine_type_info.get("machine_type")
    display_region = _get_display_crop(image, machine_type)

    if display_region is None or display_region.size == 0:
        return {"quality_score": 0, "issues": ["Cannot identify display region"],
                "recommendation": "Ensure the machine display is clearly visible"}

    gray = cv2.cvtColor(display_region, cv2.COLOR_BGR2GRAY)
    issues = []
    quality_score = 100

    mean_brightness = np.mean(gray)
    if mean_brightness < 30:
        issues.append("Image too dark")
        quality_score -= 30
    elif mean_brightness > 200:
        issues.append("Image too bright / washed out")
        quality_score -= 20

    contrast = gray.std()
    if contrast < 20:
        issues.append("Low contrast — digits hard to distinguish")
        quality_score -= 25

    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if laplacian_var < 100:
        issues.append("Image appears blurry")
        quality_score -= 35
    elif laplacian_var < 300:
        issues.append("Slightly blurry — may affect accuracy")
        quality_score -= 15

    _, bright_mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
    bright_pct = (np.sum(bright_mask == 255) / bright_mask.size) * 100
    if bright_pct > 15:
        issues.append("Glare detected on display")
        quality_score -= 20

    edges = cv2.Canny(gray, 50, 150)
    if np.sum(edges > 0) / edges.size < 0.02:
        issues.append("Low edge density — digits may not be well-defined")
        quality_score -= 25

    score = max(0, quality_score)
    if score >= 80:
        rec = "Good image quality"
    elif score >= 60:
        rec = "Acceptable quality — results may vary"
    else:
        tips = []
        if any("dark" in i.lower() for i in issues):
            tips.append("increase lighting or use flash")
        if any("glare" in i.lower() or "bright" in i.lower() for i in issues):
            tips.append("reduce glare by changing angle")
        if any("blurry" in i.lower() for i in issues):
            tips.append("hold camera steady and ensure focus")
        rec = "Poor quality — " + (", ".join(tips) if tips else "retake photo")

    return {
        "quality_score": score,
        "issues": issues,
        "recommendation": rec,
        "brightness": mean_brightness,
        "contrast": contrast,
        "sharpness": laplacian_var,
        "glare_percentage": bright_pct,
    }


# ---------------------------------------------------------------------------
# Core extraction cascade: Vision API → PaddleOCR → Tesseract
# ---------------------------------------------------------------------------

def extract_readings(image, machine_type_info):
    """
    Extract machine readings using a three-tier OCR cascade:
      1. Claude Vision API (most accurate)
      2. PaddleOCR with LED-optimized preprocessing
      3. Tesseract fallback
    Returns (readings_dict, raw_text_str). readings_dict may be empty on failure.
    """
    machine_type = machine_type_info.get("machine_type", "")
    fields = machine_type_info.get("fields", [])
    units = machine_type_info.get("units", {})

    display = _get_display_crop(image, machine_type)

    # ---- Tier 1: Claude Vision API ----
    try:
        from vision_ocr import extract_with_vision
        readings = extract_with_vision(display, machine_type, fields, units)
        non_null = {k: v for k, v in readings.items() if v is not None}
        if non_null:
            print(f"[OCR] Vision API succeeded: {non_null}")
            return non_null, f"Vision API: {non_null}"
        print("[OCR] Vision API returned all nulls — trying next tier")
    except ImportError as e:
        print(f"[OCR] Vision API not available: {e}")
    except Exception as e:
        print(f"[OCR] Vision API failed: {e}")

    # ---- Tier 2: PaddleOCR ----
    try:
        from enhanced_ocr import get_enhanced_ocr_extractor
        extractor = get_enhanced_ocr_extractor()
        machine_config = {'machine_type': machine_type, 'fields': fields, 'units': units}
        result = extractor.extract_machine_values(display, machine_config)
        if result.get('success'):
            vals = result['values']
            raw = vals.pop('_metadata', {}).get('extracted_text', '')
            non_null = {k: v for k, v in vals.items() if v is not None}
            if non_null:
                print(f"[OCR] PaddleOCR succeeded: {non_null}")
                return non_null, raw
        print(f"[OCR] PaddleOCR failed or returned nothing: {result.get('error', '')}")
    except Exception as e:
        print(f"[OCR] PaddleOCR exception: {e}")

    # ---- Tier 3: Tesseract ----
    try:
        processed_images = _preprocess_display_for_ocr(display)
        raw_parts = []
        best = {f: None for f in fields}
        for proc in processed_images:
            text = ocr_text(proc)
            raw_parts.append(text)
            parsed = _parse_generic_text(text, fields)
            for k, v in parsed.items():
                if best.get(k) is None and v is not None:
                    best[k] = v
        raw_text = " ".join(raw_parts)
        non_null = {k: v for k, v in best.items() if v is not None}
        if non_null:
            print(f"[OCR] Tesseract succeeded: {non_null}")
            return non_null, raw_text
        print("[OCR] Tesseract returned nothing")
    except Exception as e:
        print(f"[OCR] Tesseract exception: {e}")

    # All tiers failed — return empty (no fake data)
    return {}, "OCR extraction failed — please retake photo with better lighting and focus"


def _parse_generic_text(text: str, fields: list) -> dict:
    """Simple heuristic parser for Tesseract output."""
    result = {}
    if not text:
        return result

    time_m = re.search(r'(\d{1,2}:\d{2}(?::\d{2})?)', text)
    if 'time_value' in fields and time_m:
        result['time_value'] = time_m.group(1)

    numbers = [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', text)]

    field_rules = {
        'speed': lambda v: v >= 100,
        'temperature': lambda v: -80 <= v <= 200,
        'osmolarity': lambda v: 0 <= v <= 3000,
        'absorbance': lambda v: 0 <= v <= 4,
        'wavelength': lambda v: 150 <= v <= 1100,
        'pressure': lambda v: 0 <= v <= 20,
        'co2': lambda v: 0 <= v <= 100,
        'weight': lambda v: v > 0,
        'volume': lambda v: v > 0,
    }

    for n in numbers:
        for field in fields:
            if field in result or field == 'time_value':
                continue
            rule = field_rules.get(field)
            if rule and rule(n):
                result[field] = n
                break

    return result


# ---------------------------------------------------------------------------
# Machine ID detection
# ---------------------------------------------------------------------------

def detect_machine_id(image):
    qr_values = decode_qr_or_barcode(image)
    combined_qr = "\n".join(qr_values)

    machine_id = extract_machine_id_from_text(combined_qr)
    inst_group = extract_inst_group(combined_qr)

    full_text = ocr_text(image)
    label_text = ocr_text(_crop_lower_half(image))

    combined_text = "\n".join([combined_qr, full_text, label_text])

    if not machine_id:
        machine_id = extract_machine_id_from_text(combined_text)
    if not inst_group:
        inst_group = extract_inst_group(combined_text)

    return machine_id, inst_group, combined_text


# ---------------------------------------------------------------------------
# Timeout wrapper
# ---------------------------------------------------------------------------

def _extract_with_timeout(image_path, selected_lab_no=None, selected_machine_id=None,
                          timeout_seconds=60):
    result = [None]  # use list so worker can replace the value

    def worker():
        try:
            result[0] = _extract_from_image_internal(
                image_path, selected_lab_no, selected_machine_id)
        except Exception as e:
            result[0] = {"error": str(e)}

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout_seconds)

    if t.is_alive():
        print(f"[OCR] Extraction timed out after {timeout_seconds}s")
        return {"error": "OCR is taking too long. Please try with a clearer image."}

    if result[0] is None:
        return {"error": "Extraction failed unexpectedly"}

    return result[0]


# ---------------------------------------------------------------------------
# Main internal extraction
# ---------------------------------------------------------------------------

def _extract_from_image_internal(image_path, selected_lab_no=None, selected_machine_id=None):
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Could not read uploaded image")

    # Detect machine ID from QR / label
    detected_machine_id = None
    inst_group = None
    raw_label_text = ""
    try:
        detected_machine_id, inst_group, raw_label_text = detect_machine_id(image)
    except Exception as e:
        print(f"[OCR] Machine ID detection failed: {e}")

    selected_machine = get_machine_by_id(selected_machine_id) if selected_machine_id else None

    if selected_machine:
        machine_info = selected_machine
        machine_id = selected_machine_id
    else:
        machine_id = detected_machine_id or selected_machine_id or "UNKNOWN"
        try:
            machine_info = detect_machine_type(detected_machine_id, inst_group)
        except Exception as e:
            print(f"[OCR] Machine type detection failed: {e}")
            machine_info = {
                "machine_type": "centrifuge",
                "machine_name": "Unknown Machine",
                "fields": ["speed", "temperature", "time_value"],
                "group_code": "CEN",
            }

    try:
        quality_analysis = _analyze_image_quality(image, machine_info)
    except Exception as e:
        print(f"[OCR] Quality analysis failed: {e}")
        quality_analysis = {"quality_score": 50, "issues": [], "recommendation": ""}

    readings, raw_display_text = extract_readings(image, machine_info)

    selected_group = machine_info.get("group_code")
    detected_group = None
    if detected_machine_id and "/" in detected_machine_id:
        parts = detected_machine_id.split("/")
        if len(parts) >= 3:
            detected_group = parts[1]

    warning = None
    if (detected_machine_id and selected_machine_id
            and detected_machine_id != selected_machine_id):
        warning = (
            f"Selected machine ({selected_machine_id}) differs from "
            f"detected ({detected_machine_id}). Please verify before saving."
        )

    quality_warning = None
    if quality_analysis["quality_score"] < 60:
        quality_warning = quality_analysis["recommendation"]

    return {
        "lab_no": selected_lab_no or machine_info.get("lab_no"),
        "machine_id": machine_id,
        "machine_type": machine_info.get("machine_type"),
        "machine_name": machine_info.get("machine_name"),
        "group_code": selected_group or machine_info.get("group_code"),
        "detected_machine_id": detected_machine_id,
        "detected_group_code": detected_group or inst_group,
        "sample_id": None,
        "reference_id": None,
        "readings": readings,
        "units": machine_info.get("units", {}),
        "image_path": image_path,
        "confidence": {
            "machine_id": "high" if detected_machine_id else "manual_selected",
            "readings": "medium" if any(v is not None for v in readings.values()) else "low",
            "image_quality": quality_analysis["quality_score"],
        },
        "warning": warning,
        "quality_warning": quality_warning,
        "image_quality": quality_analysis,
        "raw_text": {
            "label_text": raw_label_text,
            "display_text": raw_display_text,
        },
        "note": (
            "Please verify/edit values before saving. "
            "OCR may not be 100% accurate on all display types."
        ),
    }


def extract_from_image(image_path, selected_lab_no=None, selected_machine_id=None):
    return _extract_with_timeout(
        image_path, selected_lab_no, selected_machine_id, timeout_seconds=90)
