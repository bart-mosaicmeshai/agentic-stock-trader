# Agentic Stock Trader

An AI-powered stock trading system built with Model Context Protocol (MCP) that autonomously analyzes market data and makes trading decisions.

## Overview

This project implements an agentic stock trading system that uses MCP servers to:
- Fetch real-time and historical stock market data
- Analyze market trends and patterns
- Generate trading signals
- Execute trades (paper trading mode)
- Track portfolio performance

## Architecture

The system uses the Model Context Protocol (MCP) to modularize different trading components:
- **Market Data Server**: Provides stock prices, charts, and market information
- **Analysis Server**: Technical analysis indicators and pattern recognition
- **Trading Agent**: Main decision-making component that coordinates analysis and execution

## Setup

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure your API keys and settings.

## Usage

```bash
npm start
```

## Development

This project is in active development. Contributions welcome!

## License

MIT
