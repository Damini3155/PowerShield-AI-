// Core anomaly detection utilities for EnergyGuard AI
// Provides moving average, standard deviation, threshold-based detection, and risk classification.

const AnomalyDetector = (() => {
  const MOVING_WINDOW = 5;
  const STD_MULTIPLIER = 2.2;
  const NEIGHBORHOOD_THRESHOLD = 0.25; // 25% deviation from neighborhood average considered suspicious

  const parseNumber = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  };

  const parseCSV = (text) => {
    const rows = text.trim().split(/\r?\n/);
    const header = rows[0].split(",").map((h) => h.trim().toLowerCase());
    const dataRows = header.length === 4 ? rows.slice(1) : rows; // fallback if header missing

    return dataRows
      .map((row) => row.split(",").map((c) => c.trim()))
      .filter((cols) => cols.length >= 4)
      .map(([timestamp, meter_id, user_consumption, neighbourhood_average]) => ({
        timestamp,
        meter_id,
        user_consumption: parseNumber(user_consumption),
        neighbourhood_average: parseNumber(neighbourhood_average),
      }));
  };

  const movingAverage = (arr, window = MOVING_WINDOW) => {
    const res = [];
    for (let i = 0; i < arr.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = arr.slice(start, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      res.push(avg);
    }
    return res;
  };

  const standardDeviation = (arr) => {
    if (!arr.length) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  };

  const classifyRisk = (point, baseline, std, neighborhoodDiff) => {
    const deviation = Math.abs(point - baseline);
    const zScore = std ? deviation / std : 0;
    if (zScore > 3 || neighborhoodDiff > 0.35) return "high";
    if (zScore > 2 || neighborhoodDiff > 0.25) return "suspicious";
    return "normal";
  };

  const detectAnomalies = (data) => {
    if (!data.length) return [];
    const usage = data.map((d) => d.user_consumption);
    const ma = movingAverage(usage, MOVING_WINDOW);
    const globalStd = standardDeviation(usage);
    const anomalies = [];

    data.forEach((row, idx) => {
      const baseline = ma[idx];
      const deviation = row.user_consumption - baseline;
      const neighborhoodDiff =
        row.neighbourhood_average > 0
          ? (row.user_consumption - row.neighbourhood_average) / row.neighbourhood_average
          : 0;
      const isSpike = deviation > STD_MULTIPLIER * globalStd;
      const isDrop = deviation < -STD_MULTIPLIER * globalStd;
      const exceedsNeighborhood = Math.abs(neighborhoodDiff) > NEIGHBORHOOD_THRESHOLD;

      if (isSpike || isDrop || exceedsNeighborhood) {
        const risk = classifyRisk(row.user_consumption, baseline, globalStd, Math.abs(neighborhoodDiff));
        anomalies.push({
          ...row,
          baseline: Number(baseline.toFixed(2)),
          deviation: Number(deviation.toFixed(2)),
          zScore: globalStd ? Number((Math.abs(deviation) / globalStd).toFixed(2)) : 0,
          neighborhoodDiff: Number((neighborhoodDiff * 100).toFixed(1)),
          type: isSpike ? "spike" : isDrop ? "drop" : "deviation",
          risk,
          reason: buildReason({ isSpike, isDrop, exceedsNeighborhood, neighborhoodDiff, deviation, globalStd, baseline: baseline.toFixed(2) }),
          index: idx,
        });
      }
    });

    return anomalies;
  };

  const buildReason = ({ isSpike, isDrop, exceedsNeighborhood, neighborhoodDiff, deviation, globalStd, baseline }) => {
    const parts = [];
    if (isSpike) parts.push(`usage spike of ${deviation.toFixed(2)} kWh above baseline ${baseline}`);
    if (isDrop) parts.push(`usage drop of ${Math.abs(deviation).toFixed(2)} kWh below baseline ${baseline}`);
    if (globalStd) parts.push(`deviation is ${(Math.abs(deviation) / globalStd).toFixed(2)}σ from norm`);
    if (exceedsNeighborhood) parts.push(`differs from neighborhood by ${(neighborhoodDiff * 100).toFixed(1)}%`);
    return parts.join("; ");
  };

  const optimizationTips = (data) => {
    if (!data.length) {
      return [
        "Upload consumption data to receive tailored optimization strategies.",
        "Consider scheduling high-load appliances during off-peak hours.",
      ];
    }
    const usage = data.map((d) => d.user_consumption);
    const avg = usage.reduce((a, b) => a + b, 0) / usage.length;
    const peak = Math.max(...usage);
    const tips = [
      `Average daily usage is ${avg.toFixed(2)} kWh. Keep it within ±10% to remain stable.`,
      `Peak recorded usage is ${peak.toFixed(2)} kWh. Shift non-critical loads away from peak windows.`,
      "Enable appliance-level monitoring to isolate abnormal draws (HVAC, heaters).",
      "Compare your usage with neighborhood averages; aim to stay within 10-15%.",
    ];
    if (peak > avg * 1.4) tips.push("Detected high peaks: consider smart plugs or timers for heavy appliances.");
    return tips;
  };

  return {
    parseCSV,
    movingAverage,
    standardDeviation,
    detectAnomalies,
    classifyRisk,
    optimizationTips,
  };
})();

// Expose globally
window.AnomalyDetector = AnomalyDetector;
