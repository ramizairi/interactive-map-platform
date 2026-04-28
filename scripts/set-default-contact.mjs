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

const DEFAULT_CONTACT = "98191306";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const col = db.collection(process.env.MONGODB_PLACES_COLLECTION || "places");

// Set default contact on ALL places that have no contact (null, undefined, empty string)
const result = await col.updateMany(
  { $or: [{ contact: { $exists: false } }, { contact: null }, { contact: "" }] },
  { $set: { contact: DEFAULT_CONTACT } }
);

console.log(`Updated ${result.modifiedCount} places with default contact: ${DEFAULT_CONTACT}`);

// Verify
const total = await col.countDocuments();
const withContact = await col.countDocuments({ contact: { $exists: true, $ne: null, $ne: "" } });
console.log(`All places: ${total} | With contact: ${withContact}`);

await client.close();
