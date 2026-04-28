import "server-only";

import * as dns from "node:dns";
import { MongoClient } from "mongodb";

declare global {
  var __nabeulMongoClientPromise: Promise<MongoClient> | undefined;
  var __nabeulMongoConnectedLogged: boolean | undefined;
}

const uri = process.env.MONGODB_URI;
const dnsServers = process.env.MONGODB_DNS_SERVERS;
let configuredDnsServers: string[] = [];

export function isMongoConfigured() {
  return Boolean(uri);
}

export async function getMongoDb() {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!global.__nabeulMongoClientPromise) {
    configureMongoDns();
    global.__nabeulMongoClientPromise = connectMongoClient(uri)
      .then((connectedClient) => {
        if (!global.__nabeulMongoConnectedLogged) {
          console.info(
            `[mongodb] Connected to database "${process.env.MONGODB_DB || "default"}" at ${getMongoHostLabel()}`,
          );
          global.__nabeulMongoConnectedLogged = true;
        }

        return connectedClient;
      })
      .catch((error) => {
        console.warn(`[mongodb] Connection failed: ${getMongoErrorMessage(error)}`);
        global.__nabeulMongoClientPromise = undefined;
        global.__nabeulMongoConnectedLogged = false;
        throw error;
      });
  }

  const client = await global.__nabeulMongoClientPromise;
  return client.db(process.env.MONGODB_DB || undefined);
}

async function connectMongoClient(connectionString: string) {
  const client = new MongoClient(connectionString);

  try {
    return await client.connect();
  } catch (error) {
    await client.close().catch(() => undefined);

    if (!shouldUseSeedListFallback(connectionString, error)) {
      throw error;
    }

    const seedListUri = await buildSeedListUri(connectionString);
    console.info("[mongodb] Retrying connection with resolved Atlas seed list.");
    return new MongoClient(seedListUri).connect();
  }
}

function configureMongoDns() {
  if (!dnsServers) {
    return;
  }

  const servers = dnsServers
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (!servers.length) {
    return;
  }

  dns.setServers(servers);
  configuredDnsServers = servers;
  console.info(`[mongodb] Using DNS servers: ${dns.getServers().join(", ")}`);
}

function shouldUseSeedListFallback(connectionString: string, error: unknown) {
  return connectionString.startsWith("mongodb+srv://") && isNodeError(error) && error.code === "ECONNREFUSED";
}

async function buildSeedListUri(connectionString: string) {
  const parsed = new URL(connectionString);
  const resolver = new dns.promises.Resolver();

  if (configuredDnsServers.length) {
    resolver.setServers(configuredDnsServers);
  }

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
  const hosts = srvRecords
    .map((record) => `${record.name.replace(/\.$/, "")}:${record.port}`)
    .join(",");
  const params = new URLSearchParams(parsed.searchParams);

  try {
    const txtRecords = await resolver.resolveTxt(parsed.hostname);

    for (const record of txtRecords) {
      const txtParams = new URLSearchParams(record.join(""));

      for (const [key, value] of txtParams) {
        if (!params.has(key)) {
          params.set(key, value);
        }
      }
    }
  } catch {
    // TXT records carry Atlas options such as replicaSet/authSource. Keep going with explicit TLS if unavailable.
  }

  if (!params.has("tls") && !params.has("ssl")) {
    params.set("tls", "true");
  }

  const credentials = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
    : "";
  const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/";
  const query = params.toString();

  return `mongodb://${credentials}${hosts}${path}${query ? `?${query}` : ""}`;
}

export function getMongoErrorMessage(error: unknown) {
  if (isNodeError(error) && error.code === "ECONNREFUSED" && error.syscall === "querySrv") {
    return "MongoDB Atlas SRV DNS lookup failed. Check your network/DNS access and verify the MONGODB_URI host.";
  }

  if (isNodeError(error) && error.code === "ENOTFOUND") {
    return "MongoDB host could not be resolved. Verify MONGODB_URI and your DNS connection.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to connect to MongoDB.";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function getMongoHostLabel() {
  if (!uri) {
    return "unconfigured host";
  }

  try {
    const safeUri = uri.replace(/:\/\/([^:/@]+):([^@]+)@/, "://user:pass@");
    return new URL(safeUri).host;
  } catch {
    return "configured host";
  }
}
