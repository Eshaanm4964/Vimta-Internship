const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Lab and Machine operations
  getLabs: () => ipcRenderer.invoke('get-labs'),
  getMachines: (labNo) => ipcRenderer.invoke('get-machines', labNo),
  getReadings: (labNo) => ipcRenderer.invoke('get-readings', labNo),
  
  // OCR operations
  extractValues: (labNo, machineId, imagePath) => ipcRenderer.invoke('extract-values', labNo, machineId, imagePath),
  saveReading: (data) => ipcRenderer.invoke('save-reading', data),
  
  // User operations
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  signup: (userData) => ipcRenderer.invoke('signup', userData),
  getUsers: () => ipcRenderer.invoke('get-users'),
  getPendingUsers: () => ipcRenderer.invoke('get-pending-users'),
  approveUser: (username) => ipcRenderer.invoke('approve-user', username),
  denyUser: (username) => ipcRenderer.invoke('deny-user', username),
  
  // File operations
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  
  // Utility operations
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Events
  onFlaskStatus: (callback) => ipcRenderer.on('flask-status', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Handle window close
window.addEventListener('beforeunload', () => {
  ipcRenderer.removeAllListeners();
});
