"""
Google Cloud Vision OCR
Calls Vision API TEXT_DETECTION, returns raw text, then parses into readings.
Free tier: 1000 units/month.
No extra pip packages needed — uses stdlib urllib.
"""
import base64
import json
import os
import re
import urllib.request


def _call_vision_api(image) -> str:
    """Send image to Google Vision API and return all detected text."""
    import cv2

    api_key = os.getenv("GOOGLE_VISION_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_VISION_API_KEY not set")

    if isinstance(image, str):
        with open(image, "rb") as f:
            image_bytes = f.read()
    else:
        _, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 95])
        image_bytes = buf.tobytes()

    payload = json.dumps({
        "requests": [{
            "image": {"content": base64.b64encode(image_bytes).decode("utf-8")},
            "features": [{"type": "TEXT_DETECTION", "maxResults": 1}],
        }]
    }).encode("utf-8")

    req = urllib.request.Request(
        f"https://vision.googleapis.com/v1/images:annotate?key={api_key}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    annotations = data.get("responses", [{}])[0].get("textAnnotations", [])
    return annotations[0].get("description", "") if annotations else ""


def _parse(text: str, fields: list) -> dict:
    """Parse raw OCR text into structured readings using field-specific rules."""
    readings = {}
    if not text:
        return readings

    # Time: MM:SS or H:MM:SS
    if "time_value" in fields:
        m = re.search(r"\b(\d{1,2}:\d{2}(?::\d{2})?)\b", text)
        if m:
            readings["time_value"] = m.group(1)

    # Remove time strings before extracting numbers (prevents 19:25 → 19 being matched)
    text_no_time = re.sub(r"\b\d{1,2}:\d{2}(?::\d{2})?\b", "", text)
    numbers = [float(m) for m in re.findall(r"-?\d+(?:\.\d+)?", text_no_time)]

    rules = {
        "speed":       lambda v: 100 <= v <= 30000,
        "temperature": lambda v: -100 <= v <= 300,
        "osmolarity":  lambda v: 0 <= v <= 3000,
        "absorbance":  lambda v: 0 <= v <= 4,
        "wavelength":  lambda v: 150 <= v <= 1100,
        "pressure":    lambda v: 0 <= v <= 20,
        "co2":         lambda v: 0 <= v <= 100,
        "weight":      lambda v: 0 < v <= 50000,
        "volume":      lambda v: 0 < v <= 10000,
        "frequency":   lambda v: 0 < v <= 1000,
        "power":       lambda v: 0 <= v <= 100,
    }

    used = set()
    for field in fields:
        if field == "time_value" or field in readings:
            continue
        rule = rules.get(field)
        if not rule:
            continue
        for i, n in enumerate(numbers):
            if i not in used and rule(n):
                readings[field] = n
                used.add(i)
                break

    return readings


def extract_with_google_vision(image, machine_type: str, fields: list, units: dict) -> dict:
    raw_text = _call_vision_api(image)
    print(f"[GoogleVision] Raw text: {repr(raw_text[:120])}")
    if not raw_text.strip():
        raise ValueError("Google Vision returned no text")
    readings = _parse(raw_text, fields)
    print(f"[GoogleVision] Parsed readings: {readings}")
    return readings
