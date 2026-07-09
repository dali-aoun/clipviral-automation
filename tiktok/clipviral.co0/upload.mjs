/**
 * TikTok Video Uploader — @clipviral.co0
 * Status: APP IN REVIEW — will be activated once TikTok approves the ClipHaus app
 *
 * App: ClipHaus | Developer Portal: developers.tiktok.com
 * Redirect URI: https://brightysmile.com/callback
 * Scopes needed: video.publish, video.upload
 *
 * Flow (once approved):
 *   1. User authorizes via OAuth → get access_token
 *   2. Initialize upload: POST /v2/post/publish/video/init/
 *   3. Upload video chunks
 *   4. Publish
 *
 * Env vars (in root .env):
 *   TIKTOK_CLIENT_KEY
 *   TIKTOK_CLIENT_SECRET
 *   TIKTOK_REDIRECT_URI=https://brightysmile.com/callback
 */
import { existsSync, readFileSync, statSync, createReadStream } from "fs";
import { readFile, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "../..");
const env       = loadEnv(join(ROOT, ".env"));

const CLIENT_KEY    = env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI  = env.TIKTOK_REDIRECT_URI;
const TOKEN_PATH    = join(__dirname, "token.json");
const CLIPS_DIR     = env.CLIPS_DIR;

function loadEnv(path) {
  if (!existsSync(path)) { console.error(`❌ .env not found at ${path}`); process.exit(1); }
  return Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()])
  );
}

async function getToken() {
  if (!existsSync(TOKEN_PATH)) {
    console.error("❌ token.json not found — run OAuth flow first");
    console.error("   See: https://developers.tiktok.com/doc/login-kit-web");
    process.exit(1);
  }
  return JSON.parse(await readFile(TOKEN_PATH, "utf-8"));
}

async function refreshToken(refreshTk) {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key:    CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token: refreshTk,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  await writeFile(TOKEN_PATH, JSON.stringify(data, null, 2));
  console.log("  Token refreshed");
  return data;
}

async function initUpload(accessToken, fileSize) {
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title:            "posted via ClipHaus automation",
        privacy_level:    "PUBLIC_TO_EVERYONE",
        disable_duet:     false,
        disable_comment:  false,
        disable_stitch:   false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source:          "FILE_UPLOAD",
        video_size:      fileSize,
        chunk_size:      fileSize,
        total_chunk_count: 1,
      },
    }),
  });
  const data = await res.json();
  if (data.error?.code !== "ok") throw new Error(`Init failed: ${JSON.stringify(data)}`);
  return data.data;
}

async function uploadChunk(uploadUrl, filePath, fileSize) {
  const stream = createReadStream(filePath);
  const res = await fetch(uploadUrl, {
    method:  "PUT",
    headers: {
      "Content-Type":  "video/mp4",
      "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
      "Content-Length": String(fileSize),
    },
    body: stream,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  console.log("  Chunk uploaded");
}

async function main() {
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    console.error("❌ TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET required in .env");
    console.error("   App is currently IN REVIEW — awaiting TikTok approval");
    process.exit(1);
  }

  const filePath = process.argv[2];
  if (!filePath || !existsSync(filePath)) {
    console.error("Usage: node tiktok/clipviral.co0/upload.mjs <path/to/video.mp4>");
    process.exit(1);
  }

  const fileSize = statSync(filePath).size;
  console.log(`\nTikTok Upload — @clipviral.co0`);
  console.log(`File: ${filePath} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

  let { access_token, refresh_token, expires_in, created_at } = await getToken();

  // Refresh if expired (with 5 min buffer)
  const expiresAt = (created_at || 0) + (expires_in || 0) - 300;
  if (Date.now() / 1000 > expiresAt) {
    console.log("  Token expired, refreshing...");
    ({ access_token } = await refreshToken(refresh_token));
  }

  console.log("  Initializing upload...");
  const { publish_id, upload_url } = await initUpload(access_token, fileSize);
  console.log(`  publish_id: ${publish_id}`);

  console.log("  Uploading video...");
  await uploadChunk(upload_url, filePath, fileSize);

  console.log(`\nUPLOADED to TikTok — @clipviral.co0`);
  console.log(`publish_id: ${publish_id}`);
  console.log(`Check status at: https://developers.tiktok.com/doc/content-posting-api-reference-query-video-status`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
