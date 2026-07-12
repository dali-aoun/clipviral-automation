/**
 * Upload local clips to Cloudflare R2 via wrangler (no API keys needed)
 *
 * Usage:
 *   node r2/sync.mjs daleel ig 1-15      # Daleel clips for Instagram
 *   node r2/sync.mjs daleel tiktok 1-15  # Daleel clips for TikTok
 *   node r2/sync.mjs coinbase yt 4-15    # Coinbase clips for YouTube
 *   node r2/sync.mjs coinbase ig 4-15    # Coinbase clips for Instagram
 *   node r2/sync.mjs list                # List bucket contents
 *
 * R2 key format: {campaign}/{platform}/{N}.{ext}
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const BUCKET    = "clipviral-videos";

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

const env = loadEnv();

const CAMPAIGN_DIRS = {
  daleel:   env.DALEEL_CLIPS_DIR,
  coinbase: env.CLIPS_DIR,
};

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

function uploadClip(campaign, platform, num) {
  const ext       = getExt(campaign, num);
  const filename  = `${num}.${ext}`;
  const localDir  = CAMPAIGN_DIRS[campaign];

  if (!localDir) { console.error(`❌ No directory for "${campaign}" in .env`); return; }

  const localPath = join(localDir, filename);
  if (!existsSync(localPath)) { console.error(`  ❌ Not found: ${localPath}`); return; }

  const key         = `${campaign}/${platform}/${filename}`;
  const contentType = ext === "mov" ? "video/quicktime" : "video/mp4";
  const mb          = (statSync(localPath).size / 1024 / 1024).toFixed(1);

  console.log(`  Uploading ${key} (${mb} MB)...`);
  execSync(
    `npx wrangler r2 object put ${BUCKET}/${key} --file "${localPath}" --content-type "${contentType}"`,
    { stdio: "inherit" }
  );
  console.log(`  ✅ ${key}`);
}

async function main() {
  const [,, campaign, platform, rangeStr] = process.argv;

  if (campaign === "list" || campaign === "--list") {
    execSync(`npx wrangler r2 object list ${BUCKET}`, { stdio: "inherit" });
    return;
  }

  if (!campaign || !platform || !rangeStr) {
    console.log("Usage:");
    console.log("  node r2/sync.mjs daleel ig 1-15");
    console.log("  node r2/sync.mjs daleel tiktok 1-15");
    console.log("  node r2/sync.mjs coinbase yt 4-15");
    console.log("  node r2/sync.mjs coinbase ig 4-15");
    console.log("  node r2/sync.mjs list");
    process.exit(1);
  }

  if (!["daleel", "coinbase"].includes(campaign)) {
    console.error(`❌ Unknown campaign: ${campaign} (must be daleel or coinbase)`);
    process.exit(1);
  }
  if (!["yt", "ig", "tiktok"].includes(platform)) {
    console.error(`❌ Unknown platform: ${platform} (must be yt, ig or tiktok)`);
    process.exit(1);
  }

  const nums = parseRange(rangeStr);
  console.log(`\nUploading ${campaign}/${platform} clips [${nums.join(", ")}] → R2\n`);
  for (const num of nums) {
    uploadClip(campaign, platform, num);
  }
  console.log("\nDone. Run 'node r2/sync.mjs list' to verify.");
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
