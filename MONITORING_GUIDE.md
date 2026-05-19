# CloudCart Pro — Monitoring & Observability Guide

## The Three Pillars

| Pillar | Tool | Question Answered |
|--------|------|-------------------|
| **Metrics** | Prometheus + Grafana | "Is CPU high? Error rate up?" |
| **Logs** | Loki + Grafana | "What exactly failed in pod X?" |
| **Traces** | (Future: Jaeger/Tempo) | "Which service caused the slow request?" |

---

## Prometheus

**What:** Time-series metrics database. Scrapes `/metrics` endpoints on a schedule.

**Key metrics for CloudCart:**
- `http_requests_total` — request count by status code
- `http_request_duration_seconds` — latency histogram
- `process_cpu_seconds_total` — Node.js CPU
- Kubernetes: pod restarts, memory usage (via kube-state-metrics)

**Install on EKS (Step 10):**
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

---

## Grafana

**What:** Dashboards and visualization.

**Dashboards to build:**
1. **API Overview** — RPS, latency p50/p95/p99, error rate
2. **Business** — orders/min, revenue (custom metrics from app)
3. **Infrastructure** — pod CPU/memory, RDS connections
4. **Redis** — hit rate, memory usage

Access: `kubectl port-forward svc/prometheus-grafana -n monitoring 3000:80`

---

## Loki (Logging — Step 11)

**What:** Log aggregation like Elasticsearch but indexes labels not full text (cheaper).

**Flow:**
```
App logs (stdout) → Promtail (agent on each node) → Loki → Grafana Explore
```

**Query example (LogQL):**
```logql
{namespace="cloudcart-pro", app="backend"} |= "error"
```

---

## Alertmanager

**What:** Routes alerts from Prometheus to Slack/PagerDuty/email.

**Example alerts:**
```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Backend 5xx rate above 5%"
```

---

## Application Instrumentation (Backend)

Add to Express (Phase 2):
```typescript
import promClient from 'prom-client';
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Observability Checklist for Production

- [ ] Health endpoints wired to K8s probes
- [ ] Structured JSON logging (Winston → stdout)
- [ ] Request ID in every log line
- [ ] Dashboards for API + business KPIs
- [ ] Alerts with runbooks in TROUBLESHOOTING.md
- [ ] Log retention policy (30 days prod)
- [ ] On-call rotation (even if it's just you for learning)

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for incident response.
