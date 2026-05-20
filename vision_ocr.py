"""
Vision-based OCR for machine display reading.
Primary: Google Gemini Flash (free tier — 15 req/min, no credit card needed)
Fallback: Anthropic Claude (paid, very accurate)

Set one of:
  GEMINI_API_KEY   — get free at aistudio.google.com
  ANTHROPIC_API_KEY — get at console.anthropic.com
"""

import base64
import json
import re
import os
import cv2
import numpy as np


def _encode_image(image) -> tuple:
    """Return (base64_str, media_type) for a file path or NumPy array."""
    if isinstance(image, str):
        ext = os.path.splitext(image)[1].lower()
        media_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                     '.png': 'image/png', '.webp': 'image/webp'}
        media_type = media_map.get(ext, 'image/jpeg')
        with open(image, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8'), media_type
    else:
        _, buf = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return base64.b64encode(buf.tobytes()).decode('utf-8'), 'image/jpeg'


def _build_prompt(machine_type: str, fields: list, units: dict) -> str:
    units = units or {}
    field_lines = []
    for f in fields:
        u = units.get(f, "")
        field_lines.append(f"  - {f}" + (f" (unit: {u})" if u else ""))
    example = {}
    for f in fields:
        example[f] = "10:00" if f == "time_value" else 0
    return (
        f"You are reading a lab instrument display photo.\n"
        f"Extract these readings:\n" + "\n".join(field_lines) + "\n\n"
        f"Return ONLY a JSON object. Keys must match exactly. "
        f"Values are numbers (int/float). Time fields use 'MM:SS' string. "
        f"Use null if a value is not clearly visible. No units in values.\n"
        f"Machine type: {machine_type}\n"
        f"Example: {json.dumps(example)}"
    )


def _parse_response(text: str, fields: list) -> dict:
    """Extract and clean JSON from model response."""
    json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if not json_match:
        raise ValueError(f"No JSON in response: {text[:200]}")
    data = json.loads(json_match.group(0))
    clean = {}
    for field in fields:
        val = data.get(field)
        if val is not None:
            if field == "time_value":
                clean[field] = str(val)
            else:
                try:
                    clean[field] = float(val)
                except (TypeError, ValueError):
                    clean[field] = val
    return clean


# ---------------------------------------------------------------------------
# Gemini (free tier)
# ---------------------------------------------------------------------------

def _extract_with_gemini(image, machine_type: str, fields: list, units: dict) -> dict:
    """Use Google Gemini Flash — free at 15 req/min."""
    import warnings
    warnings.filterwarnings("ignore", category=FutureWarning)
    import google.generativeai as genai
    from PIL import Image

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-flash-lite-latest")

    # Convert to PIL Image
    if isinstance(image, str):
        pil_image = Image.open(image)
    else:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb)

    prompt = _build_prompt(machine_type, fields, units)
    response = model.generate_content([pil_image, prompt])
    raw = response.text.strip()
    print(f"[VisionOCR/Gemini] Response: {raw}")
    return _parse_response(raw, fields)


# ---------------------------------------------------------------------------
# Anthropic Claude (paid, optional fallback)
# ---------------------------------------------------------------------------

def _extract_with_anthropic(image, machine_type: str, fields: list, units: dict) -> dict:
    """Use Anthropic Claude vision — accurate but paid."""
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=api_key)
    image_b64, media_type = _encode_image(image)
    prompt = _build_prompt(machine_type, fields, units)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image",
                 "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                {"type": "text", "text": prompt}
            ]
        }]
    )
    raw = message.content[0].text.strip()
    print(f"[VisionOCR/Anthropic] Response: {raw}")
    return _parse_response(raw, fields)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_with_vision(image, machine_type: str, fields: list, units: dict = None) -> dict:
    """
    Extract machine readings using a vision LLM.
    Tries Gemini first (free), then Anthropic (paid).
    Raises Exception if neither key is configured or both fail.
    """
    errors = []

    # Try Gemini first (free)
    if os.getenv("GEMINI_API_KEY"):
        try:
            return _extract_with_gemini(image, machine_type, fields, units or {})
        except Exception as e:
            errors.append(f"Gemini: {e}")
            print(f"[VisionOCR] Gemini failed: {e}")

    # Try Anthropic
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            return _extract_with_anthropic(image, machine_type, fields, units or {})
        except Exception as e:
            errors.append(f"Anthropic: {e}")
            print(f"[VisionOCR] Anthropic failed: {e}")

    raise Exception("No vision API key set. " + " | ".join(errors) if errors
                    else "Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY")
