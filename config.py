import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# On Vercel (and other read-only serverless platforms) the only writable
# directory is /tmp. Fall back to it automatically.
_WRITABLE = "/tmp" if os.environ.get("VERCEL") else BASE_DIR

UPLOAD_FOLDER = os.path.join(_WRITABLE, "uploads")
DATABASE_PATH = os.path.join(_WRITABLE, "machine_readings.db")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


def find_tesseract():
    """Find Tesseract executable — not available on Vercel."""
    import shutil
    path = shutil.which("tesseract")
    if path:
        return path
    for p in [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\Tesseract-OCR\tesseract.exe",
        r"C:\Users\{}\AppData\Local\Tesseract-OCR\tesseract.exe".format(
            os.getenv("USERNAME", "")),
    ]:
        if os.path.exists(p):
            return p
    return ""


TESSERACT_CMD = os.getenv("TESSERACT_CMD", "") or find_tesseract()
