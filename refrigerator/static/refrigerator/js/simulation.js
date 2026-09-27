/* ============================================================
   simulation.js
   ------------------------------------------------------------
   Real-time working model of the 4-component vapour-compression
   cycle: Compressor, Condenser, Capillary Tube, Evaporator.

   No fault simulation in this version — Start/Stop only. Every
   value is derived from machineState.running (and the startup
   ramp), never randomized.

   Exposes a single global: window.Sim
   ============================================================ */

(function () {
  "use strict";

  const TICK_MS = 700;
  const AMBIENT_TEMP = 24.0; // resting temperature of the whole circuit when stopped

  // Nominal steady-state operating point for a small hermetic
  // reciprocating compressor / capillary-tube system.
  const NOMINAL = {
    compressorRPM: 2900,
    compressorCurrent: 2.6,
    suctionPressure: 1.5,     // bar
    dischargePressure: 10.0,  // bar
    dischargeTemp: 82.0,      // °C — hot gas leaving the compressor
    condenserOutletTemp: 40.0,// °C — subcooled liquid leaving the condenser
    evaporatorInletTemp: -8.0,// °C — flash-cooled liquid/vapour after the capillary
    evaporatorOutletTemp: 1.0 // °C — a few degrees of superheat picked up in the coil
  };

  function approach(current, target, rate) {
    const next = current + (target - current) * rate;
    return Math.abs(next - target) < 0.03 ? target : next;
  }
  function round1(v) { return Math.round(v * 10) / 10; }

  const machineState = {
    running: false,
    systemStatus: "STOPPED", // STOPPED | STARTING | RUNNING

    compressorRPM: 0,
    compressorCurrent: 0,
    suctionPressure: AMBIENT_TEMP > 0 ? 1.0 : 1.0,
    dischargePressure: 1.0,
    dischargeTemp: AMBIENT_TEMP,
    condenserOutletTemp: AMBIENT_TEMP,
    evaporatorInletTemp: AMBIENT_TEMP,
    evaporatorOutletTemp: AMBIENT_TEMP,
    superheat: 0,

    startupTicksRemaining: 0
  };

  // ------------------------------------------------------------
  // Event log (newest first)
  // ------------------------------------------------------------
  const log = [];
  const MAX_LOG_ENTRIES = 100;

  function timeNow() {
    return new Date().toLocaleTimeString("en-GB", { hour12: false });
  }
  function addLog(message, severity) {
    log.unshift({ time: timeNow(), message: message, severity: severity || "info" });
    if (log.length > MAX_LOG_ENTRIES) log.length = MAX_LOG_ENTRIES;
    notify();
  }

  const listeners = [];
  function onTick(fn) { listeners.push(fn); }
  function notify() { listeners.forEach((fn) => fn(machineState, log)); }

  // ------------------------------------------------------------
  // Tick
  // ------------------------------------------------------------
  function tick() {
    const s = machineState;

    if (s.systemStatus === "STARTING") {
      s.startupTicksRemaining -= 1;
      if (s.startupTicksRemaining <= 0) s.systemStatus = "RUNNING";
    }

    const running = s.running;
    const RATE_MECH = 0.16;
    const RATE_TEMP = 0.08;

    s.compressorRPM = approach(s.compressorRPM, running ? NOMINAL.compressorRPM : 0, RATE_MECH);
    s.compressorCurrent = approach(s.compressorCurrent, running ? NOMINAL.compressorCurrent : 0, RATE_MECH);
    s.suctionPressure = approach(s.suctionPressure, running ? NOMINAL.suctionPressure : 1.0, RATE_MECH);
    s.dischargePressure = approach(s.dischargePressure, running ? NOMINAL.dischargePressure : 1.0, RATE_MECH);

    s.dischargeTemp = approach(s.dischargeTemp, running ? NOMINAL.dischargeTemp : AMBIENT_TEMP, RATE_TEMP);
    s.condenserOutletTemp = approach(s.condenserOutletTemp, running ? NOMINAL.condenserOutletTemp : AMBIENT_TEMP, RATE_TEMP);
    s.evaporatorInletTemp = approach(s.evaporatorInletTemp, running ? NOMINAL.evaporatorInletTemp : AMBIENT_TEMP, RATE_TEMP);
    s.evaporatorOutletTemp = approach(s.evaporatorOutletTemp, running ? NOMINAL.evaporatorOutletTemp : AMBIENT_TEMP, RATE_TEMP);

    s.superheat = s.evaporatorOutletTemp - s.evaporatorInletTemp;

    // rounding
    s.compressorRPM = Math.round(s.compressorRPM);
    s.compressorCurrent = round1(s.compressorCurrent);
    s.suctionPressure = round1(s.suctionPressure);
    s.dischargePressure = round1(s.dischargePressure);
    s.dischargeTemp = round1(s.dischargeTemp);
    s.condenserOutletTemp = round1(s.condenserOutletTemp);
    s.evaporatorInletTemp = round1(s.evaporatorInletTemp);
    s.evaporatorOutletTemp = round1(s.evaporatorOutletTemp);
    s.superheat = round1(s.superheat);

    if (s.systemStatus !== "STARTING") {
      s.systemStatus = running ? "RUNNING" : "STOPPED";
    }

    notify();
  }

  // ------------------------------------------------------------
  // PostgreSQL Database Telemetry Logger (5-second interval)
  // ------------------------------------------------------------
  const DB_SAVE_INTERVAL_MS = 5000;
  let dbSaveTimer = null;
  let isLiveActive = true;
  let lastSavedId = null;

  async function saveTelemetryToDb() {
    if (!isLiveActive) return;
    const s = machineState;

    const payload = {
      timestamp: new Date().toISOString(),
      suction_pressure: s.suctionPressure,
      discharge_pressure: s.dischargePressure,
      discharge_temperature: s.dischargeTemp,
      condenser_outlet_temp: s.condenserOutletTemp,
      evaporator_inlet_temp: s.evaporatorInletTemp,
      evaporator_outlet_temp: s.evaporatorOutletTemp,
      compressor_status: s.running ? (s.systemStatus === "STARTING" ? "STARTING" : "RUNNING") : "OFF",
      condenser_fan_status: s.running ? "ACTIVE" : "IDLE",
      evaporator_fan_status: s.running ? "ACTIVE" : "IDLE",
      system_status: s.systemStatus,
      fault_type: "None"
    };

    try {
      const resp = await fetch("/api/telemetry/save/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        const data = await resp.json();
        lastSavedId = data.id;
        const dbBadge = document.getElementById("dbSaveStatus");
        if (dbBadge) {
          dbBadge.textContent = "● Saved to DB #" + data.id + " (" + new Date().toLocaleTimeString() + ")";
          dbBadge.className = "db-status-badge saved";
        }
      } else {
        console.warn("Telemetry save response status:", resp.status);
      }
    } catch (err) {
      console.warn("Telemetry DB auto-save network error:", err);
      const dbBadge = document.getElementById("dbSaveStatus");
      if (dbBadge) {
        dbBadge.textContent = "● DB Connection Error";
        dbBadge.className = "db-status-badge error";
      }
    }
  }

  // ------------------------------------------------------------
  // Commands
  // ------------------------------------------------------------
  function start() {
    if (machineState.running) return;
    machineState.running = true;
    machineState.systemStatus = "STARTING";
    machineState.startupTicksRemaining = 2;
    addLog("System started (LIVE MODE)", "ok");
    addLog("Compressor start command issued", "info");
    // Trigger immediate save on startup
    saveTelemetryToDb();
  }

  function stop() {
    if (!machineState.running) return;
    machineState.running = false;
    machineState.systemStatus = "STOPPED";
    addLog("System stopped by operator", "info");
    // Trigger immediate save on shutdown
    saveTelemetryToDb();
  }

  function setLiveModeActive(active) {
    isLiveActive = active;
    if (active) {
      notify();
    }
  }

  let simInterval = null;
  function init() {
    addLog("System initialized (LIVE SIMULATION MODE)", "info");
    notify();
    if (!simInterval) {
      simInterval = setInterval(function () {
        if (isLiveActive) tick();
      }, TICK_MS);
    }
    if (!dbSaveTimer) {
      dbSaveTimer = setInterval(function () {
        if (isLiveActive && machineState.running) {
          saveTelemetryToDb();
        }
      }, DB_SAVE_INTERVAL_MS);
    }
  }

  window.Sim = {
    state: machineState,
    constants: { TICK_MS, AMBIENT_TEMP, NOMINAL, DB_SAVE_INTERVAL_MS },
    onTick: onTick,
    addLog: addLog,
    getLog: () => log,
    start: start,
    stop: stop,
    init: init,
    saveTelemetryToDb: saveTelemetryToDb,
    setLiveModeActive: setLiveModeActive,
    isLiveModeActive: () => isLiveActive,
    getLastSavedId: () => lastSavedId
  };
})();
