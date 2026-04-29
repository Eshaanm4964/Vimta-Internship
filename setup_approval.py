import sqlite3
from database import get_connection, approve_user

def setup_approval_system():
    """Setup the approval system by approving existing users and adding the is_approved column"""
    conn = get_connection()
    cur = conn.cursor()
    
    # Check if is_approved column exists, add it if it doesn't
    try:
        cur.execute("ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT 0")
        conn.commit()
        print("Added is_approved column to users table")
    except sqlite3.OperationalError:
        print("is_approved column already exists")
    
    # Approve existing users (admin and 0007)
    cur.execute("UPDATE users SET is_approved = 1 WHERE username IN ('admin', '0007')")
    conn.commit()
    
    print("Approved existing users: admin, 0007")
    
    # Show current user status
    users = cur.execute("SELECT username, full_name, role, is_approved, is_active FROM users").fetchall()
    print("\nCurrent users:")
    for user in users:
        status = "Approved" if user['is_approved'] else "Pending"
        active = "Active" if user['is_active'] else "Inactive"
        print(f"  {user['username']} ({user['full_name']}) - {user['role']} - {status} - {active}")
    
    conn.close()

if __name__ == "__main__":
    setup_approval_system()
