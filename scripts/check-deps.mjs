import net from "node:net";

function portOpen(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

const pg = await portOpen("127.0.0.1", 5432);
const redis = await portOpen("127.0.0.1", 6379);

if (!pg || !redis) {
  console.error("\n[Stock AI] Database services are not running.\n");
  if (!pg) console.error("  - PostgreSQL (port 5432) is down");
  if (!redis) console.error("  - Redis (port 6379) is down");
  console.error("\nFix (Windows):");
  console.error("  1. Start Docker Desktop from the Start menu (wait until 'Engine running')");
  console.error("  2. Run:  .\\scripts\\diagnose-docker.ps1");
  console.error("  3. Run:  .\\scripts\\setup-local.ps1 -StartDocker");
  console.error("  4. Or:   docker compose up -d");
  console.error("  5. Then: npm run dev\n");
  process.exit(1);
}

console.log("[Stock AI] PostgreSQL and Redis are reachable.");
