import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createHash } from "node:crypto";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { MODEL_GOVERNANCE, SPORT_MODEL_PROFILES } from "../../lib/model-governance";
import { MODEL_UPDATE_SCHEMA_VERSION, serializeModelPayload, type RemoteModelPayload } from "../../lib/model-update-contract";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  /**
   * 唯讀且不需帳號的受控模型發佈端。模型調整僅能由已審核的部署版本更新，
   * 用戶端仍會驗證結構、來源、數值範圍與 SHA-256 後才快取套用。
   */
  app.get("/api/model-update/manifest", (_req, res) => {
    const payload: RemoteModelPayload = {
      schemaVersion: MODEL_UPDATE_SCHEMA_VERSION,
      issuedAt: "2026-08-16T00:00:00.000Z",
      model: {
        version: MODEL_GOVERNANCE.version,
        sourceIds: MODEL_GOVERNANCE.sources.map((source) => source.id),
        profiles: SPORT_MODEL_PROFILES,
      },
    };
    const payloadSha256 = createHash("sha256").update(serializeModelPayload(payload), "utf8").digest("hex");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({ ...payload, payloadSha256 });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
