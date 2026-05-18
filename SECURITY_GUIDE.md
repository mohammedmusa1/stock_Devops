# CloudCart Pro — Security Guide

## Defense in Depth

Security is layered — no single control is enough.

```
Internet → WAF/CloudFront → ALB → Ingress → App Middleware → Auth → DB
```

---

## Application Security (Implemented / Planned)

| Threat | Protection | Status |
|--------|------------|--------|
| SQL Injection | Prisma parameterized queries | ✅ |
| XSS | React escaping + Helmet CSP | ✅ Partial |
| CSRF | SameSite cookies + future CSRF tokens | ✅ Partial |
| Brute force | express-rate-limit | ✅ |
| JWT theft | HTTP-only cookies | ✅ |
| Secrets in Git | .gitignore + Secrets Manager | ✅ / Phase 2 |

---

## Authentication Security

### Access vs Refresh Tokens

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access | 15 min | HTTP-only cookie | API authorization |
| Refresh | 7 days | HTTP-only cookie + DB | Get new access token |

**Why short access tokens?** If stolen, attacker has limited window.

### Cookie Flags

```typescript
{
  httpOnly: true,   // JavaScript cannot read (blocks XSS theft)
  secure: true,     // HTTPS only (production)
  sameSite: 'lax',  // CSRF mitigation
}
```

---

## RBAC (Role-Based Access Control)

| Role | Permissions |
|------|-------------|
| USER | Browse, cart, own orders |
| VENDOR | Manage own products/inventory |
| ADMIN | Full platform, coupons, analytics |

Middleware: `authorize('ADMIN')` on admin routes.

---

## AWS IAM Best Practices

1. **Least privilege** — each service gets only required permissions
2. **No root keys** — use IAM users/roles
3. **MFA** on all human accounts
4. **Rotate keys** every 90 days
5. **Use roles for EC2/EKS** — not access keys on instances

---

## Kubernetes Secrets

```bash
# Create secret (never commit plaintext to Git)
kubectl create secret generic backend-secrets \
  --from-literal=JWT_ACCESS_SECRET=xxx \
  -n cloudcart-pro
```

**Better:** External Secrets Operator → AWS Secrets Manager.

---

## Docker Security

- Run as non-root user (`USER cloudcart` in Dockerfile) ✅
- Scan images: `trivy image cloudcart-backend:local`
- Pin base image versions (`node:20-alpine`)
- Multi-stage builds (no dev deps in production) ✅

---

## Network Security

- RDS/Redis in **private subnets** only
- Security groups: deny all, allow specific
- No SSH password auth — key pairs only
- VPN or bastion for admin DB access

---

## Payment Security (Stripe/Razorpay)

- Never store card numbers — use provider tokens
- Verify webhooks with signing secret
- Idempotency keys on payment creation
- PCI DSS scope reduced by using Stripe Checkout

---

## Security Checklist Before Production

- [ ] HTTPS everywhere (ACM certificates)
- [ ] `COOKIE_SECURE=true`
- [ ] Secrets in AWS Secrets Manager
- [ ] WAF on CloudFront (AWS WAF)
- [ ] Dependency scanning in CI (`npm audit`, Snyk)
- [ ] Penetration test or OWASP ZAP scan
- [ ] Backup encryption at rest (RDS, S3)
