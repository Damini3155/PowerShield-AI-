// Utility helpers for Chart.js charts

const ChartUtils = (() => {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#e5ecff" } },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: {
        ticks: { color: "#8fa4d4" },
        grid: { color: "rgba(255,255,255,0.04)" },
      },
      y: {
        ticks: { color: "#8fa4d4" },
        grid: { color: "rgba(255,255,255,0.04)" },
      },
    },
  };

  const createLineChart = (ctx, labels, datasets) => {
    return new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        ...defaultOptions,
        interaction: { mode: "index", intersect: false },
      },
    });
  };

  const createBarChart = (ctx, labels, datasets) => {
    return new Chart(ctx, {
      type: "bar",
      data: { labels, datasets },
      options: defaultOptions,
    });
  };

  const updateChartData = (chart, labels, datasets) => {
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.update();
  };

  return { createLineChart, createBarChart, updateChartData };
})();

window.ChartUtils = ChartUtils;
