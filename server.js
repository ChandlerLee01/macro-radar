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
};
const staticFiles = new Set(["/index.html", "/styles.css", "/script.js"]);

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
    watchNext: list(generated.watchNext, context.defaultWatchNext),
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

function buildAnalystContext(marketsPayload, newsPayload) {
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

  const defaultDrivers = [
    `Regime engine: ${regime.label} at ${regime.confidence}% confidence`,
    `S&P 500: ${spx.change} at ${spx.value}`,
    `DXY: ${dxy.change} at ${dxy.value}`,
    `Gold: ${gold.change} at ${gold.value}`,
    `US10Y: ${tenYear.change} to ${tenYear.value}`,
  ];
  const defaultBullish = [
    spx.rawChange >= 0 ? "Positive S&P 500 momentum supports risk appetite" : null,
    dxy.rawChange < 0 ? "A softer dollar can ease financial conditions for risk assets" : null,
    tenYear.rawChange <= 0 ? "Stable or lower Treasury yields reduce valuation pressure" : null,
    ["Risk On", "Growth Optimism"].includes(regime.label)
      ? `${regime.label} regime points to constructive cross-asset tone`
      : null,
  ].filter(Boolean);
  const defaultBearish = [
    spx.rawChange < 0 ? "Equity weakness signals fragile risk sentiment" : null,
    dxy.rawChange > 0 ? "Dollar strength can tighten global liquidity conditions" : null,
    tenYear.rawChange > 0 ? "Rising Treasury yields can pressure duration-sensitive assets" : null,
    gold.rawChange > 0.35 ? "Firm gold suggests investors are still paying for hedges" : null,
    ["Risk Off", "Defensive Positioning", "Rate Shock", "Inflation Fear"].includes(regime.label)
      ? `${regime.label} regime keeps macro risk elevated`
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
    defaultBullish: defaultBullish.length ? defaultBullish : ["No strong bullish signal is dominant yet"],
    defaultBearish: defaultBearish.length ? defaultBearish : ["No strong bearish signal is dominant yet"],
    defaultWatchNext: [
      "Whether Treasury yields extend or fade the latest move",
      "Dollar follow-through as a cross-asset liquidity signal",
      "Gold confirmation of hedge demand",
      "Fed, inflation, and growth headlines in the next news cycle",
    ],
    defaultExplanation: `${regime.label} is the current macro regime. The research read is based on S&P 500 ${spx.change}, DXY ${dxy.change}, gold ${gold.change}, US10Y ${tenYear.change}, and headlines focused on ${headlineTopics.join(", ") || "macro policy and market pricing"}.`,
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
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are an AI macro markets analyst for a product dashboard. Return valid JSON only. Frame the output as market research and education, not financial advice. Use only the provided internal signals and headline topics. Be concise and product-ready.",
          },
          {
            role: "user",
            content: JSON.stringify({
              question,
              requiredSchema: {
                overallView: "Bullish | Neutral | Bearish | Mixed",
                confidence: "integer 0-100",
                keyDrivers: "array of 3-5 concise strings",
                bullishFactors: "array of 2-4 concise strings",
                bearishFactors: "array of 2-4 concise strings",
                watchNext: "array of 2-4 concise strings",
                explanation:
                  "one concise paragraph, no financial advice, cite internal signals used",
              },
              internalSignals: {
                regime: context.signalsUsed.regime,
                spx: context.signalsUsed.spx,
                gold: context.signalsUsed.gold,
                dxy: context.signalsUsed.dxy,
                tenYear: context.signalsUsed.tenYear,
                headlineTopics: context.headlineTopics,
                headlines: context.headlines,
              },
            }),
          },
        ],
        max_output_tokens: 700,
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

async function buildFallbackMarketsPayload(reason) {
  const today = localDateKey();
  const fallbackQuotes = {
    gold: { Open: "3305", High: "3338", Low: "3292", Close: "3320", Date: today, Time: "fallback" },
    spx: { Open: "6020", High: "6062", Low: "5998", Close: "6038", Date: today, Time: "fallback" },
    dxy: { Open: "99.32", High: "99.45", Low: "99.05", Close: "99.15", Date: today, Time: "fallback" },
  };
  const previousTenYear = 4.45;
  const latestTenYear = 4.47;
  const tenYearChange = latestTenYear - previousTenYear;
  const goldMove = pctChange(num(fallbackQuotes.gold.Close), num(fallbackQuotes.gold.Open));
  const spxMove = pctChange(num(fallbackQuotes.spx.Close), num(fallbackQuotes.spx.Open));
  const dxyMove = pctChange(num(fallbackQuotes.dxy.Close), num(fallbackQuotes.dxy.Open));
  const tenYearBps = tenYearChange * 100;
  const tenYearChart = [4.42, 4.43, 4.44, 4.45, 4.46, 4.45, latestTenYear].map(
    (value, index) => ({
      label: index === 6 ? today.slice(5) : `D-${6 - index}`,
      value,
      display: `${value.toFixed(2)}%`,
    }),
  );
  const markets = [
    {
      id: "gold",
      label: "Gold Price",
      icon: "Au",
      value: currency(num(fallbackQuotes.gold.Close)),
      change: changeText(goldMove),
      rawChange: goldMove,
      detail: `XAU/USD spot fallback, ${today}`,
      accent: "#f4bf4f",
      trend: marketTrend(fallbackQuotes.gold),
      charts: {
        "1D": intradayChart(fallbackQuotes.gold, currency),
        "1W": fallbackWeeklyChart(fallbackQuotes.gold, currency),
      },
      down: goldMove < 0,
    },
    {
      id: "spx",
      label: "S&P 500",
      icon: "SP",
      value: indexValue(num(fallbackQuotes.spx.Close)),
      change: changeText(spxMove),
      rawChange: spxMove,
      detail: `S&P 500 fallback, ${today}`,
      accent: "#49d68f",
      trend: marketTrend(fallbackQuotes.spx),
      charts: {
        "1D": intradayChart(fallbackQuotes.spx, indexValue),
        "1W": fallbackWeeklyChart(fallbackQuotes.spx, indexValue),
      },
      down: spxMove < 0,
    },
    {
      id: "dxy",
      label: "US Dollar Index",
      icon: "DXY",
      value: indexValue(num(fallbackQuotes.dxy.Close)),
      change: changeText(dxyMove),
      rawChange: dxyMove,
      detail: `DXY fallback, ${today}`,
      accent: "#67a7ff",
      trend: marketTrend(fallbackQuotes.dxy),
      charts: {
        "1D": intradayChart(fallbackQuotes.dxy, indexValue),
        "1W": fallbackWeeklyChart(fallbackQuotes.dxy, indexValue),
      },
      down: dxyMove < 0,
    },
    {
      id: "tenYear",
      label: "US 10Y Treasury Yield",
      icon: "10Y",
      value: `${latestTenYear.toFixed(2)}%`,
      change: formatBps(tenYearBps),
      rawChange: tenYearChange,
      detail: `Treasury fallback, ${today}`,
      accent: "#b18cff",
      trend: tenYearChart.map((entry) => entry.value),
      charts: {
        "1D": tenYearChart.slice(-5),
        "1W": tenYearChart,
      },
      down: tenYearChange < 0,
    },
  ];
  const aiSummary = await generateAiSummary(markets);
  const regime = buildMarketRegime({
    spxMove,
    dxyMove,
    goldMove,
    tenYearBps,
  });

  return {
    updatedAt: new Date().toISOString(),
    markets,
    regime,
    ...aiSummary,
    sources: ["Local degraded market fallback"],
    degraded: true,
    error: reason,
  };
}

async function fetchMarkets() {
  const now = Date.now();
  if (cache && now - cacheTime < 30_000) return cache;
  if (marketFetchPromise) return marketFetchPromise;

  marketFetchPromise = (async () => {
    try {
    const [stooqText, treasuryText, goldHistoryText, spxHistoryText, dxyHistoryText] =
      await Promise.all([
        fetchText(STOOQ_URL, "Stooq"),
        fetchText(TREASURY_URL, "Treasury"),
        fetchOptionalText(STOOQ_HISTORY_URLS.gold, "Gold history"),
        fetchOptionalText(STOOQ_HISTORY_URLS.spx, "S&P history"),
        fetchOptionalText(STOOQ_HISTORY_URLS.dxy, "DXY history"),
      ]);

  const quotes = Object.fromEntries(
    parseCsv(stooqText).map((row) => [row.Symbol.toUpperCase(), row]),
  );
  const treasury = parseTreasuryXml(treasuryText);
  const history = {
    gold: parseCsv(goldHistoryText),
    spx: parseCsv(spxHistoryText),
    dxy: parseCsv(dxyHistoryText),
  };
  const latestYield = treasury.at(-1);
  const previousYield = treasury.at(-2);

  const gold = quotes.XAUUSD;
  const spx = quotes["^SPX"];
  const dxy = quotes["DX.F"];

  if (!gold || !spx || !dxy || !latestYield || !previousYield) {
    throw new Error("One or more market data sources returned incomplete data");
  }

  const tenYearChange = latestYield.tenYear - previousYield.tenYear;
  const goldMove = pctChange(num(gold.Close), num(gold.Open));
  const spxMove = pctChange(num(spx.Close), num(spx.Open));
  const dxyMove = pctChange(num(dxy.Close), num(dxy.Open));
  const tenYearBps = tenYearChange * 100;
  const markets = [
    {
      id: "gold",
      label: "Gold Price",
      icon: "Au",
      value: currency(num(gold.Close)),
      change: changeText(goldMove),
      rawChange: goldMove,
      detail: `XAU/USD spot, ${sourceTime(gold)}`,
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
      label: "S&P 500",
      icon: "SP",
      value: indexValue(num(spx.Close)),
      change: changeText(spxMove),
      rawChange: spxMove,
      detail: `S&P 500 index, ${sourceTime(spx)}`,
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
      label: "US Dollar Index",
      icon: "DXY",
      value: indexValue(num(dxy.Close)),
      change: changeText(dxyMove),
      rawChange: dxyMove,
      detail: `DXY futures proxy, ${sourceTime(dxy)}`,
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

  const aiSummary = await generateAiSummary(markets);
  const regime = buildMarketRegime({
    spxMove,
    dxyMove,
    goldMove,
    tenYearBps,
  });

  cache = {
    updatedAt: new Date().toISOString(),
    markets,
    regime,
    ...aiSummary,
    sources: ["Stooq CSV", "U.S. Treasury yield curve XML", "OpenAI Responses API"],
  };
  cacheTime = now;
  return cache;
    } catch (error) {
      console.error(`Market data fallback: ${error.message}`);
      cache = await buildFallbackMarketsPayload(error.message);
      cacheTime = now;
      return cache;
    }
  })();

  try {
    return await marketFetchPromise;
  } finally {
    marketFetchPromise = null;
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

  const [marketsPayload, newsPayload] = await Promise.all([fetchMarkets(), fetchMacroNews()]);
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
  const marketsPayload = await fetchMarkets();
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

  const [marketsPayload, newsPayload] = await Promise.all([fetchMarkets(), fetchMacroNews()]);
  const context = buildAnalystContext(marketsPayload, newsPayload);
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
    await sendApiPayload(response, fetchMarkets);
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
  fetchMacroNews,
  fetchDailyBrief,
  fetchTimeline,
  fetchMacroAlerts,
  analyzeMacroQuestion,
};
