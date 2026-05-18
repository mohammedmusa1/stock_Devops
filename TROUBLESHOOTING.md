# CloudCart Pro — Troubleshooting

## Local Development

### `docker compose up` fails

**Symptom:** Cannot connect to Docker daemon

**Fix:**
1. Start Docker Desktop
2. Wait until whale icon shows "Running"
3. Retry: `docker compose up -d`

---

### Backend: `Invalid environment variables`

**Symptom:** Server exits on start with Zod validation errors

**Fix:**
```powershell
copy apps\backend\.env.example apps\backend\.env
# Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (min 32 chars each)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Health check: `database: error`

**Symptom:** `/api/v1/health` shows database error

**Fix:**
1. `docker compose ps` — postgres should be "healthy"
2. Verify `DATABASE_URL` matches docker-compose credentials
3. Run migrations: `cd apps/backend && npx prisma migrate dev`

---

### Health check: `redis: error`

**Symptom:** Redis check fails

**Fix:**
1. `docker compose up -d redis`
2. Test: `docker exec cloudcart-redis redis-cli ping` → `PONG`
3. Verify `REDIS_URL=redis://localhost:6379`

---

### Frontend: "Failed to load products"

**Symptom:** Products page shows error

**Fix:**
1. Confirm backend running: http://localhost:4000/api/v1/health
2. Check `apps/frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`
3. Run seed: `npm run db:seed --workspace=apps/backend`

---

### Prisma migrate fails

**Symptom:** `P1001: Can't reach database server`

**Fix:** Postgres not ready — wait 10s after `docker compose up`, retry.

---

### Port already in use

**Symptom:** `EADDRINUSE :::4000` or `:::3000`

**Fix (Windows):**
```powershell
netstat -ano | findstr :4000
taskkill /PID <pid> /F
```

---

## Docker / EC2

### Container exits immediately

```bash
docker logs cloudcart-backend
```

Common causes: missing env vars, DB not reachable (use service name `postgres` not `localhost` inside Docker network).

---

## Kubernetes

### Pod CrashLoopBackOff

```bash
kubectl describe pod <name> -n cloudcart-pro
kubectl logs <name> -n cloudcart-pro --previous
```

Check: image pull errors (ECR auth), missing secrets, failed readiness probe.

---

### ImagePullBackOff

ECR login expired on nodes. Verify IAM role for nodes includes `AmazonEC2ContainerRegistryReadOnly`.

---

## AWS / Terraform

### `terraform apply` fails on EKS

- Check IAM permissions for creating service-linked roles
- Verify region supports EKS (use us-east-1 for learning)

---

## When Stuck

1. Read error message fully — last line is usually the cause
2. Check `PROJECT_PROGRESS.md` for current step expectations
3. Search `COMMANDS_REFERENCE.md` for the command you ran
4. Ask mentor with: error text + command + what step you're on
