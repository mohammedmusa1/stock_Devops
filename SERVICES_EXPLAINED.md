# CloudCart Pro — Services & Technologies Explained

Beginner-to-advanced reference for every technology in this project.

---

## Frontend Stack

### Next.js 15/16 (App Router)

**What:** React framework with server components, routing, and optimizations.

**Why:** Industry standard for production React — SSR for SEO, API routes, image optimization.

**Alternatives:** Remix, Nuxt (Vue), SvelteKit

| Pros | Cons |
|------|------|
| Great DX, Vercel ecosystem | Learning curve for App Router |
| Built-in routing | Vendor coupling if using Vercel-only features |

**Enterprise usage:** Nike, Netflix, Twitch use Next.js patterns.

---

### TypeScript

**What:** JavaScript with static types.

**Why:** Catch bugs at compile time, better IDE support, self-documenting code.

**CloudCart:** `strict: true` in all tsconfig files.

---

### Tailwind CSS

**What:** Utility-first CSS framework.

**Why:** Fast UI development, consistent design tokens, small production bundle (purges unused).

**Alternatives:** CSS Modules, styled-components, MUI

---

### ShadCN UI

**What:** Copy-paste Radix UI components styled with Tailwind (you own the code).

**Why:** Accessible, customizable, not a heavy npm dependency blob.

**Setup (when ready):** `npx shadcn@latest init` in frontend folder.

---

### React Query (TanStack Query)

**What:** Server state management — caching, refetching, loading states.

**Why:** Better than useEffect + fetch for API data. Handles stale data, retries.

**CloudCart usage:** Products list, user profile on dashboard.

---

### Zod

**What:** Schema validation library.

**Why:** Validate API inputs and form data with TypeScript inference.

**Used in:** Backend `env.ts`, auth validators, frontend login form.

---

## Backend Stack

### Node.js + Express

**What:** JavaScript runtime + minimal HTTP framework.

**Why:** Huge ecosystem, same language as frontend, interview-friendly.

**Alternatives:** Fastify (faster), NestJS (opinionated), Go, Java Spring

**Enterprise:** PayPal, Netflix, LinkedIn use Node for APIs.

---

### Prisma ORM

**What:** Type-safe database client + migration tool.

**Why:** Auto-generated types from schema, readable queries, migration history.

**Alternatives:** TypeORM, Drizzle, raw SQL

**vs raw SQL:** Prisma prevents SQL injection by default; easier for teams.

---

### PostgreSQL

**What:** Open-source relational database (ACID compliant).

**Why chosen for CloudCart:**
- **ACID transactions** — order + payment + inventory must succeed or rollback together
- **Relations** — users → orders → items → products
- **Indexing** — fast lookups on email, slug, order number
- **JSON columns** — variant attributes, payment metadata
- **Mature** — 30+ years of reliability

**Alternatives:** MySQL (similar), MongoDB (document — weaker transactions for orders)

**Key concepts:**
- **Normalization:** separate tables reduce duplication (User not repeated in every Order row)
- **Indexes:** B-tree structures speeding WHERE clauses — add on frequently queried columns
- **Migrations:** version-controlled schema changes via Prisma

---

### Redis

**What:** In-memory key-value store.

**Uses in CloudCart:**
| Use | How |
|-----|-----|
| Caching | Store product list 60s — reduce DB load |
| Sessions | User session data (with Cognito later) |
| Rate limiting | Count requests per IP in sliding window |
| Queues (future) | BullMQ for async emails |

**Alternatives:** Memcached (cache only), Amazon ElastiCache (managed Redis)

---

## Authentication

### JWT (JSON Web Tokens)

**What:** Signed token containing claims (user id, role).

**Access token:** Short-lived, sent with each request.

**Refresh token:** Long-lived, used only to get new access tokens.

### HTTP-Only Cookies

**What:** Cookies JavaScript cannot read.

**Why:** Even if XSS exists, attacker cannot steal token from `document.cookie`.

### AWS Cognito (Phase 2)

**What:** Managed auth — signup, MFA, OAuth, user pools.

**Why:** Don't build auth from scratch in production — security is hard.

**Alternatives:** Auth0, Firebase Auth, Keycloak (self-hosted)

### OAuth / Google Login

User clicks "Sign in with Google" → Google authenticates → Cognito federates → your app gets JWT.

### MFA

Second factor (SMS, TOTP app) after password — stops credential-stuffing attacks.

### SSO

Single Sign-On — one login for multiple internal apps (SAML/OIDC — enterprise feature).

---

## Payments

### Stripe

International cards, subscriptions, Checkout hosted page.

### Razorpay

India-focused — UPI, NetBanking, wallets.

**Webhooks:** Provider POSTs to your `/webhooks/stripe` when payment succeeds — always verify signature.

---

## DevOps Tools

| Tool | Purpose | When in Project |
|------|---------|-----------------|
| **Docker** | Container packaging | Step 2 |
| **Docker Compose** | Multi-container local | Step 3 |
| **Kubernetes** | Container orchestration | Step 6 |
| **Helm** | K8s package manager | Step 7 |
| **Terraform** | Infrastructure as Code | Step 5 |
| **Ansible** | Server configuration | Optional EC2 setup |
| **Jenkins** | CI/CD pipelines | Step 8 |
| **ArgoCD** | GitOps deployment | Step 9 |
| **Prometheus** | Metrics | Step 10 |
| **Grafana** | Dashboards | Step 10 |
| **Loki** | Log aggregation | Step 11 |

---

## AWS Services Summary

See [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md) for full details.

**Networking logic:** Public subnets face internet; private subnets hide databases. NAT Gateway lets private subnets reach internet for updates without inbound access.

**Scaling logic:** Start single EC2 → EKS with HPA → RDS read replicas → CloudFront CDN as traffic grows.

**Security logic:** IAM roles, security groups, private RDS, Secrets Manager, HTTPS everywhere.

---

## Coupon System Logic (Designed)

```
1. User enters code at checkout
2. Validate: active? not expired? usage limit? min order? scope (product/category/user)?
3. Calculate: PERCENTAGE | FIXED | FREE_SHIPPING
4. Apply maxDiscount cap
5. Increment usageCount atomically (prevent race abuse)
6. Store couponId on Order
```

**Abuse prevention:** per-user limits (`UserCoupon`), rate limit coupon attempts, admin-only creation.

---

## Inventory Logic (Designed)

```
available = quantity - reservedQty
On checkout: reservedQty += qty (hold stock)
On payment success: quantity -= qty, reservedQty -= qty
On payment fail/timeout: reservedQty -= qty (release hold)
Low stock: quantity <= lowStockThreshold → alert admin
```
