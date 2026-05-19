# CloudCart Pro — Complete Learning Guide

**Your path from zero to production-ready engineer.**

---

## Phase 0: Foundations (Week 1)

Before coding, understand:

| Topic | Resource |
|-------|----------|
| How the internet works | DNS, HTTP, TCP/IP basics |
| Git | `git init`, `add`, `commit`, `push` |
| Terminal | `cd`, `ls`, environment variables |
| JavaScript/TypeScript basics | variables, async/await, promises |

**Exercise:** Clone this repo, read README, run setup script.

---

## Phase 1: Local Full Stack (Weeks 2–4) ← YOU ARE HERE

### Goals
- Run frontend + backend + database locally
- Understand request flow browser → API → database
- Implement auth and product browsing

### Steps
1. ✅ Run `.\scripts\setup-local.ps1`
2. ✅ Explore Prisma schema — draw ER diagram on paper
3. ✅ Test APIs with curl (see COMMANDS_REFERENCE.md)
4. ✅ Login via UI, view dashboard
5. ⏳ Read every file in `apps/backend/src/` with mentor
6. ⏳ Add product detail page
7. ⏳ Implement cart API

### Concepts to Master
- REST API design
- JWT + cookies
- Prisma migrations
- React Query caching
- Zod validation

### Interview Questions You Can Answer
- "Explain how login works in your project"
- "Why PostgreSQL over MongoDB for e-commerce?"
- "What is middleware in Express?"

---

## Phase 2: Docker (Week 5)

### Goals
- Containerize backend
- Understand images vs containers vs volumes

### Steps
1. Build Dockerfile
2. Run backend container linked to compose network
3. Full stack in Docker Compose

### Concepts
- Layer caching in Docker builds
- Multi-stage builds
- `.dockerignore`

---

## Phase 3: Cloud Basics — EC2 (Week 6)

### Goals
- Deploy on real AWS server
- Nginx reverse proxy + SSL

### Steps
1. Create AWS account + IAM user
2. Launch EC2, configure security groups
3. SSH, install Docker, deploy compose
4. Point domain (optional) with Route53

Read: [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md)

---

## Phase 4: Infrastructure as Code (Weeks 7–8)

### Goals
- Provision VPC, RDS, EKS with Terraform
- Understand state, modules, variables

Read: [TERRAFORM_GUIDE.md](./TERRAFORM_GUIDE.md)

**Warning:** Destroy resources when not studying to avoid bills.

---

## Phase 5: Kubernetes (Weeks 9–11)

### Goals
- Deploy pods, services, ingress on EKS
- Helm charts for environment config
- HPA, probes, rolling updates

Read: [KUBERNETES_GUIDE.md](./KUBERNETES_GUIDE.md)

---

## Phase 6: CI/CD & GitOps (Weeks 12–13)

### Goals
- Jenkins pipeline: test → build → push ECR
- ArgoCD sync from Git
- Blue-green or canary deploy

Read: [JENKINS_GUIDE.md](./JENKINS_GUIDE.md), [ARGOCD_GUIDE.md](./ARGOCD_GUIDE.md)

---

## Phase 7: Observability & Security (Week 14)

### Goals
- Prometheus metrics + Grafana dashboards
- Loki logs
- Security hardening checklist

Read: [MONITORING_GUIDE.md](./MONITORING_GUIDE.md), [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)

---

## Phase 8: Advanced Features (Ongoing)

- AWS Cognito + Google OAuth
- Stripe + Razorpay webhooks
- Coupon admin panel
- Email system (SES/Resend)
- Admin analytics charts

---

## Resume Bullet Templates

After completing phases, adapt:

> Built **CloudCart Pro**, a production-grade e-commerce platform on **AWS EKS** with **Terraform** IaC, **GitOps** (ArgoCD), **CI/CD** (Jenkins), and observability (**Prometheus/Grafana/Loki**). Implemented **JWT/RBAC** auth, **PostgreSQL/Prisma** data layer, **Redis** caching, and payment integration (**Stripe/Razorpay**).

---

## Daily Study Routine (Suggested)

| Time | Activity |
|------|----------|
| 30 min | Read documentation / watch concept video |
| 60 min | Code feature or fix bug |
| 15 min | Update PROJECT_PROGRESS.md |
| 15 min | Practice explaining one component out loud |

---

## How to Continue After Interruption

1. Open **PROJECT_PROGRESS.md**
2. Find "Pending Tasks" and "Next Immediate Steps"
3. Run health check commands
4. Tell AI: "Continue CloudCart Pro from PROJECT_PROGRESS.md Step X"

---

## Mentor Rules

When learning with AI mentor:
- Ask "why" for every architecture decision
- Run every command yourself — don't just read
- Break things on purpose (stop Redis, wrong password) to learn errors
- Update PROJECT_PROGRESS.md after each session

**You are building real skills, not just a README. Go step by step.**
