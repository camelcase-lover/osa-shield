 import Fastify from "fastify";
import dotenv from "dotenv";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import routes from "./routes/routes.js";


import sequelize from "./config/db.js";
import { ensureFeatureColumns } from "./config/ensureSchema.js";
import { resolveSessionCookieConfig, resolveTrustProxy } from "./config/sessionConfig.js";
import {
  isDatabaseReady,
  markDatabaseConnected,
  markDatabaseDisconnected,
} from "./services/databaseStateService.js";

dotenv.config();

const port = Number(process.env.PORT || 9200);
const dbRetryIntervalMs = Number(process.env.DB_RETRY_INTERVAL_MS || 15000);
const requireDbAtStartup =
  process.env.DB_REQUIRED_AT_STARTUP === "true" || process.env.NODE_ENV === "production";

const fastify = Fastify({
  logger: true,
  trustProxy: resolveTrustProxy(),
});

const rawSessionSecret =
  process.env.SESSION_SECRET;
const sessionSecret =
  rawSessionSecret.length >= 32 ? rawSessionSecret : rawSessionSecret.padEnd(32, "_");

fastify.register(cookie);
fastify.register(session, {
  secret: sessionSecret,
  cookieName: "sessionId",
  saveUninitialized: false,
  cookie: resolveSessionCookieConfig(),
});

fastify.register(routes, { prefix: "/" });

let isConnectingToDatabase = false;
let databaseSchemaSynced = false;

async function initializeDatabase() {
  if (isConnectingToDatabase || isDatabaseReady()) {
    return isDatabaseReady();
  }

  isConnectingToDatabase = true;

  try {
    await sequelize.authenticate();

    if (!databaseSchemaSynced) {
      await sequelize.sync();
      await ensureFeatureColumns(sequelize);
      databaseSchemaSynced = true;
    }

    markDatabaseConnected();
    fastify.log.info("Database connected successfully");
    return true;
  } catch (error) {
    markDatabaseDisconnected(error);
    fastify.log.error({ err: error }, "Database connection failed");
    return false;
  } finally {
    isConnectingToDatabase = false;
  }
} 

const start = async () => {
  try {
    const connected = await initializeDatabase();

    if (!connected && requireDbAtStartup) {
      process.exit(1);
    }

    await fastify.listen({
      port,
      host: "0.0.0.0",
    });

    if (!connected) {
      fastify.log.warn(
        "Starting without database connectivity. DB-backed routes will return 503 until the connection succeeds."
      );

      setInterval(() => {
        void initializeDatabase();
      }, dbRetryIntervalMs);
    }
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();   /*
import fastify from 'fastify';
import routes from "./routes/routes.js";

const app = fastify();

app.register(routes);

app.listen({ port: process.env.PORT }, () => {
console.log(`Server running on http://localhost:${process.env.PORT}`);
}); */
