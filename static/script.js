let currentExtraction = null;
let machines = [];

const $ = (id) => document.getElementById(id);

function setMessage(text, isError = false) {
  const el = $("message");
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#dc2626" : "#047857";
}

function valueOrEmpty(v) {
  return v === null || v === undefined ? "" : v;
}

function numberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function selectedMachine() {
  const machineId = $("machine_id_select").value;
  return machines.find(m => m.machine_id === machineId) || null;
}

async function loadLabs() {
  try {
    const res = await fetch("/api/labs");
    const labs = await res.json();

    const labSelect = $("lab_no");
    labSelect.innerHTML = `<option value="">Select Lab No</option>`;

    labs.forEach(lab => {
      const opt = document.createElement("option");
      opt.value = lab;
      opt.textContent = lab;
      labSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("loadLabs error:", err);
  }
}

async function loadMachinesForLab() {
  const labNo = $("lab_no").value;
  const machineSelect = $("machine_id_select");
  const details = $("machine_details");

  details.value = "";

  if (!labNo) {
    machineSelect.disabled = true;
    machineSelect.innerHTML = `<option value="">Select Lab No first</option>`;
    return;
  }

  try {
    const res = await fetch(`/api/machines?lab_no=${encodeURIComponent(labNo)}`);
    machines = await res.json();

    machineSelect.disabled = false;
    machineSelect.innerHTML = `<option value="">Select Machine ID</option>`;

    machines.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.machine_id;
      opt.textContent = `${m.machine_id} — ${m.machine_name}`;
      machineSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("loadMachinesForLab error:", err);
  }
}

function updateMachineDetails() {
  const m = selectedMachine();

  if (!m) {
    $("machine_details").value = "";
    return;
  }

  $("machine_details").value =
    `${m.machine_type} | ${m.group_code} | Fields: ${m.fields.join(", ")}`;
}

function fillForm(data) {
  const readings = data.readings || {};

  $("lab_no_confirm").value = valueOrEmpty(data.lab_no);
  $("machine_id").value = valueOrEmpty(data.machine_id);
  $("machine_type").value = valueOrEmpty(data.machine_type);
  $("machine_name").value = valueOrEmpty(data.machine_name);
  $("sample_id").value = valueOrEmpty(data.sample_id);
  $("reference_id").value = valueOrEmpty(data.reference_id);

  $("speed").value = valueOrEmpty(readings.speed);
  $("temperature").value = valueOrEmpty(readings.temperature);
  $("time_value").value = valueOrEmpty(readings.time_value);
  $("weight").value = valueOrEmpty(readings.weight);
  $("pressure").value = valueOrEmpty(readings.pressure);
  $("volume").value = valueOrEmpty(readings.volume);

  const common = ["speed", "temperature", "time_value", "weight", "pressure", "volume"];
  const extra = {};

  Object.entries(readings).forEach(([k, v]) => {
    if (!common.includes(k)) extra[k] = v;
  });

  $("extra_json").value = JSON.stringify(extra, null, 2);
  $("rawJson").textContent = JSON.stringify(data, null, 2);

  // Handle OCR warning
  const warningBox = $("ocrWarning");
  if (data.warning) {
    warningBox.textContent = data.warning;
    warningBox.classList.remove("hidden");
  } else {
    warningBox.textContent = "";
    warningBox.classList.add("hidden");
  }

  // Handle image quality warning
  const qualityBox = $("qualityWarning");
  if (data.quality_warning) {
    qualityBox.textContent = data.quality_warning;
    qualityBox.classList.remove("hidden");
    
    // Add visual quality indicator
    const qualityScore = data.image_quality?.quality_score || 0;
    let qualityIndicator = "";
    if (qualityScore >= 80) {
      qualityIndicator = "🟢 High Quality";
    } else if (qualityScore >= 60) {
      qualityIndicator = "🟡 Medium Quality";
    } else if (qualityScore >= 40) {
      qualityIndicator = "🟠 Low Quality";
    } else {
      qualityIndicator = "🔴 Poor Quality";
    }
    
    qualityBox.innerHTML = `<strong>${qualityIndicator} (Score: ${qualityScore}/100)</strong><br>${data.quality_warning}`;
  } else {
    qualityBox.textContent = "";
    qualityBox.classList.add("hidden");
  }

  $("confirmSection").classList.remove("hidden");
}

async function extractValues() {
  const labNo = $("lab_no").value;
  const machineId = $("machine_id_select").value;
  const file = $("imageInput").files[0];

  if (!labNo) return setMessage("❌ Please select Lab No first.", true);
  if (!machineId) return setMessage("❌ Please select Machine ID first.", true);
  if (!file) return setMessage("❌ Photo upload is MANDATORY. Please upload a clear photo of the machine display.", true);
  
  // Check file size on client side for immediate feedback
  if (file.size > 10 * 1024 * 1024) { // 10MB
    return setMessage("❌ File too large. Please upload an image smaller than 10MB for optimal performance.", true);
  }

  const preview = $("previewImage");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";

  const formData = new FormData();
  formData.append("lab_no", labNo);
  formData.append("machine_id", machineId);
  formData.append("image", file);

  $("extractBtn").disabled = true;
  setMessage("Extracting values...");

  try {
    // Add timeout protection with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const res = await fetch("/api/extract", {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json();
      setMessage(errorData.error || "Extraction failed.", true);
      return;
    }

    const data = await res.json();

    if (data.error) {
      setMessage(data.error, true);
      return;
    }

    currentExtraction = data;
    currentExtraction.image_path = data.image_url || data.image_path;
    fillForm(data);
    setMessage("✅ Extraction completed. Please verify values before saving.");
  } catch (err) {
    console.error("extractValues error:", err);
    if (err.name === 'AbortError') {
      setMessage("⏰ Extraction timed out. Please try with a clearer image or smaller file size.", true);
    } else {
      setMessage("❌ Extraction failed. Please check your internet connection and try again.", true);
    }
  } finally {
    $("extractBtn").disabled = false;
  }
}

async function saveConfirmed() {
  console.log("Confirm & Save clicked");

  if (!currentExtraction) {
    setMessage("No extracted data found. Extract values first.", true);
    return;
  }

  let extra = {};
  try {
    extra = JSON.parse($("extra_json").value || "{}");
  } catch (err) {
    setMessage("Extra Readings JSON is invalid.", true);
    return;
  }

  const payload = {
    lab_no: $("lab_no_confirm").value.trim(),
    machine_id: $("machine_id").value.trim(),
    machine_type: $("machine_type").value.trim(),
    machine_name: $("machine_name").value.trim(),
    sample_id: $("sample_id").value.trim(),
    reference_id: $("reference_id").value.trim(),
    image_path: currentExtraction.image_path,

    readings: {
      speed: numberOrNull($("speed").value),
      temperature: numberOrNull($("temperature").value),
      time_value: $("time_value").value.trim() || null,
      weight: numberOrNull($("weight").value),
      pressure: numberOrNull($("pressure").value),
      volume: numberOrNull($("volume").value),
      ...extra
    }
  };

  if (!payload.sample_id) {
    setMessage("Sample ID / Sample No is required before saving.", true);
    return;
  }

  try {
    const res = await fetch("/api/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Save failed.", true);
      return;
    }

    setMessage("✓ " + (data.message || "Reading saved successfully!"));
    await loadReadings();
    
    // Auto-scroll to show the saved readings table
    setTimeout(() => {
      const table = $("readingsBody");
      if (table) {
        table.closest('.table-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);

  } catch (err) {
    console.error("saveConfirmed error:", err);
    setMessage("Save request failed. Check backend terminal.", true);
  }
}

async function loadReadings() {
  console.log("Refresh clicked / loading readings");

  try {
    const labNo = $("lab_no")?.value || "";
    const url = labNo
      ? `/api/readings?lab_no=${encodeURIComponent(labNo)}`
      : "/api/readings";

    const res = await fetch(url);
    const rows = await res.json();

    const body = $("readingsBody");
    body.innerHTML = "";

    rows.forEach(row => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${row.id}</td>
        <td>${row.lab_no || ""}</td>
        <td>${row.machine_id || ""}</td>
        <td>${row.machine_type || ""}</td>
        <td>${row.sample_id || ""}</td>
        <td>${row.speed ?? ""}</td>
        <td>${row.temperature ?? ""}</td>
        <td>${row.time_value ?? ""}</td>
        <td>${row.status || ""}</td>
        <td>${row.created_at || ""}</td>
      `;

      body.appendChild(tr);
    });

    setMessage("Readings refreshed.");

  } catch (err) {
    console.error("loadReadings error:", err);
    setMessage("Refresh failed. Check backend terminal.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("lab_no").addEventListener("change", async () => {
    await loadMachinesForLab();
    await loadReadings();
  });

  $("machine_id_select").addEventListener("change", updateMachineDetails);
  $("extractBtn").addEventListener("click", extractValues);
  $("saveBtn").addEventListener("click", saveConfirmed);
  $("refreshBtn").addEventListener("click", loadReadings);

  $("imageInput").addEventListener("change", () => {
    const file = $("imageInput").files[0];
    if (!file) return;

    const preview = $("previewImage");
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
    
    // Clear any previous error messages when a file is selected
    if ($("message").textContent.includes("Photo upload is MANDATORY")) {
      setMessage("");
    }
  });

  loadLabs();
  loadReadings();
});