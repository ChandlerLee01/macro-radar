const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

loadEnvFile();

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC_ROOT = path.join(ROOT, "public");
const DATA_ROOT =
  process.env.DATA_DIR || (process.env.VERCEL ? path.join("/tmp", "macro-radar") : ROOT);
const BRIEFS_DIR = path.join(DATA_ROOT, "briefs");
const ALERTS_DIR = path.join(DATA_ROOT, "alerts");
const ALERTS_FILE = path.join(ALERTS_DIR, "history.json");
const ALERT_STATE_FILE = path.join(ALERTS_DIR, "state.json");
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const STOOQ_URL =
  "https://stooq.com/q/l/?s=xauusd+%5Espx+dx.f&f=sd2t2ohlcv&h&e=csv";
const STOOQ_HISTORY_URLS = {
  gold: "https://stooq.com/q/d/l/?s=xauusd&i=d",
  spx: "https://stooq.com/q/d/l/?s=%5Espx&i=d",
  dxy: "https://stooq.com/q/d/l/?s=dx.f&i=d",
};
const ALPHA_VANTAGE_SYMBOLS = {
  gold: "GLD",
  spx: "SPY",
  dxy: "UUP",
};
const YAHOO_SYMBOLS = {
  gold: "GC=F",
  spx: "^GSPC",
  dxy: "DX-Y.NYB",
  tenYear: "^TNX",
};
const WATCHLIST_YAHOO_SYMBOLS = {
  SPX: { symbol: "^GSPC", label: "S&P 500", formatter: "index" },
  NASDAQ: { symbol: "QQQ", label: "NASDAQ", formatter: "currency" },
  BTC: { symbol: "BTC-USD", label: "Bitcoin", formatter: "currency" },
  ETH: { symbol: "ETH-USD", label: "Ethereum", formatter: "currency" },
  Gold: { symbol: "GC=F", label: "Gold", formatter: "currency" },
  Silver: { symbol: "SI=F", label: "Silver", formatter: "currency" },
  DXY: { symbol: "DX-Y.NYB", label: "US Dollar Index", formatter: "index" },
  EURUSD: { symbol: "EURUSD=X", label: "EUR/USD", formatter: "fx4" },
  USDJPY: { symbol: "JPY=X", label: "USD/JPY", formatter: "fx2" },
  WTI: { symbol: "CL=F", label: "WTI Crude", formatter: "currency" },
};
const TREASURY_URL = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${new Date().getFullYear()}`;
const NEWS_TOPICS = [
  "Federal Reserve",
  "Inflation",
  "Gold",
  "Treasury yields",
  "US dollar",
  "S&P 500",
];
const NEWS_FEEDS = [
  ["Federal Reserve", '"Federal Reserve" OR Fed OR FOMC OR Powell'],
  ["Inflation", 'inflation OR CPI OR PCE OR "consumer prices"'],
  ["Gold", '"gold prices" OR "spot gold" OR bullion OR "gold futures"'],
  ["Treasury Yields", '"Treasury yields" OR "10-year Treasury" OR "bond yields"'],
  ["US Dollar", '"US dollar" OR DXY OR greenback'],
  ["S&P 500", '"S&P 500" OR "S&P futures" OR "US stocks"'],
].map(([topic, query]) => [
  topic,
  `https://news.google.com/rss/search?q=${encodeURIComponent(
    `(${query}) (markets OR economy OR rates OR stocks OR futures OR investors) when:1d`,
  )}&hl=en-US&gl=US&ceid=US:en`,
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
};
const staticFiles = new Set([
  "/index.html",
  "/styles.css",
  "/script.js",
  "/manifest.json",
  "/sw.js",
  "/icon.svg",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]);

let cache = null;
let cacheTime = 0;
let newsCache = null;
let newsCacheTime = 0;
let briefCache = null;
let briefCacheTime = 0;
let marketFetchPromise = null;
let newsFetchPromise = null;
let openAiDisabled = false;

function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, ".env");
    const envText = require("node:fs").readFileSync(envPath, "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // A .env file is optional; production can provide environment variables directly.
  }
}

function parseCsv(csv) {
  if (!csv || !csv.includes(",")) return [];
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((row) =>
    row.split(",").reduce((record, value, index) => {
      record[keys[index]] = value;
      return record;
    }, {}),
  );
}

function looksBlockedHtml(text = "") {
  return /<html|<!doctype|requires javascript|__verify|page you requested does not exist|has been moved/i.test(
    text,
  );
}

function validateStooqQuotes(csv) {
  if (!csv || looksBlockedHtml(csv)) {
    throw new Error("Stooq returned a blocked or non-CSV response");
  }

  const rows = parseCsv(csv);
  const quotes = Object.fromEntries(rows.map((row) => [String(row.Symbol || "").toUpperCase(), row]));
  const required = ["XAUUSD", "^SPX", "DX.F"];
  const missing = required.filter((symbol) => {
    const row = quotes[symbol];
    return !row || !Number.isFinite(num(row.Open)) || !Number.isFinite(num(row.Close));
  });

  if (missing.length) {
    throw new Error(`Stooq CSV missing required quotes: ${missing.join(", ")}`);
  }

  return quotes;
}

function validateTreasuryEntries(xml) {
  if (!xml || looksBlockedHtml(xml)) {
    throw new Error("Treasury returned a blocked or non-XML response");
  }

  const entries = parseTreasuryXml(xml);
  if (entries.length < 2) {
    throw new Error("Treasury returned incomplete yield data");
  }

  return entries;
}

async function fetchText(url, label, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  return response.text();
}

async function fetchOptionalText(url, label, options = {}) {
  try {
    return await fetchText(url, label, options);
  } catch (error) {
    console.error(`${label} unavailable: ${error.message}`);
    return "";
  }
}

function num(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (value === ".") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pctChange(close, open) {
  if (!close || !open) return null;
  return ((close - open) / open) * 100;
}

function marketTrend(row) {
  const open = num(row.Open);
  const high = num(row.High);
  const low = num(row.Low);
  const close = num(row.Close);
  return [open, low, (open + close) / 2, high, close].filter(Number.isFinite);
}

function intradayChart(row, formatter) {
  const open = num(row.Open);
  const high = num(row.High);
  const low = num(row.Low);
  const close = num(row.Close);
  const mid = Number.isFinite(open) && Number.isFinite(close) ? (open + close) / 2 : null;
  const points = [
    ["Open", open],
    ["Low", low],
    ["Mid", mid],
    ["High", high],
    ["Last", close],
  ];

  return points
    .filter(([, value]) => Number.isFinite(value))
    .map(([label, value]) => ({
      label,
      value,
      display: formatter(value),
    }));
}

function stooqWeeklyChart(rows, formatter) {
  return rows
    .filter((row) => row.Date && Number.isFinite(num(row.Close)))
    .slice(-7)
    .map((row) => {
      const value = num(row.Close);
      return {
        label: row.Date.slice(5),
        value,
        display: formatter(value),
      };
    });
}

function fallbackWeeklyChart(row, formatter) {
  const open = num(row.Open);
  const high = num(row.High);
  const low = num(row.Low);
  const close = num(row.Close);
  const mid = Number.isFinite(open) && Number.isFinite(close) ? (open + close) / 2 : close;
  const range = Number.isFinite(high) && Number.isFinite(low) ? high - low : 0;
  const points = [
    open,
    mid - range * 0.18,
    mid + range * 0.1,
    low,
    mid + range * 0.2,
    high,
    close,
  ].filter(Number.isFinite);

  return points.map((value, index) => ({
    label: index === points.length - 1 ? "Last" : `D-${points.length - index - 1}`,
    value,
    display: formatter(value),
  }));
}

function weeklyChart(rows, row, formatter) {
  const history = stooqWeeklyChart(rows, formatter);
  return history.length ? history : fallbackWeeklyChart(row, formatter);
}

function treasuryWeeklyChart(entries) {
  return entries.slice(-7).map((entry) => ({
    label: entry.date.slice(5),
    value: entry.tenYear,
    display: `${entry.tenYear.toFixed(2)}%`,
  }));
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function indexValue(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function changeText(change, suffix = "%") {
  if (change === null) return "N/A";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}${suffix}`;
}

function formatPct(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatBps(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${Math.round(value)} bps`;
}

function formatWatchlistValue(value, formatter) {
  if (!Number.isFinite(value)) return "N/A";
  if (formatter === "yield") return `${(value / 10).toFixed(2)}%`;
  if (formatter === "fx4") return value.toFixed(4);
  if (formatter === "fx2") return value.toFixed(2);
  if (formatter === "currency") return currency(value);
  return indexValue(value);
}

function sourceTime(row) {
  return `${row.Date} ${row.Time}`.trim();
}

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseTreasuryXml(xml) {
  const entries = [...xml.matchAll(/<entry>[\s\S]*?<\/entry>/g)].map(([entry]) => {
    const date = entry.match(/<d:NEW_DATE[^>]*>([^<]+)/)?.[1]?.slice(0, 10);
    const tenYear = num(entry.match(/<d:BC_10YEAR[^>]*>([^<]+)/)?.[1]);
    return { date, tenYear };
  });

  return entries
    .filter((entry) => entry.date && Number.isFinite(entry.tenYear))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function signal(value, positiveThreshold, negativeThreshold = -positiveThreshold) {
  if (!Number.isFinite(value)) return 0;
  if (value >= positiveThreshold) return 1;
  if (value <= negativeThreshold) return -1;
  return value / positiveThreshold;
}

function positivePart(value) {
  return Math.max(0, value);
}

function negativePart(value) {
  return Math.max(0, -value);
}

function buildMarketRegime({ spxMove, dxyMove, goldMove, tenYearBps }) {
  const equity = signal(spxMove, 0.35);
  const dollar = signal(dxyMove, 0.15);
  const gold = signal(goldMove, 0.35);
  const rates = signal(tenYearBps, 5);
  const scores = [
    {
      label: "Risk On",
      score:
        positivePart(equity) * 3 +
        negativePart(dollar) * 1.4 +
        negativePart(gold) * 1 +
        Math.max(0, 1 - Math.abs(rates)) * 0.8,
    },
    {
      label: "Risk Off",
      score:
        negativePart(equity) * 3 +
        positivePart(dollar) * 1.5 +
        positivePart(gold) * 1.2 +
        negativePart(rates) * 0.8,
    },
    {
      label: "Inflation Fear",
      score:
        positivePart(gold) * 2.4 +
        positivePart(rates) * 2.3 +
        positivePart(dollar) * 0.9 +
        negativePart(equity) * 0.8,
    },
    {
      label: "Growth Optimism",
      score:
        positivePart(equity) * 2.6 +
        positivePart(rates) * 1.2 +
        negativePart(gold) * 1 +
        Math.max(0, 1 - Math.abs(dollar)) * 0.8,
    },
    {
      label: "Defensive Positioning",
      score:
        positivePart(gold) * 2.2 +
        positivePart(dollar) * 1.7 +
        negativePart(equity) * 1.2 +
        Math.max(0, 1 - positivePart(rates)) * 0.8,
    },
    {
      label: "Rate Shock",
      score:
        positivePart(rates) * 3 +
        negativePart(equity) * 2 +
        positivePart(dollar) * 1.1 +
        negativePart(gold) * 0.7,
    },
  ].sort((a, b) => b.score - a.score);

  const winner = scores[0];
  const runnerUp = scores[1];
  const strength = Math.min(1, winner.score / 6);
  const separation = Math.min(1, (winner.score - runnerUp.score) / 2);
  const confidence = Math.round(
    Math.min(94, Math.max(45, 45 + strength * 28 + separation * 24)),
  );
  const explanation = `${winner.label} leads because the S&P 500 is ${formatPct(
    spxMove,
  )}, DXY is ${formatPct(dxyMove)}, gold is ${formatPct(
    goldMove,
  )}, and the US 10Y yield is ${formatBps(tenYearBps)}.`;

  return {
    label: winner.label,
    confidence,
    explanation,
    inputs: {
      spxMove: formatPct(spxMove),
      dxyMove: formatPct(dxyMove),
      goldMove: formatPct(goldMove),
      tenYearMove: formatBps(tenYearBps),
    },
    scores: scores.map((item) => ({
      label: item.label,
      score: Number(item.score.toFixed(2)),
    })),
  };
}

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripTags(value = "") {
  return decodeXml(value).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function textBetween(xml, tag) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
}

function extractNewsTopics(title) {
  const normalized = title.toLowerCase();
  const topics = [
    ["Federal Reserve", /\bfed\b|federal reserve|fomc|powell/],
    ["Inflation", /inflation|cpi|pce|consumer prices|price pressures/],
    ["Gold", /\bgold\b|gold price|gold prices|spot gold|gold futures|bullion|xau/],
    ["Treasury Yields", /treasury|yield|yields|10-year|10 year/],
    ["US Dollar", /us dollar|u\.s\. dollar|\bdollar\b|dxy|greenback/],
    ["S&P 500", /s&p 500|sp 500|s & p 500|stocks|equities/],
  ];

  return topics
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([label]) => label)
    .slice(0, 3);
}

function isMacroHeadline(item) {
  const headline = `${item.title} ${item.source}`.toLowerCase();
  const reject =
    /sports|hockey|baseball|brewers|panthers|hiker|scabbard|archaeology|princetonian|grade inflation/.test(
      headline,
    );
  const macroContext =
    /market|markets|economy|economic|stocks|equities|futures|rates|yield|yields|treasury|central bank|fed|federal reserve|inflation|cpi|pce|dollar|dxy|gold price|spot gold|bullion|s&p 500|wall street|investors|traders|borrowing costs/.test(
      headline,
    );

  return !reject && macroContext && item.topics.length;
}

function parseNewsRss(xml, feedTopic) {
  return [...xml.matchAll(/<item>[\s\S]*?<\/item>/gi)]
    .map(([item]) => {
      const title = stripTags(textBetween(item, "title"));
      const source = stripTags(textBetween(item, "source")) || "Market news";
      const link = decodeXml(textBetween(item, "link"));
      const published = new Date(stripTags(textBetween(item, "pubDate")));
      const extractedTopics = extractNewsTopics(title);
      const topics = extractedTopics.length ? extractedTopics : [feedTopic];

      return {
        title,
        source,
        link,
        publishedAt: Number.isNaN(published.getTime())
          ? new Date().toISOString()
          : published.toISOString(),
        topics,
      };
    })
    .filter((item) => item.title && item.link && isMacroHeadline(item))
    .slice(0, 3);
}

function buildFallbackNews(reason) {
  const now = new Date().toISOString();
  const topics = NEWS_TOPICS;
  const headlines = [
    {
      title: "Markets weigh Federal Reserve path, inflation data, and Treasury yield moves",
      source: "Macro Radar fallback",
      link: "https://news.google.com/search?q=Federal%20Reserve%20inflation%20Treasury%20yields%20markets",
      publishedAt: now,
      topics: ["Federal Reserve", "Inflation", "Treasury Yields"],
    },
    {
      title: "Dollar and gold remain key cross-asset signals as investors monitor risk appetite",
      source: "Macro Radar fallback",
      link: "https://news.google.com/search?q=US%20dollar%20gold%20markets%20risk%20appetite",
      publishedAt: now,
      topics: ["US Dollar", "Gold"],
    },
    {
      title: "S&P 500 traders watch rates and macro headlines for confirmation of market regime",
      source: "Macro Radar fallback",
      link: "https://news.google.com/search?q=S%26P%20500%20Treasury%20yields%20macro%20headlines",
      publishedAt: now,
      topics: ["S&P 500", "Treasury Yields"],
    },
  ];

  return {
    updatedAt: now,
    queryTopics: topics,
    headlines,
    source: "Local degraded news fallback",
    degraded: true,
    error: reason,
  };
}

function buildSummary(markets) {
  const byId = Object.fromEntries(markets.map((market) => [market.id, market]));
  const equityTone = byId.spx.rawChange >= 0 ? "constructive" : "cautious";
  const dollarTone = byId.dxy.rawChange >= 0 ? "firmer" : "softer";
  const ratesTone = byId.tenYear.rawChange >= 0 ? "higher" : "lower";
  const goldTone = byId.gold.rawChange >= 0 ? "bid" : "softer";

  return {
    summary: `The live macro tape looks ${equityTone}: the S&P 500 is ${byId.spx.change.toLowerCase()} from its open while the dollar is ${dollarTone}. Gold is ${goldTone}, showing hedge demand remains relevant, and the 10-year Treasury yield is ${ratesTone} versus the prior Treasury fixing. The mix points to a market still balancing risk appetite against rate sensitivity.`,
    summaryPoints: [
      ["Tone", byId.spx.rawChange >= 0 ? "Risk appetite is positive." : "Risk appetite is under pressure."],
      ["Dollar", `DXY is ${byId.dxy.value}, ${byId.dxy.change.toLowerCase()} intraday.`],
      ["Rates", `The 10Y yield is ${byId.tenYear.value}, ${byId.tenYear.change.toLowerCase()}.`],
    ],
  };
}

function extractResponseText(payload) {
  if (payload.output_text) return payload.output_text;

  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
    .trim();
}

function parseSummaryJson(text) {
  const clean = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(clean);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeQuestion(question) {
  return String(question || "").replace(/\s+/g, " ").trim().slice(0, 600);
}

function normalizeAnalystResponse(question, generated, context, provider) {
  const views = new Set(["Bullish", "Neutral", "Bearish", "Mixed"]);
  const watchItems = generated.watchNext || generated.watchingNext;
  const list = (items, fallback) =>
    (Array.isArray(items) ? items : fallback)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 5);

  return {
    question,
    overallView: views.has(generated.overallView) ? generated.overallView : "Mixed",
    confidence: clamp(Math.round(Number(generated.confidence) || context.regime.confidence), 0, 100),
    keyDrivers: list(generated.keyDrivers, context.defaultDrivers),
    bullishFactors: list(generated.bullishFactors, context.defaultBullish),
    bearishFactors: list(generated.bearishFactors, context.defaultBearish),
    watchNext: list(watchItems, context.defaultWatchNext),
    explanation:
      typeof generated.explanation === "string" && generated.explanation.trim()
        ? generated.explanation.trim()
        : context.defaultExplanation,
    signalsUsed: {
      regime: context.signalsUsed.regime,
      spx: context.signalsUsed.spx,
      gold: context.signalsUsed.gold,
      dxy: context.signalsUsed.dxy,
      tenYear: context.signalsUsed.tenYear,
    },
    provider,
  };
}

function buildAnalystContext(marketsPayload, newsPayload, dailyBriefPayload = null, alertsPayload = null) {
  const markets = marketsPayload.markets;
  const regime = marketsPayload.regime;
  const gold = marketById(markets, "gold");
  const spx = marketById(markets, "spx");
  const dxy = marketById(markets, "dxy");
  const tenYear = marketById(markets, "tenYear");
  const topHeadlines = newsPayload.headlines.slice(0, 6);
  const headlineTopics = [
    ...new Set(topHeadlines.flatMap((headline) => headline.topics || [])),
  ].slice(0, 6);
  const alertHistory = alertsPayload?.history || [];
  const activeAlerts = alertsPayload?.active || [];
  const recentAlerts = [...activeAlerts, ...alertHistory]
    .filter(Boolean)
    .slice(0, 5)
    .map((alert) => ({
      title: alert.title,
      explanation: alert.explanation,
      severity: alert.severity,
      type: alert.type,
      timestamp: alert.timestamp,
    }));
  const dailyBrief = dailyBriefPayload
    ? {
        marketTheme: dailyBriefPayload.marketTheme,
        mainRisks: dailyBriefPayload.mainRisks || [],
        keyDrivers: dailyBriefPayload.keyDrivers || [],
        watchingNext: dailyBriefPayload.watchingNext || [],
        actionableInterpretation: dailyBriefPayload.actionableInterpretation,
        summaryLine: dailyBriefPayload.summaryLine,
      }
    : marketsPayload.aiDailyBrief || null;

  const defaultDrivers = [
    `Regime engine: ${regime.label} at ${regime.confidence}% confidence`,
    `S&P 500: ${spx.change} at ${spx.value}`,
    `DXY: ${dxy.change} at ${dxy.value}`,
    `Gold: ${gold.change} at ${gold.value}`,
    `US10Y: ${tenYear.change} to ${tenYear.value}`,
    dailyBrief?.summaryLine ? `Daily brief: ${dailyBrief.summaryLine}` : null,
    recentAlerts[0] ? `Latest alert: ${recentAlerts[0].title}` : null,
  ].filter(Boolean);
  const defaultBullish = [
    spx.rawChange >= 0
      ? `The S&P 500 is holding a constructive tone at ${spx.value}, suggesting risk appetite has not broken despite the macro cross-currents.`
      : null,
    dxy.rawChange < 0
      ? `A softer dollar at ${dxy.value} can ease financial conditions at the margin and reduce one headwind for global risk sentiment.`
      : null,
    tenYear.rawChange <= 0
      ? `A stable-to-lower US10Y at ${tenYear.value} reduces the immediate valuation pressure from rates and helps the tape look less fragile.`
      : null,
    gold.rawChange >= 0
      ? `${gold.label} remains supported at ${gold.value}, which keeps hedge demand visible in the macro read.`
      : null,
    ["Risk On", "Growth Optimism"].includes(regime.label)
      ? `The ${regime.label} regime keeps the cross-asset backdrop tilted toward a more constructive interpretation.`
      : null,
  ].filter(Boolean);
  const defaultBearish = [
    spx.rawChange < 0
      ? `Equity softness in the S&P 500 points to a more fragile risk backdrop and limits conviction in a clean bullish macro read.`
      : null,
    dxy.rawChange > 0
      ? `Dollar strength at ${dxy.value} can tighten global liquidity conditions and complicate the read for risk assets and commodities.`
      : null,
    tenYear.rawChange > 0
      ? `A higher US10Y at ${tenYear.value} raises the opportunity cost for non-yielding assets and keeps duration sensitivity in focus.`
      : null,
    gold.rawChange < 0
      ? `${gold.label} is not confirming broad safe-haven demand yet, which makes the near-term gold signal less one-sided.`
      : null,
    gold.rawChange > 0.35
      ? `Firm gold also carries a cautionary message: investors may still be paying for macro hedges rather than simply expressing growth optimism.`
      : null,
    recentAlerts.some((alert) => alert.severity === "high")
      ? "High-severity macro alerts keep the risk distribution wider than the headline market move alone would imply."
      : null,
    ["Risk Off", "Defensive Positioning", "Rate Shock", "Inflation Fear"].includes(regime.label)
      ? `The ${regime.label} regime keeps macro risk elevated and argues for waiting on confirmation from rates, dollar, and headline flow.`
      : null,
  ].filter(Boolean);

  return {
    markets,
    regime,
    headlineTopics,
    headlines: topHeadlines.map((headline) => ({
      title: headline.title,
      source: headline.source,
      topics: headline.topics,
    })),
    dailyBrief,
    alerts: recentAlerts,
    signalsUsed: {
      regime: `${regime.label} (${regime.confidence}% confidence)`,
      spx: `${spx.change} at ${spx.value}`,
      gold: `${gold.change} at ${gold.value}`,
      dxy: `${dxy.change} at ${dxy.value}`,
      tenYear: `${tenYear.change} to ${tenYear.value}`,
    },
    rawSignals: {
      spxMove: spx.rawChange,
      goldMove: gold.rawChange,
      dxyMove: dxy.rawChange,
      tenYearMove: tenYear.rawChange,
    },
    defaultDrivers,
    defaultBullish: [
      ...defaultBullish,
      "The constructive case would improve if rates stabilize, the dollar softens, and equity breadth confirms the current risk tone.",
      "A calmer headline tape would make the current market regime easier to interpret as a macro stabilization signal rather than a short-lived bounce.",
    ].slice(0, 4),
    defaultBearish: [
      ...defaultBearish,
      "The main caution is that the signal mix is not yet strong enough to support a high-conviction directional read.",
      "Headline sensitivity remains important because regime confidence can shift quickly when rates, dollar, and gold move together.",
    ].slice(0, 4),
    defaultWatchNext: [
      ...(dailyBrief?.watchingNext || []),
      "Whether Treasury yields extend or fade the latest move",
      "Dollar follow-through as a cross-asset liquidity signal",
      "Gold confirmation of hedge demand",
      "Fed, inflation, and growth headlines in the next news cycle",
    ].slice(0, 5),
    defaultExplanation: `${regime.label} is the current macro regime, so the market read is less about one asset move and more about whether the cross-asset mix is confirming the same story. S&P 500 ${spx.change} sets the risk tone, while DXY ${dxy.change}, ${gold.label} ${gold.change}, and US10Y ${tenYear.change} define the liquidity, hedge-demand, and rates backdrop. The research takeaway is conditional: conviction improves only if those signals line up with the daily brief, alerts, and headlines around ${headlineTopics.join(", ") || "macro policy and market pricing"}.`,
  };
}

function inferQuestionAsset(question) {
  const normalized = question.toLowerCase();
  if (/gold|xau|bullion/.test(normalized)) return "gold";
  if (/dollar|dxy|greenback/.test(normalized)) return "dollar";
  if (/yield|treasury|rates|10y|bond/.test(normalized)) return "rates";
  if (/equity|equities|stock|stocks|s&p|spx|nasdaq/.test(normalized)) return "equities";
  if (/regime|risk/.test(normalized)) return "regime";
  return "macro";
}

function localOverallView(question, context) {
  const asset = inferQuestionAsset(question);
  const { spxMove, goldMove, dxyMove, tenYearMove } = context.rawSignals;
  const riskPositive = spxMove >= 0 && dxyMove <= 0.1 && tenYearMove <= 0.03;
  const riskNegative = spxMove < 0 || dxyMove > 0.15 || tenYearMove > 0.04;

  if (asset === "gold") {
    if (goldMove > 0.25 && (dxyMove >= 0 || context.regime.label.includes("Defensive"))) {
      return "Bullish";
    }
    if (goldMove < -0.25 && riskPositive) return "Bearish";
    return "Mixed";
  }

  if (asset === "dollar") {
    if (dxyMove > 0.12) return "Bullish";
    if (dxyMove < -0.12) return "Bearish";
    return "Neutral";
  }

  if (asset === "rates") {
    if (tenYearMove > 0.03) return "Bullish";
    if (tenYearMove < -0.03) return "Bearish";
    return "Neutral";
  }

  if (asset === "equities") {
    if (riskPositive) return "Bullish";
    if (riskNegative) return "Bearish";
    return "Mixed";
  }

  if (["Risk On", "Growth Optimism"].includes(context.regime.label)) return "Bullish";
  if (["Risk Off", "Rate Shock"].includes(context.regime.label)) return "Bearish";
  return context.regime.label === "Defensive Positioning" ? "Mixed" : "Neutral";
}

function generateLocalAnalysis(question, context) {
  const overallView = localOverallView(question, context);
  const confidence = clamp(
    Math.round(context.regime.confidence - (overallView === "Mixed" ? 12 : 4)),
    45,
    88,
  );

  return normalizeAnalystResponse(
    question,
    {
      overallView,
      confidence,
      keyDrivers: context.defaultDrivers,
      bullishFactors: context.defaultBullish,
      bearishFactors: context.defaultBearish,
      watchNext: context.defaultWatchNext,
      explanation: context.defaultExplanation,
    },
    context,
    "local",
  );
}

function buildOpenAiAnalystPayload(question, context) {
  return {
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are a senior institutional macro research analyst writing for a professional markets dashboard. Style: Bloomberg, Bridgewater, and Goldman Sachs research note. Return JSON only. Do not give financial advice, trade instructions, or personalized recommendations. Frame everything as educational market research. Use only the provided market data, regime, alerts, daily brief, and headlines. Avoid generic template language; write a fresh narrative view that directly answers the user's question.",
      },
      {
        role: "user",
        content: JSON.stringify({
          question,
          task:
            "Generate real narrative macro research content from the current context. The UI will render these fields as cards, so each string should be polished prose rather than a fixed template. Interpret the current S&P 500 move, DXY move, gold move, US10Y move, current regime, alerts, daily brief, and relevant headlines instead of merely listing them.",
          requiredJsonFields: [
            "overallView",
            "confidence",
            "keyDrivers",
            "bullishFactors",
            "bearishFactors",
            "watchingNext",
            "explanation",
          ],
          tone: "Institutional macro research; Bloomberg / Bridgewater / Goldman Sachs style.",
          qualityBar: [
            "The explanation should read like a concise macro note with 2-4 natural sentences.",
            "Bullish Factors should usually contain 2-4 fully written research bullets.",
            "Bearish Factors should usually contain 2-4 fully written research bullets.",
            "Watching Next should contain 3-5 concrete monitoring points.",
            "If the question is about gold, explicitly interpret the interaction between gold, the dollar, Treasury yields, and the current regime.",
          ],
          rules: [
            "Never say buy, sell, hold, allocate, enter, exit, target, or recommend.",
            "Do not invent market data, prices, forecasts, alerts, or headlines.",
            "Use conditional educational phrasing such as 'the read is', 'the signal argues', 'the market is pricing', and 'watch whether'.",
            "Overall View must reflect the balance of current signals, not a personal investment recommendation.",
          ],
          context: {
            marketData: {
              spx: context.signalsUsed.spx,
              dxy: context.signalsUsed.dxy,
              gold: context.signalsUsed.gold,
              tenYear: context.signalsUsed.tenYear,
            },
            regime: context.signalsUsed.regime,
            alerts: context.alerts,
            dailyBrief: context.dailyBrief,
            headlines: context.headlines,
            headlineTopics: context.headlineTopics,
          },
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "macro_analyst_response",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "overallView",
            "confidence",
            "keyDrivers",
            "bullishFactors",
            "bearishFactors",
            "watchingNext",
            "explanation",
          ],
          properties: {
            overallView: {
              type: "string",
              enum: ["Bullish", "Neutral", "Bearish", "Mixed"],
            },
            confidence: {
              type: "integer",
              minimum: 0,
              maximum: 100,
            },
            keyDrivers: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: { type: "string" },
            },
            bullishFactors: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" },
            },
            bearishFactors: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" },
            },
            watchingNext: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: { type: "string" },
            },
            explanation: {
              type: "string",
              minLength: 220,
            },
          },
        },
      },
    },
    max_output_tokens: 1000,
  };
}

async function generateOpenAiAnalysis(question, context) {
  if (
    !process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY === "your-openai-api-key" ||
    process.env.OPENAI_API_KEY === "sk-your-api-key" ||
    openAiDisabled
  ) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildOpenAiAnalystPayload(question, context)),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        openAiDisabled = true;
      }
      throw new Error(`OpenAI returned ${response.status}`);
    }

    const payload = await response.json();
    const generated = parseSummaryJson(extractResponseText(payload));
    return normalizeAnalystResponse(question, generated, context, "openai");
  } catch (error) {
    console.error(`OpenAI analyst fallback: ${error.message}`);
    return null;
  }
}

async function generateAiSummary(markets) {
  if (
    !process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY === "your-openai-api-key" ||
    process.env.OPENAI_API_KEY === "sk-your-api-key" ||
    openAiDisabled
  ) {
    return { ...buildSummary(markets), summaryProvider: "local-fallback" };
  }

  const compactMarkets = markets.map((market) => ({
    id: market.id,
    label: market.label,
    value: market.value,
    change: market.change,
    detail: market.detail,
    rawChange: market.rawChange,
  }));

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are a concise macro markets analyst. Use only the provided live market data. Do not give investment advice. Return valid JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                "Write a dashboard market summary and three short point cards from this live data.",
              schema: {
                summary: "One paragraph, 45-70 words.",
                summaryPoints:
                  "Array of exactly three [title, text] pairs. Titles 1-3 words. Text under 12 words.",
              },
              markets: compactMarkets,
            }),
          },
        ],
        max_output_tokens: 300,
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        openAiDisabled = true;
      }
      throw new Error(`OpenAI returned ${response.status}`);
    }

    const payload = await response.json();
    const generated = parseSummaryJson(extractResponseText(payload));

    if (
      typeof generated.summary !== "string" ||
      !Array.isArray(generated.summaryPoints) ||
      generated.summaryPoints.length !== 3
    ) {
      throw new Error("OpenAI summary response did not match the expected shape");
    }

    return {
      summary: generated.summary,
      summaryPoints: generated.summaryPoints,
      summaryProvider: "openai",
      summaryModel: OPENAI_MODEL,
    };
  } catch (error) {
    console.error(`OpenAI summary fallback: ${error.message}`);
    return { ...buildSummary(markets), summaryProvider: "local-fallback" };
  }
}

function buildAiDailyBrief(markets, regime, aiSummary) {
  const gold = marketById(markets, "gold");
  const spx = marketById(markets, "spx");
  const dxy = marketById(markets, "dxy");
  const tenYear = marketById(markets, "tenYear");
  const summaryPoints = Array.isArray(aiSummary.summaryPoints) ? aiSummary.summaryPoints : [];

  return {
    provider: aiSummary.summaryProvider === "openai" ? "openai" : "local",
    currentRegime: `${regime.label} / ${regime.confidence}% confidence. ${regime.explanation}`,
    marketMoves: [
      movementText("S&P 500", spx),
      movementText(gold.label, gold),
      movementText(dxy.label, dxy),
      movementText("US10Y", tenYear),
    ],
    ratesDollarGoldRead: [
      `Rates: US10Y is ${tenYear.value}, ${tenYear.change}.`,
      `Dollar: ${dxy.label} is ${dxy.value}, ${dxy.change}.`,
      `Gold: ${gold.label} is ${gold.value}, ${gold.change}.`,
    ],
    watchNext: summaryPoints.length
      ? summaryPoints.map(([title, text]) => `${title}: ${text}`).slice(0, 3)
      : [
          `Risk appetite through ${spx.label} follow-through.`,
          `Treasury yield direction around ${tenYear.value}.`,
          `Dollar and gold confirmation: ${dxy.change} vs ${gold.change}.`,
        ],
    riskSummary: aiSummary.summary || regime.explanation,
  };
}

function fallbackQuoteRows() {
  const today = localDateKey();
  return {
    gold: { Open: "3305", High: "3338", Low: "3292", Close: "3320", Date: today, Time: "fallback" },
    spx: { Open: "6020", High: "6062", Low: "5998", Close: "6038", Date: today, Time: "fallback" },
    dxy: { Open: "99.32", High: "99.45", Low: "99.05", Close: "99.15", Date: today, Time: "fallback" },
  };
}

function fallbackTreasuryEntries() {
  return [4.42, 4.43, 4.44, 4.45, 4.46, 4.45, 4.47].map((tenYear, index) => ({
    date: localDateKey(new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000)),
    tenYear,
  }));
}

function providerRow({ open, high, low, close, date, time, detail, label, provider }) {
  if (![open, high, low, close].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Provider row is missing price fields");
  }

  return {
    Open: String(open),
    High: String(high),
    Low: String(low),
    Close: String(close),
    Date: date || localDateKey(),
    Time: time || "",
    Detail: detail,
    Label: label,
    Provider: provider,
  };
}

function alphaVantageUrl(params) {
  const url = new URL("https://www.alphavantage.co/query");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("apikey", process.env.ALPHA_VANTAGE_API_KEY);
  return url.toString();
}

async function fetchJson(url, label, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  const payload = await response.json();
  if (payload.Note || payload.Information || payload["Error Message"]) {
    throw new Error(payload.Note || payload.Information || payload["Error Message"]);
  }
  return payload;
}

async function fetchAlphaVantageQuote(symbol, id) {
  if (!process.env.ALPHA_VANTAGE_API_KEY) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not configured");
  }

  const payload = await fetchJson(
    alphaVantageUrl({ function: "GLOBAL_QUOTE", symbol }),
    `Alpha Vantage ${symbol}`,
  );
  const quote = payload["Global Quote"];
  if (!quote) throw new Error(`Alpha Vantage returned no quote for ${symbol}`);

  return providerRow({
    open: num(quote["02. open"]),
    high: num(quote["03. high"]),
    low: num(quote["04. low"]),
    close: num(quote["05. price"]),
    date: quote["07. latest trading day"],
    time: "Alpha Vantage",
    detail: `${symbol} ${id === "spx" ? "ETF proxy" : id === "gold" ? "ETF proxy" : "dollar ETF proxy"}, Alpha Vantage`,
    label: id === "gold" ? "Gold ETF (GLD)" : id === "spx" ? "S&P 500 ETF (SPY)" : "US Dollar ETF (UUP)",
    provider: "Alpha Vantage",
  });
}

async function fetchAlphaVantageQuotes() {
  if (!process.env.ALPHA_VANTAGE_API_KEY) {
    return {
      quotes: {},
      status: "not_configured",
      error: "ALPHA_VANTAGE_API_KEY is not configured",
    };
  }

  const results = await Promise.allSettled(
    Object.entries(ALPHA_VANTAGE_SYMBOLS).map(async ([id, symbol]) => [
      id,
      await fetchAlphaVantageQuote(symbol, id),
    ]),
  );
  const quotes = {};
  const errors = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const [id, row] = result.value;
      quotes[id] = row;
    } else {
      errors.push(result.reason.message);
    }
  }

  const quoteCount = Object.keys(quotes).length;
  return {
    quotes,
    status: quoteCount === 3 ? "live" : quoteCount > 0 ? "fallback" : "error",
    error: errors.join("; "),
  };
}

function yahooChartUrl(symbol, range = "7d", interval = "1d") {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  return url.toString();
}

function parseYahooResult(payload, symbol, label) {
  const result = payload.chart?.result?.[0];
  if (!result) {
    const message = payload.chart?.error?.description || `Yahoo returned no chart for ${symbol}`;
    throw new Error(message);
  }

  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const points = timestamps
    .map((timestamp, index) => ({
      date: localDateKey(new Date(timestamp * 1000)),
      open: num(quote.open?.[index]),
      high: num(quote.high?.[index]),
      low: num(quote.low?.[index]),
      close: num(quote.close?.[index]),
    }))
    .filter((point) => Number.isFinite(point.close));

  if (!points.length) throw new Error(`Yahoo returned no usable prices for ${symbol}`);
  const latest = points.at(-1);

  return {
    row: providerRow({
      open: Number.isFinite(latest.open) ? latest.open : latest.close,
      high: Number.isFinite(latest.high) ? latest.high : latest.close,
      low: Number.isFinite(latest.low) ? latest.low : latest.close,
      close: latest.close,
      date: latest.date,
      time: "Yahoo Finance",
      detail: `${label}, Yahoo Finance`,
      label,
      provider: "Yahoo Finance",
    }),
    history: points.map((point) => ({
      Date: point.date,
      Close: String(point.close),
    })),
  };
}

async function fetchYahooAsset(symbol, label) {
  const payload = await fetchJson(yahooChartUrl(symbol), `Yahoo ${symbol}`);
  return parseYahooResult(payload, symbol, label);
}

async function fetchYahooWatchlistQuote(id, config) {
  const parsed = await fetchYahooAsset(config.symbol, config.label);
  const open = num(parsed.row.Open);
  const close = num(parsed.row.Close);
  const change = pctChange(close, open);
  if (!Number.isFinite(close) || !Number.isFinite(change)) {
    throw new Error(`Yahoo ${config.symbol} returned invalid watchlist quote`);
  }

  return {
    id,
    name: config.label,
    symbol: config.symbol,
    provider: "Yahoo Finance",
    value: formatWatchlistValue(close, config.formatter),
    change: formatPct(change),
    rawChange: change,
    down: change < 0,
    updatedAt: parsed.row.Date,
  };
}

async function fetchYahooWatchlistQuotes() {
  const entries = await Promise.all(
    Object.entries(WATCHLIST_YAHOO_SYMBOLS).map(async ([id, config]) => {
      try {
        return [id, await fetchYahooWatchlistQuote(id, config)];
      } catch (error) {
        console.error(`Yahoo watchlist ${id} unavailable: ${error.message}`);
        return [
          id,
          {
            id,
            name: config.label,
            symbol: config.symbol,
            provider: "Yahoo Finance",
            value: "--",
            change: "--",
            rawChange: null,
            down: false,
            unavailable: true,
            error: error.message,
          },
        ];
      }
    }),
  );

  return Object.fromEntries(entries);
}

async function fetchYahooMarketData() {
  const [gold, spx, dxy] = await Promise.all([
    fetchYahooAsset(YAHOO_SYMBOLS.gold, "Gold futures"),
    fetchYahooAsset(YAHOO_SYMBOLS.spx, "S&P 500 index"),
    fetchYahooAsset(YAHOO_SYMBOLS.dxy, "US Dollar Index"),
  ]);

  return {
    quotes: {
      gold: gold.row,
      spx: spx.row,
      dxy: dxy.row,
    },
    history: {
      gold: gold.history,
      spx: spx.history,
      dxy: dxy.history,
    },
  };
}

async function fetchFredTreasuryEntries() {
  if (!process.env.FRED_API_KEY) {
    throw new Error("FRED_API_KEY is not configured");
  }

  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", "DGS10");
  url.searchParams.set("api_key", process.env.FRED_API_KEY);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "14");

  const payload = await fetchJson(url.toString(), "FRED DGS10");
  const entries = (payload.observations || [])
    .map((entry) => ({
      date: entry.date,
      tenYear: num(entry.value),
    }))
    .filter((entry) => entry.date && Number.isFinite(entry.tenYear) && entry.tenYear >= 3 && entry.tenYear <= 6)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length < 2) throw new Error("FRED DGS10 returned incomplete data");
  return entries;
}

async function fetchYahooTreasuryEntries() {
  const payload = await fetchJson(yahooChartUrl(YAHOO_SYMBOLS.tenYear), "Yahoo 10Y Treasury yield");
  const parsed = parseYahooResult(payload, YAHOO_SYMBOLS.tenYear, "CBOE 10Y Treasury yield proxy");
  const entries = parsed.history.map((point) => ({
    date: point.Date,
    tenYear: num(point.Close) > 20 ? num(point.Close) / 10 : num(point.Close),
  })).filter((entry) => entry.date && Number.isFinite(entry.tenYear) && entry.tenYear >= 3 && entry.tenYear <= 6);

  if (entries.length < 2) throw new Error("Yahoo 10Y proxy returned incomplete data");
  return entries;
}

function buildMarketsFromInputs({ gold, spx, dxy, treasury, history }) {
  const latestYield = treasury.at(-1);
  const previousYield = treasury.at(-2);
  if (!gold || !spx || !dxy || !latestYield || !previousYield) {
    throw new Error("Market input data is incomplete");
  }

  const goldClose = num(gold.Close);
  const spxClose = num(spx.Close);
  const dxyClose = num(dxy.Close);
  if (!Number.isFinite(goldClose) || goldClose <= 0) {
    throw new Error("Gold provider returned invalid price data");
  }
  if (!Number.isFinite(spxClose) || spxClose < 100) {
    throw new Error("S&P 500 provider returned invalid price data");
  }
  if (!Number.isFinite(dxyClose) || dxyClose <= 0) {
    throw new Error("Dollar provider returned invalid price data");
  }
  if (
    !Number.isFinite(latestYield.tenYear) ||
    !Number.isFinite(previousYield.tenYear) ||
    latestYield.tenYear < 3 ||
    latestYield.tenYear > 6 ||
    previousYield.tenYear < 3 ||
    previousYield.tenYear > 6
  ) {
    throw new Error("US10Y provider returned invalid yield data");
  }

  const tenYearChange = latestYield.tenYear - previousYield.tenYear;
  const goldMove = pctChange(num(gold.Close), num(gold.Open));
  const spxMove = pctChange(num(spx.Close), num(spx.Open));
  const dxyMove = pctChange(num(dxy.Close), num(dxy.Open));
  const tenYearBps = tenYearChange * 100;
  const markets = [
    {
      id: "gold",
      label: gold.Label || "Gold Price",
      icon: "Au",
      value: currency(num(gold.Close)),
      change: changeText(goldMove),
      rawChange: goldMove,
      detail: gold.Detail || `XAU/USD spot, ${sourceTime(gold)}`,
      accent: "#f4bf4f",
      trend: marketTrend(gold),
      charts: {
        "1D": intradayChart(gold, currency),
        "1W": weeklyChart(history.gold, gold, currency),
      },
      down: goldMove < 0,
    },
    {
      id: "spx",
      label: spx.Label || "S&P 500",
      icon: "SP",
      value: indexValue(num(spx.Close)),
      change: changeText(spxMove),
      rawChange: spxMove,
      detail: spx.Detail || `S&P 500 index, ${sourceTime(spx)}`,
      accent: "#49d68f",
      trend: marketTrend(spx),
      charts: {
        "1D": intradayChart(spx, indexValue),
        "1W": weeklyChart(history.spx, spx, indexValue),
      },
      down: spxMove < 0,
    },
    {
      id: "dxy",
      label: dxy.Label || "US Dollar Index",
      icon: "DXY",
      value: indexValue(num(dxy.Close)),
      change: changeText(dxyMove),
      rawChange: dxyMove,
      detail: dxy.Detail || `DXY futures proxy, ${sourceTime(dxy)}`,
      accent: "#67a7ff",
      trend: marketTrend(dxy),
      charts: {
        "1D": intradayChart(dxy, indexValue),
        "1W": weeklyChart(history.dxy, dxy, indexValue),
      },
      down: dxyMove < 0,
    },
    {
      id: "tenYear",
      label: "US 10Y Treasury Yield",
      icon: "10Y",
      value: `${latestYield.tenYear.toFixed(2)}%`,
      change: formatBps(tenYearBps),
      rawChange: tenYearChange,
      detail: `Treasury daily curve, ${latestYield.date}`,
      accent: "#b18cff",
      trend: treasury.slice(-10).map((entry) => entry.tenYear),
      charts: {
        "1D": treasury.slice(-5).map((entry) => ({
          label: entry.date.slice(5),
          value: entry.tenYear,
          display: `${entry.tenYear.toFixed(2)}%`,
        })),
        "1W": treasuryWeeklyChart(treasury),
      },
      down: tenYearChange < 0,
    },
  ];
  const regime = buildMarketRegime({
    spxMove,
    dxyMove,
    goldMove,
    tenYearBps,
  });

  return {
    markets,
    regime,
    moves: {
      spxMove,
      dxyMove,
      goldMove,
      tenYearBps,
    },
  };
}

function parseOptionalHistory(text, label, errors) {
  if (!text || looksBlockedHtml(text)) {
    errors.push(`${label} unavailable`);
    return [];
  }

  const rows = parseCsv(text).filter((row) => row.Date && Number.isFinite(num(row.Close)));
  if (!rows.length) {
    errors.push(`${label} returned no usable rows`);
  }
  return rows;
}

async function buildMarketPayload({ quotes, treasury, history, providerStatus }) {
  const built = buildMarketsFromInputs({
    gold: quotes.gold,
    spx: quotes.spx,
    dxy: quotes.dxy,
    treasury,
    history,
  });
  const aiSummary = providerStatus.marketData === "fallback"
    ? { ...buildSummary(built.markets), summaryProvider: "local-fallback" }
    : await generateAiSummary(built.markets);
  let watchlistQuotes = {};
  try {
    watchlistQuotes = await fetchYahooWatchlistQuotes();
  } catch (error) {
    console.error(`Yahoo watchlist provider unavailable: ${error.message}`);
  }

  return {
    updatedAt: new Date().toISOString(),
    markets: built.markets,
    regime: built.regime,
    ...aiSummary,
    aiDailyBrief: buildAiDailyBrief(built.markets, built.regime, aiSummary),
    watchlistQuotes,
    sources: providerStatus.sources,
    degraded: providerStatus.marketData === "fallback",
    providerStatus,
  };
}

async function buildFallbackMarketPayload(reason, providerStatus = {}) {
  return buildMarketPayload({
    quotes: fallbackQuoteRows(),
    treasury: fallbackTreasuryEntries(),
    history: {
      gold: [],
      spx: [],
      dxy: [],
    },
    providerStatus: {
      marketData: "fallback",
      alphaVantage: providerStatus.alphaVantage || "backup_not_used",
      alphaVantageError: providerStatus.alphaVantageError || "",
      yahoo: providerStatus.yahoo || "unavailable",
      stooq: "fallback",
      treasury: "fallback",
      history: "fallback",
      assetProviders: {
        gold: "Local fallback",
        spx: "Local fallback",
        dxy: "Local fallback",
        tenYear: "Local fallback",
      },
      sources: ["Local degraded market fallback", "Local Treasury yield fallback"],
      errors: providerStatus.errors?.length
        ? providerStatus.errors
        : [reason || "Market data provider unavailable"],
    },
  });
}

async function fetchMarkets() {
  const now = Date.now();
  if (cache && now - cacheTime < 30_000) return cache;
  if (marketFetchPromise) return marketFetchPromise;

  marketFetchPromise = (async () => {
    const errors = [];
    const providerStatus = {
      alphaVantage: "backup_not_used",
      alphaVantageError: "",
      yahoo: "not-used",
      stooq: "not-used",
      errors,
    };
    let quoteRows = {};
    let history = null;
    let marketData = "fallback";
    const marketSources = [];

    try {
      const yahooData = await fetchYahooMarketData();
      history = yahooData.history;
      quoteRows = { ...quoteRows, ...yahooData.quotes };
      providerStatus.yahoo = "live";
      marketSources.push("Yahoo Finance");
    } catch (error) {
      providerStatus.yahoo = "error";
      errors.push(`Yahoo Finance: ${error.message}`);
      console.error(`Yahoo Finance market provider unavailable: ${error.message}`);
    }

    if (["gold", "spx", "dxy"].some((id) => !quoteRows[id])) {
      const alphaResult = await fetchAlphaVantageQuotes();
      providerStatus.alphaVantage = alphaResult.status === "live" ? "fallback" : alphaResult.status;
      providerStatus.alphaVantageError = alphaResult.error || "";
      quoteRows = { ...quoteRows, ...alphaResult.quotes };
      if (Object.keys(alphaResult.quotes).length) {
        marketSources.push("Alpha Vantage backup");
      }
      if (providerStatus.alphaVantageError) {
        console.error(`Alpha Vantage backup unavailable: ${providerStatus.alphaVantageError}`);
      }
    }

    if (["gold", "spx", "dxy"].some((id) => !quoteRows[id])) {
      const forceStooqFailure = process.env.MACRO_RADAR_FORCE_STOOQ_FAILURE === "1";
      try {
        if (forceStooqFailure) throw new Error("Forced Stooq failure for local verification");
        const stooqQuotes = validateStooqQuotes(await fetchText(STOOQ_URL, "Stooq"));
        if (!quoteRows.gold) quoteRows.gold = stooqQuotes.XAUUSD;
        if (!quoteRows.spx) quoteRows.spx = stooqQuotes["^SPX"];
        if (!quoteRows.dxy) quoteRows.dxy = stooqQuotes["DX.F"];
        providerStatus.stooq = "backup";
        marketSources.push("Stooq CSV legacy backup");
      } catch (error) {
        providerStatus.stooq = "error";
        errors.push(`Stooq: ${error.message}`);
        console.error(`Stooq emergency backup unavailable: ${error.message}`);
      }
    }

    const fallbackRows = fallbackQuoteRows();
    const missingAfterRealProviders = ["gold", "spx", "dxy"].filter((id) => !quoteRows[id]);
    for (const id of missingAfterRealProviders) {
      quoteRows[id] = fallbackRows[id];
    }
    if (missingAfterRealProviders.length === 3) {
      marketData = "fallback";
      marketSources.push("Local degraded market fallback");
    } else if (missingAfterRealProviders.length > 0) {
      marketData = "partial-live";
      marketSources.push("Local fallback for missing market assets");
    } else {
      marketData = "live";
    }

    let treasury = null;
    let treasuryStatus = "live";
    try {
      treasury = await fetchFredTreasuryEntries();
      treasuryStatus = "FRED DGS10";
    } catch (error) {
      errors.push(`FRED: ${error.message}`);
      console.error(`FRED DGS10 unavailable: ${error.message}`);
    }

    if (!treasury) {
      try {
        treasury = await fetchYahooTreasuryEntries();
        treasuryStatus = "Yahoo Finance 10Y proxy";
      } catch (error) {
        errors.push(`Yahoo 10Y: ${error.message}`);
        console.error(`Yahoo 10Y backup unavailable: ${error.message}`);
      }
    }

    if (!treasury) {
      try {
        treasury = validateTreasuryEntries(await fetchText(TREASURY_URL, "Treasury"));
        treasuryStatus = "U.S. Treasury yield curve XML";
      } catch (error) {
        errors.push(`Treasury XML: ${error.message}`);
        console.error(`Treasury XML backup unavailable: ${error.message}`);
      }
    }

    if (!treasury) {
      treasury = fallbackTreasuryEntries();
      treasuryStatus = "fallback";
      if (marketData !== "fallback") {
        marketData = "partial-live";
      }
      errors.push("Treasury: all real Treasury providers failed; using local fallback");
    }

    if (!history) {
      history = { gold: [], spx: [], dxy: [] };
    }

    cache = await buildMarketPayload({
      quotes: quoteRows,
      treasury,
      history,
      providerStatus: {
        marketData,
        alphaVantage: providerStatus.alphaVantage,
        alphaVantageError: providerStatus.alphaVantageError,
        yahoo: providerStatus.yahoo,
        stooq: providerStatus.stooq,
        treasury: treasuryStatus,
        history: history.gold.length && history.spx.length && history.dxy.length ? "live" : "synthetic",
        assetProviders: {
          gold: quoteRows.gold.Provider || quoteRows.gold.Detail || "Local fallback",
          spx: quoteRows.spx.Provider || quoteRows.spx.Detail || "Local fallback",
          dxy: quoteRows.dxy.Provider || quoteRows.dxy.Detail || "Local fallback",
          tenYear: treasuryStatus,
        },
        sources: [
          ...marketSources,
          treasuryStatus,
          history.gold.length && history.spx.length && history.dxy.length
            ? "Yahoo Finance chart history"
            : "Synthetic chart history from current real quotes",
          "OpenAI Responses API",
        ],
        errors,
      },
    });
    cacheTime = now;
    return cache;
  })();

  try {
    return await marketFetchPromise;
  } finally {
    marketFetchPromise = null;
  }
}

async function fetchMarketsSafe() {
  try {
    return await fetchMarkets();
  } catch (error) {
    console.error(`Safe market fallback: ${error.message}`);
    if (cache) {
      return {
        ...cache,
        updatedAt: new Date().toISOString(),
        degraded: true,
        providerStatus: {
          ...cache.providerStatus,
          marketData: "fallback",
          previousSnapshot: "preserved",
          errors: [...(cache.providerStatus?.errors || []), `Preserved previous snapshot: ${error.message}`],
        },
      };
    }
    return buildFallbackMarketPayload(error.message);
  }
}

async function fetchMacroNews() {
  const now = Date.now();
  if (newsCache && now - newsCacheTime < 120_000) return newsCache;
  if (newsFetchPromise) return newsFetchPromise;

  newsFetchPromise = (async () => {
    const feeds = await Promise.allSettled(
      NEWS_FEEDS.map(async ([topic, url]) =>
        parseNewsRss(
          await fetchText(url, `${topic} news RSS`, {
            headers: {
              "User-Agent": "MacroRadar/1.0 (+local-dashboard)",
            },
          }),
          topic,
        ),
      ),
    );

    const failedFeeds = feeds.filter((result) => result.status === "rejected");
    for (const feed of failedFeeds) {
      console.error(`News feed fallback: ${feed.reason.message}`);
    }

    const seen = new Set();
    const headlines = feeds
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value)
      .filter((item) => {
        const key = item.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 18);

    if (!headlines.length) {
      throw new Error("News RSS returned no matching macro headlines");
    }

    newsCache = {
      updatedAt: new Date().toISOString(),
      queryTopics: NEWS_TOPICS,
      headlines,
      source: "Google News RSS",
      degraded: failedFeeds.length > 0,
    };
    newsCacheTime = now;
    return newsCache;
  })();

  try {
    return await newsFetchPromise;
  } catch (error) {
    console.error(`News fallback: ${error.message}`);
    newsCache = buildFallbackNews(error.message);
    newsCacheTime = now;
    return newsCache;
  } finally {
    newsFetchPromise = null;
  }
}

function marketById(markets, id) {
  return markets.find((market) => market.id === id);
}

function movementText(label, market) {
  return `${label} ${market.change} (${market.value})`;
}

function buildDailyBrief(marketsPayload, newsPayload) {
  const markets = marketsPayload.markets;
  const regime = marketsPayload.regime;
  const gold = marketById(markets, "gold");
  const spx = marketById(markets, "spx");
  const dxy = marketById(markets, "dxy");
  const tenYear = marketById(markets, "tenYear");
  const headlines = newsPayload.headlines.slice(0, 6);
  const headlineThemes = headlines
    .slice(0, 3)
    .map((headline) => headline.title.replace(/\s+-\s+[^-]+$/, ""))
    .join("; ");
  const riskList = [
    tenYear.rawChange > 0.03 ? "higher Treasury yields pressuring duration and equity multiples" : null,
    gold.rawChange > 0.35 ? "firm gold signaling demand for hedges" : null,
    dxy.rawChange > 0.12 ? "dollar strength tightening financial conditions" : null,
    spx.rawChange < -0.35 ? "equity weakness confirming cautious risk appetite" : null,
    regime.label === "Rate Shock" ? "rate volatility dominating cross-asset pricing" : null,
  ].filter(Boolean);
  const risks = riskList.length
    ? riskList
    : ["low conviction cross-asset signals and headline sensitivity"];
  const drivers = [
    movementText("S&P 500", spx),
    movementText("DXY", dxy),
    movementText("Gold", gold),
    movementText("US10Y", tenYear),
  ];
  const watchNext = [
    "Fed communication and repricing of the next policy move",
    "whether Treasury yields keep rising or stabilize",
    "confirmation from the dollar and gold on defensive demand",
    "follow-through in S&P 500 breadth after the opening move",
  ];
  const themeMap = {
    "Risk On": "Risk appetite is leading the tape",
    "Risk Off": "Defensive risk reduction is driving markets",
    "Inflation Fear": "Inflation and rate pressure are setting the tone",
    "Growth Optimism": "Growth expectations are offsetting rate concerns",
    "Defensive Positioning": "Hedging demand is shaping cross-asset flows",
    "Rate Shock": "Rates are the dominant macro shock",
  };
  const interpretationMap = {
    "Risk On": "Favor risk-sensitive readings while monitoring any reversal in yields or the dollar.",
    "Risk Off": "Stay defensive until equities stabilize and haven demand fades.",
    "Inflation Fear": "Treat rallies cautiously while yields and gold rise together.",
    "Growth Optimism": "Risk assets have support, but confirmation needs stable yields and a contained dollar.",
    "Defensive Positioning": "Preserve optionality; the tape is rewarding hedges more than momentum.",
    "Rate Shock": "Reduce sensitivity to duration and watch for policy-rate repricing.",
  };

  return {
    date: localDateKey(),
    generatedAt: new Date().toISOString(),
    sourceUpdatedAt: marketsPayload.updatedAt,
    marketTheme: `${themeMap[regime.label] || regime.label}: ${regime.explanation}`,
    mainRisks: risks,
    keyDrivers: drivers,
    watchingNext: watchNext,
    actionableInterpretation:
      interpretationMap[regime.label] ||
      "Use the regime signal as a bias, then require confirmation from rates, dollar, gold, and equities.",
    regime: {
      label: regime.label,
      confidence: regime.confidence,
    },
    newsContext: headlines.map((headline) => ({
      title: headline.title,
      source: headline.source,
      topics: headline.topics,
      publishedAt: headline.publishedAt,
      link: headline.link,
    })),
    summaryLine: `${regime.label} with ${regime.confidence}% confidence. Headlines focus on ${headlineThemes || "macro policy and cross-asset moves"}.`,
  };
}

async function saveDailyBrief(brief) {
  await fs.mkdir(BRIEFS_DIR, { recursive: true });
  const filePath = path.join(BRIEFS_DIR, `${brief.date}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  return filePath;
}

async function loadDailyBrief(date) {
  try {
    const filePath = path.join(BRIEFS_DIR, `${date}.json`);
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchDailyBrief() {
  const now = Date.now();
  const today = localDateKey();
  if (briefCache && briefCache.date === today && now - briefCacheTime < 300_000) {
    return briefCache;
  }

  const existing = await loadDailyBrief(today);
  if (existing && now - new Date(existing.generatedAt).getTime() < 60 * 60 * 1000) {
    briefCache = existing;
    briefCacheTime = now;
    return briefCache;
  }

  const [marketsPayload, newsPayload] = await Promise.all([fetchMarketsSafe(), fetchMacroNews()]);
  const brief = buildDailyBrief(marketsPayload, newsPayload);
  brief.file = path.relative(ROOT, await saveDailyBrief(brief));
  briefCache = brief;
  briefCacheTime = now;
  return brief;
}

function timelineItemFromBrief(brief) {
  return {
    date: brief.date,
    generatedAt: brief.generatedAt,
    regime: brief.regime,
    marketTheme: brief.marketTheme,
    mainRisks: brief.mainRisks || [],
    keyDrivers: brief.keyDrivers || [],
    watchingNext: brief.watchingNext || [],
    actionableInterpretation: brief.actionableInterpretation,
    summaryLine: brief.summaryLine,
    headlineCount: brief.newsContext?.length || 0,
  };
}

async function fetchTimeline() {
  await fs.mkdir(BRIEFS_DIR, { recursive: true });
  const files = await fs.readdir(BRIEFS_DIR);
  const briefs = await Promise.all(
    files
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .map(async (file) => {
        try {
          return JSON.parse(await fs.readFile(path.join(BRIEFS_DIR, file), "utf8"));
        } catch {
          return null;
        }
      }),
  );

  return {
    updatedAt: new Date().toISOString(),
    count: briefs.filter(Boolean).length,
    items: briefs
      .filter(Boolean)
      .map(timelineItemFromBrief)
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function riskSentimentForRegime(regimeLabel) {
  if (["Risk On", "Growth Optimism"].includes(regimeLabel)) return "constructive";
  if (["Risk Off", "Defensive Positioning"].includes(regimeLabel)) return "defensive";
  if (["Inflation Fear", "Rate Shock"].includes(regimeLabel)) return "stress";
  return "neutral";
}

function severityForMove(absMove, mediumThreshold, highThreshold) {
  if (absMove >= highThreshold) return "high";
  if (absMove >= mediumThreshold) return "medium";
  return "low";
}

function alertId(type, date, detail) {
  return `${date}:${type}:${detail}`.toLowerCase().replace(/[^a-z0-9:+.-]+/g, "-");
}

function buildMacroAlerts(marketsPayload, previousState) {
  const date = localDateKey();
  const now = new Date().toISOString();
  const markets = marketsPayload.markets;
  const gold = marketById(markets, "gold");
  const dxy = marketById(markets, "dxy");
  const tenYear = marketById(markets, "tenYear");
  const spx = marketById(markets, "spx");
  const regime = marketsPayload.regime;
  const currentSentiment = riskSentimentForRegime(regime.label);
  const alerts = [];

  if (Math.abs(gold.rawChange) >= 1) {
    const direction = gold.rawChange > 0 ? "surges" : "drops";
    const severity = severityForMove(Math.abs(gold.rawChange), 1, 1.75);
    alerts.push({
      id: alertId("gold", date, direction),
      type: "gold-move",
      title: `Gold ${direction} more than 1%`,
      explanation: `Gold is ${gold.change} at ${gold.value}, signaling a sharp move in hedge demand.`,
      severity,
      timestamp: now,
    });
  }

  if (Math.abs(dxy.rawChange) >= 0.25) {
    const direction = dxy.rawChange > 0 ? "strengthens sharply" : "weakens sharply";
    const severity = severityForMove(Math.abs(dxy.rawChange), 0.25, 0.5);
    alerts.push({
      id: alertId("dxy", date, direction),
      type: "dxy-move",
      title: `DXY ${direction}`,
      explanation: `The dollar index is ${dxy.change} at ${dxy.value}, a move large enough to affect global liquidity and risk appetite.`,
      severity,
      timestamp: now,
    });
  }

  const tenYearBps = Math.round(tenYear.rawChange * 100);
  if (Math.abs(tenYearBps) >= 5) {
    const bps = tenYearBps;
    const direction = bps > 0 ? "jumps" : "falls";
    const severity = severityForMove(Math.abs(bps), 5, 10);
    alerts.push({
      id: alertId("us10y", date, direction),
      type: "yield-move",
      title: `US10Y yield ${direction} significantly`,
      explanation: `The 10Y Treasury yield moved ${formatBps(bps)} to ${tenYear.value}, raising rate sensitivity across assets.`,
      severity,
      timestamp: now,
    });
  }

  if (previousState.lastRegime && previousState.lastRegime !== regime.label) {
    alerts.push({
      id: alertId("regime", date, `${previousState.lastRegime}-to-${regime.label}`),
      type: "regime-change",
      title: `Market regime changed to ${regime.label}`,
      explanation: `The regime engine moved from ${previousState.lastRegime} to ${regime.label} with ${regime.confidence}% confidence.`,
      severity: regime.confidence >= 75 ? "high" : "medium",
      timestamp: now,
    });
  }

  if (previousState.riskSentiment && previousState.riskSentiment !== currentSentiment) {
    alerts.push({
      id: alertId("sentiment", date, `${previousState.riskSentiment}-to-${currentSentiment}`),
      type: "risk-sentiment",
      title: `Risk sentiment shifted to ${currentSentiment}`,
      explanation: `Cross-asset signals changed from ${previousState.riskSentiment} to ${currentSentiment}: S&P 500 ${spx.change}, DXY ${dxy.change}, gold ${gold.change}, US10Y ${tenYear.change}.`,
      severity: currentSentiment === "stress" ? "high" : "medium",
      timestamp: now,
    });
  }

  return {
    alerts,
    nextState: {
      lastRegime: regime.label,
      riskSentiment: currentSentiment,
      updatedAt: now,
    },
  };
}

async function saveAlerts(alerts, nextState) {
  await fs.mkdir(ALERTS_DIR, { recursive: true });
  const history = await readJsonFile(ALERTS_FILE, []);
  const existingIds = new Set(history.map((alert) => alert.id));
  const freshAlerts = alerts.filter((alert) => !existingIds.has(alert.id));
  const nextHistory = [...freshAlerts, ...history].slice(0, 250);

  await fs.writeFile(ALERTS_FILE, `${JSON.stringify(nextHistory, null, 2)}\n`, "utf8");
  await fs.writeFile(ALERT_STATE_FILE, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  return {
    freshAlerts,
    history: nextHistory,
  };
}

async function fetchMacroAlerts() {
  const marketsPayload = await fetchMarketsSafe();
  const previousState = await readJsonFile(ALERT_STATE_FILE, {});
  const { alerts, nextState } = buildMacroAlerts(marketsPayload, previousState);
  const saved = await saveAlerts(alerts, nextState);

  return {
    updatedAt: new Date().toISOString(),
    active: saved.freshAlerts,
    history: saved.history,
    count: saved.history.length,
  };
}

async function analyzeMacroQuestion(body = {}) {
  const question = sanitizeQuestion(body.question);
  if (!question) {
    const error = new Error("Question is required");
    error.statusCode = 400;
    throw error;
  }

  const marketsPayload = await fetchMarketsSafe();
  const [newsResult, briefResult, alertsResult] = await Promise.allSettled([
    fetchMacroNews(),
    fetchDailyBrief(),
    fetchMacroAlerts(),
  ]);
  const newsPayload =
    newsResult.status === "fulfilled" ? newsResult.value : buildFallbackNews(newsResult.reason?.message);
  const dailyBriefPayload = briefResult.status === "fulfilled" ? briefResult.value : null;
  const alertsPayload =
    alertsResult.status === "fulfilled"
      ? alertsResult.value
      : { updatedAt: new Date().toISOString(), active: [], history: [], count: 0 };
  const context = buildAnalystContext(marketsPayload, newsPayload, dailyBriefPayload, alertsPayload);
  const openAiAnalysis = await generateOpenAiAnalysis(question, context);
  return openAiAnalysis || generateLocalAnalysis(question, context);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

async function sendApiPayload(response, fetchPayload) {
  try {
    sendJson(response, 200, await fetchPayload());
  } catch (error) {
    sendJson(response, error.statusCode || 502, { error: error.message });
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  if (!staticFiles.has(pathname)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  let filePath;
  try {
    filePath = path.resolve(PUBLIC_ROOT, `.${decodeURIComponent(pathname)}`);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

async function handleRequest(request, response) {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  if (pathname === "/api/markets") {
    await sendApiPayload(response, fetchMarketsSafe);
    return;
  }

  if (pathname === "/api/news") {
    await sendApiPayload(response, fetchMacroNews);
    return;
  }

  if (pathname === "/api/brief") {
    await sendApiPayload(response, fetchDailyBrief);
    return;
  }

  if (pathname === "/api/timeline") {
    await sendApiPayload(response, fetchTimeline);
    return;
  }

  if (pathname === "/api/alerts") {
    await sendApiPayload(response, fetchMacroAlerts);
    return;
  }

  if (pathname === "/api/analyze") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    await sendApiPayload(response, async () => analyzeMacroQuestion(await readRequestJson(request)));
    return;
  }

  serveStatic(request, response);
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Macro Radar dashboard running at http://localhost:${PORT}`);
  });
}

module.exports = handleRequest;
module.exports.handleRequest = handleRequest;
module.exports.api = {
  fetchMarkets,
  fetchMarketsSafe,
  fetchMacroNews,
  fetchDailyBrief,
  fetchTimeline,
  fetchMacroAlerts,
  analyzeMacroQuestion,
};
