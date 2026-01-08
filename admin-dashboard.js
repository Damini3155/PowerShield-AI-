// Admin dashboard logic: aggregates user data and notifications from localStorage.

let riskDistributionChart;
let networkChart;

const qs = (sel) => document.querySelector(sel);

const riskBadge = (risk) => {
  if (risk === "high") return '<span class="badge badge-high">High Risk</span>';
  if (risk === "suspicious") return '<span class="badge badge-suspicious">Suspicious</span>';
  return '<span class="badge badge-normal">Normal</span>';
};

const loadAdminData = () => {
  const raw = localStorage.getItem("energyGuardAdminData");
  if (!raw) return { users: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { users: [] };
  }
};

const loadNotifications = () => {
  const raw = localStorage.getItem("energyGuardAdminNotifications");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

// Animated counter function
const animateCounter = (element, start, end, duration = 800) => {
  const startTime = performance.now();
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = Math.floor(start + (end - start) * easeOutQuart);
    element.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      element.textContent = end;
    }
  };
  requestAnimationFrame(animate);
};

const renderStats = (users) => {
  const total = users.length;
  const normal = users.filter((u) => u.risk === "normal").length;
  const suspicious = users.filter((u) => u.risk === "suspicious").length;
  const high = users.filter((u) => u.risk === "high").length;

  const totalEl = qs("#totalUsers");
  const normalEl = qs("#normalUsers");
  const suspiciousEl = qs("#suspiciousUsers");
  const highEl = qs("#highRiskUsers");

  const currentTotal = parseInt(totalEl.textContent) || 0;
  const currentNormal = parseInt(normalEl.textContent) || 0;
  const currentSuspicious = parseInt(suspiciousEl.textContent) || 0;
  const currentHigh = parseInt(highEl.textContent) || 0;

  animateCounter(totalEl, currentTotal, total, 600);
  setTimeout(() => animateCounter(normalEl, currentNormal, normal, 600), 100);
  setTimeout(() => animateCounter(suspiciousEl, currentSuspicious, suspicious, 600), 200);
  setTimeout(() => animateCounter(highEl, currentHigh, high, 600), 300);
};

const renderTable = (users) => {
  const body = qs("#usersTableBody");
  body.innerHTML = "";
  if (!users.length) {
    body.innerHTML = '<tr class="table-placeholder"><td colspan="7">No user data available.</td></tr>';
    return;
  }
  
  // Clear any existing animation delays
  body.querySelectorAll('tr').forEach(tr => {
    tr.style.animation = 'none';
  });
  users.forEach((u, index) => {
    const row = document.createElement("tr");
    row.style.opacity = '0';
    row.style.transform = 'translateX(-20px)';
    row.style.transition = 'all 0.5s ease';
    row.innerHTML = `
      <td>${u.meter_id}</td>
      <td>${u.current.toFixed(2)} kWh</td>
      <td>${u.neighborhood.toFixed(2)} kWh</td>
      <td>${u.deviation.toFixed(1)}%</td>
      <td>${riskBadge(u.risk)}</td>
      <td>${u.anomalies}</td>
      <td><button class="btn" style="padding:6px 10px;">Notify</button></td>
    `;
    body.appendChild(row);
    
    // Animate in with stagger
    setTimeout(() => {
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    }, index * 100);
  });
};

const renderCharts = (users) => {
  const labels = users.map((u) => u.meter_id);
  const riskCounts = [
    users.filter((u) => u.risk === "normal").length,
    users.filter((u) => u.risk === "suspicious").length,
    users.filter((u) => u.risk === "high").length,
  ];
  const consumption = users.map((u) => u.current);
  const neighborhood = users.map((u) => u.neighborhood);

  const riskCtx = document.getElementById("riskDistributionChart").getContext("2d");
  const netCtx = document.getElementById("networkChart").getContext("2d");

  if (!riskDistributionChart) {
    riskDistributionChart = new Chart(riskCtx, {
      type: "doughnut",
      data: {
        labels: ["Normal", "Suspicious", "High Risk"],
        datasets: [{ data: riskCounts, backgroundColor: ["#45f39a", "#f7b955", "#ff5f6d"] }],
      },
      options: { plugins: { legend: { labels: { color: "#e5ecff" } } } },
    });
  } else {
    riskDistributionChart.data.datasets[0].data = riskCounts;
    riskDistributionChart.update();
  }

  if (!networkChart) {
    networkChart = ChartUtils.createBarChart(netCtx, labels, [
      { label: "User Consumption", data: consumption, backgroundColor: "rgba(59,199,255,0.7)" },
      { label: "Neighborhood Avg", data: neighborhood, backgroundColor: "rgba(69,243,154,0.7)" },
    ]);
  } else {
    ChartUtils.updateChartData(networkChart, labels, [
      { label: "User Consumption", data: consumption, backgroundColor: "rgba(59,199,255,0.7)" },
      { label: "Neighborhood Avg", data: neighborhood, backgroundColor: "rgba(69,243,154,0.7)" },
    ]);
  }
};

const renderNotifications = (items) => {
  const container = qs("#adminNotifications");
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = '<div class="notification-placeholder"><p>No notifications yet.</p></div>';
    return;
  }
  items.slice(0, 6).forEach((n, index) => {
    const el = document.createElement("div");
    el.className = "notification-item";
    el.style.opacity = '0';
    el.style.transform = 'translateX(-20px)';
    el.style.transition = 'all 0.5s ease';
    el.innerHTML = `
      <div class="notification-icon">🔔</div>
      <div>
        <p>${n.message}</p>
        <span class="notification-time">${n.time || ""}</span>
      </div>
    `;
    container.appendChild(el);
    
    // Animate in with stagger
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    }, index * 100);
  });
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
  createParticles();
  
  const { users } = loadAdminData();
  renderStats(users);
  renderTable(users);
  renderCharts(users);
  const notifications = loadNotifications();
  renderNotifications(notifications);
  
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
  
  // Auto-refresh every 5 seconds
  setInterval(() => {
    const { users: updatedUsers } = loadAdminData();
    const updatedNotifications = loadNotifications();
    if (updatedUsers.length !== users.length || updatedNotifications.length !== notifications.length) {
      renderStats(updatedUsers);
      renderTable(updatedUsers);
      renderCharts(updatedUsers);
      renderNotifications(updatedNotifications);
    }
  }, 5000);
});
