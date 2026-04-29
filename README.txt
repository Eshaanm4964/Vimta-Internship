# VIMTA Labs Machine Reading System - Setup & Run Instructions

## Overview
VIMTA Labs Machine Reading System is an AI-powered desktop application for automated laboratory machine reading using OCR technology. This guide provides step-by-step instructions to run the frontend and backend from terminal.

## Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- npm (Node Package Manager)
- Git

## Project Structure
```
machine_reading_system/
├── app.py                    # Flask backend application
├── database.py               # Database operations
├── electron_app/             # Electron frontend application
│   ├── main.js              # Electron main process
│   ├── preload.js           # Electron preload script
│   ├── package.json         # Node.js dependencies
│   └── build/               # Frontend build files
│       └── index.html       # Main frontend application
├── uploads/                  # Upload directory for images
├── config.py                 # Configuration settings
└── README.txt               # This file
```

## Step 1: Setup Backend (Flask Server)

### 1.1 Install Python Dependencies
```bash
# Navigate to project directory
cd "d:\Vimta labs\machine_reading_system"

# Install required Python packages
pip install flask werkzeug pillow opencv-python paddleocr numpy matplotlib requests
```

### 1.2 Initialize Database
```bash
# Run database initialization
python -c "from database import init_db; init_db(); print('Database initialized successfully')"
```

### 1.3 Start Flask Backend Server
```bash
# Method 1: Direct Python execution
python app.py

# Method 2: Using Flask development server
flask run --host=127.0.0.1 --port=5000

# Method 3: Using Python module
python -m flask run --host=127.0.0.1 --port=5000
```

**Expected Output:**
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
```

## Step 2: Setup Frontend (Electron Application)

### 2.1 Navigate to Electron App Directory
```bash
cd "d:\Vimta labs\machine_reading_system\electron_app"
```

### 2.2 Install Node.js Dependencies
```bash
# Install all required packages
npm install

# If npm install fails, try:
npm install --force
# or
npm install --legacy-peer-deps
```

### 2.3 Start Electron Frontend Application
```bash
# Start the Electron application
npm start
```

**Expected Output:**
```
> vimta-labs-machine-reading@1.0.0 start
> electron .

Starting Flask server...
Flask: * Serving Flask app 'app'
Flask server started successfully
Flask: * Running on http://127.0.0.1:5000
```

## Step 3: Complete Application Startup

### 3.1 Automated Startup (Recommended)
The Electron application automatically starts the Flask backend when you run `npm start`.

```bash
# Single command to start the complete application
cd "d:\Vimta labs\machine_reading_system\electron_app"
npm start
```

### 3.2 Manual Startup (Alternative)
If you prefer to start backend and frontend separately:

**Terminal 1 - Backend:**
```bash
cd "d:\Vimta labs\machine_reading_system"
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd "d:\Vimta labs\machine_reading_system\electron_app"
npm start
```

## Step 4: Access the Application

### 4.1 Desktop Application
- The Electron desktop application will launch automatically
- Look for the VIMTA Labs window on your desktop

### 4.2 Web Access (Optional)
If you want to access via web browser:
- Frontend: Not accessible via browser (Electron desktop only)
- Backend API: http://localhost:5000

## Default Login Credentials

### Admin Account
- **Username:** admin
- **Password:** admin123

### User Account
- **Username:** 0007
- **Password:** eshaan

### Create New Account
1. Click "Create an Account" on login page
2. Fill in the registration form
3. Wait for admin approval (if approval system is enabled)

## Troubleshooting

### Common Issues

#### 1. Flask Server Not Starting
```bash
# Check Python version
python --version

# Install Flask if missing
pip install flask

# Check if port 5000 is in use
netstat -ano | findstr :5000
```

#### 2. Electron Application Not Starting
```bash
# Check Node.js version
node --version

# Reinstall dependencies
npm install

# Clear npm cache
npm cache clean --force
```

#### 3. Database Issues
```bash
# Reinitialize database
python -c "from database import init_db; init_db()"

# Check database file permissions
dir "d:\Vimta labs\machine_reading_system\*.db"
```

#### 4. OCR/Dependencies Issues
```bash
# Install OCR dependencies
pip install paddleocr

# Install image processing libraries
pip install opencv-python pillow

# Install additional dependencies
pip install numpy matplotlib requests
```

#### 5. Permission Issues (Windows)
```bash
# Run PowerShell as Administrator
# Then navigate to project directory
cd "d:\Vimta labs\machine_reading_system"
```

### Error Messages and Solutions

**Error:** "ModuleNotFoundError: No module named 'flask'"
```bash
Solution: pip install flask
```

**Error:** "npm ERR! code ENOENT"
```bash
Solution: npm install --force
```

**Error:** "Address already in use" (Port 5000)
```bash
Solution: 
# Kill process using port 5000
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F
```

**Error:** "Database is locked"
```bash
Solution: Restart the application or delete database.lock file if exists
```

## Development Mode

### Enable Debug Mode
```bash
# Set FLASK_ENV environment variable
set FLASK_ENV=development
python app.py
```

### View Logs
```bash
# Flask logs are displayed in terminal
# Check for ERROR messages in output
```

## Production Deployment

### For Production Use
1. Use a production WSGI server (Gunicorn, uWSGI)
2. Configure proper database
3. Set up SSL certificates
4. Configure firewall rules
5. Set up monitoring and logging

### Production Flask Server
```bash
# Install Gunicorn
pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

## API Endpoints Reference

### Authentication
- POST /api/login - User login
- POST /api/signup - User registration

### Data Management
- GET /api/labs - Get all laboratories
- GET /api/machines - Get all machines
- GET /api/readings - Get all readings

### User Management (Admin)
- GET /api/users - Get all users
- GET /api/users/pending - Get pending users
- POST /api/users/approve - Approve user
- POST /api/users/deny - Deny user

### OCR Operations
- POST /api/extract - Extract values from image
- POST /api/confirm - Save reading data

## Support

For technical support:
1. Check the troubleshooting section above
2. Review error logs in terminal output
3. Verify all prerequisites are installed
4. Ensure proper file permissions

## File Locations

- **Main Application:** d:\Vimta labs\machine_reading_system\
- **Electron App:** d:\Vimta labs\machine_reading_system\electron_app\
- **Database:** d:\Vimta labs\machine_reading_system\machine_reading.db
- **Uploads:** d:\Vimta labs\machine_reading_system\uploads\
- **Logs:** Terminal output

---

**Last Updated:** April 29, 2026
**Version:** 2.0
**Framework:** Flask Backend + Electron Frontend
