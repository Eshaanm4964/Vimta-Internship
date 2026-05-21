import os
import signal
import threading

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
except ImportError:
    # python-dotenv not installed — fall back to manual load
    _env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(_env_path):
        with open(_env_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith('#') and '=' in _line:
                    _k, _v = _line.split('=', 1)
                    os.environ.setdefault(_k.strip(), _v.strip())
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS

from config import UPLOAD_FOLDER, ALLOWED_EXTENSIONS
from database import (
    init_db, seed_initial_data, save_reading, get_readings, get_user_by_username, verify_password,
    get_labs, get_machines, get_users, create_lab, create_machine,
    get_machine_types, create_machine_type, create_machine_field,
    get_lims_config, save_lims_config, update_reading_lims_status, get_lims_push_log,
)
from machine_router import list_labs, list_machines, get_machine_by_id

app = Flask(__name__)
CORS(app)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

try:
    init_db()
    seed_initial_data()
except Exception as _e:
    print(f"[startup] DB init warning: {_e}")


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/api/labs', methods=['GET', 'POST'])
def labs():
    if request.method == 'POST':
        data = request.json
        lab_no = data.get('lab_no')
        lab_name = data.get('lab_name')
        if not lab_no or not lab_name:
            return jsonify({"error": "Lab number and name are required"}), 400
        try:
            create_lab(lab_no, lab_name, data.get('description'))
            return jsonify({"success": True}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Merge hardcoded labs (always available) with any admin-added labs in DB
    static_labs = {lab: {"lab_no": lab, "lab_name": lab} for lab in list_labs()}
    for row in get_labs():
        static_labs[row["lab_no"]] = {"lab_no": row["lab_no"], "lab_name": row.get("lab_name", row["lab_no"])}
    return jsonify(sorted(static_labs.values(), key=lambda x: x["lab_no"]))


@app.route('/api/machines', methods=['GET', 'POST'])
def machines_api():
    if request.method == 'POST':
        data = request.json
        lab_no = data.get('lab_no')
        machine_id = data.get('machine_id')
        machine_name = data.get('machine_name')
        fields = data.get('fields', []) # List of {name, type, unit}
        
        if not lab_no or not machine_id or not machine_name:
            return jsonify({"error": "Missing required fields"}), 400
            
        try:
            from database import get_lab_by_no
            lab = get_lab_by_no(lab_no)
            if not lab:
                return jsonify({"error": "Lab not found"}), 404
                
            # Create a machine type for this specific machine to allow custom fields
            type_name = f"type_{machine_id.replace('/', '_')}"
            type_id = create_machine_type(type_name, machine_name)
            
            # Add fields
            for i, f in enumerate(fields):
                create_machine_field(type_id, f['name'], f.get('type', 'text'), f.get('unit'), display_order=i)
                
            # Create machine
            create_machine(lab['id'], type_id, machine_id, machine_name, data.get('group_code'))
            
            return jsonify({"success": True}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    # GET logic
    lab_no = request.args.get('lab_no')
    return jsonify(get_machines(lab_no))

@app.route('/api/machines/<lab_no>', methods=['GET'])
def api_machines(lab_no):
    return jsonify(list_machines(lab_no))


@app.route("/api/extract", methods=["POST"])
def api_extract():
    lab_no = (request.form.get("lab_no") or "").strip()
    machine_id = (request.form.get("machine_id") or "").strip()

    if not lab_no:
        return jsonify({"error": "Lab No is required before selecting a machine"}), 400
    if not machine_id:
        return jsonify({"error": "Machine ID is required"}), 400
    if not get_machine_by_id(machine_id):
        return jsonify({"error": f"Unknown machine ID: {machine_id}"}), 400

    if "image" not in request.files:
        return jsonify({"error": "Image is required"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Only png, jpg, jpeg, webp files are allowed"}), 400
    
    # Check file size (limit to 10MB for performance)
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > 10 * 1024 * 1024:  # 10MB limit
        return jsonify({"error": "File too large. Please upload an image smaller than 10MB for optimal performance."}), 413

    filename = secure_filename(file.filename)
    base, ext = os.path.splitext(filename)
    filename = f"{base}_{abs(hash(os.urandom(8)))}{ext}"
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    
    try:
        file.save(path)
    except Exception as e:
        return jsonify({"error": f"Failed to save file: {str(e)}"}), 500

    try:
        from extractor import extract_from_image
        print(f"Starting extraction for machine: {machine_id}")
        result = extract_from_image(path, selected_lab_no=lab_no, selected_machine_id=machine_id)
        print(f"Extraction result: {result}")
        
        # Check if extraction failed or timed out
        if "error" in result:
            print(f"Extraction failed with error: {result['error']}")
            # Check if we have valid readings despite the timeout
            if "readings" in result and result["readings"] and any(value is not None for value in result["readings"].values()):
                print("Valid readings found despite timeout - returning success")
                result["success"] = True
                result["values"] = result.get("readings", {})
                result["warning"] = result["error"]
                del result["error"]
                result["image_url"] = f"/uploads/{filename}"
                return jsonify(result)
            else:
                return jsonify(result), 500
            
        # Ensure we have the expected structure
        if "readings" not in result:
            result["readings"] = {}
        
        result["success"] = True
        result["values"] = result.get("readings", {})
        result["image_url"] = f"/uploads/{filename}"
        
        print(f"Final result being returned: {result}")
        return jsonify(result)
        
    except Exception as e:
        app.logger.error(f"Extraction error: {str(e)}")
        print(f"Exception in extraction: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        
        # Provide more detailed error information
        error_msg = str(e)
        if "timeout" in error_msg.lower():
            detailed_error = "OCR extraction timed out. Please try with a clearer image or ensure the display is visible."
        elif "could not read" in error_msg.lower():
            detailed_error = "Could not read the uploaded image. Please ensure the image file is valid and not corrupted."
        elif "enhanced" in error_msg.lower():
            detailed_error = "Enhanced OCR system encountered an error. Trying alternative extraction methods..."
        else:
            detailed_error = f"OCR extraction failed: {error_msg}. Please try with a clearer image or different angle."
        
        return jsonify({
            "success": False,
            "error": detailed_error,
            "error_type": type(e).__name__,
            "debug_info": error_msg
        }), 500


@app.route("/api/confirm", methods=["POST"])
def api_confirm():
    data = request.get_json(silent=True) or {}
    if not data.get("lab_no"):
        return jsonify({"error": "lab_no is required before saving"}), 400
    if not data.get("machine_id"):
        return jsonify({"error": "machine_id is required before saving"}), 400
    if not data.get("sample_id"):
        return jsonify({"error": "sample_id is required before saving"}), 400

    data["status"] = "confirmed"
    row_id = save_reading(data)

    # Auto-push to LIMS if configured
    lims_status = None
    cfg = get_lims_config()
    if cfg.get("enabled") == "true" and cfg.get("auto_push") == "true" and cfg.get("endpoint_url"):
        lims_status = _push_reading_to_lims(row_id, data, cfg)

    resp = {"message": "Reading confirmed and saved successfully", "id": row_id}
    if lims_status:
        resp["lims_push"] = lims_status
    return jsonify(resp)


@app.route("/api/readings", methods=["GET"])
def api_readings():
    return jsonify(get_readings(lab_no=request.args.get("lab_no")))


@app.route("/api/readings/<path:machine_id>", methods=["GET"])
def api_readings_by_machine(machine_id):
    return jsonify(get_readings(machine_id=machine_id, lab_no=request.args.get("lab_no")))


@app.route("/api/lims/pull", methods=["GET"])
def api_lims_pull():
    machine_id = request.args.get("machine_id")
    lab_no = request.args.get("lab_no")
    return jsonify(get_readings(machine_id=machine_id, lab_no=lab_no, confirmed_only=True))


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
        
    user = get_user_by_username(username)
    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Check user approval status
    from database import check_user_approval
    is_approved, approval_message = check_user_approval(username)
    if not is_approved:
        return jsonify({"error": approval_message}), 403
        
    return jsonify({
        "message": "Login successful",
        "user": {
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    })


@app.route("/api/signup", methods=["POST"])
def api_signup():
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    email = data.get("email")
    user_id = data.get("user_id")
    password = data.get("password")
    role = data.get("role", "user")
    
    # Validation
    if not name or not email or not user_id or not password:
        return jsonify({"error": "All fields are required"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    
    try:
        from database import create_user
        
        # Check if user already exists
        existing_user = get_user_by_username(user_id)
        if existing_user:
            return jsonify({"error": "User ID already exists"}), 400
        
        # Create new user (password hashing is handled in create_user function)
        create_user(user_id, password, name, email, role)
        
        return jsonify({
            "message": "User created successfully",
            "user": {
                "username": user_id,
                "full_name": name,
                "email": email,
                "role": role
            }
        }), 201
        
    except Exception as e:
        return jsonify({"error": f"Failed to create user: {str(e)}"}), 500


@app.route("/api/users", methods=["GET"])
def api_users():
    # Get all users for admin dashboard
    users = get_users()
    return jsonify(users)


@app.route("/api/users/pending", methods=["GET"])
def api_pending_users():
    # Get all users pending approval
    from database import get_pending_users
    users = get_pending_users()
    return jsonify(users)


@app.route("/api/users/approve", methods=["POST"])
def api_approve_user():
    # Approve a user account
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    
    if not username:
        return jsonify({"error": "Username is required"}), 400
    
    try:
        from database import approve_user
        approve_user(username)
        return jsonify({"message": "User approved successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to approve user: {str(e)}"}), 500


@app.route("/api/users/deny", methods=["POST"])
def api_deny_user():
    # Deny a user account
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    
    if not username:
        return jsonify({"error": "Username is required"}), 400
    
    try:
        from database import deny_user
        deny_user(username)
        return jsonify({"message": "User denied successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to deny user: {str(e)}"}), 500


@app.route("/api/stats", methods=["GET"])
def api_stats():
    # Get basic stats for admin dashboard
    labs = get_labs()
    machines = get_machines()
    readings = get_readings()
    users = get_users()
    
    return jsonify({
        "total_labs": len(labs),
        "total_machines": len(machines),
        "total_readings": len(readings),
        "total_users": len(users)
    })


# ---------------------------------------------------------------------------
# LIMS push helper
# ---------------------------------------------------------------------------

def _push_reading_to_lims(reading_id: int, reading_data: dict, cfg: dict) -> str:
    """POST a reading to the external LIMS endpoint. Returns 'sent' or 'failed'."""
    import urllib.request, urllib.error, json as _json
    payload = {
        "source": "vimta_lims_v1",
        "reading_id": reading_id,
        "lab_no": reading_data.get("lab_no"),
        "machine_id": reading_data.get("machine_id"),
        "machine_type": reading_data.get("machine_type"),
        "machine_name": reading_data.get("machine_name"),
        "sample_id": reading_data.get("sample_id"),
        "reference_id": reading_data.get("reference_id"),
        "readings": reading_data.get("readings", {}),
        "units": reading_data.get("units", {}),
    }
    try:
        body = _json.dumps(payload).encode()
        req = urllib.request.Request(
            cfg["endpoint_url"],
            data=body,
            headers={
                "Content-Type": "application/json",
                cfg.get("auth_header", "Authorization"): cfg.get("api_key", ""),
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            status_code = resp.status
        result = "sent" if 200 <= status_code < 300 else "failed"
    except Exception as e:
        print(f"[LIMS] Push failed: {e}")
        result = "failed"
    update_reading_lims_status(reading_id, result)
    return result


# ---------------------------------------------------------------------------
# LIMS config & management routes
# ---------------------------------------------------------------------------

@app.route("/api/lims/config", methods=["GET"])
def api_lims_config_get():
    cfg = get_lims_config()
    # Never expose the full API key to the frontend
    if cfg.get("api_key"):
        cfg["api_key_set"] = True
        cfg["api_key"] = "••••••••"
    else:
        cfg["api_key_set"] = False
    return jsonify(cfg)


@app.route("/api/lims/config", methods=["POST"])
def api_lims_config_save():
    data = request.get_json(silent=True) or {}
    existing = get_lims_config()
    # Keep existing key if client sends masked value
    api_key = data.get("api_key", "")
    if api_key.startswith("••"):
        api_key = existing.get("api_key", "")
    save_lims_config(
        endpoint_url=data.get("endpoint_url", ""),
        auth_header=data.get("auth_header", "Authorization"),
        api_key=api_key,
        auto_push=data.get("auto_push", "true"),
        enabled=data.get("enabled", "false"),
    )
    return jsonify({"message": "LIMS configuration saved"})


@app.route("/api/lims/test", methods=["POST"])
def api_lims_test():
    data = request.get_json(silent=True) or {}
    url = data.get("endpoint_url", "")
    if not url:
        return jsonify({"success": False, "error": "No endpoint URL provided"}), 400
    import urllib.request, urllib.error
    try:
        req = urllib.request.Request(
            url,
            data=b'{"test":true}',
            headers={
                "Content-Type": "application/json",
                data.get("auth_header", "Authorization"): data.get("api_key", ""),
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            code = resp.status
        return jsonify({"success": 200 <= code < 300, "status_code": code})
    except urllib.error.HTTPError as e:
        return jsonify({"success": False, "status_code": e.code, "error": str(e)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/lims/retry/<int:reading_id>", methods=["POST"])
def api_lims_retry(reading_id):
    readings = get_readings()
    match = next((r for r in readings if r["id"] == reading_id), None)
    if not match:
        return jsonify({"error": "Reading not found"}), 404
    cfg = get_lims_config()
    if not cfg.get("endpoint_url"):
        return jsonify({"error": "LIMS not configured"}), 400
    result = _push_reading_to_lims(reading_id, match, cfg)
    return jsonify({"status": result})


@app.route("/api/lims/log", methods=["GET"])
def api_lims_log():
    return jsonify(get_lims_push_log())


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400
    if len(question) > 1000:
        return jsonify({"error": "Question is too long (max 1000 characters)"}), 400
    from rag_chatbot import answer_question
    answer = answer_question(question)
    return jsonify({"answer": answer})


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
