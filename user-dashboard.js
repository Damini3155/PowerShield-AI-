// User dashboard logic: CSV upload, anomaly detection, charts, alerts, and tips.

let consumptionChart;
let comparisonChart;
let currentData = [];
let anomalies = [];

const state = {
  notifications: [],
};

const qs = (sel) => document.querySelector(sel);

const initCharts = () => {
  const consumptionCtx = document.getElementById("consumptionChart").getContext("2d");
  const comparisonCtx = document.getElementById("comparisonChart").getContext("2d");

  consumptionChart = ChartUtils.createLineChart(consumptionCtx, [], [
    { label: "User Consumption (kWh)", data: [], borderColor: "#3bc7ff", backgroundColor: "rgba(59,199,255,0.2)", tension: 0.35, fill: true },
    { label: "Moving Average", data: [], borderColor: "#45f39a", backgroundColor: "rgba(69,243,154,0.15)", tension: 0.35, fill: true },
  ]);

  comparisonChart = ChartUtils.createBarChart(comparisonCtx, [], [
    { label: "User Consumption", data: [], backgroundColor: "rgba(59,199,255,0.7)" },
    { label: "Neighborhood Avg", data: [], backgroundColor: "rgba(69,243,154,0.7)" },
  ]);
};

const setRiskDisplay = (risk) => {
  const statusEl = qs("#riskStatus");
  statusEl.classList.remove("risk-normal", "risk-suspicious", "risk-high");
  if (risk === "high") {
    statusEl.textContent = "High Risk";
    statusEl.classList.add("risk-high");
    qs("#riskLevel").textContent = "Immediate attention required";
  } else if (risk === "suspicious") {
    statusEl.textContent = "Suspicious";
    statusEl.classList.add("risk-suspicious");
    qs("#riskLevel").textContent = "Investigate unusual pattern";
  } else {
    statusEl.textContent = "Normal";
    statusEl.classList.add("risk-normal");
    qs("#riskLevel").textContent = "Low Risk";
  }
};

const renderExplainableAI = (anomalyList) => {
  const container = qs("#explainableContent");
  container.innerHTML = "";
  if (!anomalyList.length) {
    container.innerHTML = '<div class="explanation-placeholder"><p>No anomalies detected yet.</p></div>';
    return;
  }
  anomalyList.slice(-4).forEach((a, index) => {
    const el = document.createElement("div");
    el.className = "explanation-card";
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'all 0.5s ease';
    el.innerHTML = `
      <strong>${a.type === "spike" ? "Spike" : a.type === "drop" ? "Drop" : "Deviation"} on ${a.timestamp}</strong>
      <p>${a.reason}</p>
      <p>Baseline: ${a.baseline} kWh | Observed: ${a.user_consumption} kWh | Neighborhood diff: ${a.neighborhoodDiff}%</p>
    `;
    container.appendChild(el);
    
    // Animate in
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, index * 100);
  });
};

const renderTips = (data) => {
  const tips = AnomalyDetector.optimizationTips(data);
  const container = qs("#optimizationTips");
  container.innerHTML = "";
  tips.forEach((tip, index) => {
    const el = document.createElement("div");
    el.className = "tip-item";
    el.style.opacity = '0';
    el.style.transform = 'translateX(-20px)';
    el.style.transition = 'all 0.5s ease';
    el.innerHTML = `<div class="tip-icon">💡</div><div class="tip-content"><p>${tip}</p></div>`;
    container.appendChild(el);
    
    // Animate in with stagger
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    }, index * 150);
  });
};

const pushNotification = (message, risk) => {
  const now = new Date().toLocaleTimeString();
  const entry = { message, risk, time: now };
  state.notifications.unshift(entry);
  localStorage.setItem("energyGuardAdminNotifications", JSON.stringify(state.notifications.slice(0, 30)));
};

// Animated counter function
const animateCounter = (element, start, end, duration = 1000, suffix = '') => {
  const startTime = performance.now();
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = start + (end - start) * easeOutQuart;
    element.textContent = current.toFixed(2) + suffix;
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      element.textContent = end.toFixed(2) + suffix;
    }
  };
  requestAnimationFrame(animate);
};

const updateStats = (data, anomalyList) => {
  if (!data.length) return;
  const latest = data[data.length - 1];
  
  // Animate counters
  const currentEl = qs("#currentConsumption");
  const avgEl = qs("#neighbourhoodAvg");
  const anomalyEl = qs("#anomalyCount");
  
  const currentVal = parseFloat(currentEl.textContent) || 0;
  const avgVal = parseFloat(avgEl.textContent) || 0;
  const anomalyVal = parseInt(anomalyEl.textContent) || 0;
  
  animateCounter(currentEl, currentVal, latest.user_consumption, 800, '');
  animateCounter(avgEl, avgVal, latest.neighbourhood_average, 800, '');
  
  // Animate anomaly count
  const animateAnomaly = () => {
    const start = anomalyVal;
    const end = anomalyList.length;
    const duration = 600;
    const startTime = performance.now();
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(start + (end - start) * easeOutQuart);
      anomalyEl.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        anomalyEl.textContent = end;
      }
    };
    requestAnimationFrame(animate);
  };
  animateAnomaly();
  
  const worstRisk = anomalyList.some((a) => a.risk === "high")
    ? "high"
    : anomalyList.some((a) => a.risk === "suspicious")
    ? "suspicious"
    : "normal";
  setRiskDisplay(worstRisk);
};

const showAlert = (message) => {
  const banner = qs("#alertBanner");
  qs("#alertMessage").textContent = message;
  banner.classList.remove("hidden");
  
  // Add shake animation
  banner.style.animation = 'none';
  setTimeout(() => {
    banner.style.animation = 'slideInUp 0.5s ease-out, glow-pulse 2s ease-in-out infinite';
  }, 10);
  
  // Trigger browser notification if supported
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('EnergyGuard Alert', {
      body: message,
      icon: '⚡',
      badge: '⚡'
    });
  }
};

const closeAlert = () => {
  qs("#alertBanner").classList.add("hidden");
};
window.closeAlert = closeAlert;

const updateCharts = (data, ma) => {
  const labels = data.map((d) => d.timestamp);
  const usage = data.map((d) => d.user_consumption);
  const neighborhood = data.map((d) => d.neighbourhood_average);

  ChartUtils.updateChartData(consumptionChart, labels, [
    { label: "User Consumption (kWh)", data: usage, borderColor: "#3bc7ff", backgroundColor: "rgba(59,199,255,0.2)", tension: 0.35, fill: true },
    { label: "Moving Average", data: ma, borderColor: "#45f39a", backgroundColor: "rgba(69,243,154,0.15)", tension: 0.35, fill: true },
  ]);

  ChartUtils.updateChartData(comparisonChart, labels, [
    { label: "User Consumption", data: usage, backgroundColor: "rgba(59,199,255,0.7)" },
    { label: "Neighborhood Avg", data: neighborhood, backgroundColor: "rgba(69,243,154,0.7)" },
  ]);
};

const syncAdminData = (data, anomalyList) => {
  // Persist summary so the admin dashboard can consume it.
  const summary = {
    updatedAt: new Date().toISOString(),
    users: [
      {
        meter_id: data[0]?.meter_id || "user-001",
        current: data[data.length - 1]?.user_consumption || 0,
        neighborhood: data[data.length - 1]?.neighbourhood_average || 0,
        anomalies: anomalyList.length,
        risk:
          anomalyList.some((a) => a.risk === "high")
            ? "high"
            : anomalyList.some((a) => a.risk === "suspicious")
            ? "suspicious"
            : "normal",
        deviation:
          data[data.length - 1] && data[data.length - 1].neighbourhood_average
            ? ((data[data.length - 1].user_consumption - data[data.length - 1].neighbourhood_average) /
                data[data.length - 1].neighbourhood_average) *
              100
            : 0,
      },
    ],
  };
  localStorage.setItem("energyGuardAdminData", JSON.stringify(summary));
};

const handleData = (data) => {
  currentData = data;
  const ma = AnomalyDetector.movingAverage(data.map((d) => d.user_consumption));
  anomalies = AnomalyDetector.detectAnomalies(data);
  updateCharts(data, ma);
  renderExplainableAI(anomalies);
  renderTips(data);
  updateStats(data, anomalies);
  syncAdminData(data, anomalies);

  if (anomalies.length) {
    const latest = anomalies[anomalies.length - 1];
    showAlert(`Risk: ${latest.risk.toUpperCase()} — ${latest.reason}`);
    pushNotification(`User ${latest.meter_id} flagged: ${latest.reason}`, latest.risk);
  } else {
    closeAlert();
  }
};

const handleFile = (file) => {
  showLoading();
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const parsed = AnomalyDetector.parseCSV(text);
    if (!parsed.length) {
      qs("#uploadStatus").textContent = "No valid rows found. Check CSV format.";
      qs("#uploadStatus").classList.remove("hidden");
      hideLoading();
      return;
    }
    
    // Animate status update
    const statusEl = qs("#uploadStatus");
    statusEl.textContent = `Loading...`;
    statusEl.classList.remove("hidden");
    
    setTimeout(() => {
      statusEl.textContent = `✓ Loaded ${parsed.length} rows successfully!`;
      statusEl.style.color = 'var(--secondary)';
      hideLoading();
      handleData(parsed);
    }, 500);
  };
  reader.readAsText(file);
};

const initUpload = () => {
  const dropArea = qs("#uploadArea");
  const input = qs("#csvFileInput");

  dropArea.addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropArea.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropArea.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove("dragover");
    })
  );

  dropArea.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
};

// Request notification permission on load
const requestNotificationPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

// Add loading animation
const showLoading = () => {
  const uploadArea = qs("#uploadArea");
  uploadArea.style.opacity = '0.5';
  uploadArea.style.pointerEvents = 'none';
};

const hideLoading = () => {
  const uploadArea = qs("#uploadArea");
  uploadArea.style.opacity = '1';
  uploadArea.style.pointerEvents = 'auto';
};

// Create particle effects
const createParticles = () => {
  const particlesContainer = document.querySelector('.particles');
  if (!particlesContainer) return;
  
  const particleCount = 25;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 15 + 's';
    particle.style.animationDuration = (10 + Math.random() * 10) + 's';
    particlesContainer.appendChild(particle);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  initUpload();
  requestNotificationPermission();
  createParticles();
  
  // Add entrance animations to cards
  const cards = document.querySelectorAll('.glass-card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    setTimeout(() => {
      card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 100);
  });
});
