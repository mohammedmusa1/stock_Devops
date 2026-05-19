#!/usr/bin/env node
/**
 * Stock AI — deployment step validator
 * Usage: node scripts/validate-step.mjs <step_number>
 * Example: node scripts/validate-step.mjs 1
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const step = Number(process.argv[2] || "1");

const ok = (msg) => console.log(`  [PASS] ${msg}`);
const fail = (msg) => {
  console.error(`  [FAIL] ${msg}`);
  process.exitCode = 1;
};
const warn = (msg) => console.warn(`  [WARN] ${msg}`);
const info = (msg) => console.log(`  [INFO] ${msg}`);

function mustExist(rel, label = rel) {
  const p = path.join(ROOT, rel);
  if (!existsSync(p)) fail(`Missing: ${label} (${rel})`);
  else ok(`Found: ${rel}`);
  return p;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host: "127.0.0.1", port });
    const done = (v) => {
      s.destroy();
      resolve(v);
    };
    s.setTimeout(1500);
    s.on("connect", () => done(true));
    s.on("timeout", () => done(false));
    s.on("error", () => done(false));
  });
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim();
  } catch (e) {
    return null;
  }
}

async function step1() {
  console.log("\n=== STEP 1: Project structure validation ===\n");
  const required = [
    "package.json",
    "docker-compose.yml",
    "docker-compose.prod.yml",
    ".env.production.example",
    "apps/api/package.json",
    "apps/api/Dockerfile",
    "apps/api/.env.example",
    "apps/api/prisma/schema.prisma",
    "apps/api/src/main.ts",
    "apps/web/package.json",
    "apps/web/Dockerfile",
    "apps/web/next.config.ts",
    "apps/web/.env.local.example",
    "infrastructure/nginx/namestock.conf",
    "infrastructure/aws/terraform/main.tf",
    "infrastructure/k3s/namespace.yaml",
    "scripts/check-deps.mjs",
    "scripts/setup-local.ps1",
    "AWS_FREE_TIER_DEPLOYMENT.md",
  ];
  for (const f of required) mustExist(f);

  const migDir = path.join(ROOT, "apps/api/prisma/migrations");
  if (!existsSync(migDir)) fail("No prisma/migrations folder");
  else ok("Prisma migrations directory exists");

  warn("Legacy folders apps/backend + apps/frontend exist — ignore for Stock AI deploy");
  info(`Node: ${process.version}`);
  const npmv = run("npm -v");
  if (npmv) ok(`npm: ${npmv}`);
  else fail("npm not found");

  console.log(process.exitCode ? "\nSTEP 1: FAILED\n" : "\nSTEP 1: PASSED — proceed to STEP 2\n");
}

async function step2() {
  console.log("\n=== STEP 2: Environment variable setup ===\n");
  mustExist("apps/api/.env.example");
  const example = readFileSync(path.join(ROOT, "apps/api/.env.example"), "utf8");
  const requiredKeys = ["DATABASE_URL", "REDIS_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "CORS_ORIGIN"];
  for (const k of requiredKeys) {
    if (!example.includes(k)) fail(`apps/api/.env.example missing ${k}`);
    else ok(`Template has ${k}`);
  }
  if (existsSync(path.join(ROOT, "apps/api/.env"))) ok("apps/api/.env exists");
  else warn("apps/api/.env missing — copy from .env.example");

  if (existsSync(path.join(ROOT, "apps/web/.env.local"))) ok("apps/web/.env.local exists");
  else warn("apps/web/.env.local missing — copy from .env.local.example");

  console.log(process.exitCode ? "\nSTEP 2: FAILED\n" : "\nSTEP 2: PASSED — proceed to STEP 3\n");
}

async function step3() {
  console.log("\n=== STEP 3: PostgreSQL local setup ===\n");
  const docker = run("docker info");
  if (!docker) {
    fail("Docker daemon not running — start Docker Desktop");
    return;
  }
  ok("Docker daemon running");

  run("docker compose up -d postgres");
  for (let i = 0; i < 15; i++) {
    if (await portOpen(5432)) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (await portOpen(5432)) ok("PostgreSQL reachable on :5432");
  else fail("PostgreSQL not on :5432 — run: docker compose up -d postgres");

  const ps = run("docker compose ps postgres");
  if (ps?.includes("running") || ps?.includes("healthy")) ok("postgres container running");
  else info(ps || "check: docker compose ps");

  console.log(process.exitCode ? "\nSTEP 3: FAILED\n" : "\nSTEP 3: PASSED — proceed to STEP 4\n");
}

async function step4() {
  console.log("\n=== STEP 4: Redis local setup ===\n");
  run("docker compose up -d redis");
  for (let i = 0; i < 10; i++) {
    if (await portOpen(6379)) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (await portOpen(6379)) ok("Redis reachable on :6379");
  else fail("Redis not on :6379 — run: docker compose up -d redis");

  const ping = run('docker compose exec -T redis redis-cli ping');
  if (ping === "PONG") ok("redis-cli PING → PONG");
  else warn(`redis-cli ping: ${ping ?? "n/a"}`);

  console.log(process.exitCode ? "\nSTEP 4: FAILED\n" : "\nSTEP 4: PASSED — proceed to STEP 5\n");
}

async function step5() {
  console.log("\n=== STEP 5: Backend local verification ===\n");
  if (!(await portOpen(5432))) fail("PostgreSQL required — complete STEP 3");
  if (!(await portOpen(6379))) fail("Redis required — complete STEP 4");

  const health = run('curl -s -o NUL -w "%{http_code}" http://localhost:4000/api/v1/health', { shell: true });
  // Windows curl may differ; try fetch via node
  try {
    const res = await fetch("http://localhost:4000/api/v1/health");
    if (res.ok) {
      const body = await res.json();
      ok(`Health HTTP ${res.status}`);
      info(JSON.stringify(body));
    } else fail(`API health returned ${res.status} — is npm run dev:api running?`);
  } catch {
    fail("API not reachable on :4000 — run: npm run dev:api (after STEP 3–4)");
  }

  console.log(process.exitCode ? "\nSTEP 5: FAILED\n" : "\nSTEP 5: PASSED — proceed to STEP 6\n");
}

const handlers = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5 };

async function main() {
  if (!handlers[step]) {
    console.error(`Validator implemented for steps 1–5. Step ${step}: see DEPLOYMENT_RUNBOOK.md`);
    process.exit(2);
  }
  await handlers[step]();
}

main();
