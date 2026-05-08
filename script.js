const REFRESH_MS = 60_000;
const NEWS_REFRESH_MS = 120_000;
const chartPeriods = {};
let latestMarkets = [];

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

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

function chartCoordinates(points, width = 520, height = 180) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = points.length > 1 ? width / (points.length - 1) : width;

  return points.map((point, index) => ({
    ...point,
    x: points.length > 1 ? index * xStep : width / 2,
    y: height - ((point.value - min) / range) * (height - 24) - 12,
  }));
}

function chartPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function renderCharts(marketData) {
  latestMarkets = marketData;
  const grid = document.querySelector("#chartsGrid");

  grid.innerHTML = marketData
    .map((item) => {
      const period = chartPeriods[item.id] || "1D";
      const points = item.charts?.[period] || [];
      if (!points.length) {
        return `
          <article class="chart-card" style="--accent: ${item.accent}" data-chart-id="${item.id}">
            <div class="chart-top">
              <div>
                <p class="metric-label">${escapeHtml(item.label)}</p>
                <div class="chart-value">${escapeHtml(item.value)}</div>
              </div>
            </div>
            <div class="chart-stage empty-chart">Chart data unavailable</div>
          </article>
        `;
      }
      const coordinates = chartCoordinates(points);
      const first = points.at(0)?.value;
      const last = points.at(-1)?.value;
      const change = Number.isFinite(first) && Number.isFinite(last) && first !== 0
        ? ((last - first) / first) * 100
        : 0;
      const activePoint = points.at(-1);

      return `
        <article class="chart-card" style="--accent: ${item.accent}" data-chart-id="${item.id}">
          <div class="chart-top">
            <div>
              <p class="metric-label">${escapeHtml(item.label)}</p>
              <div class="chart-value">${escapeHtml(activePoint?.display || item.value)}</div>
            </div>
            <div class="period-toggle" aria-label="${escapeHtml(item.label)} chart range">
              <button class="${period === "1D" ? "active" : ""}" data-chart-period="1D" type="button">1D</button>
              <button class="${period === "1W" ? "active" : ""}" data-chart-period="1W" type="button">1W</button>
            </div>
          </div>
          <div class="chart-stage">
            <svg class="asset-chart" viewBox="0 0 520 180" preserveAspectRatio="none" aria-hidden="true">
              <path class="chart-area" d="${chartPath([
                { ...coordinates[0], y: 180 },
                ...coordinates,
                { ...coordinates.at(-1), y: 180 },
              ])}"></path>
              <path class="chart-line" d="${chartPath(coordinates)}"></path>
              ${coordinates
                .map(
                  (point, index) => `
                    <circle
                      class="chart-point"
                      cx="${point.x.toFixed(1)}"
                      cy="${point.y.toFixed(1)}"
                      r="5"
                      tabindex="0"
                      data-point-index="${index}"
                    ></circle>
                  `,
                )
                .join("")}
            </svg>
          </div>
          <div class="chart-readout" data-chart-readout>
            <span>${escapeHtml(activePoint?.label || period)}</span>
            <strong>${escapeHtml(activePoint?.display || "--")}</strong>
            <em class="${change < 0 ? "down" : ""}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</em>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateChartReadout(card, pointIndex) {
  const market = latestMarkets.find((item) => item.id === card.dataset.chartId);
  if (!market) return;

  const period = chartPeriods[market.id] || "1D";
  const point = market.charts?.[period]?.[pointIndex];
  if (!point) return;

  const readout = card.querySelector("[data-chart-readout]");
  readout.innerHTML = `
    <span>${escapeHtml(point.label)}</span>
    <strong>${escapeHtml(point.display)}</strong>
    <em>${period}</em>
  `;
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

function renderSummary(summary, summaryPoints, provider) {
  document.querySelector("#marketSummary").textContent = summary;
  document.querySelector("#summaryTag").textContent =
    provider === "openai" ? "OpenAI" : "Generated";
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

function renderRegime(regime) {
  if (!regime) return;

  document.querySelector("#regimeLabel").textContent = regime.label;
  document.querySelector("#regimeConfidence").textContent = `${regime.confidence}% confidence`;
  document.querySelector("#regimeExplanation").textContent = regime.explanation;
  document.querySelector("#regimeInputs").innerHTML = [
    ["S&P 500", regime.inputs.spxMove],
    ["DXY", regime.inputs.dxyMove],
    ["Gold", regime.inputs.goldMove],
    ["US10Y", regime.inputs.tenYearMove],
  ]
    .map(
      ([label, value]) => `
        <div class="regime-input">
          <span>${label}</span>
          <strong>${escapeHtml(value)}</strong>
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

  document.querySelector("#chartsGrid").innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <article class="chart-card loading-card">
          <div class="metric-label">Loading chart</div>
          <div class="chart-value">--</div>
          <div class="chart-stage empty-chart">Waiting for history...</div>
        </article>
      `,
    )
    .join("");

  document.querySelector("#regimeLabel").textContent = "Calculating...";
  document.querySelector("#regimeConfidence").textContent = "-- confidence";
  document.querySelector("#regimeExplanation").textContent = "Waiting for live macro signals.";
  document.querySelector("#regimeInputs").innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <div class="regime-input loading-card">
          <span>Signal</span>
          <strong>--</strong>
        </div>
      `,
    )
    .join("");
}

function renderNewsLoading() {
  document.querySelector("#topicStrip").innerHTML = [
    "Federal Reserve",
    "Inflation",
    "Gold",
    "Treasury yields",
    "US dollar",
    "S&P 500",
  ]
    .map((topic) => `<span>${topic}</span>`)
    .join("");

  document.querySelector("#newsList").innerHTML = Array.from({ length: 5 })
    .map(
      () => `
        <article class="news-item loading-news">
          <span class="news-time">--:--</span>
          <div>
            <h3>Loading macro headline...</h3>
            <p>Fetching live news feed</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderNews(payload) {
  document.querySelector("#topicStrip").innerHTML = payload.queryTopics
    .map((topic) => `<span>${escapeHtml(topic)}</span>`)
    .join("");

  document.querySelector("#newsList").innerHTML = payload.headlines
    .map((item) => {
      const published = new Date(item.publishedAt);
      const time = Number.isNaN(published.getTime())
        ? "--:--"
        : published.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const topics = item.topics
        .map((topic) => `<span class="news-topic">${escapeHtml(topic)}</span>`)
        .join("");

      return `
        <article class="news-item">
          <span class="news-time">${time}</span>
          <div class="news-copy">
            <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">
              ${escapeHtml(item.title)}
            </a>
            <div class="news-source">
              <span>${escapeHtml(item.source)}</span>
              <div>${topics}</div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelector("#newsStatus").textContent = `Updated ${new Date(
    payload.updatedAt,
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
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
    renderCharts(payload.markets);
    renderRegime(payload.regime);
    renderSummary(payload.summary, payload.summaryPoints, payload.summaryProvider);
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

async function refreshNews() {
  try {
    const response = await fetch("/api/news", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`News API returned ${response.status}`);
    }

    renderNews(await response.json());
  } catch (error) {
    document.querySelector("#newsStatus").textContent = "News unavailable";
    document.querySelector("#newsList").innerHTML = `
      <article class="news-item">
        <span class="news-time">--:--</span>
        <div class="news-copy">
          <h3>Live macro news is temporarily unavailable.</h3>
          <p>The feed will retry automatically.</p>
        </div>
      </article>
    `;
    console.error(error);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-period]");
  if (!button) return;

  const card = button.closest("[data-chart-id]");
  if (!card) return;

  chartPeriods[card.dataset.chartId] = button.dataset.chartPeriod;
  renderCharts(latestMarkets);
});

document.addEventListener("mouseover", (event) => {
  const point = event.target.closest("[data-point-index]");
  const card = event.target.closest("[data-chart-id]");
  if (!point || !card) return;

  updateChartReadout(card, Number(point.dataset.pointIndex));
});

document.addEventListener("focusin", (event) => {
  const point = event.target.closest("[data-point-index]");
  const card = event.target.closest("[data-chart-id]");
  if (!point || !card) return;

  updateChartReadout(card, Number(point.dataset.pointIndex));
});

renderLoading();
renderNewsLoading();
refreshMarkets();
refreshNews();
setInterval(refreshMarkets, REFRESH_MS);
setInterval(refreshNews, NEWS_REFRESH_MS);
