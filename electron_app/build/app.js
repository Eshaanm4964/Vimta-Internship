// VIMTA Labs Machine Reading Automation System
class VimtaMachineReadingApp {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.labs = [
      { code: 'CL07', name: 'Chemical Laboratory' }
    ];
    this.machines = [
      {"lab_no": "CL07", "machine_id": "VLL/CEN/048", "group_code": "CEN", "machine_type": "centrifuge", "machine_name": "Thermo Scientific Sorvall ST 8R Centrifuge", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
      {"lab_no": "CL07", "machine_id": "VLL/CEN/047", "group_code": "CEN", "machine_type": "centrifuge", "machine_name": "Thermo Scientific Sorvall Legend Micro 21R", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
      {"lab_no": "CL07", "machine_id": "VLL/OSMO/001", "group_code": "OSMO", "machine_type": "osmometer", "machine_name": "Advanced Instruments OsmoTECH XT", "fields": ["osmolarity"], "units": {"osmolarity": "mOsm/kg"}},
      {"lab_no": "CL07", "machine_id": "VLL/UVS/006", "group_code": "UVS", "machine_type": "uv_spectrophotometer", "machine_name": "Shimadzu UV-1900i UV-VIS Spectrophotometer", "fields": ["absorbance", "wavelength"], "units": {"absorbance": "Abs", "wavelength": "nm"}},
      {"lab_no": "CL07", "machine_id": "VLL/MIXR/023", "group_code": "MIXR", "machine_type": "thermomixer", "machine_name": "Eppendorf ThermoMixer C", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
      {"lab_no": "CL07", "machine_id": "VLL/MAGS/012", "group_code": "MAGS", "machine_type": "magnetic_stirrer", "machine_name": "Wiggens WH-410D Magnetic Stirrer", "fields": ["speed"], "units": {"speed": "RPM"}},
      {"lab_no": "CL07", "machine_id": "VLL/SON/007", "group_code": "S", "machine_type": "sonicator", "machine_name": "Elma Elmasonic P Ultrasonic Bath", "fields": ["temperature", "time_value", "frequency", "power"], "units": {"temperature": "°C", "time_value": "min", "frequency": "kHz", "power": "%"}},
      {"lab_no": "CL07", "machine_id": "VLL/WAB/017", "group_code": "WAB", "machine_type": "water_bath", "machine_name": "Labwit Water Bath", "fields": ["temperature"], "units": {"temperature": "°C"}},
      {"lab_no": "CL07", "machine_id": "VLL/FMS/002", "group_code": "FMS", "machine_type": "headspace_analyzer", "machine_name": "Lighthouse FMS Carbon Dioxide Headspace Analyzer", "fields": ["co2", "pressure"], "units": {"co2": "%", "pressure": "bar"}}
    ];
    this.users = {
      'admin_dev': { password: 'admin123', role: 'admin', name: 'System Administrator' },
      'EMP001': { password: 'user123', role: 'user', name: 'John Doe' },
      'EMP002': { password: 'user123', role: 'user', name: 'Jane Smith' }
    };
    this.readings = [];
    this.selectedImage = null;
    this.currentExtraction = null;
    
    this.init();
  }

  init() {
    this.renderLoginScreen();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Login events
    document.addEventListener('click', (e) => {
      if (e.target.id === 'adminLoginBtn') {
        this.setLoginType('admin');
      }
      if (e.target.id === 'userLoginBtn') {
        this.setLoginType('user');
      }
      if (e.target.id === 'loginBtn') {
        this.handleLogin();
      }
      if (e.target.id === 'logoutBtn') {
        this.handleLogout();
      }
      if (e.target.id === 'adminPanelBtn') {
        this.showAdminPanel();
      }
    });

    // Lab and machine selection
    document.addEventListener('change', (e) => {
      if (e.target.id === 'labSelect') {
        this.loadMachines(e.target.value);
        this.loadReadings();
      }
      if (e.target.id === 'machineSelect') {
        this.updateMachineDetails(e.target.value);
      }
    });

    // Form validation
    document.addEventListener('input', (e) => {
      if (e.target.id === 'imageInput') {
        this.handleImageSelect(e.target.files[0]);
      }
    });
  }

  renderLoginScreen() {
    document.getElementById('root').innerHTML = `
      <div class="min-h-screen relative overflow-hidden">
        <!-- Background with image -->
        <div class="absolute inset-0 bg-cover bg-center bg-no-repeat" style="background-image: url('background.png');">
          <div class="absolute inset-0 bg-gradient-to-br from-vimta-dark/70 via-vimta-green/60 to-vimta-dark/70"></div>
        </div>
        
        <!-- Content -->
        <div class="relative z-10 min-h-screen flex items-center justify-center">
          <div class="max-w-md w-full space-y-8 p-8">
            <div class="text-center">
              <!-- Company Logo -->
              <div class="flex justify-center mb-8">
                <img src="vimta_logo.png" alt="VIMTA Labs Logo" class="w-48 h-48 object-contain">
              </div>
            </div>
            
            <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
              <h3 class="text-2xl font-semibold text-gray-900 text-center mb-6">Sign In</h3>
              
              <div class="space-y-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Login Type</label>
                  <div class="grid grid-cols-2 gap-4">
                    <button id="adminLoginBtn" class="px-4 py-2 border-2 border-vimta-green text-vimta-green rounded-lg hover:bg-vimta-green hover:text-white transition-colors font-medium">
                      Admin Login
                    </button>
                    <button id="userLoginBtn" class="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                      User Login
                    </button>
                  </div>
                </div>
                
                <div id="loginForm">
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">
                        <span id="usernameLabel">Employee ID</span>
                      </label>
                      <input type="text" id="username" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green focus:border-transparent" placeholder="Enter credentials">
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input type="password" id="password" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green focus:border-transparent" placeholder="Enter password">
                    </div>
                    
                    <button id="loginBtn" class="w-full bg-vimta-green text-white py-3 rounded-md hover:bg-vimta-dark transition-colors font-medium">
                      Sign In
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="mt-6 text-center">
                <p class="text-xs text-gray-500">
                  Test Accounts:<br>
                  Admin: admin_dev / admin123<br>
                  User: EMP001 / user123
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add login type selection handlers
    document.getElementById('adminLoginBtn').addEventListener('click', () => {
      this.setLoginType('admin');
    });
    
    document.getElementById('userLoginBtn').addEventListener('click', () => {
      this.setLoginType('user');
    });
    
    // Initialize with user login
    this.setLoginType('user');
  }

  setLoginType(type) {
    const adminBtn = document.getElementById('adminLoginBtn');
    const userBtn = document.getElementById('userLoginBtn');
    const usernameLabel = document.getElementById('usernameLabel');
    const usernameInput = document.getElementById('username');
    
    if (type === 'admin') {
      adminBtn.className = 'px-4 py-2 border-2 border-vimta-green text-vimta-green rounded-lg hover:bg-vimta-green hover:text-white transition-colors font-medium';
      userBtn.className = 'px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium';
      usernameLabel.textContent = 'Admin ID';
      usernameInput.placeholder = 'Enter admin credentials';
    } else {
      userBtn.className = 'px-4 py-2 border-2 border-vimta-green text-vimta-green rounded-lg hover:bg-vimta-green hover:text-white transition-colors font-medium';
      adminBtn.className = 'px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium';
      usernameLabel.textContent = 'Employee ID';
      usernameInput.placeholder = 'Enter employee ID';
    }
  }

  showLoginMessage(message, type) {
    // Create or update message element on login screen
    let messageDiv = document.getElementById('loginMessage');
    if (!messageDiv) {
      messageDiv = document.createElement('div');
      messageDiv.id = 'loginMessage';
      messageDiv.className = 'mt-4 text-sm text-center';
      
      // Insert after the login form
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.parentNode.insertBefore(messageDiv, loginForm.nextSibling);
      }
    }
    
    const colorClasses = {
      success: 'text-green-600',
      error: 'text-red-600',
      info: 'text-blue-600'
    };
    
    messageDiv.className = `mt-4 text-sm text-center ${colorClasses[type] || 'text-gray-600'}`;
    messageDiv.textContent = message;
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (messageDiv) {
          messageDiv.textContent = '';
        }
      }, 3000);
    }
  }

  handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
      this.showLoginMessage('Please enter both username and password', 'error');
      return;
    }
    
    const user = this.users[username];
    
    if (!user || user.password !== password) {
      this.showLoginMessage('Invalid credentials. Please try again.', 'error');
      return;
    }
    
    // Successful login
    this.currentUser = { ...user, username };
    this.isAdmin = user.role === 'admin';
    
    this.showLoginMessage(`Welcome, ${user.name}!`, 'success');
    
    // Load appropriate dashboard
    setTimeout(() => {
      if (this.isAdmin) {
        this.renderAdminDashboard();
      } else {
        this.renderUserDashboard();
      }
      this.loadInitialData();
    }, 1000);
  }

  handleLogout() {
    this.currentUser = null;
    this.isAdmin = false;
    this.renderLoginScreen();
  }

  renderAdminDashboard() {
    document.getElementById('root').innerHTML = `
      <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-vimta-green text-white shadow-lg">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center py-4">
              <div class="flex items-center space-x-4">
                <!-- Company Logo -->
                <img src="vimta_logo.png" alt="VIMTA Labs Logo" class="w-20 h-20 object-contain">
                <div>
                  <h1 class="text-2xl font-bold">Admin Dashboard</h1>
                  <p class="text-vimta-light text-sm">Excellence in Testing and Certification</p>
                </div>
              </div>
              <div class="flex items-center space-x-4">
                <button id="adminPanelBtn" class="bg-white text-vimta-green px-4 py-2 rounded-md hover:bg-gray-100 transition-colors font-medium">
                  ⚙️ Admin Panel
                </button>
                <div class="flex items-center">
                  <div class="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
                  <span class="text-sm mr-4">Ready</span>
                  <div class="flex items-center space-x-2">
                    <span class="text-sm">${this.currentUser.name}</span>
                    <span class="text-xs text-vimta-light">(admin)</span>
                    <button id="logoutBtn" class="text-white hover:text-vimta-light text-sm">
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Admin Dashboard Content -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <!-- Admin Overview Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow-md p-6">
              <div class="flex items-center">
                <div class="p-3 bg-vimta-green rounded-lg">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-semibold text-gray-900">Total Labs</h3>
                  <p class="text-2xl font-bold text-vimta-green">${this.labs.length}</p>
                </div>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <div class="flex items-center">
                <div class="p-3 bg-vimta-green rounded-lg">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-semibold text-gray-900">Total Machines</h3>
                  <p class="text-2xl font-bold text-vimta-green">${this.machines.length}</p>
                </div>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <div class="flex items-center">
                <div class="p-3 bg-vimta-green rounded-lg">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-semibold text-gray-900">Total Users</h3>
                  <p class="text-2xl font-bold text-vimta-green">${Object.keys(this.users).length}</p>
                </div>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <div class="flex items-center">
                <div class="p-3 bg-vimta-green rounded-lg">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-semibold text-gray-900">Total Readings</h3>
                  <p class="text-2xl font-bold text-vimta-green">${this.readings.length}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Machine Reading Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-6">Machine Reading Operations</h2>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              ${this.renderMachineReadingSection()}
              ${this.renderSavedReadingsSection()}
            </div>
          </div>
        </main>
      </div>
    `;
  }

  renderUserDashboard() {
    document.getElementById('root').innerHTML = `
      <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-vimta-green text-white shadow-lg">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center py-4">
              <div class="flex items-center space-x-4">
                <!-- Company Logo -->
                <img src="vimta_logo.png" alt="VIMTA Labs Logo" class="w-20 h-20 object-contain">
                <div>
                  <h1 class="text-2xl font-bold">User Dashboard</h1>
                  <p class="text-vimta-light text-sm">Excellence in Testing and Certification</p>
                </div>
              </div>
              <div class="flex items-center">
                <div class="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
                <span class="text-sm mr-4">Ready</span>
                <div class="flex items-center space-x-2">
                  <span class="text-sm">${this.currentUser.name}</span>
                  <span class="text-xs text-vimta-light">(user)</span>
                  <button id="logoutBtn" class="text-white hover:text-vimta-light text-sm">
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- User Dashboard Content -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <!-- User Welcome Section -->
          <div class="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Welcome, ${this.currentUser.name}!</h2>
            <p class="text-gray-600">Access the machine reading system to perform OCR operations and manage your readings.</p>
          </div>

          <!-- Machine Reading Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-6">Machine Reading Operations</h2>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              ${this.renderMachineReadingSection()}
              ${this.renderSavedReadingsSection()}
            </div>
          </div>
        </main>
      </div>
    `;
  }

  renderMachineReadingSection() {
    return `
      <!-- Machine Selection & Image Upload -->
      <div class="space-y-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Machine Selection</h3>
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Laboratory</label>
              <select id="labSelect" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green">
                <option value="">Select Laboratory</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Machine</label>
              <select id="machineSelect" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green" disabled>
                <option value="">Select Machine</option>
              </select>
            </div>
          </div>
          
          <div id="machineDetails" class="hidden bg-gray-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600" id="detailsText"></p>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Image Capture</h3>
          
          <!-- Photography Guidelines -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-blue-800">Photography Guidelines</h3>
                <div class="mt-2 text-sm text-blue-700">
                  <ul class="list-disc list-inside space-y-1">
                    <li>Hold camera directly in front of machine display</li>
                    <li>Ensure good lighting - avoid glare and shadows</li>
                    <li>Keep display area focused and clear</li>
                    <li>Avoid blurry images - hold camera steady</li>
                    <li>Capture entire display with all visible values</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <div id="imagePreview" class="hidden mb-4">
              <img id="previewImg" class="mx-auto h-32 w-auto rounded-lg shadow-md">
              <p class="text-sm text-gray-600 mt-2" id="imageName"></p>
            </div>
            
            <div id="uploadArea">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              <p class="mt-2 text-sm text-gray-600">Choose capture method</p>
              <p class="text-xs text-gray-500">PNG, JPG up to 10MB</p>
            </div>
            
            <input type="file" id="imageInput" class="hidden" accept="image/*">
            <input type="file" id="cameraInput" class="hidden" accept="image/*" capture="environment">
            
            <div class="flex space-x-3 mt-4">
              <button id="uploadBtn" class="flex-1 bg-vimta-green text-white px-4 py-2 rounded-md hover:bg-vimta-dark transition-colors flex items-center justify-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                Upload Image
              </button>
              <button id="cameraBtn" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                Take Photo
              </button>
            </div>
          </div>
          
          <div id="qualityWarning" class="mt-4"></div>
        </div>

        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Extraction</h3>
          <button id="extractBtn" class="w-full bg-vimta-green text-white py-3 rounded-md hover:bg-vimta-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed" disabled>
            Extract Values
          </button>
        </div>

        <div id="verificationSection" class="hidden">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Verification</h3>
          <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4" id="verificationFields">
              <!-- Dynamic fields will be added here -->
            </div>
            <button id="saveBtn" class="w-full bg-vimta-green text-white py-3 rounded-md hover:bg-vimta-dark transition-colors font-medium">
              Save Reading
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderSavedReadingsSection() {
    return `
      <!-- Saved Readings -->
      <div>
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Saved Readings</h3>
          <button id="refreshBtn" class="text-vimta-green hover:text-vimta-dark">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Values</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody id="readingsTable" class="bg-white divide-y divide-gray-200">
              <tr>
                <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">No readings found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Additional methods for functionality
  loadInitialData() {
    this.populateLabSelect();
    this.setupDashboardEventListeners();
  }

  populateLabSelect() {
    const labSelect = document.getElementById('labSelect');
    if (labSelect) {
      this.labs.forEach(lab => {
        const option = document.createElement('option');
        option.value = lab.code;
        option.textContent = `${lab.code} - ${lab.name}`;
        labSelect.appendChild(option);
      });
    }
  }

  setupDashboardEventListeners() {
    // Add dashboard-specific event listeners
    const uploadBtn = document.getElementById('uploadBtn');
    const imageInput = document.getElementById('imageInput');
    const cameraBtn = document.getElementById('cameraBtn');
    const cameraInput = document.getElementById('cameraInput');
    const extractBtn = document.getElementById('extractBtn');
    const saveBtn = document.getElementById('saveBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    if (uploadBtn && imageInput) {
      uploadBtn.addEventListener('click', () => {
        imageInput.click();
      });
    }

    if (cameraBtn && cameraInput) {
      cameraBtn.addEventListener('click', () => {
        cameraInput.click();
      });
    }

    if (imageInput) {
      imageInput.addEventListener('change', (e) => {
        this.handleImageSelect(e.target.files[0]);
      });
    }

    if (cameraInput) {
      cameraInput.addEventListener('change', (e) => {
        this.handleImageSelect(e.target.files[0]);
      });
    }

    if (extractBtn) {
      extractBtn.addEventListener('click', () => {
        this.extractValues();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveReading();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadReadings();
      });
    }
  }

  loadMachines(labNo) {
    const machineSelect = document.getElementById('machineSelect');
    if (!machineSelect) return;

    machineSelect.innerHTML = '<option value="">Select Machine</option>';
    machineSelect.disabled = !labNo;

    if (labNo) {
      const labMachines = this.machines.filter(m => m.lab_no === labNo);
      labMachines.forEach(machine => {
        const option = document.createElement('option');
        option.value = machine.machine_id;
        option.textContent = `${machine.machine_id} - ${machine.machine_name}`;
        machineSelect.appendChild(option);
      });
    }
  }

  updateMachineDetails(machineId) {
    const detailsDiv = document.getElementById('machineDetails');
    const detailsText = document.getElementById('detailsText');
    
    if (!machineId) {
      detailsDiv.classList.add('hidden');
      return;
    }

    const machine = this.machines.find(m => m.machine_id === machineId);
    if (machine) {
      detailsText.innerHTML = `
        <strong>Machine Type:</strong> ${machine.machine_type}<br>
        <strong>Group Code:</strong> ${machine.group_code}<br>
        <strong>Fields:</strong> ${machine.fields.join(', ')}<br>
        <strong>Units:</strong> ${JSON.stringify(machine.units)}
      `;
      detailsDiv.classList.remove('hidden');
    }
  }

  handleImageSelect(file) {
    if (!file) return;

    this.selectedImage = file;
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const imageName = document.getElementById('imageName');
    const extractBtn = document.getElementById('extractBtn');

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      imageName.textContent = file.name;
      preview.classList.remove('hidden');
      extractBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  async saveImageTemp(imageFile) {
    // For desktop app, we'll use the file path directly
    // In a real implementation, you might want to save to a temp directory
    return imageFile.path || imageFile.name;
  }

  async extractValues() {
    if (!this.selectedImage) {
      this.showNotification('Please upload an image first', 'error');
      return;
    }

    const machineSelect = document.getElementById('machineSelect');
    const selectedMachineId = machineSelect.value;
    const machine = this.machines.find(m => m.machine_id === selectedMachineId);

    if (!machine) {
      this.showNotification('Please select a machine', 'error');
      return;
    }

    // Disable extract button and show loading
    const extractBtn = document.getElementById('extractBtn');
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';

    try {
      // Create a temporary file for the image
      const tempImagePath = await this.saveImageTemp(this.selectedImage);
      
      const result = await window.electronAPI.extractValues(machine.lab_no, selectedMachineId, tempImagePath);
      
      if (result.success) {
        this.currentExtraction = result.values;
        this.showVerificationSection();
        this.showNotification('Values extracted successfully', 'success');
      } else {
        throw new Error(result.error || 'Extraction failed');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      this.showNotification('OCR extraction failed: ' + error.message, 'error');
      
      // No fallback - show error to user
      this.currentExtraction = {};
      this.showVerificationSection();
    } finally {
      // Re-enable extract button
      extractBtn.disabled = false;
      extractBtn.textContent = 'Extract Values';
    }
  }

  getMockValue(field) {
    // Generate realistic mock values based on field type
    switch(field) {
      case 'speed':
        return Math.floor(Math.random() * 10000) + 10000; // 10000-20000 RPM
      case 'temperature':
        return Math.floor(Math.random() * 40) - 10; // -10 to 30°C
      case 'time_value':
        const hours = Math.floor(Math.random() * 2) + 19; // 19-20
        const minutes = Math.floor(Math.random() * 60); // 0-59
        return `${hours}:${minutes.toString().padStart(2, '0')}`;
      case 'wavelength':
        return Math.floor(Math.random() * 200) + 200; // 200-400 nm
      case 'absorbance':
        return (Math.random() * 2).toFixed(3); // 0-2.000
      case 'osmolarity':
        return Math.floor(Math.random() * 200) + 200; // 200-400 mOsm/kg
      case 'frequency':
        return Math.floor(Math.random() * 40) + 20; // 20-60 kHz
      case 'power':
        return Math.floor(Math.random() * 80) + 20; // 20-100%
      case 'co2':
        return (Math.random() * 10 + 3).toFixed(1); // 3-13%
      case 'pressure':
        return (Math.random() * 2 + 1).toFixed(1); // 1-3 bar
      default:
        return (Math.random() * 100).toFixed(2);
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 flex items-center space-x-3 ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    
    // Add icon based on type
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    
    notification.innerHTML = `
      <span class="text-xl font-bold">${icon}</span>
      <span class="font-medium">${message}</span>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  showVerificationSection() {
    const verificationSection = document.getElementById('verificationSection');
    const verificationFields = document.getElementById('verificationFields');
    
    if (!this.currentExtraction) return;

    verificationFields.innerHTML = '';
    Object.entries(this.currentExtraction).forEach(([field, value]) => {
      const div = document.createElement('div');
      div.innerHTML = `
        <label class="block text-sm font-medium text-gray-700 mb-1">${field}</label>
        <input type="text" id="field_${field}" class="w-full px-3 py-2 border border-gray-300 rounded-md" value="${typeof value === 'number' ? value.toFixed(2) : value}">
      `;
      verificationFields.appendChild(div);
    });

    verificationSection.classList.remove('hidden');
  }

  saveReading() {
    const reading = {
      id: Date.now(),
      date: new Date().toISOString(),
      machineId: document.getElementById('machineSelect').value,
      values: this.currentExtraction,
      user: this.currentUser.username,
      status: 'completed'
    };

    this.readings.push(reading);
    this.loadReadings();
    this.resetForm();
    this.showMessage('Reading saved successfully!', 'success');
  }

  loadReadings() {
    const readingsTable = document.getElementById('readingsTable');
    if (!readingsTable) return;

    if (this.readings.length === 0) {
      readingsTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">No readings found</td></tr>';
      return;
    }

    readingsTable.innerHTML = this.readings.map(reading => `
      <tr>
        <td class="px-6 py-4 text-sm text-gray-900">${new Date(reading.date).toLocaleDateString()}</td>
        <td class="px-6 py-4 text-sm text-gray-900">${reading.machineId}</td>
        <td class="px-6 py-4 text-sm text-gray-900">${JSON.stringify(reading.values)}</td>
        <td class="px-6 py-4 text-sm text-green-600">${reading.status}</td>
      </tr>
    `).join('');
  }

  resetForm() {
    this.currentExtraction = null;
    this.selectedImage = null;
    
    // Clear form
    const sampleId = document.getElementById('sampleId');
    if (sampleId) sampleId.value = '';
    
    // Clear image
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) imagePreview.classList.add('hidden');
    
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) uploadBtn.disabled = false;
    
    const extractBtn = document.getElementById('extractBtn');
    if (extractBtn) extractBtn.disabled = true;
    
    // Hide verification section
    const verificationSection = document.getElementById('verificationSection');
    if (verificationSection) verificationSection.classList.add('hidden');
    
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.disabled = true;
    
    // Clear quality warning
    const qualityWarning = document.getElementById('qualityWarning');
    if (qualityWarning) qualityWarning.innerHTML = '';
  }

  showMessage(message, type) {
    // Simple message display - can be enhanced
    console.log(`${type}: ${message}`);
  }

  showAdminPanel() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-bold text-gray-900">Admin Panel</h3>
          <button id="closeModalBtn" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="space-y-6">
          <div class="border rounded-lg p-4">
            <h4 class="text-lg font-semibold mb-4">Laboratory Management</h4>
            <div class="mb-4">
              <p class="text-sm text-gray-600 mb-2">Current Labs:</p>
              <div class="space-y-2">
                ${this.labs.map(lab => `
                  <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span class="text-sm font-medium">${lab.code} - ${lab.name}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            <button id="addLabBtn" class="bg-vimta-green text-white px-4 py-2 rounded-md hover:bg-vimta-dark transition-colors">
              + Add New Laboratory
            </button>
          </div>
          
          <div class="border rounded-lg p-4">
            <h4 class="text-lg font-semibold mb-4">Machine Management</h4>
            <div class="mb-4">
              <p class="text-sm text-gray-600 mb-2">Total Machines: ${this.machines.length}</p>
              <div class="max-h-32 overflow-y-auto space-y-1">
                ${this.machines.slice(0, 5).map(machine => `
                  <div class="text-xs text-gray-600 p-1">${machine.machine_id} - ${machine.machine_name}</div>
                `).join('')}
                ${this.machines.length > 5 ? `<div class="text-xs text-gray-500">... and ${this.machines.length - 5} more</div>` : ''}
              </div>
            </div>
            <button id="addMachineBtn" class="bg-vimta-green text-white px-4 py-2 rounded-md hover:bg-vimta-dark transition-colors">
              + Add New Machine
            </button>
          </div>
          
          <div class="border rounded-lg p-4">
            <h4 class="text-lg font-semibold mb-4">User Management</h4>
            <div class="space-y-2">
              ${Object.entries(this.users).map(([username, user]) => `
                <div class="flex justify-between items-center text-sm">
                  <span>${username} - ${user.name} (${user.role})</span>
                  <span class="text-gray-500">${user.role === 'admin' ? '🔧' : '👤'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners for the modal
    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.closeModal();
    });
    
    document.getElementById('addLabBtn').addEventListener('click', () => {
      this.showAddLabModal();
    });
    
    document.getElementById('addMachineBtn').addEventListener('click', () => {
      this.showAddMachineModal();
    });
  }

  showAddLabModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-900">Add New Laboratory</h3>
          <button id="closeModalBtn" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Lab Code *</label>
            <input type="text" id="labCode" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green" placeholder="e.g., CL08">
            <p class="text-xs text-gray-500 mt-1">Use format: CL##, LAB##, etc.</p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Lab Name *</label>
            <input type="text" id="labName" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green" placeholder="e.g., Microbiology Laboratory">
            <p class="text-xs text-gray-500 mt-1">Descriptive name for the laboratory</p>
          </div>
          
          <div class="flex space-x-4">
            <button id="saveLabBtn" class="flex-1 bg-vimta-green text-white py-2 rounded-md hover:bg-vimta-dark transition-colors">
              Save Lab
            </button>
            <button id="closeModalBtn" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.querySelectorAll('#closeModalBtn').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
    
    document.getElementById('saveLabBtn').addEventListener('click', () => {
      this.saveNewLab();
    });
  }

  showAddMachineModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-900">Add New Machine</h3>
          <button id="closeModalBtn" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Lab *</label>
              <select id="machineLabNo" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green">
                <option value="">Select Lab</option>
                ${this.labs.map(lab => `<option value="${lab.code}">${lab.code} - ${lab.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Machine ID *</label>
              <input type="text" id="machineId" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green" placeholder="e.g., VLL/CEN/049">
              <p class="text-xs text-gray-500 mt-1">Unique identifier for the machine</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Group Code *</label>
              <input type="text" id="groupCode" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green" placeholder="e.g., CEN">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Machine Type *</label>
              <select id="machineType" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green">
                <option value="">Select Type</option>
                <option value="centrifuge">Centrifuge</option>
                <option value="osmometer">Osmometer</option>
                <option value="uv_spectrophotometer">UV Spectrophotometer</option>
                <option value="thermomixer">Thermomixer</option>
                <option value="magnetic_stirrer">Magnetic Stirrer</option>
                <option value="sonicator">Sonicator</option>
                <option value="water_bath">Water Bath</option>
                <option value="headspace_analyzer">Headspace Analyzer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Machine Name *</label>
              <input type="text" id="machineName" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vimta-green" placeholder="e.g., Thermo Scientific Centrifuge">
            </div>
          </div>
          
          <div class="border-t pt-4">
            <h4 class="text-md font-semibold mb-3">Machine Parameters</h4>
            <p class="text-sm text-gray-600 mb-3">Define the parameters this machine outputs (these will be used for OCR extraction)</p>
            
            <div id="parametersContainer" class="space-y-3">
              <div class="parameter-entry space-y-2 p-3 border rounded-lg bg-gray-50">
                <div class="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="Parameter name (e.g., speed)" class="param-name w-full px-2 py-1 border rounded text-sm">
                  <input type="text" placeholder="Unit (e.g., RPM)" class="param-unit w-full px-2 py-1 border rounded text-sm">
                  <button type="button" class="remove-param bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600">Remove</button>
                </div>
              </div>
            </div>
            
            <button type="button" id="addParameterBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
              + Add Parameter
            </button>
          </div>
          
          <div class="flex space-x-4">
            <button id="saveMachineBtn" class="flex-1 bg-vimta-green text-white py-2 rounded-md hover:bg-vimta-dark transition-colors">
              Save Machine
            </button>
            <button id="closeModalBtn" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.querySelectorAll('#closeModalBtn').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
    
    document.getElementById('saveMachineBtn').addEventListener('click', () => {
      this.saveNewMachine();
    });
    
    document.getElementById('addParameterBtn').addEventListener('click', () => {
      this.addParameterField();
    });
    
    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-param').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.parameter-entry').remove();
      });
    });
  }

  addParameterField() {
    const container = document.getElementById('parametersContainer');
    const newParam = document.createElement('div');
    newParam.className = 'parameter-entry space-y-2 p-3 border rounded-lg bg-gray-50';
    newParam.innerHTML = `
      <div class="grid grid-cols-3 gap-2">
        <input type="text" placeholder="Parameter name (e.g., temperature)" class="param-name w-full px-2 py-1 border rounded text-sm">
        <input type="text" placeholder="Unit (e.g., °C)" class="param-unit w-full px-2 py-1 border rounded text-sm">
        <button type="button" class="remove-param bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600">Remove</button>
      </div>
    `;
    container.appendChild(newParam);
    
    // Add event listener for the new remove button
    newParam.querySelector('.remove-param').addEventListener('click', (e) => {
      e.target.closest('.parameter-entry').remove();
    });
  }

  closeModal() {
    const modals = document.querySelectorAll('.fixed.inset-0');
    modals.forEach(modal => modal.remove());
  }

  saveNewLab() {
    const labCode = document.getElementById('labCode').value.trim();
    const labName = document.getElementById('labName').value.trim();
    
    if (!labCode || !labName) {
      alert('Both lab code and lab name are required');
      return;
    }
    
    // Check if lab code already exists
    if (this.labs.some(lab => lab.code === labCode)) {
      alert('Lab with this code already exists');
      return;
    }
    
    // Add new lab
    this.labs.push({ code: labCode, name: labName });
    
    // Update lab select dropdown
    this.populateLabSelect();
    
    this.closeModal();
    alert(`Lab "${labCode} - ${labName}" added successfully!`);
  }

  saveNewMachine() {
    const labNo = document.getElementById('machineLabNo').value;
    const machineId = document.getElementById('machineId').value.trim();
    const groupCode = document.getElementById('groupCode').value.trim();
    const machineType = document.getElementById('machineType').value;
    const machineName = document.getElementById('machineName').value.trim();
    
    if (!labNo || !machineId || !groupCode || !machineType || !machineName) {
      alert('All required fields must be filled');
      return;
    }
    
    // Collect parameters
    const parameterEntries = document.querySelectorAll('.parameter-entry');
    const fields = [];
    const units = {};
    
    parameterEntries.forEach(entry => {
      const paramName = entry.querySelector('.param-name').value.trim();
      const paramUnit = entry.querySelector('.param-unit').value.trim();
      
      if (paramName && paramUnit) {
        fields.push(paramName);
        units[paramName] = paramUnit;
      }
    });
    
    if (fields.length === 0) {
      alert('At least one parameter must be defined');
      return;
    }
    
    // Check if machine ID already exists
    if (this.machines.some(machine => machine.machine_id === machineId)) {
      alert('Machine with this ID already exists');
      return;
    }
    
    // Add new machine
    const newMachine = {
      lab_no: labNo,
      machine_id: machineId,
      group_code: groupCode,
      machine_type: machineType,
      machine_name: machineName,
      fields: fields,
      units: units
    };
    
    this.machines.push(newMachine);
    this.loadMachines(labNo);
    this.closeModal();
    alert(`Machine "${machineId}" added successfully with ${fields.length} parameters!`);
  }
}

// Initialize the app
const app = new VimtaMachineReadingApp();
