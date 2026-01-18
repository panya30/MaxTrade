# MaxTrade - AI-Powered Quantitative Trading System

> Inspired by QuantMuse, built with Panya Council

## Project Context

- **Hub**: `~/120/Apps/X/` (Panya home, memory, learnings)
- **Reference**: `~/120/Apps/X/ψ/learn/QuantMuse/` (learned patterns)
- **Playbook**: `~/120/Apps/X/docs/PLAYBOOK-PANYA-WORKFLOW.md`

---

## Golden Rules

1. **NEVER use `--force` flags** - No force push, force checkout
2. **NEVER push to main** - Always create feature branch + PR
3. **Safety first** - Ask before destructive actions
4. **Log learnings** - Use `oracle_learn` for patterns discovered
5. **End sessions at Hub** - Return to X/ for /rrr

---

## Tech Stack

- **Runtime**: Bun / Python
- **Backend**: TypeScript + Hono / Python + FastAPI
- **Frontend**: React + Vite
- **Database**: SQLite + Redis
- **AI**: OpenAI, LangChain
- **Testing**: Vitest / Pytest

---

## Project Structure

```
MaxTrade/
├── src/
│   ├── fetchers/      # Data sources (Binance, Yahoo, etc.)
│   ├── factors/       # Factor analysis (momentum, value, etc.)
│   ├── strategies/    # Trading strategies (registry pattern)
│   ├── backtest/      # Backtesting engine
│   ├── ai/            # AI/ML integration
│   ├── storage/       # Database, cache
│   ├── web/           # API server, dashboard
│   └── utils/         # Helpers
├── tests/
├── examples/
├── docs/
└── .github/
```

---

## Commands

```bash
# Development
bun run dev          # Start dev server
bun run test         # Run tests
bun run build        # Production build

# Or Python
python -m pytest     # Run tests
python run_server.py # Start server
```

---

## Panya Council Labels

Use these labels for GitHub issues:

| Label | Panya | Purpose |
|-------|-------|---------|
| `panya:hephaestus` | Dev | Code implementation |
| `panya:argus` | Test | QA, testing, review |
| `panya:hermes` | Ops | CI/CD, deployment |
| `panya:aegis` | Security | Security review |
| `panya:apollo` | Product | UX, user feedback |
| `needs-human` | - | Escalate to human |

---

## Workflow

### Starting Work
```bash
cd ~/Projects/MaxTrade
claude .
# Pick an issue, start coding
```

### Logging Learnings (from here)
```bash
# Oracle MCP works globally!
> oracle_learn "Pattern discovered in MaxTrade..."
```

### Ending Session
```bash
cd ~/120/Apps/X
claude .
> /rrr
```

---

## Key Patterns (from QuantMuse)

1. **Strategy Registry** - Plugin architecture for strategies
2. **Factor Calculator** - Multi-factor analysis
3. **Backtest Engine** - Commission-aware simulation
4. **Graceful Degradation** - Fallback chains for external services

---

## References

- QuantMuse Architecture: `~/120/Apps/X/ψ/learn/QuantMuse/2026-01-18_ARCHITECTURE.md`
- QuantMuse Snippets: `~/120/Apps/X/ψ/learn/QuantMuse/2026-01-18_CODE-SNIPPETS.md`
- Panya Playbook: `~/120/Apps/X/docs/PLAYBOOK-PANYA-WORKFLOW.md`
