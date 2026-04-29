// VIMTA Labs Machine Reading Automation System
class VimtaMachineReadingApp {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.labs = ['CL07'];
    this.machines = [
      {"lab_no": "CL07", "machine_id": "VLL/CEN/048", "group_code": "CEN", "machine_type": "centrifuge", "machine_name": "Thermo Scientific Sorvall ST 8R Centrifuge", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
      {"lab_no": "CL07", "machine_id": "VLL/CEN/047", "group_code": "CEN", "machine_type": "centrifuge", "machine_name": "Thermo Scientific Sorvall Legend Micro 21R", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
      {"lab_no": "CL07", "machine_id": "VLL/OSMO/001", "group_code": "OSMO", "machine_type": "osmometer", "machine_name": "Advanced Instruments OsmoTECH XT", "fields": ["temperature", "osmolality"], "units": {"temperature": "°C", "osmolality": "mOsm/kg"}},
      {"lab_no": "CL07", "machine_id": "VLL/UVS/006", "group_code": "UVS", "machine_type": "uv_spectrophotometer", "machine_name": "Shimadzu UV-1900i UV-VIS Spectrophotometer", "fields": ["wavelength", "absorbance"], "units": {"wavelength": "nm", "absorbance": "AU"}},
      {"lab_no": "CL07", "machine_id": "VLL/MIXR/023", "group_code": "MIXR", "machine_type": "thermomixer", "machine_name": "Eppendorf ThermoMixer C", "fields": ["temperature", "speed", "time_value"], "units": {"temperature": "°C", "speed": "RPM", "time_value": "min"}},
      {"lab_no": "CL07", "machine_id": "VLL/MAGS/012", "group_code": "MAGS", "machine_type": "magnetic_stirrer", "machine_name": "Wiggens WH-410D Magnetic Stirrer", "fields": ["speed", "temperature"], "units": {"speed": "RPM", "temperature": "°C"}},
      {"lab_no": "CL07", "machine_id": "VLL/SON/007", "group_code": "SON", "machine_type": "sonicator", "machine_name": "Elma Elmasonic P Ultrasonic Bath", "fields": ["frequency", "power", "time_value", "temperature"], "units": {"frequency": "kHz", "power": "W", "time_value": "min", "temperature": "°C"}},
      {"lab_no": "CL07", "machine_id": "VLL/WAB/017", "group_code": "WAB", "machine_type": "water_bath", "machine_name": "Labwit Water Bath", "fields": ["temperature", "time_value"], "units": {"temperature": "°C", "time_value": "min"}},
      {"lab_no": "CL07", "machine_id": "VLL/FMS/002", "group_code": "FMS", "machine_type": "headspace_analyzer", "machine_name": "Lighthouse FMS Carbon Dioxide Headspace Analyzer", "fields": ["co2_concentration", "temperature", "pressure"], "units": {"co2_concentration": "%", "temperature": "°C", "pressure": "psi"}}
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
        <!-- Background with screenshot -->
        <div class="absolute inset-0 bg-cover bg-center bg-no-repeat" style="background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjMDY0ZTNiIi8+CjxwYXRoIGQ9Ik0wIDU0MEM5NjAgMCAxOTIwIDU0MDE5MjAgMTA4MEM5NjAgMTA4MCAwIDU0MCAwIDU0MFoiIGZpbGw9IiMxMGI5ODEiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4K');">
          <div class="absolute inset-0 bg-gradient-to-br from-vimta-dark/90 via-vimta-green/80 to-vimta-dark/90"></div>
        </div>
        
        <!-- Content -->
        <div class="relative z-10 min-h-screen flex items-center justify-center">
          <div class="max-w-md w-full space-y-8 p-8">
            <div class="text-center">
              <!-- VIMTA Logo -->
              <div class="flex justify-center mb-6">
                <div class="bg-white rounded-lg shadow-2xl p-4">
                  <div class="w-16 h-16 bg-vimta-green rounded-lg flex items-center justify-center">
                    <span class="text-2xl font-bold text-white">V</span>
                  </div>
                </div>
              </div>
              <h2 class="mt-4 text-4xl font-bold text-white">VIMTA Labs</h2>
              <p class="mt-2 text-sm text-vimta-light">AI Machine Reading Automation</p>
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
              <div>
                <h1 class="text-2xl font-bold">VIMTA Labs - Admin Dashboard</h1>
                <p class="text-vimta-light text-sm">System Administration & Machine Management</p>
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
              <div>
                <h1 class="text-2xl font-bold">VIMTA Labs - User Dashboard</h1>
                <p class="text-vimta-light text-sm">AI Machine Reading Automation System</p>
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
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Image Upload</h3>
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <div id="imagePreview" class="hidden mb-4">
              <img id="previewImg" class="mx-auto h-32 w-auto rounded-lg shadow-md">
              <p class="text-sm text-gray-600 mt-2" id="imageName"></p>
            </div>
            
            <div id="uploadArea">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              <p class="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
              <p class="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
            
            <input type="file" id="imageInput" class="hidden" accept="image/*">
            <button id="uploadBtn" class="mt-4 bg-vimta-green text-white px-4 py-2 rounded-md hover:bg-vimta-dark transition-colors">
              Choose Image
            </button>
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
        option.value = lab;
        option.textContent = lab;
        labSelect.appendChild(option);
      });
    }
  }

  setupDashboardEventListeners() {
    // Add dashboard-specific event listeners
    const uploadBtn = document.getElementById('uploadBtn');
    const imageInput = document.getElementById('imageInput');
    const extractBtn = document.getElementById('extractBtn');
    const saveBtn = document.getElementById('saveBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    if (uploadBtn && imageInput) {
      uploadBtn.addEventListener('click', () => {
        imageInput.click();
      });
    }

    if (imageInput) {
      imageInput.addEventListener('change', (e) => {
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

  extractValues() {
    // Mock extraction - in real app, this would call OCR service
    const machineSelect = document.getElementById('machineSelect');
    const selectedMachineId = machineSelect.value;
    const machine = this.machines.find(m => m.machine_id === selectedMachineId);

    if (!machine) return;

    this.currentExtraction = {};
    machine.fields.forEach(field => {
      this.currentExtraction[field] = Math.random() * 100; // Mock values
    });

    this.showVerificationSection();
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
        <input type="text" id="field_${field}" class="w-full px-3 py-2 border border-gray-300 rounded-md" value="${value.toFixed(2)}">
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
    alert('Admin Panel functionality would open here with Add Lab and Add Machine features');
  }
}

// Initialize the app
const app = new VimtaMachineReadingApp();
