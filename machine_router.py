MACHINES = [
    {"lab_no": "CL07", "machine_id": "VLL/CEN/048", "group_code": "CEN", "machine_type": "centrifuge", "machine_name": "Thermo Scientific Sorvall ST 8R Centrifuge", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
    {"lab_no": "CL07", "machine_id": "VLL/CEN/047", "group_code": "CEN", "machine_type": "centrifuge", "machine_name": "Thermo Scientific Sorvall Legend Micro 21R", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
    {"lab_no": "CL07", "machine_id": "VLL/OSMO/001", "group_code": "OSMO", "machine_type": "osmometer", "machine_name": "Advanced Instruments OsmoTECH XT", "fields": ["osmolarity"], "units": {"osmolarity": "mOsm/kg"}},
    {"lab_no": "CL07", "machine_id": "VLL/UVS/006", "group_code": "UVS", "machine_type": "uv_spectrophotometer", "machine_name": "Shimadzu UV-1900i UV-VIS Spectrophotometer", "fields": ["absorbance", "wavelength"], "units": {"absorbance": "Abs", "wavelength": "nm"}},
    {"lab_no": "CL07", "machine_id": "VLL/MIXR/023", "group_code": "MIXR", "machine_type": "thermomixer", "machine_name": "Eppendorf ThermoMixer C", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
    {"lab_no": "CL07", "machine_id": "VLL/MAGS/012", "group_code": "MAGS", "machine_type": "magnetic_stirrer", "machine_name": "Wiggens WH-410D Magnetic Stirrer", "fields": ["speed"], "units": {"speed": "RPM"}},
    {"lab_no": "CL07", "machine_id": "VLL/SON/007", "group_code": "S", "machine_type": "sonicator", "machine_name": "Elma Elmasonic P Ultrasonic Bath", "fields": ["temperature", "time_value", "frequency", "power"], "units": {"temperature": "°C", "time_value": "min", "frequency": "kHz", "power": "%"}},
    {"lab_no": "CL07", "machine_id": "VLL/WAB/017", "group_code": "WAB", "machine_type": "water_bath", "machine_name": "Labwit Water Bath", "fields": ["temperature"], "units": {"temperature": "°C"}},
    {"lab_no": "CL07", "machine_id": "VLL/FMS/002", "group_code": "FMS", "machine_type": "headspace_analyzer", "machine_name": "Lighthouse FMS Carbon Dioxide Headspace Analyzer", "fields": ["co2", "pressure"], "units": {"co2": "%", "pressure": "bar"}},
]

MACHINE_BY_ID = {m["machine_id"]: m for m in MACHINES}

# Alias support when OCR reads only group code from sticker.
MACHINE_TYPE_MAP = {
    "CEN": {"machine_type": "centrifuge", "machine_name": "Centrifuge", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
    "OSMO": {"machine_type": "osmometer", "machine_name": "Osmometer", "fields": ["osmolarity"], "units": {"osmolarity": "mOsm/kg"}},
    "UVS": {"machine_type": "uv_spectrophotometer", "machine_name": "UV Spectrophotometer", "fields": ["absorbance", "wavelength"], "units": {"absorbance": "Abs", "wavelength": "nm"}},
    "MIXR": {"machine_type": "thermomixer", "machine_name": "ThermoMixer", "fields": ["speed", "temperature", "time_value"], "units": {"speed": "RPM", "temperature": "°C", "time_value": "min"}},
    "MAGS": {"machine_type": "magnetic_stirrer", "machine_name": "Magnetic Stirrer", "fields": ["speed"], "units": {"speed": "RPM"}},
    "WAB": {"machine_type": "water_bath", "machine_name": "Water Bath", "fields": ["temperature"], "units": {"temperature": "°C"}},
    "FMS": {"machine_type": "headspace_analyzer", "machine_name": "Headspace Analyzer", "fields": ["co2", "pressure"], "units": {"co2": "%", "pressure": "bar"}},
    "FTRM": {"machine_type": "headspace_analyzer", "machine_name": "Headspace Analyzer", "fields": ["co2", "pressure"], "units": {"co2": "%", "pressure": "bar"}},
    "S": {"machine_type": "sonicator", "machine_name": "Ultrasonic Bath / Sonicator", "fields": ["temperature", "time_value", "frequency", "power"], "units": {"temperature": "°C", "time_value": "min", "frequency": "kHz", "power": "%"}},
}


def list_labs():
    return sorted({m["lab_no"] for m in MACHINES})


def list_machines(lab_no: str | None = None):
    if not lab_no:
        return MACHINES
    return [m for m in MACHINES if m["lab_no"].upper() == lab_no.upper()]


def get_machine_by_id(machine_id: str):
    return MACHINE_BY_ID.get(machine_id)


def detect_machine_type(machine_id: str | None, inst_group: str | None = None) -> dict:
    if machine_id and machine_id in MACHINE_BY_ID:
        return MACHINE_BY_ID[machine_id]

    code = None
    if machine_id and "/" in machine_id:
        parts = machine_id.upper().split("/")
        if len(parts) >= 3:
            code = parts[1].strip()
    if not code and inst_group:
        code = inst_group.upper().strip()

    config = MACHINE_TYPE_MAP.get(code, {
        "machine_type": "unknown",
        "machine_name": "Unknown Machine",
        "fields": [],
        "units": {},
    })
    return {"lab_no": None, "machine_id": machine_id, "group_code": code, **config}
