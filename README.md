# Macro Radar

Macro Radar is an AI-powered macroeconomic intelligence platform for monitoring market regimes, tracking macro signals, and generating investment-oriented research from live market data and news.

It is built as a lightweight recruiter-ready MVP: one Node.js server, vanilla HTML/CSS/JS, Vercel-compatible API routes, live external data sources, optional OpenAI analysis, and high-quality local fallbacks when no API key is configured.

For educational and research purposes only. Not financial advice.

## Recruiter-Friendly Summary

Macro Radar demonstrates full-stack product engineering without a heavy framework: live market-data ingestion, macro news parsing, regime detection, alerting, local persistence, LLM integration, fallback reasoning, and a polished responsive dashboard. The app is intentionally deployable on Vercel and easy to inspect because the architecture stays close to Node.js and browser-native JavaScript.

Example resume bullet:

> Built and deployed an AI-powered macroeconomic intelligence platform integrating live market data, Treasury yields, macro news, regime detection, alerts, and LLM-generated research analysis.

## Key Features

- AI Macro Analyst that answers user questions with structured market research
- Optional OpenAI Responses API integration with local fallback analysis
- Live macro dashboard for gold, S&P 500, DXY, and US 10Y Treasury yield
- 1D and 1W interactive asset charts
- Market regime engine with confidence scoring
- Macro alert engine with severity levels and local alert history
- Daily Macro Brief generated from regime, asset moves, yields, dollar, gold, and news
- Historical timeline of saved daily briefs and past regimes
- Live macro news section covering the Fed, inflation, gold, Treasury yields, US dollar, and S&P 500
- Vercel-compatible serverless API endpoints

## AI Macro Analyst

The homepage includes an AI Macro Analyst section where users can ask macro and market questions such as:

- Is gold bullish over the next 3 months?
- What does a stronger dollar mean for equities?
- How should investors read rising Treasury yields?
- What is today's macro risk regime?

The analyst returns product-ready structured output:

- Overall View: Bullish, Neutral, Bearish, or Mixed
- Confidence Score
- Key Drivers
- Bullish Factors
- Bearish Factors
- Watch Next
- Short Explanation
- Internal signals used, including regime, S&P 500, gold, DXY, and US10Y

When `OPENAI_API_KEY` is configured, the backend calls the OpenAI Responses API and asks for concise structured JSON. If the key is missing or the call fails, the app returns a local research fallback based on the current market data, regime, asset moves, yields, dollar, gold, and news topics.

## API Endpoints

### `GET /api/markets`

Returns live market cards, charts, current regime, and dashboard summary.

### `GET /api/news`

Returns filtered macro headlines from Google News RSS.

### `GET /api/brief`

Returns the current daily macro brief and saves it locally.

### `GET /api/timeline`

Returns saved daily brief history.

### `GET /api/alerts`

Returns macro alerts and alert history.

### `POST /api/analyze`

Generates structured AI Macro Analyst research for a user question.

Request:

```json
{
  "question": "What does a stronger dollar mean for equities?"
}
```

Response:

```json
{
  "question": "What does a stronger dollar mean for equities?",
  "overallView": "Bullish | Neutral | Bearish | Mixed",
  "confidence": 72,
  "keyDrivers": ["...", "..."],
  "bullishFactors": ["...", "..."],
  "bearishFactors": ["...", "..."],
  "watchNext": ["...", "..."],
  "explanation": "...",
  "signalsUsed": {
    "regime": "...",
    "spx": "...",
    "gold": "...",
    "dxy": "...",
    "tenYear": "..."
  },
  "provider": "openai"
}
```

`provider` is `openai` when OpenAI generated the analysis and `local` when the built-in fallback generated it.

## Tech Stack

- Node.js HTTP server
- Vanilla HTML, CSS, and JavaScript in `public/`
- Vercel serverless API compatibility
- Stooq market data
- U.S. Treasury yield curve XML
- Google News RSS
- Optional OpenAI Responses API
- Local JSON persistence for generated briefs and alerts

## Run Locally

```bash
git clone https://github.com/ChandlerLee01/macro-radar.git
cd macro-radar
cp .env.example .env
npm start
```

Open:

```text
http://localhost:4173
```

Run checks:

```bash
npm run check
```

## Environment Variables

Create a `.env` file from `.env.example`.

```bash
PORT=4173
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.4-mini
DATA_DIR=
```

`OPENAI_API_KEY` is optional. If it is missing or invalid, the app uses local fallback summaries and local AI Macro Analyst research.

`DATA_DIR` is optional locally. By default, local alert and brief history is written to `alerts/` and `briefs/` in the project folder.

Do not commit `.env`. It is ignored by Git.

## Local Data

The app creates local runtime history:

```text
alerts/
briefs/
```

These folders store generated alert history and daily briefs. They are ignored by Git because they are machine-local runtime data.

On Vercel, runtime history is written to `/tmp/macro-radar` unless `DATA_DIR` is set. Vercel serverless filesystem storage is ephemeral, so alerts and briefs can reset between cold starts or deployments. Use a database or durable storage provider before relying on historical data in production.

## Deploy on Vercel

The project includes:

```text
api/markets.js
api/news.js
api/brief.js
api/timeline.js
api/alerts.js
api/analyze.js
vercel.json
package.json
.vercelignore
```

Vercel serves the static dashboard files from `public/`. The API endpoints are implemented as Vercel serverless functions in `api/`.

### Vercel Environment Variables

Set these in Vercel Project Settings:

```text
OPENAI_API_KEY optional
OPENAI_MODEL optional, defaults to gpt-5.4-mini
DATA_DIR optional, defaults to /tmp/macro-radar on Vercel
```

Do not set `PORT` on Vercel. Vercel provides the HTTP runtime.

### Deploy

```bash
vercel
```

For production:

```bash
vercel --prod
```

After deployment, verify:

```text
/api/markets
/api/news
/api/brief
/api/timeline
/api/alerts
/api/analyze
```

## Roadmap

- Add provider health indicators for market data and news feeds
- Add configurable alert thresholds
- Add export/download for briefs and alert history
- Add better chart history providers for 1W data
- Add automated tests for regime scoring, alerts, and analyst response validation
- Add durable storage for hosted historical alerts and briefs
- Add screenshot assets and a public demo walkthrough
