/**
 * Upload local clips to R2 — run locally before scheduling
 *
 * Usage:
 *   node r2/sync.mjs daleel yt 1        # upload Daleel clip 1 for YouTube
 *   node r2/sync.mjs daleel ig 1-5      # upload Daleel clips 1-5 for Instagram
 *   node r2/sync.mjs coinbase yt 1-10   # upload Coinbase clips 1-10 for YouTube
 *   node r2/sync.mjs coinbase ig 1-10   # upload Coinbase clips 1-10 for Instagram
 *
 * Requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env
 *
 * R2 key format: {campaign}/{platform}/{N}.{ext}
 *   daleel/yt/1.mov   daleel/ig/2.mov
 *   coinbase/yt/1.mp4 coinbase/ig/3.mp4
 */
import { PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createReadStream, existsSync, readFileSync, statSync } from "fs";
import { join, dirname, resolve, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, "utf-8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()])
  );
}

// Load env from .env file, but env vars set in shell take precedence
const fileEnv = loadEnv();
for (const [k, v] of Object.entries(fileEnv)) {
  if (!process.env[k]) process.env[k] = v;
}

const { r2, BUCKET } = await import("./client.mjs");

const DALEEL_DIR  = process.env.DALEEL_CLIPS_DIR;
const COINBASE_DIR = process.env.CLIPS_DIR;

const CAMPAIGN_DIRS = {
  daleel:   DALEEL_DIR,
  coinbase: COINBASE_DIR,
};

// Extension lookup by clip number for each campaign
const DALEEL_EXTS = {
  1:"mov",2:"mov",3:"mov",4:"mov",5:"mov",
  6:"mov",7:"mov",8:"mov",9:"mov",
  10:"mp4",11:"mp4",12:"mp4",13:"mp4",14:"mp4",15:"mp4",
};

function getExt(campaign, num) {
  if (campaign === "daleel") return DALEEL_EXTS[num] || "mp4";
  return "mp4";
}

function parseRange(rangeStr) {
  if (rangeStr.includes("-")) {
    const [start, end] = rangeStr.split("-").map(Number);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  return [parseInt(rangeStr, 10)];
}

async function uploadClip(campaign, platform, num) {
  const ext      = getExt(campaign, num);
  const filename = `${num}.${ext}`;
  const localDir = CAMPAIGN_DIRS[campaign];
  if (!localDir) { console.error(`❌ No directory configured for campaign "${campaign}"`); return; }

  const localPath = join(localDir, filename);
  if (!existsSync(localPath)) {
    console.error(`  ❌ Not found: ${localPath}`);
    return;
  }

  const key      = `${campaign}/${platform}/${filename}`;
  const fileSize = statSync(localPath).size;
  console.log(`  Uploading ${key} (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`);

  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        createReadStream(localPath),
    ContentType: ext === "mov" ? "video/quicktime" : "video/mp4",
  }));
  console.log(`  ✅ ${key}`);
}

async function listBucket() {
  const res = await r2.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  const objects = res.Contents || [];
  if (objects.length === 0) {
    console.log("  (empty)");
    return;
  }
  for (const obj of objects) {
    console.log(`  ${obj.Key}  (${(obj.Size / 1024 / 1024).toFixed(1)} MB)`);
  }
}

async function main() {
  const [,, campaign, platform, rangeStr] = process.argv;

  if (campaign === "list" || campaign === "--list") {
    console.log(`\nBucket: ${BUCKET}`);
    await listBucket();
    return;
  }

  if (!campaign || !platform || !rangeStr) {
    console.log("Usage:");
    console.log("  node r2/sync.mjs daleel yt 1");
    console.log("  node r2/sync.mjs daleel ig 1-5");
    console.log("  node r2/sync.mjs coinbase yt 1-10");
    console.log("  node r2/sync.mjs list");
    process.exit(1);
  }

  if (!["daleel", "coinbase"].includes(campaign)) {
    console.error(`❌ Unknown campaign: ${campaign}`);
    process.exit(1);
  }
  if (!["yt", "ig"].includes(platform)) {
    console.error(`❌ Platform must be 'yt' or 'ig'`);
    process.exit(1);
  }

  const nums = parseRange(rangeStr);
  console.log(`\nUploading ${campaign}/${platform} clips [${nums.join(", ")}] → R2\n`);
  for (const num of nums) {
    await uploadClip(campaign, platform, num);
  }
  console.log("\nDone. Run 'node r2/sync.mjs list' to verify.");
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
