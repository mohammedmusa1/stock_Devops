# stock_Devops

Welcome to the **stock_Devops** code repository. This branch is a premium, **code-only** version of the project workspace. 

> [!IMPORTANT]
> **DevOps & Infrastructure Omission Notice**
> To keep this repository secure, lightweight, and focused purely on application code, all deployment configurations, infrastructure templates, automation scripts, Docker files, and environment secrets have been omitted. This includes:
> - **Infrastructure as Code (IaC):** Terraform templates (`infrastructure/terraform/`, `AWS_SETUP_GUIDE.md`)
> - **Orchestration & GitOps:** Kubernetes manifests, Helm charts, ArgoCD configurations (`infrastructure/k8s/`, `infrastructure/helm/`, `ARGOCD_GUIDE.md`)
> - **Continuous Integration (CI/CD):** Jenkins pipelines, Ansible playbooks (`infrastructure/ci-cd/`, `infrastructure/ansible/`, `JENKINS_GUIDE.md`)
> - **Containerization:** Dockerfiles, Docker Compose configurations (`docker/`, `docker-compose*.yml`, `.dockerignore`, `Dockerfile` files)
> - **DevOps Scripts:** Setup, verification, bootstrap, and cleanup script files (`scripts/`, `*.bat`, `*.sh`, `*.ps1`)
> - **Secrets & Configurations:** All `.env` files, SSH keys, PEM keys, and API credentials

---

## 🏗️ Project Architecture & Subprojects

The repository is structured as a monorepo containing two distinct application ecosystems:

```
stock_Devops (Monorepo)
├── apps/
│   ├── api/          <-- StockForge AI Backend API (NestJS, Prisma, PostgreSQL, Redis)
│   ├── web/          <-- StockForge AI Web Terminal (Next.js 16, Tailwind, Framer Motion)
│   ├── backend/      <-- CloudCart Pro Backend API (Express, TypeScript, Prisma, PostgreSQL)
│   └── frontend/     <-- CloudCart Pro Web Frontend (Next.js 16, React Query, Tailwind)
├── package.json      <-- Root package config (defines StockForge workspaces)
└── README.md         <-- This documentation
```

---

## 🛠️ Global Prerequisites

Before installing any of the subprojects, ensure you have the following services running locally on your machine:

- **Node.js:** `>=20.0.0` (with `npm >=10.0.0`)
- **PostgreSQL:** `>=15.0` (Active database server)
- **Redis:** `>=7.0` (Active key-value store for caching and session management)

---

## 🚀 1. StockForge AI Setup (Active Project)

StockForge AI is a state-of-the-art stock trading terminal & portfolio management platform. It uses **NestJS 11** for the backend API and **Next.js 16** for the trading terminal UI.

### Step 1.1: Install Dependencies
From the root directory (`d:\stockdevops`), run:
```bash
npm install
```
*Note: This will install all dependencies for both the `apps/api` and `apps/web` workspaces using npm workspaces.*

### Step 1.2: Environment Setup
Configure the environment variables by copying the examples:

1. **Backend API (`apps/api/.env`)**:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
   Open `apps/api/.env` and update your PostgreSQL connection URL, Redis URL, and JWT secrets:
   ```env
   DATABASE_URL="postgresql://stockforge:stockforge_dev_password@localhost:5432/stockforge_ai?schema=public"
   REDIS_URL="redis://localhost:6379"
   JWT_ACCESS_SECRET="generate_random_hex_64_chars"
   JWT_REFRESH_SECRET="generate_random_hex_64_chars"
   ```

2. **Frontend UI (`apps/web/.env.local`)**:
   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   ```

### Step 1.3: Run Database Migrations & Seeding
Prepare your PostgreSQL database schema and populate it with initial trading mock assets:
```bash
# Generate Prisma Client & run migrations
npm run db:migrate --workspace=apps/api

# Seed the database with trading data and demo accounts
npm run db:seed --workspace=apps/api
```

### Step 1.4: Run the Application Locally
To run both the NestJS API and Next.js Web Terminal concurrently:
```bash
npm run dev
```

Alternatively, you can run them individually:
* **Run API Only:** `npm run dev:api` (Runs on `http://localhost:4000`)
* **Run Web Terminal Only:** `npm run dev:web` (Runs on `http://localhost:3000`)

---

## 🛍️ 2. CloudCart Pro Setup (Legacy Project)

CloudCart Pro is a high-performance e-commerce platform. It uses **Express + TypeScript** for the backend API and **Next.js 16** for the frontend store.

### Step 2.1: Install Dependencies
Navigate into each workspace and install their respective node modules:

```bash
# Install Backend dependencies
cd apps/backend
npm install

# Install Frontend dependencies
cd ../frontend
npm install
```

### Step 2.2: Environment Setup
Configure the local environment files for both services:

1. **Backend API (`apps/backend/.env`)**:
   ```bash
   cd apps/backend
   cp .env.example .env
   ```
   Open `.env` and verify your connection strings:
   ```env
   PORT=4000
   DATABASE_URL="postgresql://cloudcart:cloudcart_dev_password@localhost:5432/cloudcart_pro?schema=public"
   REDIS_URL="redis://localhost:6379"
   CORS_ORIGIN="http://localhost:3000"
   JWT_ACCESS_SECRET="generate_random_hex_64_chars"
   ```

2. **Frontend Store (`apps/frontend/.env.local`)**:
   ```bash
   cd ../frontend
   cp .env.local.example .env.local
   ```

### Step 2.3: Database Setup for CloudCart
Initialize the PostgreSQL schema and client for the CloudCart backend:
```bash
cd ../backend
# Generate Prisma Client
npm run db:generate

# Execute database migrations
npm run db:migrate
```

### Step 2.4: Run the Application Locally
Run the backend and frontend separately in two terminal windows:

* **Terminal 1 (Backend API):**
  ```bash
  cd apps/backend
  npm run dev
  ```
  *(Runs on `http://localhost:4000/api/v1`)*

* **Terminal 2 (Frontend Store):**
  ```bash
  cd apps/frontend
  npm run dev
  ```
  *(Runs on `http://localhost:3000`)*

---

## 💎 Demo Credentials (StockForge AI)
To test the live stock-trading terminal terminal UI immediately, log in using the following credentials:

* **Trader Account:**
  - **Email:** `trader@stockforge.local`
  - **Password:** `Trader@12345`
  - **Starting Wallet Balance:** ₹5,00,000
* **Admin Account:**
  - **Email:** `admin@stockforge.local`
  - **Password:** `Admin@12345`

---

## 📈 Supported API Routes (StockForge AI Phase 1)

* **Authentication:**
  - `POST /auth/register` — Register a new trader account
  - `POST /auth/login` — Log in and retrieve session tokens
  - `POST /auth/refresh` — Refresh expired JWT access token
  - `POST /auth/logout` — Revoke session token
  - `GET /auth/me` — Retrieve active session profile details
* **Market Data:**
  - `GET /stocks` — Retrieve list of tracked stock tickers
  - `GET /stocks/:symbol` — Retrieve single ticker statistics
* **Portfolio & Wallet:**
  - `GET /portfolio` — Get active stocks holding summary
  - `GET /wallet` — Get current wallet balance
  - `POST /wallet/deposit` — Simulate deposit of funds into wallet
* **Trading Terminal:**
  - `POST /trading/:symbol/order` — Place a market BUY or SELL order
  - `GET /trading/orders` — Retrieve complete history of placed orders
* **Watchlist Management:**
  - `GET /watchlist/:symbol` — Verify if a stock is watchlisted
  - `POST /watchlist/:symbol` — Add a stock symbol to watchlist
  - `DELETE /watchlist/:symbol` — Remove a stock symbol from watchlist
* **Realtime WebSockets (Socket.IO):**
  - `price:update` — Real-time live stock pricing ticks
  - `ticker:snapshot` — Daily market summary ticks
  - `wallet:update` — Live trader wallet adjustment notifications
  - `portfolio:update` — Live portfolio valuation shifts
