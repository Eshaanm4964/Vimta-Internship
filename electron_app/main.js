const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { spawn } = require('child_process');
app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow;
let flaskProcess;

// Flask server configuration
const FLASK_PORT = 5000;
const FLASK_HOST = '127.0.0.1';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'VIMTA Labs • AI Machine Reading Automation',
    show: false,
    autoHideMenuBar: true
  });

  // Load the React app
  mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startFlaskServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting Flask server...');
    
    // Path to Flask app
    const flaskAppPath = path.join(__dirname, '..', 'app.py');
    
    if (!fs.existsSync(flaskAppPath)) {
      reject(new Error('Flask app not found'));
      return;
    }

    // Start Flask server
    flaskProcess = spawn('python', [flaskAppPath], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        FLASK_PORT: FLASK_PORT.toString()
      }
    });

    let serverStarted = false;
    const startupTimeout = setTimeout(() => {
      if (!serverStarted) {
        flaskProcess.kill();
        reject(new Error('Flask server startup timeout'));
      }
    }, 30000);

    flaskProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Flask:', output);
      
      if (output.includes('Running on') || output.includes('Serving Flask')) {
        serverStarted = true;
        clearTimeout(startupTimeout);
        resolve();
      }
    });

    flaskProcess.stderr.on('data', (data) => {
      console.error('Flask Error:', data.toString());
    });

    flaskProcess.on('close', (code) => {
      if (!serverStarted) {
        clearTimeout(startupTimeout);
        reject(new Error(`Flask server exited with code ${code}`));
      }
    });

    // Check if server is responding
    const checkServer = async () => {
      try {
        const response = await axios.get(`http://${FLASK_HOST}:${FLASK_PORT}/api/labs`, {
          timeout: 5000
        });
        if (response.status === 200) {
          serverStarted = true;
          clearTimeout(startupTimeout);
          resolve();
        }
      } catch (error) {
        // Server not ready yet, try again
        setTimeout(checkServer, 1000);
      }
    };

    setTimeout(checkServer, 2000);
  });
}

// App event handlers
app.whenReady().then(async () => {
  try {
    // Start Flask server first
    await startFlaskServer();
    console.log('Flask server started successfully');
    
    // Create main window
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    dialog.showErrorBox('Startup Error', 'Failed to start the application. Please check if Python and required packages are installed.');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('get-labs', async () => {
  try {
    const response = await axios.get(`http://${FLASK_HOST}:${FLASK_PORT}/api/labs`);
    return response.data;
  } catch (error) {
    console.error('Error getting labs:', error);
    throw error;
  }
});

ipcMain.handle('get-machines', async (event, labNo) => {
  try {
    const response = await axios.get(`http://${FLASK_HOST}:${FLASK_PORT}/api/machines`, {
      params: { lab_no: labNo }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting machines:', error);
    throw error;
  }
});

ipcMain.handle('get-readings', async (event, labNo) => {
  try {
    const response = await axios.get(`http://${FLASK_HOST}:${FLASK_PORT}/api/readings`, {
      params: { lab_no: labNo }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting readings:', error);
    throw error;
  }
});

ipcMain.handle('extract-values', async (event, labNo, machineId, imageData) => {
  try {
    // Handle base64 image data
    let formData;
    
    if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      // Base64 image data
      formData = new FormData();
      
      // Convert base64 to buffer
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Create a temporary file
      const tempPath = path.join(require('os').tmpdir(), `temp_image_${Date.now()}.jpg`);
      fs.writeFileSync(tempPath, buffer);
      
      formData.append('image', fs.createReadStream(tempPath));
      formData.append('lab_no', labNo);
      formData.append('machine_id', machineId);
      
      // Clean up temp file after request
      const response = await axios.post(`http://${FLASK_HOST}:${FLASK_PORT}/api/extract`, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 180000 // 3 minute timeout for OCR
      });
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
      
      return response.data;
    } else {
      // File path (fallback)
      formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('lab_no', labNo);
      formData.append('machine_id', machineId);

      const response = await axios.post(`http://${FLASK_HOST}:${FLASK_PORT}/api/extract`, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 180000 // 3 minute timeout for OCR
      });
      return response.data;
    }
  } catch (error) {
    console.error('Error extracting values:', error.response?.data || error.message);
    throw error;
  }
});

ipcMain.handle('save-reading', async (event, data) => {
  try {
    const response = await axios.post(`http://${FLASK_HOST}:${FLASK_PORT}/api/confirm`, data);
    return response.data;
  } catch (error) {
    console.error('Error saving reading:', error.response?.data || error.message);
    throw error;
  }
});

// User operations
ipcMain.handle('login', async (event, username, password) => {
  try {
    const response = await axios.post(`http://${FLASK_HOST}:${FLASK_PORT}/api/login`, {
      username: username,
      password: password
    });
    return response.data;
  } catch (error) {
    console.error('Error during login:', error.response?.data || error.message);
    throw error;
  }
});

ipcMain.handle('signup', async (event, userData) => {
  try {
    const response = await axios.post(`http://${FLASK_HOST}:${FLASK_PORT}/api/signup`, userData);
    return response.data;
  } catch (error) {
    console.error('Error during signup:', error.response?.data || error.message);
    throw error;
  }
});

ipcMain.handle('get-users', async (event) => {
  try {
    const response = await axios.get(`http://${FLASK_HOST}:${FLASK_PORT}/api/users`);
    return response.data;
  } catch (error) {
    console.error('Error getting users:', error.response?.data || error.message);
    throw error;
  }
});

ipcMain.handle('get-pending-users', async (event) => {
  try {
    const response = await axios.get(`http://${FLASK_HOST}:${FLASK_PORT}/api/users/pending`);
    return response.data;
  } catch (error) {
    console.error('Error getting pending users:', error.response?.data || error.message);
    throw error;
  }
});

ipcMain.handle('approve-user', async (event, username) => {
  try {
    const response = await axios.post(`http://${FLASK_HOST}:${FLASK_PORT}/api/users/approve`, {
      username: username
    });
    return response.data;
  } catch (error) {
    console.error('Error approving user:', error.response?.data || error.message);
    throw error;
  }
});

ipcMain.handle('deny-user', async (event, username) => {
  try {
    const response = await axios.post(`http://${FLASK_HOST}:${FLASK_PORT}/api/users/deny`, {
      username: username
    });
    return response.data;
  } catch (error) {
    console.error('Error denying user:', error.response?.data || error.message);
    throw error;
  }
});

ipcMain.handle('select-image-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
      ]
    });
    return result;
  } catch (error) {
    console.error('Error selecting file:', error);
    throw error;
  }
});

ipcMain.handle('show-save-dialog', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    });
    return result;
  } catch (error) {
    console.error('Error showing save dialog:', error);
    throw error;
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
  } catch (error) {
    console.error('Error opening external URL:', error);
    throw error;
  }
});

app.on('before-quit', () => {
  // Kill Flask server when app quits
  if (flaskProcess) {
    flaskProcess.kill();
  }
});


// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (mainWindow) {
    dialog.showErrorBox('Error', 'An unexpected error occurred. The application will close.');
  }
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
