/**
 * TikTok Video Uploader — @daliaoun84 (Daleel content)
 * Status: FUTURE — needs separate TikTok app registration
 *
 * Steps to activate:
 *   1. Register a new app in TikTok Developer Portal for @daliaoun84
 *   2. Request scopes: video.publish, video.upload
 *   3. Fill TIKTOK_DALEEL_CLIENT_KEY + TIKTOK_DALEEL_CLIENT_SECRET in root .env
 *   4. Run OAuth flow → save token to tiktok/daliaoun84/token.json
 *   5. node tiktok/daliaoun84/upload.mjs <video.mp4>
 *
 * The upload logic is identical to clipviral.co0 — only credentials differ.
 * Copy upload.mjs from tiktok/clipviral.co0/ and update env var names.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "../..");
const env       = loadEnv(join(ROOT, ".env"));

function loadEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()])
  );
}

if (!env.TIKTOK_DALEEL_CLIENT_KEY) {
  console.error("❌ TIKTOK_DALEEL_CLIENT_KEY not set in .env");
  console.error("   @daliaoun84 is not yet configured — see file header for setup steps");
  process.exit(1);
}

// TODO: implement same flow as tiktok/clipviral.co0/upload.mjs
// using TIKTOK_DALEEL_CLIENT_KEY and TIKTOK_DALEEL_CLIENT_SECRET
console.log("@daliaoun84 upload — coming soon");
