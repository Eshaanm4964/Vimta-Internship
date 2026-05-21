/* ══════════════════════════════════════════════
   Vimta Labs LIMS — Full SPA Script
══════════════════════════════════════════════ */

let currentExtraction = null;
let machines = [];
let selectedFile = null;
let currentUser = null;   // { username, full_name, role }
let loginRole = 'admin';

const $ = id => document.getElementById(id);

/* ── helpers ── */
function valueOrEmpty(v) { return v === null || v === undefined ? "" : v; }
function numberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ════════════════════════════
   STATUS / TOAST
════════════════════════════ */
function setMessage(text, isError = false) {
  const el = $("message");
  if (!el) return;
  el.textContent = text;
  el.className = "status-msg";
  if (!text) return;
  if (isError) el.classList.add("is-error");
  else if (text.startsWith("✅") || text.startsWith("✓") || text === "Readings refreshed.") el.classList.add("is-success");
  else el.classList.add("is-info");
}

let _toastTimer;
function showToast(msg, type = "info") {
  $("toastMsg").textContent = msg;
  const bar = $("toastBar");
  bar.style.background = type === "success" ? "#10b981" : type === "error" ? "#dc2626" : "#3b82f6";
  $("toast").classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3200);
}

/* ════════════════════════════
   VIEW ROUTER
════════════════════════════ */
const viewTitles = { dashboard: "Dashboard", capture: "Capture Reading", readings: "Confirmed Readings", users: "Manage Users", lims: "LIMS Integration" };

function showView(name) {
  ["dashboard", "capture", "readings", "users", "lims"].forEach(v => {
    const view = $("view" + v.charAt(0).toUpperCase() + v.slice(1));
    if (view) view.classList.add("hidden");
    const btn = $("nav" + v.charAt(0).toUpperCase() + v.slice(1));
    if (btn) btn.classList.remove("active");
  });

  const active = $("view" + name.charAt(0).toUpperCase() + name.slice(1));
  if (active) active.classList.remove("hidden");
  const btn = $("nav" + name.charAt(0).toUpperCase() + name.slice(1));
  if (btn) btn.classList.add("active");

  $("topbarTitle").textContent = viewTitles[name] || name;

  if (name === "readings")  loadReadings();
  if (name === "users")     { loadUsersData(); loadPendingUsers(); }
  if (name === "dashboard") loadStats();
  if (name === "lims")      { loadLimsConfig(); loadLimsLog(); }
}

/* ════════════════════════════
   LOGIN / AUTH
════════════════════════════ */
function setLoginRole(role) {
  loginRole = role;
  $("adminLoginBtn").classList.toggle("active", role === "admin");
  $("userLoginBtn").classList.toggle("active",  role === "user");
}

async function doLogin() {
  const username = $("username").value.trim();
  const password = $("password").value;
  const errEl = $("loginError");
  errEl.style.display = "none";

  if (!username || !password) {
    errEl.textContent = "Please enter your User ID and password.";
    errEl.style.display = "block";
    return;
  }

  const btn = $("loginBtn");
  btn.disabled = true;
  btn.textContent = "Signing in…";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || "Invalid credentials.";
      errEl.style.display = "block";
      return;
    }

    currentUser = data.user;
    sessionStorage.setItem("lims_user", JSON.stringify(currentUser));
    onLoginSuccess();

  } catch {
    errEl.textContent = "Connection error. Is the server running?";
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

function onLoginSuccess() {
  $("loginPage").classList.add("hidden");
  $("appShell").classList.remove("hidden");

  $("userNameDisplay").textContent = currentUser.full_name || currentUser.username;
  $("userRoleDisplay").textContent = currentUser.role;
  $("userInitials").textContent = (currentUser.full_name || currentUser.username)
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const isAdmin = currentUser.role === "admin";
  $("adminNav").classList.toggle("hidden", !isAdmin);
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !isAdmin));

  loadLabs();
  showView("dashboard");
  if (isAdmin) checkPendingCount();
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem("lims_user");
  $("appShell").classList.add("hidden");
  $("loginPage").classList.remove("hidden");
  $("username").value = "";
  $("password").value = "";
  $("loginError").style.display = "none";
}

/* ════════════════════════════
   SIGNUP
════════════════════════════ */
async function doSignup() {
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const userId = $("signupUserId").value.trim();
  const role = $("signupRole").value;
  const password = $("signupPassword").value;
  const confirm = $("signupConfirmPassword").value;
  const errEl = $("signupError");
  errEl.style.display = "none";

  if (!name || !email || !userId || !password) {
    errEl.textContent = "All fields are required.";
    errEl.style.display = "block"; return;
  }
  if (password !== confirm) {
    errEl.textContent = "Passwords do not match.";
    errEl.style.display = "block"; return;
  }
  if (password.length < 6) {
    errEl.textContent = "Password must be at least 6 characters.";
    errEl.style.display = "block"; return;
  }

  const btn = $("signupBtn");
  btn.disabled = true;
  try {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, user_id: userId, password, role })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || "Signup failed."; errEl.style.display = "block"; return; }
    closeModal();
    showToast("Account request submitted — await admin approval.", "success");
    // clear fields
    ["signupName","signupEmail","signupUserId","signupPassword","signupConfirmPassword"].forEach(id => $(id).value = "");
  } catch {
    errEl.textContent = "Connection error.";
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
  }
}

/* ════════════════════════════
   STATS
════════════════════════════ */
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const d = await res.json();
    $("statReadings").textContent = d.total_readings ?? "—";
    $("statUsers").textContent    = d.total_users    ?? "—";
    $("statLabs").textContent     = d.total_labs     ?? "—";
    $("statMachines").textContent = d.total_machines ?? "—";
  } catch { /* silent */ }
}

/* ════════════════════════════
   LABS & MACHINES
════════════════════════════ */
async function loadLabs() {
  try {
    const res  = await fetch("/api/labs");
    const labs = await res.json();

    const populateSel = (sel, placeholder) => {
      sel.innerHTML = `<option value="">${placeholder}</option>`;
      labs.forEach(lab => {
        const opt = document.createElement("option");
        const no   = lab.lab_no   || lab;
        const name = lab.lab_name || "";
        opt.value = no;
        opt.textContent = name ? `${no} — ${name}` : no;
        sel.appendChild(opt);
      });
    };

    populateSel($("lab_no"), "— Select Lab —");
    const machineSel = $("newMachineLab");
    if (machineSel) populateSel(machineSel, "— Select Lab —");
  } catch (err) { console.error("loadLabs:", err); }
}

async function loadMachinesForLab() {
  const labNo = $("lab_no").value;
  const machineSelect = $("machine_id_select");
  $("machine_details").value = "";

  if (!labNo) {
    machineSelect.disabled = true;
    machineSelect.innerHTML = `<option value="">Select lab first</option>`;
    machines = [];
    setStep(1);
    return;
  }

  try {
    const res = await fetch(`/api/machines?lab_no=${encodeURIComponent(labNo)}`);
    machines = await res.json();
    machineSelect.disabled = false;
    machineSelect.innerHTML = `<option value="">— Select Machine ID —</option>`;
    machines.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.machine_id;
      opt.textContent = `${m.machine_id} — ${m.machine_name}`;
      machineSelect.appendChild(opt);
    });
  } catch (err) { console.error("loadMachinesForLab:", err); }
}

function selectedMachine() {
  const id = $("machine_id_select").value;
  return machines.find(m => m.machine_id === id) || null;
}

function updateMachineDetails() {
  const m = selectedMachine();
  const details = $("machine_details");
  if (!m) { details.value = ""; return; }
  const typeName = m.machine_type_name || m.type_name || m.machine_type || "—";
  const group    = m.group_code || "—";
  details.value  = `${typeName}  ·  Group: ${group}  ·  ${m.machine_name || ""}`;

  // Pre-populate hidden confirm fields so they're ready even before extraction
  if ($("machine_type")) $("machine_type").value = typeName;
  if ($("machine_name")) $("machine_name").value = m.machine_name || "";

  setStep(2);
}

/* ════════════════════════════
   SAVE LAB / MACHINE
════════════════════════════ */
async function saveLab() {
  const lab_no   = $("newLabNo").value.trim();
  const lab_name = $("newLabName").value.trim();
  if (!lab_no || !lab_name) return showToast("Lab number and name required.", "error");
  const res = await fetch("/api/labs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lab_no, lab_name })
  });
  if (res.ok) { closeModal(); loadLabs(); loadStats(); showToast("Lab registered.", "success"); }
  else { const d = await res.json(); showToast(d.error || "Failed.", "error"); }
}

function addMachineField() {
  const list = $("machineFieldsList");
  const row = document.createElement("div");
  row.className = "machine-field-row";
  row.innerHTML = `
    <input class="field-ctrl mf-name" placeholder="Field name" />
    <select class="field-ctrl mf-type">
      <option value="number">Number</option>
      <option value="text">Text</option>
    </select>
    <input class="field-ctrl mf-unit" placeholder="Unit" />
    <button type="button" class="btn btn-sm" style="padding:6px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;"
      onclick="this.closest('.machine-field-row').remove()">✕</button>
  `;
  list.appendChild(row);
}

async function saveMachine() {
  const lab_no       = $("newMachineLab").value;
  const machine_id   = $("newMachineId").value.trim();
  const machine_name = $("newMachineName").value.trim();
  if (!lab_no || !machine_id || !machine_name) return showToast("All fields are required.", "error");

  const fields = Array.from(document.querySelectorAll(".machine-field-row")).map(r => ({
    name: r.querySelector(".mf-name").value,
    type: r.querySelector(".mf-type").value,
    unit: r.querySelector(".mf-unit").value
  })).filter(f => f.name);

  const res = await fetch("/api/machines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lab_no, machine_id, machine_name, fields })
  });
  if (res.ok) { closeModal(); loadStats(); showToast("Instrument onboarded.", "success"); }
  else { const d = await res.json(); showToast(d.error || "Failed.", "error"); }
}

/* ════════════════════════════
   PENDING USER BADGE
════════════════════════════ */
async function checkPendingCount() {
  try {
    const res = await fetch("/api/users/pending");
    const users = await res.json();
    const badge = $("pendingBadge");
    if (users.length > 0) {
      badge.textContent = users.length;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  } catch { /* silent */ }
}

/* ════════════════════════════
   USER MANAGEMENT
════════════════════════════ */
async function loadUsersData() {
  try {
    const [users, readings] = await Promise.all([
      fetch("/api/users").then(r => r.json()),
      fetch("/api/readings").then(r => r.json())
    ]);

    const tbody = $("usersTable");
    if (!users.length) {
      tbody.innerHTML = `<tr class="tbl-empty-row"><td colspan="6">No users found</td></tr>`;
    } else {
      tbody.innerHTML = users.map(u => {
        const count = readings.filter(r => r.user_id === u.username).length;
        return `<tr>
          <td style="font-family:var(--mono);font-size:12px;">${u.username}</td>
          <td style="font-weight:600;">${u.full_name}</td>
          <td style="font-size:12px;color:#64748b;">${u.email || "—"}</td>
          <td><span class="pill ${u.role === 'admin' ? 'pill-confirmed' : 'pill-pending'}">${u.role}</span></td>
          <td style="font-weight:700;color:var(--teal);">${count}</td>
          <td><span class="pill ${u.is_approved ? 'pill-confirmed' : 'pill-pending'}">${u.is_approved ? 'Active' : 'Pending'}</span></td>
        </tr>`;
      }).join("");
    }
    $("totalUsersCount").textContent  = users.length;
    $("activeUsersCount").textContent = users.filter(u => u.is_approved).length;
  } catch (err) {
    $("usersTable").innerHTML = `<tr class="tbl-empty-row"><td colspan="6">Error loading data</td></tr>`;
  }
}

async function loadPendingUsers() {
  try {
    const users = await fetch("/api/users/pending").then(r => r.json());
    const tbody = $("pendingUsersTable");
    if (!users.length) {
      tbody.innerHTML = `<tr class="tbl-empty-row"><td colspan="6">No pending approvals</td></tr>`;
    } else {
      tbody.innerHTML = users.map(u => `<tr>
        <td style="font-family:var(--mono);font-size:12px;">${u.username}</td>
        <td style="font-weight:600;">${u.full_name}</td>
        <td style="font-size:12px;color:#64748b;">${u.email || "—"}</td>
        <td><span class="pill pill-pending">${u.role}</span></td>
        <td style="font-size:12px;color:#94a3b8;">${u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-approve" onclick="approveUser('${u.username}')">Allow</button>
            <button class="btn btn-sm btn-deny"    onclick="denyUser('${u.username}')">Deny</button>
          </div>
        </td>
      </tr>`).join("");
    }
    checkPendingCount();
  } catch { $("pendingUsersTable").innerHTML = `<tr class="tbl-empty-row"><td colspan="6">Error loading data</td></tr>`; }
}

async function approveUser(username) {
  const res = await fetch("/api/users/approve", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });
  if (res.ok) { showToast(`${username} approved.`, "success"); loadPendingUsers(); loadUsersData(); }
  else showToast("Failed to approve user.", "error");
}

async function denyUser(username) {
  const res = await fetch("/api/users/deny", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });
  if (res.ok) { showToast(`${username} denied.`, "info"); loadPendingUsers(); loadUsersData(); }
  else showToast("Failed to deny user.", "error");
}

/* ════════════════════════════
   MODAL
════════════════════════════ */
function openModal(id) {
  $("modalOverlay").classList.remove("hidden");
  document.querySelectorAll(".modal-card").forEach(m => m.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function closeModal() {
  $("modalOverlay").classList.add("hidden");
  document.querySelectorAll(".modal-card").forEach(m => m.classList.add("hidden"));
}

function closeModalOnOverlay(e) {
  if (e.target === $("modalOverlay")) closeModal();
}

/* ════════════════════════════
   WORKFLOW STEPS
════════════════════════════ */
function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = $("wfStep" + i);
    if (!el) continue;
    el.classList.remove("active", "done");
    if (i < n)       el.classList.add("done");
    else if (i === n) el.classList.add("active");
  }
}

/* ════════════════════════════
   EXTRACT BUTTON STATE
════════════════════════════ */
function setExtracting(loading) {
  const btn = $("extractBtn");
  const spinner = $("extractSpinner");
  const icon    = $("extractIcon");
  const label   = $("extractLabel");
  btn.disabled = loading;
  if (spinner) spinner.classList.toggle("hidden", !loading);
  if (icon)    icon.classList.toggle("hidden",    loading);
  if (label)   label.textContent = loading ? "Extracting…" : "Extract Readings";
}

/* ════════════════════════════
   IMAGE PREVIEW
════════════════════════════ */
function showPreview(file) {
  const img  = $("previewImage");
  const pane = $("previewPane");
  if (!img || !pane) return;
  img.src = URL.createObjectURL(file);
  img.style.display = "block";
  pane.classList.add("visible");
}

function clearPreview() {
  const img  = $("previewImage");
  const pane = $("previewPane");
  const drop = $("dropzone");
  if (img)  { img.src = ""; img.style.display = "none"; }
  if (pane) pane.classList.remove("visible");
  if (drop) drop.classList.remove("has-file");
  const input = $("imageInput");
  if (input) input.value = "";
  selectedFile = null;
}

/* ════════════════════════════
   FILL CONFIRM FORM
════════════════════════════ */
function fillForm(data) {
  const r = data.readings || {};
  $("lab_no_confirm").value = valueOrEmpty(data.lab_no);
  $("machine_id").value     = valueOrEmpty(data.machine_id);
  $("machine_type").value   = valueOrEmpty(data.machine_type || data.machine_type_name || data.type_name);
  $("machine_name").value   = valueOrEmpty(data.machine_name);
  $("sample_id").value      = valueOrEmpty(data.sample_id);
  $("reference_id").value   = valueOrEmpty(data.reference_id);
  $("speed").value          = valueOrEmpty(r.speed);
  $("temperature").value    = valueOrEmpty(r.temperature);
  $("time_value").value     = valueOrEmpty(r.time_value);
  $("weight").value         = valueOrEmpty(r.weight);
  $("pressure").value       = valueOrEmpty(r.pressure);
  $("volume").value         = valueOrEmpty(r.volume);

  const common = ["speed","temperature","time_value","weight","pressure","volume"];
  const extra  = {};
  Object.entries(r).forEach(([k, v]) => { if (!common.includes(k)) extra[k] = v; });
  $("extra_json").value = JSON.stringify(extra, null, 2);
  $("rawJson").textContent = JSON.stringify(data, null, 2);

  const ocrBox = $("ocrWarning");
  if (data.warning) {
    ocrBox.innerHTML = `<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg><span>${data.warning}</span>`;
    ocrBox.classList.remove("hidden");
  } else { ocrBox.textContent = ""; ocrBox.classList.add("hidden"); }

  const qualBox = $("qualityWarning");
  if (data.quality_warning) {
    const score = data.image_quality?.quality_score ?? 0;
    const label = score >= 80 ? "✅ High Quality" : score >= 60 ? "⚠️ Acceptable" : score >= 40 ? "⚠️ Low Quality" : "❌ Poor Quality";
    qualBox.innerHTML = `<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg><span><strong>${label} (${score}/100)</strong> — ${data.quality_warning}</span>`;
    qualBox.classList.remove("hidden");
  } else { qualBox.textContent = ""; qualBox.classList.add("hidden"); }

  $("confirmSection").classList.remove("hidden");
  setStep(3);
  setTimeout(() => $("confirmSection").scrollIntoView({ behavior: "smooth", block: "start" }), 120);
}

/* ════════════════════════════
   EXTRACT VALUES
════════════════════════════ */
async function extractValues() {
  const labNo     = $("lab_no").value;
  const machineId = $("machine_id_select").value;
  const file      = selectedFile || $("imageInput").files[0];

  if (!labNo)     return setMessage("Please select a Lab No first.", true);
  if (!machineId) return setMessage("Please select a Machine ID.", true);
  if (!file)      return setMessage("Photo upload is mandatory. Select a clear image of the machine display.", true);
  if (file.size > 10 * 1024 * 1024) return setMessage("File too large — please use an image under 10 MB.", true);

  showPreview(file);

  const formData = new FormData();
  formData.append("lab_no", labNo);
  formData.append("machine_id", machineId);
  formData.append("image", file);

  setExtracting(true);
  setMessage("Analysing image and extracting readings…");

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 60000);
    const res = await fetch("/api/extract", { method: "POST", body: formData, signal: controller.signal });
    clearTimeout(tid);

    if (!res.ok) { const err = await res.json(); return setMessage(err.error || "Extraction failed.", true); }

    const data = await res.json();
    if (data.error) return setMessage(data.error, true);

    currentExtraction = data;
    currentExtraction.image_path = data.image_url || data.image_path;
    fillForm(data);
    setMessage("✅ Extraction complete — review values below before saving.");
  } catch (err) {
    if (err.name === "AbortError") setMessage("Extraction timed out. Try a smaller or clearer image.", true);
    else setMessage("Extraction failed — check the backend terminal for details.", true);
  } finally {
    setExtracting(false);
  }
}

/* ════════════════════════════
   SAVE CONFIRMED READING
════════════════════════════ */
async function saveConfirmed() {
  if (!currentExtraction) return setMessage("No extracted data. Complete extraction first.", true);

  let extra = {};
  try { extra = JSON.parse($("extra_json").value || "{}"); }
  catch { return setMessage("Additional Readings JSON is not valid — check syntax.", true); }

  const payload = {
    lab_no:       $("lab_no_confirm").value.trim(),
    machine_id:   $("machine_id").value.trim(),
    machine_type: $("machine_type").value.trim(),
    machine_name: $("machine_name").value.trim(),
    sample_id:    $("sample_id").value.trim(),
    reference_id: $("reference_id").value.trim(),
    image_path:   currentExtraction.image_path,
    readings: {
      speed:       numberOrNull($("speed").value),
      temperature: numberOrNull($("temperature").value),
      time_value:  $("time_value").value.trim() || null,
      weight:      numberOrNull($("weight").value),
      pressure:    numberOrNull($("pressure").value),
      volume:      numberOrNull($("volume").value),
      ...extra
    }
  };

  if (!payload.sample_id) return setMessage("Sample ID is required before saving.", true);

  const btn = $("saveBtn");
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Saving…`;

  try {
    const res = await fetch("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Save failed.", true);

    setMessage("✓ " + (data.message || "Reading saved successfully!"));
    showToast("Reading saved successfully.", "success");
    setStep(4);
    setTimeout(() => showView("readings"), 1400);

  } catch { setMessage("Save request failed — check backend terminal.", true); }
  finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* ════════════════════════════
   LOAD READINGS TABLE
════════════════════════════ */
async function loadReadings() {
  try {
    const labNo = $("lab_no")?.value || "";
    const url   = labNo ? `/api/readings?lab_no=${encodeURIComponent(labNo)}` : "/api/readings";
    const rows  = await fetch(url).then(r => r.json());
    const body  = $("readingsBody");
    body.innerHTML = "";

    if (!rows.length) {
      body.innerHTML = `<tr class="tbl-empty-row"><td colspan="10">No readings yet — complete a capture to see records here</td></tr>`;
      return;
    }

    rows.forEach(row => {
      const tr = document.createElement("tr");
      const pill = (row.status || "").toLowerCase() === "confirmed" ? "pill-confirmed" : "pill-pending";
      tr.innerHTML = `
        <td>${row.id}</td>
        <td>${row.lab_no || "—"}</td>
        <td class="tbl-machine-id">${row.machine_id || "—"}</td>
        <td>${row.machine_type || "—"}</td>
        <td><strong>${row.sample_id || "—"}</strong></td>
        <td class="tbl-num">${row.speed ?? "—"}</td>
        <td class="tbl-num">${row.temperature ?? "—"}</td>
        <td class="tbl-num">${row.time_value ?? "—"}</td>
        <td><span class="pill ${pill}">${row.status || "—"}</span></td>
        <td>${row.created_at || "—"}</td>
      `;
      body.appendChild(tr);
    });

    setMessage("Readings refreshed.");
  } catch { setMessage("Refresh failed — check backend terminal.", true); }
}

/* ════════════════════════════
   INIT
════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  // Restore session
  const saved = sessionStorage.getItem("lims_user");
  if (saved) {
    try { currentUser = JSON.parse(saved); onLoginSuccess(); }
    catch { sessionStorage.removeItem("lims_user"); }
  }

  // Login
  $("loginBtn").addEventListener("click", doLogin);
  $("password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

  // Lab/Machine
  $("lab_no").addEventListener("change", async () => {
    await loadMachinesForLab();
    await loadReadings();
  });
  $("machine_id_select").addEventListener("change", updateMachineDetails);

  // Capture
  $("extractBtn").addEventListener("click", extractValues);
  $("saveBtn").addEventListener("click", saveConfirmed);
  $("refreshBtn").addEventListener("click", loadReadings);

  // Image input
  $("imageInput").addEventListener("change", () => {
    const file = $("imageInput").files[0];
    if (!file) return;
    selectedFile = file;
    $("dropzone").classList.add("has-file");
    showPreview(file);
    if ($("message").textContent.includes("mandatory")) setMessage("");
  });

  const clearBtn = $("clearImageBtn");
  if (clearBtn) clearBtn.addEventListener("click", clearPreview);

  // Drag & drop
  const dropzone = $("dropzone");
  if (dropzone) {
    dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
    dropzone.addEventListener("dragleave", e => { if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove("drag-over"); });
    dropzone.addEventListener("drop", e => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!["image/png","image/jpeg","image/jpg","image/webp"].includes(file.type)) {
        setMessage("Unsupported file type — use PNG, JPG, or WEBP.", true); return;
      }
      selectedFile = file;
      dropzone.classList.add("has-file");
      showPreview(file);
      setMessage("");
    });
  }

  // Keyboard: Escape closes modal
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  setStep(1);
});

/* ════════════════════════════
   LIMS INTEGRATION
════════════════════════════ */

async function loadLimsConfig() {
  try {
    const cfg = await fetch("/api/lims/config").then(r => r.json());
    $("limsUrl").value         = cfg.endpoint_url   || "";
    $("limsAuthHeader").value  = cfg.auth_header     || "Authorization";
    $("limsApiKey").value      = cfg.api_key_set ? "••••••••" : "";
    $("limsEnabled").checked   = cfg.enabled  === "true";
    $("limsAutoPush").checked  = cfg.auto_push !== "false";
    updateLimsStatusDot(cfg.enabled === "true");
  } catch(e) {
    console.error("loadLimsConfig:", e);
  }
}

function updateLimsStatusDot(enabled) {
  const dot = $("limsStatusDot");
  if (!dot) return;
  if (enabled) {
    dot.className = "lims-status-dot lims-on";
    dot.textContent = "Enabled";
  } else {
    dot.className = "lims-status-dot lims-off";
    dot.textContent = "Disabled";
  }
}

async function saveLimsConfig() {
  const payload = {
    endpoint_url: $("limsUrl").value.trim(),
    auth_header:  $("limsAuthHeader").value.trim() || "Authorization",
    api_key:      $("limsApiKey").value,
    auto_push:    $("limsAutoPush").checked ? "true" : "false",
    enabled:      $("limsEnabled").checked  ? "true" : "false",
  };
  try {
    const res = await fetch("/api/lims/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("LIMS settings saved", "success");
      updateLimsStatusDot($("limsEnabled").checked);
    } else {
      showToast(data.error || "Save failed", "error");
    }
  } catch(e) {
    showToast("Save failed: " + e.message, "error");
  }
}

async function testLimsConnection() {
  const url = $("limsUrl").value.trim();
  if (!url) { showToast("Enter a LIMS endpoint URL first", "error"); return; }
  const result = $("limsTestResult");
  result.style.display = "block";
  result.className = "lims-test-result";
  result.textContent = "Testing connection…";
  try {
    const res = await fetch("/api/lims/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint_url: url,
        auth_header:  $("limsAuthHeader").value.trim() || "Authorization",
        api_key:      $("limsApiKey").value,
      }),
    });
    const data = await res.json();
    if (data.success) {
      result.className = "lims-test-result lims-test-ok";
      result.textContent = `Connection successful (HTTP ${data.status_code})`;
    } else {
      result.className = "lims-test-result lims-test-err";
      result.textContent = `Failed: ${data.error || "HTTP " + data.status_code}`;
    }
  } catch(e) {
    result.className = "lims-test-result lims-test-err";
    result.textContent = "Error: " + e.message;
  }
}

async function loadLimsLog() {
  try {
    const rows = await fetch("/api/lims/log").then(r => r.json());
    const tbody = $("limsLogBody");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No push activity yet</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const statusBadge = r.lims_push_status === "sent"
        ? `<span class="lims-push-sent">Sent</span>`
        : r.lims_push_status === "failed"
          ? `<span class="lims-push-failed">Failed</span>`
          : `<span class="lims-push-pending">${r.lims_push_status || "—"}</span>`;
      const retryBtn = r.lims_push_status === "failed"
        ? `<button class="btn btn-secondary btn-sm" onclick="retryLimsPush(${r.id})">Retry</button>`
        : "—";
      return `<tr>
        <td>${r.id}</td>
        <td>${r.machine_id || "—"}</td>
        <td>${r.sample_id || "—"}</td>
        <td>${r.lab_no || "—"}</td>
        <td>${statusBadge}</td>
        <td>${r.lims_pushed_at || "—"}</td>
        <td>${retryBtn}</td>
      </tr>`;
    }).join("");
  } catch(e) {
    console.error("loadLimsLog:", e);
  }
}

async function retryLimsPush(readingId) {
  try {
    const res = await fetch(`/api/lims/retry/${readingId}`, { method: "POST" });
    const data = await res.json();
    if (data.status === "sent") {
      showToast("Push successful", "success");
    } else {
      showToast("Push failed — check LIMS endpoint", "error");
    }
    loadLimsLog();
  } catch(e) {
    showToast("Retry error: " + e.message, "error");
  }
}

/* ════════════════════════════
   AI CHAT WIDGET
════════════════════════════ */
let _chatOpen = false;

function toggleChat() {
  _chatOpen = !_chatOpen;
  const panel = $("aiChatPanel");
  if (_chatOpen) {
    panel.classList.remove("hidden");
    setTimeout(() => $("aiChatInput").focus(), 80);
  } else {
    panel.classList.add("hidden");
  }
}

function _appendMessage(text, role) {
  const msgs = $("aiChatMessages");
  const div = document.createElement("div");
  div.className = `ai-msg ai-msg-${role}`;
  const bubble = document.createElement("div");
  bubble.className = "ai-msg-bubble";
  bubble.innerHTML = text.replace(/\n/g, "<br>");
  div.appendChild(bubble);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function _appendThinking() {
  const msgs = $("aiChatMessages");
  const div = document.createElement("div");
  div.className = "ai-msg ai-msg-bot ai-msg-thinking";
  div.innerHTML = `<div class="ai-msg-bubble"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

async function sendChatMessage() {
  const input = $("aiChatInput");
  const question = (input.value || "").trim();
  if (!question) return;

  input.value = "";
  $("aiChatSend").disabled = true;
  _appendMessage(question, "user");

  // Hide suggestions after first real message
  const suggs = document.querySelector(".ai-chat-suggestions");
  if (suggs) suggs.style.display = "none";

  const thinking = _appendThinking();
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    thinking.remove();
    if (data.error) {
      _appendMessage("Sorry, an error occurred: " + data.error, "bot");
    } else {
      _appendMessage(data.answer || "I don't have an answer for that.", "bot");
    }
  } catch (e) {
    thinking.remove();
    _appendMessage("Network error — please check the server is running.", "bot");
  } finally {
    $("aiChatSend").disabled = false;
    input.focus();
  }
}

function sendSuggestion(text) {
  $("aiChatInput").value = text;
  sendChatMessage();
}

document.addEventListener("DOMContentLoaded", () => {
  const inp = $("aiChatInput");
  if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") sendChatMessage(); });
});
