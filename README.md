# Macro Radar

Macro Radar is a local market dashboard for monitoring macro conditions across equities, gold, the US dollar, Treasury yields, macro headlines, market regimes, daily briefs, and alert history.

It is designed as a lightweight public-beta prototype: one Node server, static frontend files, live external data sources, and local JSON history for briefs and alerts.

## Key Features

- Live macro dashboard for gold, S&P 500, DXY, and US 10Y Treasury yield
- 1D and 1W interactive asset charts
- Market regime engine with confidence scoring
- Macro alert engine with severity levels and local alert history
- Daily Macro Brief generated from regime, asset moves, yields, dollar, gold, and news
- Historical timeline of saved daily briefs and past regimes
- Live macro news section covering the Fed, inflation, gold, Treasury yields, US dollar, and S&P 500
- Optional OpenAI-generated market summary with local fallback when no API key is configured

## Tech Stack

- Node.js HTTP server
- Vanilla HTML, CSS, and JavaScript
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
node server.js
```

Or:

```bash
npm start
```

Open:

```text
http://localhost:4173
```

## Environment Variables

Create a `.env` file from `.env.example`.

```bash
PORT=4173
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.4-mini
DATA_DIR=
```

`OPENAI_API_KEY` is optional. If it is missing or invalid, the app uses a local fallback summary.

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
api/index.js
vercel.json
package.json
.vercelignore
```

Vercel serves the static dashboard files from the project root and rewrites `/api/*` requests to the serverless API handler.

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
```

## Screenshots

Add screenshots here before public beta distribution.

```text
screenshots/dashboard.png
screenshots/regime-and-alerts.png
screenshots/daily-brief-and-timeline.png
```

## Roadmap

- Add provider health indicators for market data and news feeds
- Add configurable alert thresholds
- Add export/download for briefs and alert history
- Add better chart history providers for 1W data
- Add automated tests for regime scoring, alerts, and brief generation
- Add deployment configuration for hosted beta environments
- Add screenshot assets and a public demo walkthrough
