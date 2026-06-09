# Macro Radar — AI-Powered Macroeconomic Intelligence Platform

## Live Demo

https://macro-radar.vercel.app

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

## Recruiter Summary

Macro Radar is a deployed full-stack analytics product, not a class assignment. It combines backend API design, external data ingestion, frontend dashboard development, macro logic, alerting, resilient provider fallbacks, and AI-generated analysis in a lightweight production-ready architecture.

## Resume Bullet

Built and deployed an AI-powered macroeconomic intelligence platform integrating market data, Treasury yields, macro news, regime detection, alert logic, resilient fallbacks, and LLM-generated research analysis.
