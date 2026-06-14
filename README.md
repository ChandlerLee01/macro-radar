# Macro Radar — AI-Powered Macroeconomic Intelligence Platform

## Live Demo

https://macro-radar-eight.vercel.app

## Product Overview

Macro Radar is a deployed full-stack macroeconomic intelligence platform that integrates market data, Treasury yields, macro news, regime detection, alert logic, and AI-generated research analysis. It helps users monitor cross-asset signals, understand the current macro risk regime, and generate structured research from live market context.

## Key Features

- **AI Macro Analyst**: Generates structured macro research from user questions using live signals and optional LLM output.
- **Market Dashboard**: Tracks gold, S&P 500, the US dollar, and US 10Y Treasury yields.
- **Market Regime Engine**: Classifies the macro environment with confidence scoring.
- **Macro Alert Engine**: Detects notable moves and regime shifts across major macro indicators.
- **Interactive Asset Charts**: Displays 1D and 1W views for key market indicators.
- **News Feed**: Aggregates macro headlines across the Fed, inflation, gold, Treasury yields, the dollar, and equities.
- **Resilient Fallback System**: Keeps dashboard data available when external market or news providers fail.

## Tech Stack

- Node.js
- Vanilla JavaScript
- HTML/CSS
- Vercel
- OpenAI Responses API

## API Endpoints

- `GET /api/markets`
- `GET /api/news`
- `GET /api/brief`
- `GET /api/timeline`
- `GET /api/alerts`
- `POST /api/analyze`

## Market Data Providers

Macro Radar uses a provider chain for production market data:

1. **Alpha Vantage** for market assets such as `SPY`, `GLD`, and `UUP` proxies.
2. **FRED** for the US 10Y Treasury yield series `DGS10`.
3. **Yahoo Finance chart API** as a backup provider for market assets and chart history.
4. **U.S. Treasury yield curve XML** as a backup rates source.
5. **Local fallback data** only when real providers are unavailable.

Required environment variables for the preferred providers:

- `ALPHA_VANTAGE_API_KEY`
- `FRED_API_KEY`

The app keeps the same `/api/markets` response shape for the dashboard, regime engine, alerts, charts, brief, and AI Macro Analyst. Provider status is included in the response so production can distinguish live, backup, and fallback sources.

## Mobile App Packaging

Macro Radar includes PWA support through `public/manifest.json`, `public/sw.js`, and install metadata in `public/index.html`, so users can add the app to a mobile home screen from supported browsers.

The project is also configured with Capacitor for native iOS and Android packaging:

- App name: `Macro Radar`
- App ID: `com.jiankaili.macroradar`
- Web directory: `public`
- Server URL: `https://macro-radar-eight.vercel.app`

The native projects are generated in `ios/` and `android/`. Run `npm run cap:sync` after web changes, then use `npm run cap:ios` to open Xcode or `npm run cap:android` to open Android Studio.

## Recruiter Summary

Macro Radar is a deployed full-stack analytics product, not a class assignment. It combines backend API design, external data ingestion, frontend dashboard development, macro logic, alerting, resilient provider fallbacks, and AI-generated analysis in a lightweight production-ready architecture.

## Resume Bullet

Built and deployed an AI-powered macroeconomic intelligence platform integrating market data, Treasury yields, macro news, regime detection, alert logic, resilient fallbacks, and LLM-generated research analysis.
