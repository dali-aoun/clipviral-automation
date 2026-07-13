/**
 * Upload local clips to Cloudflare R2 via wrangler (no API keys needed)
 *
 * Usage:
 *   node r2/sync.mjs daleel ig 1-15      # Daleel clips for Instagram
 *   node r2/sync.mjs daleel tiktok 1-15  # Daleel clips for TikTok
 *   node r2/sync.mjs coinbase yt 4-10    # Coinbase clips for YouTube (clips 4 to 10)
 *   node r2/sync.mjs coinbase ig 4-10    # Coinbase clips for Instagram
 *   node r2/sync.mjs list                # List bucket contents
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";

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

// Campaign file paths for named-clip campaigns (coinbase)
const CAMPAIGN_FILES = {
  "coinbase_yt": "youtube/theclipviralco/campaigns/coinbase.js",
  "coinbase_ig": "instagram/clipviral_viralclips/campaigns/coinbase.js",
};

// Extension lookup for numbered Daleel clips
const DALEEL_EXTS = {
  1:"mov",2:"mov",3:"mov",4:"mov",5:"mov",
  6:"mov",7:"mov",8:"mov",9:"mov",
  10:"mp4",11:"mp4",12:"mp4",13:"mp4",14:"mp4",15:"mp4",
};

function parseRange(rangeStr) {
  if (rangeStr.includes("-")) {
    const [start, end] = rangeStr.split("-").map(Number);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  return [parseInt(rangeStr, 10)];
}

function uploadFile(localPath, r2Key) {
  if (!existsSync(localPath)) { console.error(`  ❌ Not found: ${localPath}`); return; }
  const ext         = r2Key.endsWith(".mov") ? "mov" : "mp4";
  const contentType = ext === "mov" ? "video/quicktime" : "video/mp4";
  const mb          = (statSync(localPath).size / 1024 / 1024).toFixed(1);
  console.log(`  Uploading ${r2Key} (${mb} MB)...`);
  execSync(
    `npx wrangler r2 object put ${BUCKET}/${r2Key} --file "${localPath}" --content-type "${contentType}" --remote`,
    { stdio: "inherit" }
  );
  console.log(`  ✅ ${r2Key}`);
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
    console.log("  node r2/sync.mjs coinbase yt 4-10");
    console.log("  node r2/sync.mjs coinbase ig 4-10");
    console.log("  node r2/sync.mjs list");
    process.exit(1);
  }

  if (!["daleel", "coinbase"].includes(campaign)) {
    console.error(`❌ Unknown campaign: ${campaign}`);
    process.exit(1);
  }
  if (!["yt", "ig", "tiktok"].includes(platform)) {
    console.error(`❌ Unknown platform: ${platform} (must be yt, ig or tiktok)`);
    process.exit(1);
  }

  const localDir = CAMPAIGN_DIRS[campaign];
  if (!localDir) { console.error(`❌ No directory for "${campaign}" in .env`); process.exit(1); }

  const nums = parseRange(rangeStr);
  console.log(`\nUploading ${campaign}/${platform} clips [${nums.join(", ")}] → R2\n`);

  const campaignKey = `${campaign}_${platform}`;

  if (CAMPAIGN_FILES[campaignKey]) {
    // Named clips (Coinbase): get actual filename from campaign file
    const { CLIPS } = await import(pathToFileURL(join(ROOT, CAMPAIGN_FILES[campaignKey])).href);
    for (const num of nums) {
      const clip = CLIPS[num - 1];
      if (!clip) { console.error(`  ❌ Clip ${num} not found (max: ${CLIPS.length})`); continue; }
      const r2Key    = `${campaign}/${platform}/${clip.file}`;
      const localPath = join(localDir, clip.file);
      uploadFile(localPath, r2Key);
    }
  } else {
    // Numbered clips (Daleel)
    for (const num of nums) {
      const ext       = campaign === "daleel" ? (DALEEL_EXTS[num] || "mp4") : "mp4";
      const filename  = `${num}.${ext}`;
      const r2Key     = `${campaign}/${platform}/${filename}`;
      const localPath = join(localDir, filename);
      uploadFile(localPath, r2Key);
    }
  }

  console.log("\nDone. Run 'node r2/sync.mjs list' to verify.");
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
