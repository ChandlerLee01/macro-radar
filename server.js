const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

loadEnvFile();

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
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

let cache = null;
let cacheTime = 0;
let newsCache = null;
let newsCacheTime = 0;

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
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((row) =>
    row.split(",").reduce((record, value, index) => {
      record[keys[index]] = value;
      return record;
    }, {}),
  );
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

function sourceTime(row) {
  return `${row.Date} ${row.Time}`.trim();
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

async function generateAiSummary(markets) {
  if (!process.env.OPENAI_API_KEY) {
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

async function fetchMarkets() {
  const now = Date.now();
  if (cache && now - cacheTime < 30_000) return cache;

  const [stooqResponse, treasuryResponse, goldHistory, spxHistory, dxyHistory] = await Promise.all([
    fetch(STOOQ_URL),
    fetch(TREASURY_URL),
    fetch(STOOQ_HISTORY_URLS.gold),
    fetch(STOOQ_HISTORY_URLS.spx),
    fetch(STOOQ_HISTORY_URLS.dxy),
  ]);

  if (!stooqResponse.ok) throw new Error(`Stooq returned ${stooqResponse.status}`);
  if (!treasuryResponse.ok) throw new Error(`Treasury returned ${treasuryResponse.status}`);
  if (!goldHistory.ok) throw new Error(`Gold history returned ${goldHistory.status}`);
  if (!spxHistory.ok) throw new Error(`S&P history returned ${spxHistory.status}`);
  if (!dxyHistory.ok) throw new Error(`DXY history returned ${dxyHistory.status}`);

  const quotes = Object.fromEntries(
    parseCsv(await stooqResponse.text()).map((row) => [row.Symbol.toUpperCase(), row]),
  );
  const treasury = parseTreasuryXml(await treasuryResponse.text());
  const history = {
    gold: parseCsv(await goldHistory.text()),
    spx: parseCsv(await spxHistory.text()),
    dxy: parseCsv(await dxyHistory.text()),
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
  const markets = [
    {
      id: "gold",
      label: "Gold Price",
      icon: "Au",
      value: currency(num(gold.Close)),
      change: changeText(pctChange(num(gold.Close), num(gold.Open))),
      rawChange: pctChange(num(gold.Close), num(gold.Open)),
      detail: `XAU/USD spot, ${sourceTime(gold)}`,
      accent: "#f4bf4f",
      trend: marketTrend(gold),
      charts: {
        "1D": intradayChart(gold, currency),
        "1W": weeklyChart(history.gold, gold, currency),
      },
      down: pctChange(num(gold.Close), num(gold.Open)) < 0,
    },
    {
      id: "spx",
      label: "S&P 500",
      icon: "SP",
      value: indexValue(num(spx.Close)),
      change: changeText(pctChange(num(spx.Close), num(spx.Open))),
      rawChange: pctChange(num(spx.Close), num(spx.Open)),
      detail: `S&P 500 index, ${sourceTime(spx)}`,
      accent: "#49d68f",
      trend: marketTrend(spx),
      charts: {
        "1D": intradayChart(spx, indexValue),
        "1W": weeklyChart(history.spx, spx, indexValue),
      },
      down: pctChange(num(spx.Close), num(spx.Open)) < 0,
    },
    {
      id: "dxy",
      label: "US Dollar Index",
      icon: "DXY",
      value: indexValue(num(dxy.Close)),
      change: changeText(pctChange(num(dxy.Close), num(dxy.Open))),
      rawChange: pctChange(num(dxy.Close), num(dxy.Open)),
      detail: `DXY futures proxy, ${sourceTime(dxy)}`,
      accent: "#67a7ff",
      trend: marketTrend(dxy),
      charts: {
        "1D": intradayChart(dxy, indexValue),
        "1W": weeklyChart(history.dxy, dxy, indexValue),
      },
      down: pctChange(num(dxy.Close), num(dxy.Open)) < 0,
    },
    {
      id: "tenYear",
      label: "US 10Y Treasury Yield",
      icon: "10Y",
      value: `${latestYield.tenYear.toFixed(2)}%`,
      change: `${tenYearChange >= 0 ? "+" : ""}${Math.round(tenYearChange * 100)} bps`,
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

  cache = {
    updatedAt: new Date().toISOString(),
    markets,
    ...aiSummary,
    sources: ["Stooq CSV", "U.S. Treasury yield curve XML", "OpenAI Responses API"],
  };
  cacheTime = now;
  return cache;
}

async function fetchMacroNews() {
  const now = Date.now();
  if (newsCache && now - newsCacheTime < 120_000) return newsCache;

  const feeds = await Promise.all(
    NEWS_FEEDS.map(async ([topic, url]) => {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "MacroRadar/1.0 (+local-dashboard)",
        },
      });

      if (!response.ok) throw new Error(`${topic} news RSS returned ${response.status}`);

      return parseNewsRss(await response.text(), topic);
    }),
  );

  const seen = new Set();
  const headlines = feeds
    .flat()
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
  };
  newsCacheTime = now;
  return newsCache;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(ROOT, pathname);

  if (!filePath.startsWith(ROOT)) {
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

const server = http.createServer(async (request, response) => {
  if (request.url.startsWith("/api/markets")) {
    try {
      const payload = await fetchMarkets();
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.url.startsWith("/api/news")) {
    try {
      const payload = await fetchMacroNews();
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Macro Radar dashboard running at http://localhost:${PORT}`);
});
