/**
 * seed-images-and-reviews.mjs
 *
 * 1. Uploads category images to ImgBB (one shared set per category)
 * 2. Assigns those image URLs to every place matching that category in MongoDB
 * 3. Seeds 3–7 fake reviews per place into the reviews collection
 * 4. Recalculates avgRating + reviewsCount on each place
 *
 * Usage:
 *   node scripts/seed-images-and-reviews.mjs
 *   node scripts/seed-images-and-reviews.mjs --dry-run   (no DB writes)
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dns from "node:dns";
import { MongoClient, ObjectId } from "mongodb";
import { faker } from "@faker-js/faker";

// ─── Configuration ────────────────────────────────────────────────────────────

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const IMAGES_ROOT = "C:\\Users\\Skander BELLELI\\Desktop\\rami";
const REVIEWS_PER_PLACE_MIN = 3;
const REVIEWS_PER_PLACE_MAX = 7;
const isDryRun = process.argv.includes("--dry-run");

// Folder name → DB category value
const CATEGORY_FOLDERS = {
  artisant: "artisan",
  market: "market",
  producers: "producer",
  restau: "restaurant",
};

// ─── Load .env ────────────────────────────────────────────────────────────────

for (const fileName of [".env", ".env.local"]) {
  const envPath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("#")) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
if (!IMGBB_API_KEY) {
  console.error("❌  IMGBB_API_KEY not found in .env");
  process.exit(1);
}

// ─── ImgBB upload helper ──────────────────────────────────────────────────────

async function uploadToImgBB(filePath) {
  const fileData = fs.readFileSync(filePath);
  const base64 = fileData.toString("base64");
  const name = path.basename(filePath, path.extname(filePath));

  const body = new URLSearchParams();
  body.set("key", IMGBB_API_KEY);
  body.set("image", base64);
  body.set("name", name);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ImgBB upload failed for ${filePath}: ${response.status} ${text}`);
  }

  const json = await response.json();
  return json.data.url;
}

// ─── Upload all category images ───────────────────────────────────────────────

console.log("\n📸  Uploading category images to ImgBB…\n");

/** @type {Record<string, string[]>} category → [url, url, …] */
const categoryImages = {};

for (const [folder, category] of Object.entries(CATEGORY_FOLDERS)) {
  const folderPath = path.join(IMAGES_ROOT, folder);
  if (!fs.existsSync(folderPath)) {
    console.warn(`  ⚠️  Folder not found, skipping: ${folderPath}`);
    continue;
  }

  const files = fs
    .readdirSync(folderPath)
    .filter((f) => /\.(jpe?g|jfif|png|webp|gif)$/i.test(f))
    .map((f) => path.join(folderPath, f));

  if (!files.length) {
    console.warn(`  ⚠️  No images in ${folderPath}`);
    continue;
  }

  const urls = [];
  for (const file of files) {
    if (isDryRun) {
      console.log(`  [dry-run] Would upload: ${file}`);
      urls.push(`https://example.com/dry-run/${path.basename(file)}`);
    } else {
      process.stdout.write(`  ⬆  Uploading ${folder}/${path.basename(file)} … `);
      try {
        const url = await uploadToImgBB(file);
        urls.push(url);
        console.log(`✅  ${url}`);
      } catch (err) {
        console.log(`❌  ${err.message}`);
      }
    }
  }

  categoryImages[category] = urls;
  console.log(`  → ${category}: ${urls.length} image(s) ready\n`);
}

if (!Object.keys(categoryImages).length) {
  console.error("❌  No images were uploaded. Aborting.");
  process.exit(1);
}

// ─── Connect to MongoDB ───────────────────────────────────────────────────────

const mongoClient = new MongoClient(process.env.MONGODB_URI);
await mongoClient.connect();
const db = mongoClient.db(process.env.MONGODB_DB || undefined);
const placesCol = db.collection(process.env.MONGODB_PLACES_COLLECTION || "places");
const reviewsCol = db.collection(process.env.MONGODB_REVIEWS_COLLECTION || "reviews");

console.log("🔌  Connected to MongoDB:", db.databaseName, "\n");

// ─── Build fake reviewer pool (reusable across places) ───────────────────────

const REVIEWER_COUNT = 40;
const reviewers = Array.from({ length: REVIEWER_COUNT }, () => ({
  _id: new ObjectId(),
  name: faker.person.fullName(),
}));

// ─── Review templates per category ───────────────────────────────────────────

const reviewTemplates = {
  restaurant: [
    "Amazing fresh seafood, highly recommend!",
    "Authentic Tunisian flavors, felt like home.",
    "Lovely seaside setting, great grilled fish.",
    "Service was warm and the couscous was perfect.",
    "Best brik à l'œuf I've ever had.",
    "Portions are generous and prices fair.",
    "The view alone is worth the trip.",
    "Simple, honest cooking — exactly what you want after a beach day.",
    "Local pêcheurs bring the catch fresh every morning, it shows.",
    "Absolutely delicious merguez, will be back.",
  ],
  market: [
    "Incredible variety of fresh produce at great prices.",
    "The spice stalls are a feast for the senses.",
    "Best place to buy local olives and harissa.",
    "Very authentic, loved the atmosphere.",
    "Arrived early and got the freshest fish straight from the boat.",
    "Great for stocking up on seasonal vegetables.",
    "The olive oil here is exceptional quality.",
    "Loved bargaining with the locals, really fun experience.",
    "Everything is seasonal and local, very fresh.",
    "The herb vendors know their plants — got great advice.",
  ],
  producer: [
    "Exceptional extra-virgin olive oil, best I've tasted.",
    "Their boutargue is a true local delicacy.",
    "Wonderful vineyard, the muscat de Kélibia is superb.",
    "Direct farm purchase, freshness guaranteed.",
    "Really passionate about their craft, it shows in the product.",
    "Honey has such a rich floral taste, totally unique.",
    "The cheese is incredible, very creamy and fresh.",
    "Bought directly from the fisherman — couldn't be fresher.",
    "Small artisanal operation with real character.",
    "Loved visiting and learning about the production process.",
  ],
  artisan: [
    "Beautiful handcrafted furniture, top quality.",
    "The woodwork is absolutely stunning.",
    "Great souvenirs you won't find anywhere else.",
    "Traditional techniques passed down through generations.",
    "The harissa they make is fiery and delicious.",
    "Incredible attention to detail on every piece.",
    "Genuinely unique work, worth every dinar.",
    "The basket weaving is an art form.",
    "Amazing craftsperson — happy to explain the whole process.",
    "Bought a carved wooden box, it's a masterpiece.",
  ],
  hotel: [
    "Comfortable rooms with a great sea view.",
    "Exceptional service and very attentive staff.",
    "The thalasso spa is absolutely divine.",
    "Perfect location for exploring Cap Bon.",
    "Great breakfast spread with local products.",
    "Very clean and well maintained.",
    "The pool area is lovely.",
    "Highly recommend for a relaxing getaway.",
  ],
};

const defaultTemplates = [
  "Great experience overall.",
  "Really enjoyed visiting this place.",
  "Highly recommended for anyone in the area.",
  "Friendly staff and excellent quality.",
  "Will definitely come back!",
];

function pickTemplates(category) {
  return reviewTemplates[category] || defaultTemplates;
}

// ─── Process each place ───────────────────────────────────────────────────────

const allPlaces = await placesCol.find({}).toArray();
console.log(`📍  Processing ${allPlaces.length} places…\n`);

let imagesAssigned = 0;
let reviewsInserted = 0;
let placesUpdated = 0;

for (const place of allPlaces) {
  const placeId = place._id.toString();
  const category = place.category || "other";
  const images = categoryImages[category] || categoryImages[Object.keys(categoryImages)[0]] || [];

  // ── Assign images ──────────────────────────────────────────────────────────
  const imageOp = {
    $set: { images },
  };

  // ── Generate fake reviews ──────────────────────────────────────────────────
  const reviewCount =
    Math.floor(Math.random() * (REVIEWS_PER_PLACE_MAX - REVIEWS_PER_PLACE_MIN + 1)) +
    REVIEWS_PER_PLACE_MIN;

  const templates = pickTemplates(category);
  const usedReviewerIds = new Set();
  const newReviews = [];

  for (let i = 0; i < reviewCount; i++) {
    // Pick a reviewer not already used for this place
    let reviewer;
    let attempts = 0;
    do {
      reviewer = reviewers[Math.floor(Math.random() * reviewers.length)];
      attempts++;
    } while (usedReviewerIds.has(reviewer._id.toString()) && attempts < 20);

    usedReviewerIds.add(reviewer._id.toString());

    const rating = faker.number.int({ min: 3, max: 5 });
    const comment = faker.helpers.arrayElement(templates);

    // Randomise createdAt within last 18 months
    const createdAt = faker.date.recent({ days: 548 });

    newReviews.push({
      _id: new ObjectId(),
      placeId: place._id,
      placeIdStr: placeId,
      userId: reviewer._id,
      userName: reviewer.name,
      rating,
      comment,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // ── Compute new avgRating ──────────────────────────────────────────────────
  const avgRating =
    Math.round((newReviews.reduce((s, r) => s + r.rating, 0) / newReviews.length) * 10) / 10;

  Object.assign(imageOp.$set, {
    avgRating,
    reviewsCount: newReviews.length,
    updatedAt: new Date(),
  });

  if (isDryRun) {
    console.log(
      `  [dry-run] ${place.name?.slice(0, 40).padEnd(40)} | cat: ${category.padEnd(10)} | imgs: ${images.length} | reviews: ${newReviews.length} | avg: ${avgRating}`,
    );
  } else {
    await placesCol.updateOne({ _id: place._id }, imageOp);
    await reviewsCol.insertMany(newReviews);
    imagesAssigned++;
    reviewsInserted += newReviews.length;
    placesUpdated++;
  }
}

if (!isDryRun) {
  // ── Ensure indexes ─────────────────────────────────────────────────────────
  await reviewsCol.createIndex({ placeId: 1, createdAt: -1 });
  await reviewsCol.createIndex({ userId: 1, createdAt: -1 });

  console.log("\n✅  Done!\n");
  console.log(`  📍  Places updated : ${placesUpdated}`);
  console.log(`  🖼   Images assigned: ${imagesAssigned} (${Object.values(categoryImages).flat().length} unique URLs reused)`);
  console.log(`  ⭐  Reviews inserted: ${reviewsInserted}`);
} else {
  console.log("\n✅  Dry run complete — no changes made.");
}

await mongoClient.close();
