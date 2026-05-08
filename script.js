const REFRESH_MS = 60_000;

function sparklinePath(values) {
  const width = 280;
  const height = 72;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function renderMetrics(marketData) {
  const grid = document.querySelector("#metricsGrid");
  grid.innerHTML = marketData
    .map(
      (item) => `
        <article class="metric-card" style="--accent: ${item.accent}">
          <div class="metric-top">
            <div>
              <p class="metric-label">${item.label}</p>
              <div class="metric-value">${item.value}</div>
              <span class="metric-change ${item.down ? "down" : ""}">${item.change}</span>
            </div>
            <div class="metric-icon">${item.icon}</div>
          </div>
          <svg class="sparkline" viewBox="0 0 280 72" preserveAspectRatio="none" aria-hidden="true">
            <path d="${sparklinePath(item.trend)}"></path>
          </svg>
          <p class="metric-foot">${item.detail}</p>
        </article>
      `,
    )
    .join("");
}

function renderSummary(summary, summaryPoints) {
  document.querySelector("#marketSummary").textContent = summary;
  document.querySelector("#summaryPoints").innerHTML = summaryPoints
    .map(
      ([title, text]) => `
        <div class="point">
          <strong>${title}</strong>
          <p>${text}</p>
        </div>
      `,
    )
    .join("");
}

function renderLoading() {
  document.querySelector("#metricsGrid").innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <article class="metric-card loading-card">
          <div class="metric-label">Loading live quote</div>
          <div class="metric-value">--</div>
          <p class="metric-foot">Waiting for market data API...</p>
        </article>
      `,
    )
    .join("");
}

function setStatus(text) {
  document.querySelector("#refreshStatus").lastChild.textContent = ` ${text}`;
}

async function refreshMarkets() {
  try {
    const response = await fetch("/api/markets", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Market API returned ${response.status}`);
    }

    const payload = await response.json();
    renderMetrics(payload.markets);
    renderSummary(payload.summary, payload.summaryPoints);
    setStatus(`Updated ${new Date(payload.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`);
  } catch (error) {
    setStatus("Data unavailable");
    document.querySelector("#marketSummary").textContent =
      "Live market data is temporarily unavailable. The dashboard will retry automatically every 60 seconds.";
    console.error(error);
  }
}

renderLoading();
refreshMarkets();
setInterval(refreshMarkets, REFRESH_MS);
