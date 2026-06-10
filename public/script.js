const REFRESH_MS = 60_000;
const NEWS_REFRESH_MS = 120_000;
const BRIEF_REFRESH_MS = 300_000;
const ALERT_REFRESH_MS = 60_000;
const API_CACHE_PREFIX = "macro-radar:api:";
const ANALYST_CACHE_KEY = "macro-radar:analyst:last";
const chartPeriods = {};
let latestMarkets = [];

function readCachedPayload(key) {
  try {
    const cached = localStorage.getItem(`${API_CACHE_PREFIX}${key}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function writeCachedPayload(key, payload) {
  try {
    localStorage.setItem(`${API_CACHE_PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private browsing; the live app should continue.
  }
}

async function fetchJsonWithSnapshot(url, cacheKey, options = {}) {
  try {
    const response = await fetch(url, { cache: "no-store", ...options });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `${url} returned ${response.status}`);
    }
    writeCachedPayload(cacheKey, payload);
    return { payload, fromCache: false };
  } catch (error) {
    const cached = readCachedPayload(cacheKey);
    if (cached) {
      return { payload: cached, fromCache: true, error };
    }
    throw error;
  }
}

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

function renderList(selector, items) {
  document.querySelector(selector).innerHTML = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function analystList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderAnalystLoading() {
  document.querySelector("#analystProvider").textContent = "Generating";
  document.querySelector("#analystStatus").textContent = "Reading live macro signals...";
  document.querySelector("#analystResult").className = "analyst-result empty loading-card";
  document.querySelector("#analystResult").innerHTML = `
    <div>
      <span class="result-kicker">Generating analysis</span>
      <strong>Combining market moves, regime data, and macro headlines.</strong>
    </div>
  `;
}

function renderAnalystError(message) {
  document.querySelector("#analystProvider").textContent = "Unavailable";
  document.querySelector("#analystStatus").textContent = "Analysis could not be generated.";
  document.querySelector("#analystResult").className = "analyst-result error";
  document.querySelector("#analystResult").innerHTML = `
    <div>
      <span class="result-kicker">Error</span>
      <strong>${escapeHtml(message)}</strong>
      <p>Try again after the live data refresh completes.</p>
    </div>
  `;
}

function renderAnalystResult(analysis) {
  document.querySelector("#analystProvider").textContent =
    analysis.provider === "openai" ? "OpenAI" : "Local model";
  document.querySelector("#analystStatus").textContent =
    "For educational and research purposes only. Not financial advice.";
  document.querySelector("#analystResult").className = "analyst-result";
  document.querySelector("#analystResult").innerHTML = `
    <div class="result-top">
      <article class="view-card">
        <span class="result-kicker">Overall View</span>
        <strong>${escapeHtml(analysis.overallView)}</strong>
        <p>${escapeHtml(analysis.explanation)}</p>
      </article>
      <article class="confidence-card">
        <span class="result-kicker">Confidence</span>
        <strong>${Number(analysis.confidence)}%</strong>
      </article>
    </div>
    <div class="result-grid">
      <article class="result-section">
        <h3>Key Drivers</h3>
        <ul>${analystList(analysis.keyDrivers)}</ul>
      </article>
      <article class="result-section">
        <h3>Bullish Factors</h3>
        <ul>${analystList(analysis.bullishFactors)}</ul>
      </article>
      <article class="result-section">
        <h3>Bearish Factors</h3>
        <ul>${analystList(analysis.bearishFactors)}</ul>
      </article>
      <article class="result-section">
        <h3>Watch Next</h3>
        <ul>${analystList(analysis.watchNext)}</ul>
      </article>
    </div>
    <article class="signals-card">
      <h3>Signals Used</h3>
      <ul>
        <li><span>Regime</span>${escapeHtml(analysis.signalsUsed.regime)}</li>
        <li><span>S&P 500</span>${escapeHtml(analysis.signalsUsed.spx)}</li>
        <li><span>Gold</span>${escapeHtml(analysis.signalsUsed.gold)}</li>
        <li><span>DXY</span>${escapeHtml(analysis.signalsUsed.dxy)}</li>
        <li><span>US10Y</span>${escapeHtml(analysis.signalsUsed.tenYear)}</li>
      </ul>
    </article>
  `;
}

async function generateAnalysis(question) {
  const submitButton = document.querySelector("#analystSubmit");
  submitButton.disabled = true;
  renderAnalystLoading();

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Analyze API returned ${response.status}`);
    }

    writeCachedPayload(ANALYST_CACHE_KEY, payload);
    renderAnalystResult(payload);
  } catch (error) {
    const cached = readCachedPayload(ANALYST_CACHE_KEY);
    if (cached) {
      renderAnalystResult(cached);
      document.querySelector("#analystStatus").textContent =
        "Offline snapshot shown. Reconnect to generate fresh analysis.";
      document.querySelector("#analystProvider").textContent = "Cached";
    } else {
      renderAnalystError(error.message);
    }
    console.error(error);
  } finally {
    submitButton.disabled = false;
  }
}

function renderBrief(brief) {
  document.querySelector("#briefStatus").textContent = `Saved ${brief.date}`;
  document.querySelector(
    "#briefRegime",
  ).textContent = `${brief.regime.label} / ${brief.regime.confidence}%`;
  document.querySelector("#briefTheme").textContent = brief.marketTheme;
  renderList("#briefRisks", brief.mainRisks);
  renderList("#briefDrivers", brief.keyDrivers);
  renderList("#briefWatching", brief.watchingNext);
  document.querySelector("#briefInterpretation").textContent = brief.actionableInterpretation;
}

function renderTimeline(payload) {
  document.querySelector("#timelineStatus").textContent = `${payload.count} saved`;
  const list = document.querySelector("#timelineList");

  if (!payload.items.length) {
    list.innerHTML = `
      <article class="timeline-empty">
        <strong>No historical briefs yet.</strong>
        <p>Daily briefs will appear here after they are generated and saved locally.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = payload.items
    .map(
      (item) => `
        <article class="timeline-item">
          <div class="timeline-date">
            <span>${escapeHtml(item.date)}</span>
            <strong>${escapeHtml(item.regime.label)}</strong>
            <em>${item.regime.confidence}%</em>
          </div>
          <div class="timeline-copy">
            <p>${escapeHtml(item.marketTheme)}</p>
            <div class="timeline-columns">
              <div>
                <span>Main Risks</span>
                <ul>${item.mainRisks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
              </div>
              <div>
                <span>Key Drivers</span>
                <ul>${item.keyDrivers.map((driver) => `<li>${escapeHtml(driver)}</li>`).join("")}</ul>
              </div>
            </div>
            <div class="timeline-interpretation">
              ${escapeHtml(item.actionableInterpretation)}
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAlerts(payload) {
  const alerts = payload.history.slice(0, 8);
  document.querySelector("#alertsStatus").textContent = `${payload.count} stored`;

  if (!alerts.length) {
    document.querySelector("#alertsList").innerHTML = `
      <article class="alert-empty">
        <strong>No macro alerts triggered.</strong>
        <p>The engine is monitoring gold, DXY, US10Y, regime changes, and risk sentiment.</p>
      </article>
    `;
    return;
  }

  document.querySelector("#alertsList").innerHTML = alerts
    .map((alert) => {
      const timestamp = new Date(alert.timestamp);
      const time = Number.isNaN(timestamp.getTime())
        ? "--:--"
        : timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `
        <article class="alert-item ${escapeHtml(alert.severity)}">
          <div class="alert-severity">${escapeHtml(alert.severity)}</div>
          <div class="alert-copy">
            <div>
              <h3>${escapeHtml(alert.title)}</h3>
              <time>${time}</time>
            </div>
            <p>${escapeHtml(alert.explanation)}</p>
          </div>
        </article>
      `;
    })
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

  document.querySelector("#briefStatus").textContent = "Loading";
  document.querySelector("#briefRegime").textContent = "--";
  document.querySelector("#briefTheme").textContent = "Generating today’s market theme...";
  renderList("#briefRisks", ["Waiting for risk signals"]);
  renderList("#briefDrivers", ["Waiting for asset moves"]);
  renderList("#briefWatching", ["Waiting for macro headlines"]);
  document.querySelector("#briefInterpretation").textContent = "Waiting for live macro data.";

  document.querySelector("#timelineStatus").textContent = "Loading";
  document.querySelector("#timelineList").innerHTML = `
    <article class="timeline-empty loading-card">
      <strong>Loading timeline...</strong>
      <p>Reading saved daily briefs.</p>
    </article>
  `;

  document.querySelector("#alertsStatus").textContent = "Loading";
  document.querySelector("#alertsList").innerHTML = `
    <article class="alert-empty loading-card">
      <strong>Loading alerts...</strong>
      <p>Checking current macro thresholds.</p>
    </article>
  `;
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
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/markets", "markets");
    renderMetrics(payload.markets);
    renderCharts(payload.markets);
    renderRegime(payload.regime);
    renderSummary(payload.summary, payload.summaryPoints, payload.summaryProvider);
    setStatus(`${fromCache ? "Offline snapshot" : "Updated"} ${new Date(payload.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`);
  } catch (error) {
    setStatus(latestMarkets.length ? "Offline snapshot" : "Data unavailable");
    if (!latestMarkets.length) {
      document.querySelector("#marketSummary").textContent =
        "Live market data is temporarily unavailable. The dashboard will retry automatically every 60 seconds.";
    }
    console.error(error);
  }
}

async function refreshNews() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/news", "news");
    renderNews(payload);
    if (fromCache) {
      document.querySelector("#newsStatus").textContent = "Offline snapshot";
    }
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

async function refreshBrief() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/brief", "brief");
    renderBrief(payload);
    if (fromCache) {
      document.querySelector("#briefStatus").textContent = "Offline snapshot";
    }
    refreshTimeline();
  } catch (error) {
    document.querySelector("#briefStatus").textContent = "Brief unavailable";
    document.querySelector("#briefTheme").textContent =
      "The daily brief could not be generated. The dashboard will retry automatically.";
    console.error(error);
  }
}

async function refreshTimeline() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/timeline", "timeline");
    renderTimeline(payload);
    if (fromCache) {
      document.querySelector("#timelineStatus").textContent = "Offline snapshot";
    }
  } catch (error) {
    document.querySelector("#timelineStatus").textContent = "Timeline unavailable";
    document.querySelector("#timelineList").innerHTML = `
      <article class="timeline-empty">
        <strong>Could not load historical briefs.</strong>
        <p>The dashboard will retry automatically.</p>
      </article>
    `;
    console.error(error);
  }
}

async function refreshAlerts() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/alerts", "alerts");
    renderAlerts(payload);
    if (fromCache) {
      document.querySelector("#alertsStatus").textContent = "Offline snapshot";
    }
  } catch (error) {
    document.querySelector("#alertsStatus").textContent = "Alerts unavailable";
    document.querySelector("#alertsList").innerHTML = `
      <article class="alert-empty">
        <strong>Could not load macro alerts.</strong>
        <p>The dashboard will retry automatically.</p>
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

document.querySelector("#analystForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const question = document.querySelector("#analystQuestion").value.trim();
  if (!question) {
    renderAnalystError("Enter a macro or market question first.");
    return;
  }

  generateAnalysis(question);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-example-prompt]");
  if (!button) return;

  document.querySelector("#analystQuestion").value = button.dataset.examplePrompt;
  document.querySelector("#analystQuestion").focus();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}

renderLoading();
renderNewsLoading();
refreshMarkets();
refreshNews();
refreshBrief();
refreshAlerts();
setInterval(refreshMarkets, REFRESH_MS);
setInterval(refreshNews, NEWS_REFRESH_MS);
setInterval(refreshBrief, BRIEF_REFRESH_MS);
setInterval(refreshTimeline, BRIEF_REFRESH_MS);
setInterval(refreshAlerts, ALERT_REFRESH_MS);
