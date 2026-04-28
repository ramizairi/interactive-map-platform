import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dns from "node:dns";
import { MongoClient } from "mongodb";

const SOURCE = "capbon-guide";
const DEFAULT_INPUT = "Guide_Gastronomique_CapBon_MapDatabase.json";

loadEnvFile(".env");
loadEnvFile(".env.local");

const isDryRun = process.argv.includes("--dry-run");
const inputArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const inputPath = path.resolve(process.cwd(), inputArg || DEFAULT_INPUT);
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const placesCollectionName = process.env.MONGODB_PLACES_COLLECTION || "places";
const reviewsCollectionName = process.env.MONGODB_REVIEWS_COLLECTION || "reviews";
let configuredDnsServers = [];

if (!uri) {
  console.error("MONGODB_URI is not configured.");
  process.exit(1);
}

const guide = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const places = flattenGuide(guide).map(toPlaceDocument).filter(Boolean);

if (!places.length) {
  console.error(`No importable places found in ${inputPath}.`);
  process.exit(1);
}

if (isDryRun) {
  const counts = places.reduce((acc, place) => {
    acc[place.category] = (acc[place.category] || 0) + 1;
    return acc;
  }, {});

  console.log(`Dry run: ${places.length} places ready from ${path.basename(inputPath)}.`);
  console.log(counts);
  process.exit(0);
}

let client;

try {
  client = await connectMongoClient(uri);
  const db = client.db(dbName || undefined);
  const placesCollection = db.collection(placesCollectionName);
  const reviewsCollection = db.collection(reviewsCollectionName);

  await ensureIndexes(placesCollection, reviewsCollection);

  const now = new Date();
  const result = await placesCollection.bulkWrite(
    places.map((place) => ({
      updateOne: {
        filter: { source: SOURCE, sourceId: place.sourceId },
        update: {
          $set: {
            ...place,
            isActive: true,
            updatedAt: now,
          },
          $setOnInsert: {
            images: [],
            avgRating: 0,
            reviewsCount: 0,
            createdAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  console.log(
    `Imported ${places.length} guide places into ${db.databaseName}.${placesCollectionName}: ` +
      `${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${result.matchedCount} matched.`,
  );
} finally {
  await client?.close();
}

async function connectMongoClient(connectionString) {
  configureMongoDns();
  const mongoClient = new MongoClient(connectionString);

  try {
    return await mongoClient.connect();
  } catch (error) {
    await mongoClient.close().catch(() => undefined);

    if (!shouldUseSeedListFallback(connectionString, error)) {
      throw error;
    }

    const seedListUri = await buildSeedListUri(connectionString);
    console.info("Retrying MongoDB connection with resolved Atlas seed list.");
    return new MongoClient(seedListUri).connect();
  }
}

function configureMongoDns() {
  const dnsServers = process.env.MONGODB_DNS_SERVERS;

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
}

function shouldUseSeedListFallback(connectionString, error) {
  return connectionString.startsWith("mongodb+srv://") && error instanceof Error && error.code === "ECONNREFUSED";
}

async function buildSeedListUri(connectionString) {
  const parsed = new URL(connectionString);
  const resolver = new dns.promises.Resolver();

  if (configuredDnsServers.length) {
    resolver.setServers(configuredDnsServers);
  }

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
  const hosts = srvRecords.map((record) => `${record.name.replace(/\.$/, "")}:${record.port}`).join(",");
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
    // TXT records carry Atlas options. Explicit TLS is enough when TXT lookup is unavailable.
  }

  if (!params.has("tls") && !params.has("ssl")) {
    params.set("tls", "true");
  }

  const credentials = parsed.username ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@` : "";
  const pathName = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/";
  const query = params.toString();

  return `mongodb://${credentials}${hosts}${pathName}${query ? `?${query}` : ""}`;
}

function flattenGuide(data) {
  const zones = Array.isArray(data) ? data : data.zones || [];
  const rows = [];

  for (const zone of zones) {
    for (const city of zone.villes || []) {
      for (const fiche of city.fiches || []) {
        rows.push({
          ...fiche,
          zone: fiche.zone || zone.zone,
          ville: fiche.ville || city.ville,
        });
      }
    }
  }

  return rows;
}

function toPlaceDocument(row) {
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);

  if (!row.id || !row.nom || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    source: SOURCE,
    sourceId: clean(row.id),
    name: clean(row.nom),
    category: toAppCategory(row.categorie),
    originalCategory: clean(row.categorie),
    subCategory: clean(row.sous_categorie),
    specialties: clean(row.specialites),
    hours: clean(row.saison_horaires),
    description: clean(row.description),
    address: clean(row.adresse),
    city: clean(row.ville),
    region: "Nabeul",
    zone: clean(row.zone),
    contact: clean(row.contact),
    budget: clean(row.budget),
    practicalNotes: clean(row.notes_pratiques),
    googleMapsUrl: clean(row.google_maps),
    location: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
    latitude,
    longitude,
  };
}

function toAppCategory(category) {
  const normalized = normalizeText(category);
  const mapping = {
    marche: "market",
    producteur: "producer",
    artisan: "artisan",
    restaurant: "restaurant",
  };

  return mapping[normalized] || "other";
}

async function ensureIndexes(placesCollection, reviewsCollection) {
  await placesCollection.createIndex(
    { source: 1, sourceId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        source: SOURCE,
        sourceId: { $exists: true },
      },
    },
  );
  await placesCollection.createIndex({ location: "2dsphere" });
  await placesCollection.createIndex({ isActive: 1, region: 1, category: 1 });
  await placesCollection.createIndex({ reviewsCount: -1, avgRating: -1, name: 1 });
  await reviewsCollection.createIndex({ placeId: 1, createdAt: -1 });
  await reviewsCollection.createIndex({ userId: 1, createdAt: -1 });
}

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
