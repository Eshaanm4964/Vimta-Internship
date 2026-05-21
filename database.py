import json
import sqlite3
from datetime import datetime, timezone, timedelta
from config import DATABASE_PATH


def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _column_exists(cur, table_name, column_name):
    rows = cur.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(row[1] == column_name for row in rows)


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    
    # Create labs table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS labs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lab_no TEXT UNIQUE NOT NULL,
        lab_name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create machine_types table for dynamic field definitions
    cur.execute("""
    CREATE TABLE IF NOT EXISTS machine_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create machine_fields table for dynamic field definitions
    cur.execute("""
    CREATE TABLE IF NOT EXISTS machine_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_type_id INTEGER,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'time')),
        unit TEXT,
        is_required BOOLEAN DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (machine_type_id) REFERENCES machine_types (id)
    )
    """)
    
    # Create machines table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lab_id INTEGER,
        machine_type_id INTEGER,
        machine_id TEXT UNIQUE NOT NULL,
        machine_name TEXT NOT NULL,
        group_code TEXT,
        location TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lab_id) REFERENCES labs (id),
        FOREIGN KEY (machine_type_id) REFERENCES machine_types (id)
    )
    """)
    
    # Create users table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        is_active BOOLEAN DEFAULT 1,
        is_approved BOOLEAN DEFAULT 0,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create machine_readings table (existing)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS machine_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lab_no TEXT,
        machine_id TEXT NOT NULL,
        machine_type TEXT,
        machine_name TEXT,
        sample_id TEXT,
        reference_id TEXT,
        speed REAL,
        temperature REAL,
        time_value TEXT,
        weight REAL,
        pressure REAL,
        volume REAL,
        reading_json TEXT,
        image_path TEXT,
        status TEXT DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create lims_config table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS lims_config (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)

    if not _column_exists(cur, "machine_readings", "lab_no"):
        cur.execute("ALTER TABLE machine_readings ADD COLUMN lab_no TEXT")
    if not _column_exists(cur, "machine_readings", "lims_push_status"):
        cur.execute("ALTER TABLE machine_readings ADD COLUMN lims_push_status TEXT")
    if not _column_exists(cur, "machine_readings", "lims_pushed_at"):
        cur.execute("ALTER TABLE machine_readings ADD COLUMN lims_pushed_at TEXT")

    conn.commit()
    conn.close()


def _to_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_current_ist_time():
    """Get current Indian Standard Time as formatted string"""
    utc_now = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    ist_now = utc_now + ist_offset
    return ist_now.strftime("%Y-%m-%d %H:%M:%S")


def save_reading(data: dict) -> int:
    readings = data.get("readings", {}) or {}
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO machine_readings (
            lab_no, machine_id, machine_type, machine_name, sample_id, reference_id,
            speed, temperature, time_value, weight, pressure, volume,
            reading_json, image_path, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("lab_no"),
        data.get("machine_id"),
        data.get("machine_type"),
        data.get("machine_name"),
        data.get("sample_id"),
        data.get("reference_id"),
        _to_float(readings.get("speed")),
        _to_float(readings.get("temperature")),
        readings.get("time_value"),
        _to_float(readings.get("weight")),
        _to_float(readings.get("pressure")),
        _to_float(readings.get("volume")),
        json.dumps(readings, ensure_ascii=False),
        data.get("image_path"),
        data.get("status", "confirmed"),
        get_current_ist_time(),
    ))
    conn.commit()
    row_id = cur.lastrowid
    conn.close()
    return row_id


def get_readings(machine_id: str | None = None, lab_no: str | None = None, confirmed_only: bool = False):
    conn = get_connection()
    cur = conn.cursor()
    query = "SELECT * FROM machine_readings"
    params = []
    where = []
    if machine_id:
        where.append("machine_id = ?")
        params.append(machine_id)
    if lab_no:
        where.append("lab_no = ?")
        params.append(lab_no)
    if confirmed_only:
        where.append("status = 'confirmed'")
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY created_at DESC"
    rows = cur.execute(query, params).fetchall()
    conn.close()
    result = []
    for row in rows:
        item = dict(row)
        try:
            item["reading_json"] = json.loads(item.get("reading_json") or "{}")
        except json.JSONDecodeError:
            item["reading_json"] = {}
        result.append(item)
    return result


# Lab management functions
def create_lab(lab_no: str, lab_name: str, description: str = None) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO labs (lab_no, lab_name, description) VALUES (?, ?, ?)", 
                (lab_no, lab_name, description))
    conn.commit()
    lab_id = cur.lastrowid
    conn.close()
    return lab_id


def get_labs():
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute("SELECT * FROM labs ORDER BY lab_no").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_lab_by_no(lab_no: str):
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM labs WHERE lab_no = ?", (lab_no,)).fetchone()
    conn.close()
    return dict(row) if row else None


# Machine type management functions
def create_machine_type(type_name: str, display_name: str, description: str = None) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO machine_types (type_name, display_name, description) VALUES (?, ?, ?)", 
                (type_name, display_name, description))
    conn.commit()
    type_id = cur.lastrowid
    conn.close()
    return type_id


def get_machine_types():
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute("SELECT * FROM machine_types ORDER BY type_name").fetchall()
    conn.close()
    return [dict(row) for row in rows]


# Machine field management functions
def create_machine_field(machine_type_id: int, field_name: str, field_type: str, 
                        unit: str = None, is_required: bool = False, display_order: int = 0) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO machine_fields (machine_type_id, field_name, field_type, unit, is_required, display_order) 
        VALUES (?, ?, ?, ?, ?, ?)
    """, (machine_type_id, field_name, field_type, unit, is_required, display_order))
    conn.commit()
    field_id = cur.lastrowid
    conn.close()
    return field_id


def get_machine_fields(machine_type_id: int):
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute("SELECT * FROM machine_fields WHERE machine_type_id = ? ORDER BY display_order", 
                      (machine_type_id,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]


# Machine management functions
def create_machine(lab_id: int, machine_type_id: int, machine_id: str, machine_name: str, 
                   group_code: str = None, location: str = None) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO machines (lab_id, machine_type_id, machine_id, machine_name, group_code, location) 
        VALUES (?, ?, ?, ?, ?, ?)
    """, (lab_id, machine_type_id, machine_id, machine_name, group_code, location))
    conn.commit()
    machine_id_db = cur.lastrowid
    conn.close()
    return machine_id_db


def get_machines(lab_no: str = None):
    conn = get_connection()
    cur = conn.cursor()
    if lab_no:
        query = """
            SELECT m.*, l.lab_no, l.lab_name, mt.type_name, mt.display_name as machine_type_name
            FROM machines m
            JOIN labs l ON m.lab_id = l.id
            JOIN machine_types mt ON m.machine_type_id = mt.id
            WHERE l.lab_no = ?
            ORDER BY m.machine_id
        """
        rows = cur.execute(query, (lab_no,)).fetchall()
    else:
        query = """
            SELECT m.*, l.lab_no, l.lab_name, mt.type_name, mt.display_name as machine_type_name
            FROM machines m
            JOIN labs l ON m.lab_id = l.id
            JOIN machine_types mt ON m.machine_type_id = mt.id
            ORDER BY l.lab_no, m.machine_id
        """
        rows = cur.execute(query).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_machine_by_id(machine_id: str):
    conn = get_connection()
    cur = conn.cursor()
    query = """
        SELECT m.*, l.lab_no, l.lab_name, mt.type_name, mt.display_name as machine_type_name
        FROM machines m
        JOIN labs l ON m.lab_id = l.id
        JOIN machine_types mt ON m.machine_type_id = mt.id
        WHERE m.machine_id = ?
    """
    row = cur.execute(query, (machine_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


# User management functions
import hashlib
import secrets

def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt"""
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{password_hash}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    try:
        salt, hash_value = password_hash.split(":")
        computed_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return computed_hash == hash_value
    except:
        return False


def create_user(username: str, password: str, full_name: str, email: str = None, role: str = "user") -> int:
    conn = get_connection()
    cur = conn.cursor()
    password_hash = hash_password(password)
    cur.execute("""
        INSERT INTO users (username, password_hash, full_name, email, role) 
        VALUES (?, ?, ?, ?, ?)
    """, (username, password_hash, full_name, email, role))
    conn.commit()
    user_id = cur.lastrowid
    conn.close()
    return user_id


def get_user_by_username(username: str):
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_users():
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute("SELECT id, username, full_name, email, role, is_active, last_login, created_at FROM users ORDER BY username").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def update_user_login(username: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET last_login = ? WHERE username = ?", (get_current_ist_time(), username))
    conn.commit()
    conn.close()


def approve_user(username: str):
    """Approve a user account"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_approved = 1 WHERE username = ?", (username,))
    conn.commit()
    conn.close()


def deny_user(username: str):
    """Deny a user account"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_active = 0 WHERE username = ?", (username,))
    conn.commit()
    conn.close()


def get_pending_users():
    """Get all users pending approval"""
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute("SELECT id, username, full_name, email, role, created_at FROM users WHERE is_approved = 0 AND is_active = 1 ORDER BY created_at").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def seed_initial_data():
    """Create default users and seed labs/machines from machine_router if DB is empty."""
    from machine_router import MACHINES

    conn = get_connection()
    cur = conn.cursor()

    # Default users
    defaults = [
        ("admin",  "admin123", "Administrator", "admin@vimtalabs.com", "admin"),
        ("0007",   "eshaan",   "Eshaan Michael", "",                   "user"),
    ]
    for username, password, full_name, email, role in defaults:
        exists = cur.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone()
        if not exists:
            cur.execute(
                "INSERT INTO users (username, password_hash, full_name, email, role, is_approved, is_active) "
                "VALUES (?, ?, ?, ?, ?, 1, 1)",
                (username, hash_password(password), full_name, email, role)
            )

    # Seed labs from machine_router
    lab_nos = sorted({m["lab_no"] for m in MACHINES})
    for lab_no in lab_nos:
        exists = cur.execute("SELECT 1 FROM labs WHERE lab_no=?", (lab_no,)).fetchone()
        if not exists:
            cur.execute("INSERT INTO labs (lab_no, lab_name) VALUES (?, ?)", (lab_no, lab_no))

    # Seed machines from machine_router
    for m in MACHINES:
        exists = cur.execute("SELECT 1 FROM machines WHERE machine_id=?", (m["machine_id"],)).fetchone()
        if not exists:
            lab_row = cur.execute("SELECT id FROM labs WHERE lab_no=?", (m["lab_no"],)).fetchone()
            if not lab_row:
                continue
            lab_id = lab_row["id"]
            type_name = m["group_code"].lower()
            type_row = cur.execute("SELECT id FROM machine_types WHERE type_name=?", (type_name,)).fetchone()
            if not type_row:
                cur.execute(
                    "INSERT INTO machine_types (type_name, display_name) VALUES (?, ?)",
                    (type_name, m["machine_name"])
                )
                type_id = cur.lastrowid
            else:
                type_id = type_row["id"]
            cur.execute(
                "INSERT INTO machines (lab_id, machine_type_id, machine_id, machine_name, group_code) "
                "VALUES (?, ?, ?, ?, ?)",
                (lab_id, type_id, m["machine_id"], m["machine_name"], m["group_code"])
            )

    conn.commit()
    conn.close()


def check_user_approval(username: str):
    """Check if user is approved"""
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT is_approved, is_active FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not row:
        return False, "User not found"
    if not row['is_active']:
        return False, "Account is deactivated"
    if not row['is_approved']:
        return False, "Account pending approval"
    return True, "Approved"


# ---------------------------------------------------------------------------
# LIMS configuration
# ---------------------------------------------------------------------------

def get_lims_config() -> dict:
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute("SELECT key, value FROM lims_config").fetchall()
    conn.close()
    cfg = {row["key"]: row["value"] for row in rows}
    return {
        "endpoint_url": cfg.get("endpoint_url", ""),
        "auth_header": cfg.get("auth_header", "Authorization"),
        "api_key": cfg.get("api_key", ""),
        "auto_push": cfg.get("auto_push", "true"),
        "enabled": cfg.get("enabled", "false"),
    }


def save_lims_config(endpoint_url: str, auth_header: str, api_key: str,
                     auto_push: str, enabled: str):
    conn = get_connection()
    cur = conn.cursor()
    for key, value in [
        ("endpoint_url", endpoint_url),
        ("auth_header", auth_header),
        ("api_key", api_key),
        ("auto_push", auto_push),
        ("enabled", enabled),
    ]:
        cur.execute(
            "INSERT INTO lims_config (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value)
        )
    conn.commit()
    conn.close()


def update_reading_lims_status(reading_id: int, status: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE machine_readings SET lims_push_status = ?, lims_pushed_at = ? WHERE id = ?",
        (status, get_current_ist_time(), reading_id)
    )
    conn.commit()
    conn.close()


def get_lims_push_log(limit: int = 50) -> list:
    conn = get_connection()
    cur = conn.cursor()
    rows = cur.execute(
        """SELECT id, machine_id, sample_id, lab_no, lims_push_status, lims_pushed_at, created_at
           FROM machine_readings
           WHERE lims_push_status IS NOT NULL
           ORDER BY lims_pushed_at DESC LIMIT ?""",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
