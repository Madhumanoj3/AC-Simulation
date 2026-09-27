/* ============================================================
   ui.js
   ------------------------------------------------------------
   Reads machineState (from simulation.js) and writes it to the
   DOM/SVG. No fault/alarm rendering in this version.

   Exposes a single global: window.UI
   ============================================================ */

(function () {
  "use strict";

  const el = {};
  function cache() {
    [
      "hdrDate", "hdrTime",
      "mimicSystemStatusTag",
      "lampSystemStatus", "valSystemStatus",
      "lampCompressor", "valCompressor",
      "lampCondenser", "valCondenser",
      "lampEvaporator", "valEvaporator",
      "lampCapillary", "valCapillary",
      "pvSuctionP", "pvDischargeP",
      "pvCondInTemp", "pvCondOutTemp",
      "pvExpInTemp", "pvExpOutTemp",
      "pvEvapInTemp", "pvEvapOutTemp",
      "eventLog",
      "svgDischargePressure", "svgDischargeTemp", "svgSuctionPressure",
      "svgCondenserOutletTemp", "svgEvaporatorInletTemp", "svgEvaporatorOutletTemp",
      "compressor", "compressorMotor", "condenser", "evaporator", "capillaryTube",
      "condShimmer1", "evapShimmer1", "capillaryGlow",
      "refrigerantFlow"
    ].forEach((id) => (el[id] = document.getElementById(id)));
  }

  function setLamp(lampEl, cls) {
    if (!lampEl) return;
    lampEl.className = "status-lamp" + (cls ? " " + cls : "");
  }
  function setComponentState(groupEl, stateClass) {
    if (!groupEl) return;
    groupEl.classList.remove("state-off", "state-running", "state-cooling", "state-hot", "state-on");
    groupEl.classList.add(stateClass);
  }

  let activeState = null;

  function renderAll(s, log) {
    activeState = s;
    const isHistorical = Boolean(s.isHistorical);
    const histPlaying = isHistorical && window.HistoryPlayer && window.HistoryPlayer.isPlaying();
    const isSimulating = isHistorical ? histPlaying : s.running;

    // ---- Historical Clock display override ----
    if (isHistorical && s.timestamp) {
      try {
        const dt = new Date(s.timestamp);
        if (el.hdrDate) el.hdrDate.textContent = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " [HISTORICAL]";
        if (el.hdrTime) el.hdrTime.textContent = dt.toLocaleTimeString("en-GB", { hour12: false });
      } catch(e) {}
    }

    // ---- Header status tag & Mode tag ----
    if (el.mimicSystemStatusTag) {
      let displayStatus = s.systemStatus;
      if (isHistorical) {
        displayStatus = histPlaying ? s.systemStatus + " (REPLAY)" : "STANDBY (READY)";
      }
      el.mimicSystemStatusTag.textContent = displayStatus;
      let sysColor = "text-gray";
      if (s.systemStatus === "RUNNING" && isSimulating) sysColor = "text-green";
      else if (s.systemStatus === "STARTING" && isSimulating) sysColor = "text-orange";
      el.mimicSystemStatusTag.className = sysColor;
    }

    const hdrModeVal = document.getElementById("hdrModeVal");
    const hdrModeItem = document.getElementById("hdrModeItem");
    if (hdrModeVal) {
      if (isHistorical) {
        hdrModeVal.textContent = histPlaying ? "HISTORICAL (PLAYING)" : "HISTORICAL (STANDBY)";
        if (hdrModeItem) hdrModeItem.className = histPlaying ? "meta-item mode-live" : "meta-item mode-hist";
      } else {
        hdrModeVal.textContent = s.running ? "LIVE (RUNNING)" : "LIVE (STOPPED)";
        if (hdrModeItem) hdrModeItem.className = s.running ? "meta-item mode-live" : "meta-item";
      }
    }

    // ---- Status panel ----
    if (el.valSystemStatus) {
      if (isHistorical) {
        el.valSystemStatus.textContent = histPlaying ? s.systemStatus : "STANDBY / PAUSED";
      } else {
        el.valSystemStatus.textContent = s.systemStatus;
      }
    }
    if (el.lampSystemStatus) setLamp(el.lampSystemStatus, isSimulating ? (s.systemStatus === "RUNNING" ? "on" : "warm") : "");

    const compOn = isSimulating && s.running;
    if (el.valCompressor) el.valCompressor.textContent = compOn ? "ON" : "OFF";
    if (el.lampCompressor) setLamp(el.lampCompressor, compOn ? "on" : "");

    const condActive = isSimulating && s.running;
    if (el.valCondenser) el.valCondenser.textContent = condActive ? "ACTIVE" : "IDLE";
    if (el.lampCondenser) setLamp(el.lampCondenser, condActive ? "warm" : "");

    const evapActive = isSimulating && s.running;
    if (el.valEvaporator) el.valEvaporator.textContent = evapActive ? "ACTIVE" : "IDLE";
    if (el.lampEvaporator) setLamp(el.lampEvaporator, evapActive ? "cool" : "");

    const capActive = isSimulating && s.running;
    if (el.valCapillary) el.valCapillary.textContent = capActive ? "METERING" : "IDLE";
    if (el.lampCapillary) setLamp(el.lampCapillary, capActive ? "cool" : "");

    // ---- Live parameters (Values ALWAYS show the historical record's numbers) ----
    if (el.pvSuctionP) el.pvSuctionP.textContent = s.suctionPressure.toFixed(1) + " bar";
    if (el.pvDischargeP) el.pvDischargeP.textContent = s.dischargePressure.toFixed(1) + " bar";

    // Condenser
    if (el.pvCondInTemp) el.pvCondInTemp.textContent = s.dischargeTemp.toFixed(1) + " °C";
    if (el.pvCondOutTemp) el.pvCondOutTemp.textContent = s.condenserOutletTemp.toFixed(1) + " °C";

    // Expansion Valve (Capillary Tube)
    if (el.pvExpInTemp) el.pvExpInTemp.textContent = s.condenserOutletTemp.toFixed(1) + " °C";
    if (el.pvExpOutTemp) el.pvExpOutTemp.textContent = s.evaporatorInletTemp.toFixed(1) + " °C";

    // Evaporator
    if (el.pvEvapInTemp) el.pvEvapInTemp.textContent = s.evaporatorInletTemp.toFixed(1) + " °C";
    if (el.pvEvapOutTemp) el.pvEvapOutTemp.textContent = s.evaporatorOutletTemp.toFixed(1) + " °C";

    // ---- Event log ----
    if (el.eventLog && log) {
      el.eventLog.innerHTML = log.slice(0, 30).map((entry) => {
        const sevClass = entry.severity === "ok" ? "sev-ok" : (entry.severity === "warn" ? "sev-warn" : (entry.severity === "err" ? "sev-err" : ""));
        return '<li class="' + sevClass + '"><span class="log-time">' + entry.time + '</span><span class="log-msg">' + entry.message + "</span></li>";
      }).join("");
    }

    // ---- SVG component states (Only active when simulating / playing!) ----
    if (el.compressor) setComponentState(el.compressor, compOn ? "state-running" : "state-off");
    if (el.compressorMotor) {
      const pulse = el.compressorMotor.querySelector(".compressor-pulse");
      if (pulse) pulse.classList.toggle("active", compOn);
    }

    if (el.condenser) setComponentState(el.condenser, condActive ? "state-hot" : "state-off");
    if (el.condShimmer1) el.condShimmer1.classList.toggle("active", condActive);

    if (el.evaporator) setComponentState(el.evaporator, evapActive ? "state-cooling" : "state-off");
    if (el.evapShimmer1) el.evapShimmer1.classList.toggle("active", evapActive);

    if (el.capillaryTube) setComponentState(el.capillaryTube, capActive ? "state-cooling" : "state-off");
    if (el.capillaryGlow) el.capillaryGlow.classList.toggle("active", capActive);

    // ---- Sensor readouts on the diagram (Always display historical frame values) ----
    if (el.svgDischargePressure) el.svgDischargePressure.textContent = s.dischargePressure.toFixed(1) + " bar";
    if (el.svgDischargeTemp) el.svgDischargeTemp.textContent = s.dischargeTemp.toFixed(1) + "°C";
    if (el.svgSuctionPressure) el.svgSuctionPressure.textContent = s.suctionPressure.toFixed(1) + " bar";
    if (el.svgCondenserOutletTemp) el.svgCondenserOutletTemp.textContent = s.condenserOutletTemp.toFixed(1) + "°C";
    if (el.svgEvaporatorInletTemp) el.svgEvaporatorInletTemp.textContent = s.evaporatorInletTemp.toFixed(1) + "°C";
    if (el.svgEvaporatorOutletTemp) el.svgEvaporatorOutletTemp.textContent = s.evaporatorOutletTemp.toFixed(1) + "°C";
  }

  // ------------------------------------------------------------
  // Refrigerant flow animation
  // ------------------------------------------------------------
  const FLOW_SEGMENTS = [
    // 1. Hot gas discharge: compressor right port (208, 200) → S-curve up → condenser left inlet (244, 93)
    { points: [[208, 200], [222, 200], [234, 150], [234, 93], [244, 93]], hot: true },
    // 2. Through condenser (left to right, down serpentines to fan bottom)
    { points: [[244, 93], [617, 93], [617, 239], [660, 276]], hot: true },
    // 3. High-P liquid line: condenser bottom → down to y=360 → right to x=736 → up to y=290 → capillary inlet
    { points: [[660, 276], [660, 360], [736, 360], [736, 290], [760, 290]], hot: true },
    // 4. Through capillary tube (expansion — left to right through copper spiral coil)
    { points: [[760, 290], [974, 290]], hot: false },
    // 5. Low-P expanded line: capillary outlet → right → down → left → evaporator right
    { points: [[974, 290], [1025, 290], [1025, 525], [672, 525]], hot: false },
    // 6. Through evaporator (right to left at y=525)
    { points: [[672, 525], [215, 525]], hot: false },
    // 7. Suction line: evaporator left → left → up → right into compressor left port (88, 293)
    { points: [[215, 525], [58, 525], [58, 293], [88, 293]], hot: false }
  ];

  const totalLengths = [];
  let circuitLength = 0;

  function dist(p1, p2) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function precalculateCircuit() {
    circuitLength = 0;
    FLOW_SEGMENTS.forEach((seg) => {
      let segLen = 0;
      for (let i = 0; i < seg.points.length - 1; i++) {
        segLen += dist(seg.points[i], seg.points[i + 1]);
      }
      totalLengths.push(segLen);
      circuitLength += segLen;
    });
  }

  function locate(distance) {
    let d = ((distance % circuitLength) + circuitLength) % circuitLength;
    for (let i = 0; i < FLOW_SEGMENTS.length; i++) {
      const segLen = totalLengths[i];
      if (d <= segLen) {
        const seg = FLOW_SEGMENTS[i];
        let acc = 0;
        for (let j = 0; j < seg.points.length - 1; j++) {
          const segDist = dist(seg.points[j], seg.points[j + 1]);
          if (d <= acc + segDist) {
            const frac = segDist === 0 ? 0 : (d - acc) / segDist;
            const x = seg.points[j][0] + (seg.points[j + 1][0] - seg.points[j][0]) * frac;
            const y = seg.points[j][1] + (seg.points[j + 1][1] - seg.points[j][1]) * frac;
            return { point: [x, y], hot: seg.hot };
          }
          acc += segDist;
        }
      }
      d -= segLen;
    }
    return { point: FLOW_SEGMENTS[0].points[0], hot: true };
  }

  const DOT_COUNT = 36;
  const dots = [];

  function initFlowDots() {
    precalculateCircuit();
    if (!el.refrigerantFlow) return;
    el.refrigerantFlow.innerHTML = "";
    dots.length = 0;

    const spacing = circuitLength / DOT_COUNT;
    for (let i = 0; i < DOT_COUNT; i++) {
      const initialDist = i * spacing;
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", "3.5");
      circle.setAttribute("class", "flow-dot");
      el.refrigerantFlow.appendChild(circle);
      dots.push({ el: circle, distance: initialDist });
    }
  }

  let currentFlowSpeed = 0;
  let lastFrameTime = null;

  function targetFlowSpeed() {
    const s = activeState || (window.Sim ? window.Sim.state : null);
    if (!s || !s.running) {
      currentFlowSpeed = 0;
      return 0;
    }

    // In historical mode, ONLY move flow dots when playback is actively playing
    if (s.isHistorical) {
      const isPlaying = Boolean(window.HistoryPlayer && window.HistoryPlayer.isPlaying());
      if (!isPlaying) {
        currentFlowSpeed = 0;
        return 0;
      }
    }

    const BASE_SPEED = 140; // px/sec at nominal compressor speed
    const nominalRPM = (window.Sim && window.Sim.constants) ? window.Sim.constants.NOMINAL.compressorRPM : 2900;
    const rpm = s.compressorRPM || (s.running ? nominalRPM : 0);
    return BASE_SPEED * (rpm / nominalRPM);
  }

  function animateFlow(timestamp) {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const dt = Math.min(0.1, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;

    const target = targetFlowSpeed();
    currentFlowSpeed += (target - currentFlowSpeed) * 0.05;
    if (Math.abs(currentFlowSpeed - target) < 0.3) currentFlowSpeed = target;

    dots.forEach((dot) => {
      dot.distance += currentFlowSpeed * dt;
      const loc = locate(dot.distance);
      dot.el.setAttribute("cx", loc.point[0].toFixed(1));
      dot.el.setAttribute("cy", loc.point[1].toFixed(1));
      dot.el.classList.toggle("hot", loc.hot);
    });

    requestAnimationFrame(animateFlow);
  }

  function updateClock() {
    if (activeState && activeState.isHistorical) return; // don't override historical replay time
    const now = new Date();
    if (el.hdrDate) el.hdrDate.textContent = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    if (el.hdrTime) el.hdrTime.textContent = now.toLocaleTimeString("en-GB", { hour12: false });
  }

  window.UI = {
    cache: cache,
    renderAll: renderAll,
    initFlowDots: initFlowDots,
    animateFlow: animateFlow,
    updateClock: updateClock,
    getActiveState: () => activeState
  };
})();
