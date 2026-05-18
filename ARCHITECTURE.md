# StockForge AI — Architecture

## Overview

```
Browser (Next.js) ──REST──► NestJS API ──► PostgreSQL
       │                      │
       └── Socket.IO ◄────────┘ (live prices, wallet, portfolio)
                              │
                              └── Redis (cache, pub/sub future)
```

## NestJS Modules

| Module | Responsibility |
|--------|----------------|
| AuthModule | JWT, cookies, register/login |
| StocksModule | Market data CRUD |
| WalletModule | Balance, deposits, ledger |
| TradingModule | Buy/sell orders, holdings |
| PortfolioModule | P&L, positions |
| WatchlistModule | User watchlists |
| MarketModule | WebSocket gateway + price simulator |
| UsersModule | Admin user list |

## Real-Time Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `price:update` | Server → All | symbol, price, change% |
| `ticker:snapshot` | Server → All | full market array |
| `wallet:update` | Server → User room | balance |
| `portfolio:update` | Server → User room | refresh signal |

## Trading Flow (Market Order)

1. Validate balance (BUY) or holdings (SELL)
2. Lock funds for BUY
3. Execute fill at current price
4. Update holdings, wallet, ledger
5. Emit WebSocket updates

## Production Target

EC2 t3.large (Ubuntu 24.04) → Docker → k3s → ArgoCD → Prometheus/Grafana
