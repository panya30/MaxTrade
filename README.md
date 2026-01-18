# MaxTrade

AI-Powered Quantitative Trading System

## Features

- 📊 **Multi-Factor Analysis** - Momentum, value, quality, technical factors
- 🤖 **AI Integration** - OpenAI, sentiment analysis, market insights
- 📈 **Strategy Framework** - Extensible plugin architecture
- 🔄 **Backtesting** - Commission-aware historical simulation
- 🌐 **Real-time Data** - Multiple data sources (Binance, Yahoo, etc.)
- 📱 **Web Dashboard** - Interactive charts and controls

## Quick Start

```bash
# Clone
git clone https://github.com/panya30/MaxTrade.git
cd MaxTrade

# Install
bun install

# Run
bun run dev
```

## Project Structure

```
src/
├── fetchers/      # Data sources
├── factors/       # Factor analysis
├── strategies/    # Trading strategies
├── backtest/      # Backtesting engine
├── ai/            # AI/ML modules
├── storage/       # Database, cache
├── web/           # API & dashboard
└── utils/         # Helpers
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Strategies Guide](docs/STRATEGIES.md)
- [API Reference](docs/API.md)

## Disclaimer

This software is for educational and research purposes only. Trading involves substantial risk of loss. Past performance does not guarantee future results.

## License

MIT
