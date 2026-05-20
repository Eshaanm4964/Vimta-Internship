"""
Enhanced OCR extraction using PaddleOCR with specialized preprocessing
for lab instrument displays (LED, LCD, 7-segment).
"""

import cv2
import numpy as np
import re
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False
    logger.warning("PaddleOCR not available. Install: pip install paddlepaddle paddleocr")


def _preprocess_for_led(image: np.ndarray) -> List[np.ndarray]:
    """
    Multi-variant preprocessing optimized for LED/7-segment lab displays.
    Returns list of processed images for OCR ensemble.
    """
    results = []

    # Upscale — OCR accuracy improves significantly at larger sizes
    h, w = image.shape[:2]
    scale = max(1, min(4, 800 // max(h, w, 1) + 1))
    if scale > 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    else:
        gray = image.copy()
        hsv = None

    # 1. Grayscale baseline
    results.append(gray)

    # 2. CLAHE enhanced — improves local contrast
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    enhanced = clahe.apply(gray)
    results.append(enhanced)

    # 3. Otsu threshold on enhanced
    _, otsu = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    results.append(otsu)

    # 4. Inverted Otsu — for light text on dark (LED)
    results.append(cv2.bitwise_not(otsu))

    # 5. Adaptive threshold (handles uneven lighting)
    adaptive = cv2.adaptiveThreshold(
        enhanced, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 15, 4
    )
    results.append(adaptive)

    # 6. LED color isolation using HSV (orange/red LED digits)
    if hsv is not None:
        # Orange-red range (typical LED display color)
        mask1 = cv2.inRange(hsv, np.array([0, 100, 100]), np.array([20, 255, 255]))
        # Green range
        mask2 = cv2.inRange(hsv, np.array([40, 100, 100]), np.array([80, 255, 255]))
        # Combine
        led_mask = cv2.bitwise_or(mask1, mask2)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        led_clean = cv2.morphologyEx(led_mask, cv2.MORPH_CLOSE, kernel)
        if np.sum(led_clean) > 100:
            results.append(led_clean)

    # 7. Morphological sharpening
    kernel_sharpen = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharp = cv2.filter2D(enhanced, -1, kernel_sharpen)
    _, sharp_thresh = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    results.append(sharp_thresh)

    return results


def _extract_with_tesseract_fallback(image: np.ndarray) -> str:
    """Tesseract OCR on multiple preprocessing variants."""
    try:
        import pytesseract
    except ImportError:
        return ""

    # PSM modes good for machine displays
    psm_modes = ["--psm 7", "--psm 8", "--psm 6", "--psm 11"]
    all_text = []

    for proc in _preprocess_for_led(image):
        for psm in psm_modes[:2]:
            try:
                config = f"{psm} -c tessedit_char_whitelist=0123456789.:-+°CF"
                text = pytesseract.image_to_string(proc, config=config)
                if text.strip():
                    all_text.append(text.strip())
            except Exception:
                continue

    return " ".join(all_text)


class EnhancedOCRExtractor:
    """PaddleOCR-based extractor with LED-optimized preprocessing."""

    def __init__(self, use_gpu: bool = False, lang: str = 'en'):
        self.ocr = None
        if PADDLE_AVAILABLE:
            try:
                self.ocr = PaddleOCR(use_angle_cls=True, lang=lang, use_gpu=use_gpu,
                                     show_log=False)
                logger.info("PaddleOCR initialized successfully")
            except Exception as e:
                logger.error(f"PaddleOCR init failed: {e}")

    def _paddle_ocr(self, image: np.ndarray, confidence_threshold: float = 0.5) -> List[Dict]:
        """Run PaddleOCR and return sorted, deduplicated results."""
        if self.ocr is None:
            return []

        all_results = []
        processed = _preprocess_for_led(image)

        for i, proc in enumerate(processed):
            try:
                # PaddleOCR needs uint8 BGR or grayscale
                if len(proc.shape) == 2:
                    inp = cv2.cvtColor(proc, cv2.COLOR_GRAY2BGR)
                else:
                    inp = proc

                result = self.ocr.ocr(inp, cls=True)
                if not result or not result[0]:
                    continue

                for line in result[0]:
                    bbox, (text, conf) = line
                    if conf >= confidence_threshold and text.strip():
                        all_results.append({
                            'text': text.strip(),
                            'confidence': conf,
                            'bbox': bbox,
                        })
            except Exception as e:
                logger.debug(f"PaddleOCR failed on variant {i}: {e}")
                continue

        # Deduplicate by text (keep highest confidence)
        seen = {}
        for item in all_results:
            key = item['text'].lower()
            if key not in seen or item['confidence'] > seen[key]['confidence']:
                seen[key] = item

        # Sort spatially: top-to-bottom, left-to-right
        sorted_results = sorted(seen.values(),
                                key=lambda x: (int(x['bbox'][0][1] // 15), x['bbox'][0][0]))
        return sorted_results

    def extract_machine_values(self, image: np.ndarray, machine_config: Dict) -> Dict:
        """Extract readings from a display image using PaddleOCR + pattern matching."""
        machine_type = machine_config.get('machine_type', '')
        fields = machine_config.get('fields', [])
        units = machine_config.get('units', {})

        try:
            text_results = self._paddle_ocr(image, confidence_threshold=0.4)
            all_text = ' '.join(r['text'] for r in text_results)
            logger.info(f"PaddleOCR raw text: {all_text!r}")

            if not all_text.strip():
                # Fall through to Tesseract
                all_text = _extract_with_tesseract_fallback(image)
                logger.info(f"Tesseract fallback text: {all_text!r}")
                text_results = []

            if not all_text.strip():
                return {'success': False, 'error': 'No text extracted from display'}

            extracted = _parse_display_values(all_text, text_results, machine_type, fields)

            extracted['_metadata'] = {
                'extracted_text': all_text,
                'method': 'paddleocr',
            }

            return {
                'success': True,
                'values': extracted,
                'confidence': (sum(r['confidence'] for r in text_results) / len(text_results))
                              if text_results else 0.5
            }

        except Exception as e:
            logger.error(f"EnhancedOCRExtractor error: {e}")
            return {'success': False, 'error': str(e)}


def _parse_display_values(text: str, text_results: List[Dict],
                           machine_type: str, fields: List[str]) -> Dict:
    """Assign numeric tokens to field names using position and value heuristics."""
    extracted = {}

    # --- Time extraction (anchor for positional logic) ---
    time_match = re.search(r'\b(\d{1,2}:\d{2}(?::\d{2})?)\b', text)
    if 'time_value' in fields and time_match:
        extracted['time_value'] = time_match.group(1)

    # --- Collect all numbers with approximate X positions ---
    tokens = []
    for item in text_results:
        t = item['text']
        x = item['bbox'][0][0]
        for m in re.finditer(r'-?\d+(?:\.\d+)?', t):
            tokens.append({'val': float(m.group()), 'x': x, 'raw': m.group()})

    # Also scan raw text if text_results is sparse
    if not tokens:
        for m in re.finditer(r'-?\d+(?:\.\d+)?', text):
            tokens.append({'val': float(m.group()), 'x': 0, 'raw': m.group()})

    tokens.sort(key=lambda t: t['x'])

    # --- Machine-specific assignment ---
    if machine_type in ('centrifuge', 'thermomixer', 'magnetic_stirrer', 'mixr', 'mags'):
        _assign_centrifuge_fields(tokens, extracted, fields)
    elif machine_type in ('osmometer', 'osmo'):
        _assign_single_value(tokens, extracted, 'osmolarity', 0, 3000)
    elif machine_type in ('uv_spectrophotometer', 'uvs'):
        _assign_uv_fields(tokens, extracted, fields)
    elif machine_type in ('water_bath', 'wab'):
        _assign_single_value(tokens, extracted, 'temperature', -20, 200)
    elif machine_type in ('headspace_analyzer', 'fms'):
        _assign_fms_fields(tokens, extracted, fields)
    else:
        _assign_generic_fields(tokens, extracted, fields)

    # --- Label-based extraction for any still-missing fields ---
    _extract_by_label(text, extracted, fields)

    return extracted


def _assign_centrifuge_fields(tokens, extracted, fields):
    """Centrifuge/mixer: speed (>=100 RPM), temperature (-20..100 °C), time (already parsed)."""
    speeds, temps = [], []
    for t in tokens:
        v = t['val']
        if v >= 100 and 'speed' in fields:
            speeds.append(t)
        elif -20 <= v <= 110 and 'temperature' in fields:
            temps.append(t)

    if speeds and 'speed' not in extracted:
        # Pick highest value as speed
        extracted['speed'] = max(s['val'] for s in speeds)
    if temps and 'temperature' not in extracted:
        # Pick leftmost temperature reading
        extracted['temperature'] = temps[0]['val']


def _assign_single_value(tokens, extracted, field, lo, hi):
    for t in tokens:
        if lo <= t['val'] <= hi and field not in extracted:
            extracted[field] = t['val']
            break


def _assign_uv_fields(tokens, extracted, fields):
    for t in tokens:
        v = t['val']
        if 'absorbance' in fields and 0 <= v <= 4 and 'absorbance' not in extracted:
            extracted['absorbance'] = v
        elif 'wavelength' in fields and 150 <= v <= 1100 and 'wavelength' not in extracted:
            extracted['wavelength'] = v


def _assign_fms_fields(tokens, extracted, fields):
    for t in tokens:
        v = t['val']
        if 'co2' in fields and 0 <= v <= 100 and 'co2' not in extracted:
            extracted['co2'] = v
        elif 'pressure' in fields and 0 <= v <= 10 and 'pressure' not in extracted:
            extracted['pressure'] = v


def _assign_generic_fields(tokens, extracted, fields):
    for field in fields:
        if field in extracted or field == 'time_value':
            continue
        for t in tokens:
            if field not in extracted:
                extracted[field] = t['val']
                break


def _extract_by_label(text: str, extracted: Dict, fields: List[str]):
    """Scan for label:value pairs in OCR text."""
    label_map = {
        'speed': r'(?:speed|spd|rpm)[:\s]*(-?\d+(?:\.\d+)?)',
        'temperature': r'(?:temp|temperature)[:\s]*(-?\d+(?:\.\d+)?)',
        'time_value': r'(?:time|t)[:\s]*(\d{1,2}:\d{2}(?::\d{2})?)',
        'osmolarity': r'(?:osm|osmolarity)[:\s]*(\d+(?:\.\d+)?)',
        'absorbance': r'(?:abs|absorbance)[:\s]*(\d+(?:\.\d+)?)',
        'wavelength': r'(?:wave|wavelength|nm)[:\s]*(\d+(?:\.\d+)?)',
        'pressure': r'(?:press|pressure)[:\s]*(\d+(?:\.\d+)?)',
        'co2': r'(?:co2|co₂)[:\s]*(\d+(?:\.\d+)?)',
        'weight': r'(?:weight|wt)[:\s]*(\d+(?:\.\d+)?)',
        'volume': r'(?:vol|volume)[:\s]*(\d+(?:\.\d+)?)',
    }
    for field in fields:
        if field in extracted:
            continue
        pattern = label_map.get(field)
        if pattern:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                val = m.group(1)
                extracted[field] = val if field == 'time_value' else float(val)


# --- Singleton ---
_instance: Optional[EnhancedOCRExtractor] = None


def get_enhanced_ocr_extractor() -> EnhancedOCRExtractor:
    global _instance
    if _instance is None:
        _instance = EnhancedOCRExtractor()
    return _instance
