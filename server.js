const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const STOOQ_URL =
  "https://stooq.com/q/l/?s=xauusd+%5Espx+dx.f&f=sd2t2ohlcv&h&e=csv";
const TREASURY_URL = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${new Date().getFullYear()}`;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

let cache = null;
let cacheTime = 0;

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

async function fetchMarkets() {
  const now = Date.now();
  if (cache && now - cacheTime < 30_000) return cache;

  const [stooqResponse, treasuryResponse] = await Promise.all([
    fetch(STOOQ_URL),
    fetch(TREASURY_URL),
  ]);

  if (!stooqResponse.ok) throw new Error(`Stooq returned ${stooqResponse.status}`);
  if (!treasuryResponse.ok) throw new Error(`Treasury returned ${treasuryResponse.status}`);

  const quotes = Object.fromEntries(
    parseCsv(await stooqResponse.text()).map((row) => [row.Symbol.toUpperCase(), row]),
  );
  const treasury = parseTreasuryXml(await treasuryResponse.text());
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
      down: tenYearChange < 0,
    },
  ];

  cache = {
    updatedAt: new Date().toISOString(),
    markets,
    ...buildSummary(markets),
    sources: ["Stooq CSV", "U.S. Treasury yield curve XML"],
  };
  cacheTime = now;
  return cache;
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

  serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Macro Radar dashboard running at http://localhost:${PORT}`);
});
