import re
import cv2
import numpy as np
import signal
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from config import TESSERACT_CMD

try:
    import pytesseract
    if TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
except Exception:
    pytesseract = None

try:
    from pyzbar.pyzbar import decode as zbar_decode
except Exception:
    zbar_decode = None


def preprocess_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    denoised = cv2.fastNlMeansDenoising(resized, None, 20, 7, 21)
    _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    adaptive = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(resized, -1, kernel)
    return [image, gray, resized, denoised, thresh, adaptive, sharpened]


def _ocr_with_timeout(image, timeout_seconds=10):
    """OCR with timeout protection to prevent hanging"""
    if pytesseract is None:
        print("Pytesseract not available")
        return ""
    
    result = [""]
    
    def ocr_worker():
        try:
            print("Starting OCR processing...")
            text = pytesseract.image_to_string(image, config="--psm 6")
            print(f"OCR completed, text length: {len(text)}")
            result[0] = text
        except Exception as e:
            print(f"OCR error: {e}")
            result[0] = ""
    
    thread = threading.Thread(target=ocr_worker)
    thread.daemon = True
    thread.start()
    thread.join(timeout_seconds)
    
    if thread.is_alive():
        print("OCR timed out after {} seconds".format(timeout_seconds))
        return ""
    
    return result[0]


def ocr_text(image):
    """Simplified OCR with timeout protection"""
    if pytesseract is None:
        print("Pytesseract not available")
        return ""
    
    print("Starting simplified OCR process...")
    
    # Try just the original image first to avoid timeout
    try:
        text = _ocr_with_timeout(image, timeout_seconds=20)
        if text and len(text.strip()) > 3:
            print(f"OCR successful with original image, text length: {len(text)}")
            return text.strip()
    except Exception as e:
        print(f"OCR failed with original image: {e}")
    
    # If original fails, try one simple preprocessing
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        text = _ocr_with_timeout(gray, timeout_seconds=20)
        if text and len(text.strip()) > 3:
            print(f"OCR successful with grayscale, text length: {len(text)}")
            return text.strip()
    except Exception as e:
        print(f"OCR failed with grayscale: {e}")
    
    print("OCR failed with all attempts")
    return ""


def decode_qr_or_barcode(image):
    values = []
    detector = cv2.QRCodeDetector()
    try:
        data, _, _ = detector.detectAndDecode(image)
        if data:
            values.append(data)
    except Exception:
        pass

    if zbar_decode:
        for img in preprocess_image(image):
            try:
                decoded = zbar_decode(img)
                for obj in decoded:
                    value = obj.data.decode("utf-8", errors="ignore")
                    if value:
                        values.append(value)
            except Exception:
                continue
    return list(dict.fromkeys(values))


def extract_machine_id_from_text(text):
    if not text:
        return None
    cleaned = text.upper().replace("\\", "/").replace("|", "/")
    cleaned = re.sub(r"\s+", " ", cleaned)
    patterns = [
        r"VLL\s*/\s*[A-Z0-9]+\s*/\s*\d{2,4}",
        r"VLL\s+[A-Z0-9]+\s+\d{2,4}",
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned)
        if match:
            value = match.group(0)
            value = re.sub(r"\s*/\s*", "/", value)
            value = re.sub(r"\s+", "/", value)
            return value
    return None


def extract_inst_group(text):
    if not text:
        return None
    cleaned = text.upper()
    match = re.search(r"INST\s*GROUP\s*[:\-]?\s*([A-Z0-9_]+)", cleaned)
    if match:
        return match.group(1).strip()
    return None


def extract_numeric_values(text):
    if not text:
        return []
    return [float(x) for x in re.findall(r"[-+]?\d*\.\d+|[-+]?\d+", text)]
