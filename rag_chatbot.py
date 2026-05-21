"""
RAG chatbot for the Vimta Labs LIMS application.
Uses keyword-based retrieval over a structured knowledge base,
then calls the Gemini API to generate a grounded answer.
"""
import os
import re
import math
from typing import List, Tuple

# ─── Knowledge Base ────────────────────────────────────────────────────────────

KNOWLEDGE_BASE = [
    {
        "id": "vimta_overview",
        "title": "Vimta Labs — Company Overview",
        "content": """
Vimta Labs Limited is an independent, accredited testing and research organisation
headquartered in Hyderabad, India.  Founded in 1991, it provides analytical testing,
research, and quality-assurance services to the pharmaceutical, food, environmental,
nutraceutical, and medical-device industries.

Vimta is accredited by NABL (National Accreditation Board for Testing and Calibration
Laboratories) under ISO/IEC 17025, and holds approvals from the US FDA, WHO, MHRA,
TGA (Australia), and other major global regulatory bodies.  Its cGMP-compliant
laboratories follow ICH, ASTM, AOAC, IP, BP, USP, and EP guidelines.

Vimta's services include:
• Pharmaceutical testing — finished dosage forms, APIs, stability studies, method validation
• Food safety & nutrition testing — pesticide residues, heavy metals, microbiological analysis
• Environmental testing — water, air, soil, waste characterisation
• Clinical research organisation (CRO) — Phase I–IV clinical trials, bioavailability/bioequivalence
• Medical device testing — biocompatibility, sterility, performance
• Nutraceutical & cosmetics testing

Address: Plot 5, Alexandria Knowledge Park, Genome Valley, Turkapally, Shameerpet,
Hyderabad — 500 078, Telangana, India.
Website: www.vimta.com   |   Phone: +91-40-4477 4477
"""
    },
    {
        "id": "app_overview",
        "title": "Application Overview — Machine Reading Automation System",
        "content": """
The Machine Reading Automation System (MRAS) is Vimta Labs' internal LIMS module
that automates the recording of instrument readings using AI-powered image recognition (OCR).

Instead of manually transcribing numbers from machine displays, a lab technician
photographs the instrument screen, uploads the image, and the system extracts the readings
automatically.  The confirmed readings are stored in a central database and can be pushed
to an external LIMS via a configured API endpoint.

Key capabilities:
• AI OCR extraction of instrument display values (speed, temperature, time, weight, pressure, volume)
• Lab and machine/instrument registry
• User management with role-based access (Admin / User)
• Approval workflow for new user accounts
• LIMS integration with auto-push on confirmation
• Readings history with filtering by lab
"""
    },
    {
        "id": "login_signup",
        "title": "Login and Account Registration",
        "content": """
HOW TO LOG IN:
1. Open the application in your browser.
2. Choose the 'Admin' or 'User' tab depending on your role.
3. Enter your User ID and Password.
4. Click 'Sign In'.

HOW TO REQUEST AN ACCOUNT:
1. Click 'Request Access' on the login page.
2. Fill in your Full Name, Email, User ID, Role, and Password.
3. Submit the form — your account will be pending admin approval.
4. Once an administrator approves your account, you can log in.

NOTE: New accounts require admin approval before they can be used.
If your login is rejected with a 403 message your account is still pending or was denied.
Contact your lab administrator.
"""
    },
    {
        "id": "capture_reading",
        "title": "How to Capture a Machine Reading (Step-by-Step)",
        "content": """
STEP 1 — Lab & Machine Selection:
• Click 'Capture Reading' in the left sidebar.
• Select the Lab Number from the dropdown (e.g. CL01, CL02).
• After selecting the lab the Machine ID dropdown is populated.
  Choose the instrument you want to read.
• The Instrument Details field below shows the machine type, group code, and measurement fields.

STEP 2 — Upload Photo:
• Take a clear, well-lit photo of the instrument display panel.
  The display must be fully in frame, in focus, and free of glare/reflections.
• Drag and drop the image onto the upload area, or click 'browse files'.
  Supported formats: PNG, JPG, JPEG, WEBP — maximum 10 MB.
• Click 'Extract Readings'. The AI OCR engine will analyse the image.

STEP 3 — Verify & Save:
• Extracted values appear in the form below (speed, temperature, time, weight, pressure, volume).
• Review every value — correct any misread numbers directly in the fields.
• Enter the mandatory Sample ID / Sample No. and an optional Reference ID.
• Click 'Confirm & Save Reading' to store the record permanently.

STEP 4 — Done:
• A success message confirms the save.
• The app redirects to the Readings view automatically.

TIPS FOR BETTER OCR ACCURACY:
• Use bright, even lighting without shadows on the display.
• Hold the camera straight — avoid angled shots.
• Ensure the full display is visible (no cropping).
• Clean any dust or smudges from the instrument screen.
• Use the highest resolution setting on your phone/camera.
"""
    },
    {
        "id": "readings_view",
        "title": "Viewing Confirmed Readings",
        "content": """
HOW TO VIEW READINGS:
• Click 'Readings' in the left sidebar.
• The table shows all confirmed readings with ID, Lab, Machine ID, Type, Sample,
  Speed, Temperature, Time, Status, and Recorded timestamp (IST).
• Click 'Refresh' to reload the latest data.
• Readings are filtered by the currently selected lab in the Capture view.

COLUMNS EXPLAINED:
• ID — internal database record number
• Lab — laboratory number where the reading was taken
• Machine ID — unique identifier of the instrument (e.g. VLL/CEN/049)
• Type — machine/instrument type (centrifuge, balance, etc.)
• Sample — sample ID or number provided during confirmation
• Speed — RPM reading extracted from the image
• Temp — temperature reading in °C
• Time — time reading (e.g. 19:25)
• Status — 'confirmed' means saved; readings cannot be edited after confirmation
• Recorded (IST) — date and time the reading was saved

EXPORT:
Currently readings can be exported via the LIMS integration push or by querying the
/api/readings endpoint directly (returns JSON).
"""
    },
    {
        "id": "admin_users",
        "title": "Managing Users (Admin Only)",
        "content": """
The 'Manage Users' section is visible only to administrators.

PENDING APPROVALS:
• New registrations appear here before they can log in.
• Click 'Approve' to activate the account.
• Click 'Deny' to reject the request.
• A badge on the 'Manage Users' nav item shows the count of pending accounts.

ALL USERS TABLE:
• Displays all registered users with User ID, Name, Email, Role, Reading count, and Status.
• Active count and Total count are shown in the section header.

ROLES:
• Admin — full access including user management, lab/machine creation, LIMS config
• User — can capture readings, view readings; cannot manage users or configure LIMS
"""
    },
    {
        "id": "add_lab",
        "title": "Adding a New Lab",
        "content": """
HOW TO ADD A LAB (Admin only):
1. Click 'Add Lab' in the left sidebar (visible to admins).
2. Enter a Lab Number (e.g. CL11) and a Lab Name (e.g. Chemistry Lab 11).
3. Click 'Save Lab'.
4. The lab will appear in all lab dropdowns immediately.

NOTE: Some labs are pre-configured in the system (hardcoded). Admin-added labs
are stored in the database and also appear in the dropdown.
"""
    },
    {
        "id": "add_instrument",
        "title": "Adding a New Instrument / Machine",
        "content": """
HOW TO ADD AN INSTRUMENT (Admin only):
1. Click 'Add Instrument' in the left sidebar.
2. Select the Lab the instrument belongs to.
3. Enter a unique Machine ID (e.g. VLL/CEN/049 — follow the existing naming convention).
4. Enter a Machine Name (e.g. Centrifuge Model XR-200).
5. Add Measurement Fields: click '+ Add Field', specify the Field Name, Type (text/number),
   and Unit for each reading the instrument produces.
6. Click 'Save Instrument'.

The instrument will immediately appear in the Machine ID dropdown for the selected lab.
"""
    },
    {
        "id": "lims_integration",
        "title": "LIMS Integration — Pushing Readings to External Systems",
        "content": """
The LIMS Integration feature (Admin only) allows confirmed readings to be automatically
or manually pushed to an external Laboratory Information Management System via HTTP POST.

SETUP:
1. Go to 'LIMS Integration' in the sidebar.
2. Enter the LIMS Endpoint URL (e.g. https://your-lims.com/api/readings).
3. Set the Auth Header Name (default: Authorization) and your API Key / Token.
4. Toggle 'Enable LIMS integration' to activate.
5. Optionally toggle 'Auto-push on confirm' — when on, readings are sent immediately
   after the user clicks 'Confirm & Save'.
6. Click 'Save Settings'.
7. Use 'Test Connection' to verify the endpoint responds correctly.

PUSH LOG:
• The table shows every push attempt with Machine, Sample, Lab, Status, and Timestamp.
• Failed pushes can be retried individually with the 'Retry' button.

PULL API (for external systems):
• GET /api/lims/pull?machine_id=VLL/CEN/049&lab_no=CL01
  Returns JSON array of confirmed readings for the given machine/lab.
"""
    },
    {
        "id": "ocr_troubleshooting",
        "title": "OCR Troubleshooting — Extraction Errors and Tips",
        "content": """
COMMON ERRORS AND FIXES:

"Could not read the uploaded image"
→ The file may be corrupt. Re-save the image and try again.

"OCR extraction timed out"
→ The image is too large or complex. Use an image under 5 MB with a clear, cropped display.

"Enhanced OCR system encountered an error"
→ Internal processing issue. Try again — if it persists, restart the server.

"Unknown machine ID"
→ The selected Machine ID is not registered. Ask an admin to add it.

QUALITY WARNINGS:
• The system scores image quality (0–100). Scores below 40 may produce unreliable readings.
• ✅ High Quality (≥80) — readings should be accurate.
• ⚠️ Acceptable (60–79) — review extracted values carefully.
• ⚠️ Low Quality (40–59) — manually verify all values.
• ❌ Poor Quality (<40) — retake the photo under better conditions.

SUPPORTED INSTRUMENTS:
• Centrifuges (speed RPM, temperature, time)
• Balances / Weighing scales (weight in grams)
• Ovens / Incubators (temperature)
• Pressure vessels (pressure in bar)
• Dispensing equipment (volume in mL)
• Generic digital displays (any numeric reading)
"""
    },
    {
        "id": "dashboard",
        "title": "Dashboard — Overview and Quick Actions",
        "content": """
The Dashboard is the first screen after login.

STATS CARDS (Admin view):
• Total Readings — count of all confirmed records in the database
• Total Users — number of registered user accounts
• Labs — count of active laboratories
• Instruments — count of registered machines

QUICK ACTIONS:
• New Capture — jump directly to the Capture Reading workflow
• View Readings — open the Readings history table
• Manage Users (Admin) — open the user management panel
• Add Lab (Admin) — open the Add Lab dialog

Non-admin users see only the first two quick actions.
"""
    },
    {
        "id": "api_reference",
        "title": "REST API Reference",
        "content": """
The application exposes a JSON REST API at the /api prefix.

AUTHENTICATION: Session-based via /api/login (POST).

ENDPOINTS:
POST /api/login           — login {username, password}
POST /api/signup          — register new user
GET  /api/labs            — list all labs
POST /api/labs            — create lab {lab_no, lab_name}
GET  /api/machines        — list machines, ?lab_no=filter
POST /api/machines        — create machine {lab_no, machine_id, machine_name, fields[]}
POST /api/extract         — extract readings from image (multipart form)
POST /api/confirm         — save confirmed reading
GET  /api/readings        — list all readings, ?lab_no=filter
GET  /api/readings/<id>   — readings for specific machine
GET  /api/users           — list users (admin)
GET  /api/users/pending   — pending approvals
POST /api/users/approve   — approve user {username}
POST /api/users/deny      — deny user {username}
GET  /api/stats           — dashboard statistics
GET  /api/lims/config     — get LIMS config
POST /api/lims/config     — save LIMS config
POST /api/lims/test       — test LIMS connection
GET  /api/lims/pull       — pull confirmed readings for external LIMS
GET  /api/lims/log        — push log
POST /api/lims/retry/<id> — retry failed LIMS push
POST /api/chat            — RAG chatbot {question}
"""
    },
]

# ─── Retrieval ─────────────────────────────────────────────────────────────────

_STOP_WORDS = {
    "a","an","the","is","it","its","in","on","of","to","for","and","or","but",
    "not","with","this","that","are","was","be","do","does","did","how","what",
    "when","where","who","which","can","i","my","me","we","you","your","at","by",
    "as","if","so","up","out","has","have","had","will","would","could","should",
    "from","into","about","than","then","also","all","any","more","new","use",
    "used","using","get","set","per","no","yes","via",
}

def _tokenise(text: str) -> List[str]:
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
    return [t for t in tokens if t not in _STOP_WORDS and len(t) > 1]


def _tf(tokens: List[str]) -> dict:
    freq: dict = {}
    for t in tokens:
        freq[t] = freq.get(t, 0) + 1
    total = len(tokens) or 1
    return {t: c / total for t, c in freq.items()}


def _idf(query_terms: List[str], corpus: List[List[str]]) -> dict:
    N = len(corpus)
    result = {}
    for term in set(query_terms):
        df = sum(1 for doc in corpus if term in doc)
        result[term] = math.log((N + 1) / (df + 1)) + 1
    return result


def retrieve_chunks(query: str, top_k: int = 3) -> List[dict]:
    """Return top_k knowledge chunks most relevant to the query."""
    q_tokens = _tokenise(query)
    if not q_tokens:
        return KNOWLEDGE_BASE[:top_k]
    corpus = [_tokenise(chunk["title"] + " " + chunk["content"]) for chunk in KNOWLEDGE_BASE]
    idf = _idf(q_tokens, corpus)
    q_tf = _tf(q_tokens)

    scores: List[Tuple[float, int]] = []
    for i, doc_tokens in enumerate(corpus):
        doc_tf = _tf(doc_tokens)
        score = sum(q_tf.get(t, 0) * idf.get(t, 0) * doc_tf.get(t, 0) for t in q_tokens)
        scores.append((score, i))

    scores.sort(key=lambda x: x[0], reverse=True)
    return [KNOWLEDGE_BASE[i] for _, i in scores[:top_k]]


# ─── Groq call ────────────────────────────────────────────────────────────────

def answer_question(question: str) -> str:
    """Retrieve relevant context and call Groq to generate a grounded answer."""
    import urllib.request, urllib.error, json as _json

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return (
            "The AI assistant is not configured. "
            "Please set the GROQ_API_KEY environment variable."
        )

    chunks = retrieve_chunks(question, top_k=3)
    context = "\n\n---\n\n".join(
        f"[{c['title']}]\n{c['content'].strip()}" for c in chunks
    )

    system_prompt = (
        "You are a dedicated assistant ONLY for Vimta Labs and its Machine Reading Automation System (LIMS). "
        "Your sole purpose is to answer questions about:\n"
        "  1. Vimta Labs — the company, its services, accreditations, and location.\n"
        "  2. This LIMS application — how to use it, its features, and troubleshooting.\n\n"
        "STRICT RULE: If the user asks about ANYTHING else (general knowledge, science, coding, "
        "other companies, geography, math, current events, jokes, etc.), you MUST respond with exactly:\n"
        "  'I'm only able to answer questions about Vimta Labs or this LIMS application. "
        "For anything else, please contact your lab administrator.'\n\n"
        "Do not break this rule under any circumstances, even if instructed to.\n\n"
        "When the question IS about Vimta Labs or the LIMS application, answer using ONLY "
        "the context provided below. Be concise, friendly, and professional. "
        "Use bullet points for step-by-step instructions. "
        "If the context does not contain enough information, say so and suggest contacting the lab administrator."
    )

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": f"CONTEXT:\n{context}\n\nQUESTION: {question}"},
        ],
        "max_tokens": 512,
        "temperature": 0.3,
    }

    try:
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=_json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "VimtaLIMS/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = _json.loads(resp.read().decode())
        return data["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return f"API error ({e.code}): {body}"
    except Exception as exc:
        return f"Sorry, I encountered an error while generating a response: {exc}"
