import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
DATABASE_PATH = os.path.join(BASE_DIR, "machine_readings.db")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

# Auto-detect Tesseract installation path
def find_tesseract():
    """Find Tesseract executable in common installation locations"""
    possible_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\Tesseract-OCR\tesseract.exe",
        r"C:\Users\{}\AppData\Local\Tesseract-OCR\tesseract.exe".format(os.getenv("USERNAME", "")),
        r"C:\Users\{}\AppData\Local\Programs\Tesseract-OCR\tesseract.exe".format(os.getenv("USERNAME", "")),
    ]
    
    # Check if Tesseract is in PATH
    try:
        import shutil
        path = shutil.which("tesseract")
        if path:
            return path
    except:
        pass
    
    # Check common installation paths
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    return ""

# If Tesseract is installed but not in PATH, set it here on Windows.
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "") or find_tesseract()
