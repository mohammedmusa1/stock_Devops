# CloudCart Pro — Commands Reference

Every command explained with expected output and troubleshooting.

---

## Docker

### `docker compose up -d`

| | |
|---|---|
| **What** | Starts PostgreSQL and Redis in background |
| **Why** | Backend needs database and cache locally |
| **Expected** | `Container cloudcart-postgres Started` |
| **If fails** | Docker Desktop not running |

### `docker compose down`

Stops and removes containers. Add `-v` to delete data volumes (fresh DB).

### `docker compose logs -f postgres`

Follow Postgres logs. Look for `database system is ready to accept connections`.

### `docker ps`

Lists running containers. Verify `cloudcart-postgres` and `cloudcart-redis` are Up.

---

## npm (Root)

### `npm install`

Installs root + workspace dependencies (backend + frontend).

### `npm run dev`

Runs backend and frontend concurrently via `concurrently`.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:4000 |

### `npm run db:migrate`

Runs `prisma migrate dev` in backend — applies schema changes.

### `npm run db:seed`

Inserts admin user, sample product, coupon.

---

## Backend (`apps/backend`)

### `npm run dev`

Starts Express with hot reload (`tsx watch`). Output:
```
CloudCart Pro API running on http://localhost:4000
```

### `npx prisma generate`

Regenerates Prisma Client after `schema.prisma` changes. Run after every schema edit.

### `npx prisma migrate dev --name <name>`

Creates SQL migration + applies it. Prompts for migration name if omitted.

### `npx prisma studio`

Opens GUI at http://localhost:5555 to browse/edit database tables.

### `npm run build`

Compiles TypeScript to `dist/`. Required before `npm start` (production).

---

## Frontend (`apps/frontend`)

### `npm run dev`

Next.js dev server on port 3000. Shows compile errors in terminal.

### `npm run build`

Production build. Must pass with zero TypeScript errors.

---

## Git

### `git init`

Initialize repo (run once at root if not already).

### `git status`

Shows changed files before commit.

---

## curl / API Testing

### Health check

```powershell
curl http://localhost:4000/api/v1/health
```

**Expected:**
```json
{"success":true,"service":"cloudcart-pro-api","checks":{"api":"ok","database":"ok","redis":"ok"}}
```

### Register

```powershell
curl -X POST http://localhost:4000/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"Test@1234","firstName":"Test","lastName":"User"}'
```

### Login (PowerShell — saves cookies)

```powershell
curl -X POST http://localhost:4000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@cloudcart.local","password":"Admin@12345"}' `
  -c cookies.txt
```

---

## Terraform

| Command | Purpose |
|---------|---------|
| `terraform init` | Download providers |
| `terraform plan` | Preview changes |
| `terraform apply` | Create/update infrastructure |
| `terraform destroy` | Remove all managed resources |

---

## kubectl

| Command | Purpose |
|---------|---------|
| `kubectl get pods -n cloudcart-pro` | List pods |
| `kubectl logs -f <pod> -n cloudcart-pro` | Stream logs |
| `kubectl describe pod <pod> -n cloudcart-pro` | Debug failures |
| `kubectl apply -f file.yaml` | Deploy manifest |

---

## AWS CLI

```bash
aws sts get-caller-identity    # Verify AWS credentials
aws eks update-kubeconfig --name cloudcart-pro --region us-east-1
aws ecr get-login-password --region us-east-1 | docker login ...
```

---

## Generate JWT Secrets

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice — one for `JWT_ACCESS_SECRET`, one for `JWT_REFRESH_SECRET`.
