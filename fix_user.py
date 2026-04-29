import sqlite3
from database import get_connection, hash_password

def fix_user_0007():
    """Fix user 0007 by updating password hash"""
    conn = get_connection()
    cur = conn.cursor()
    
    # Delete existing user 0007
    cur.execute("DELETE FROM users WHERE username = ?", ("0007",))
    
    # Recreate user with correct password hash
    password = "eshaan"
    password_hash = hash_password(password)
    
    cur.execute("""
        INSERT INTO users (username, password_hash, full_name, email, role) 
        VALUES (?, ?, ?, ?, ?)
    """, ("0007", password_hash, "Eshaan", "eshaan@vimta.com", "user"))
    
    conn.commit()
    conn.close()
    print("User 0007 has been recreated with correct password hash")

if __name__ == "__main__":
    fix_user_0007()
