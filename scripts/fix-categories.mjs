import { MongoClient } from "mongodb";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("#")) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const col = db.collection(process.env.MONGODB_PLACES_COLLECTION || "places");

function resolveCategory(originalCategory) {
  const norm = String(originalCategory || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\w\s]/g, " ")        // strip emoji & punctuation
    .trim();

  if (norm.includes("marche") || norm.includes("march")) return "market";
  if (norm.includes("producteur")) return "producer";
  if (norm.includes("artisan")) return "artisan";
  if (norm.includes("restaurant")) return "restaurant";
  return "other";
}

// Get all 'other' docs
const others = await col
  .find({ category: "other" }, { projection: { _id: 1, originalCategory: 1 } })
  .toArray();

console.log(`Found ${others.length} 'other' records to re-classify.`);

if (others.length === 0) {
  console.log("Nothing to fix.");
  await client.close();
  process.exit(0);
}

const ops = others.map((doc) => ({
  updateOne: {
    filter: { _id: doc._id },
    update: { $set: { category: resolveCategory(doc.originalCategory) } },
  },
}));

const result = await col.bulkWrite(ops, { ordered: false });
console.log(`Fixed: ${result.modifiedCount} records updated.`);

// Final verification
const cats = await col.distinct("category");
const counts = {};
for (const c of cats) {
  counts[c] = await col.countDocuments({ category: c });
}
console.log("Final category counts:", JSON.stringify(counts, null, 2));

await client.close();
