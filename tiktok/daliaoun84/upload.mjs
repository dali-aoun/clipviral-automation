/**
 * TikTok Video Uploader — @daliaoun84 (Daleel content)
 *
 * Prerequisites:
 *   1. TikTok developer app with video.publish + video.upload scopes approved
 *   2. OAuth flow completed → token.json saved here
 *   3. In .env: TIKTOK_DALEEL_CLIENT_KEY, TIKTOK_DALEEL_CLIENT_SECRET, DALEEL_CLIPS_DIR
 *
 * Usage:
 *   node tiktok/daliaoun84/upload.mjs daleel 1
 */
import { existsSync, readFileSync, statSync, createReadStream, unlinkSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, "../..");
const TOKEN_PATH = join(__dirname, "token.json");
const env        = loadEnv(join(ROOT, ".env"));

const CLIENT_KEY    = env.TIKTOK_DALEEL_CLIENT_KEY;
const CLIENT_SECRET = env.TIKTOK_DALEEL_CLIENT_SECRET;
const CLIPS_DIR     = env.DALEEL_CLIPS_DIR;
const VOICE_SCRIPT  = resolve(ROOT, "instagram", "med.ali.84", "voiceover.py");

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
    console.error("❌ token.json not found — run TikTok OAuth flow first");
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
  data.created_at = Math.floor(Date.now() / 1000);
  await writeFile(TOKEN_PATH, JSON.stringify(data, null, 2));
  console.log("  Token refreshed ✓");
  return data;
}

async function initUpload(accessToken, fileSize, caption) {
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title:            caption.slice(0, 150),
        description:      caption,
        privacy_level:    "PUBLIC_TO_EVERYONE",
        disable_duet:     false,
        disable_comment:  false,
        disable_stitch:   false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source:            "FILE_UPLOAD",
        video_size:        fileSize,
        chunk_size:        fileSize,
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
      "Content-Type":   "video/mp4",
      "Content-Range":  `bytes 0-${fileSize - 1}/${fileSize}`,
      "Content-Length": String(fileSize),
    },
    body: stream,
  });
  if (!res.ok) throw new Error(`Upload chunk failed: ${res.status} ${await res.text()}`);
  console.log("  Chunk uploaded ✓");
}

async function main() {
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    console.error("❌ TIKTOK_DALEEL_CLIENT_KEY and TIKTOK_DALEEL_CLIENT_SECRET required in .env");
    process.exit(1);
  }
  if (!CLIPS_DIR) {
    console.error("❌ DALEEL_CLIPS_DIR required in .env");
    process.exit(1);
  }

  const campaignName = process.argv[2] || "daleel";
  const clipNum      = parseInt(process.argv[3] ?? "1", 10) - 1;

  const { CLIPS } = await import(`./campaigns/${campaignName}.js`);
  const clip = CLIPS[clipNum];
  if (!clip) { console.error(`Clip ${clipNum + 1} not found (max: ${CLIPS.length})`); process.exit(1); }

  const filePath = join(CLIPS_DIR, clip.file);
  if (!existsSync(filePath)) { console.error(`❌ Not found: ${filePath}`); process.exit(1); }

  const mb = (statSync(filePath).size / 1024 / 1024).toFixed(1);
  console.log(`\nTikTok Upload — @daliaoun84 (Daleel)`);
  console.log(`Campaign : ${campaignName} | Clip ${clipNum + 1}`);
  console.log(`File     : ${clip.file} (${mb} MB)`);

  // Arabic voiceover
  const voicedPath = filePath.replace(/\.(mov|mp4)$/i, "_voiced.mp4");
  console.log("  Adding Arabic voiceover...");
  execSync(`python "${VOICE_SCRIPT}" ${clipNum + 1} "${filePath}" "${voicedPath}"`, { stdio: "inherit" });
  const uploadPath = existsSync(voicedPath) ? voicedPath : filePath;

  const fileSize = statSync(uploadPath).size;

  let { access_token, refresh_token, expires_in, created_at } = await getToken();

  const expiresAt = (created_at || 0) + (expires_in || 0) - 300;
  if (Date.now() / 1000 > expiresAt) {
    console.log("  Token expired, refreshing...");
    ({ access_token } = await refreshToken(refresh_token));
  }

  console.log("  Initializing TikTok upload...");
  const { publish_id, upload_url } = await initUpload(access_token, fileSize, clip.caption);
  console.log(`  publish_id: ${publish_id}`);

  console.log("  Uploading video...");
  await uploadChunk(upload_url, uploadPath, fileSize);

  if (uploadPath !== filePath && existsSync(voicedPath)) unlinkSync(voicedPath);

  console.log(`\nUPLOADED to TikTok — @daliaoun84`);
  console.log(`publish_id: ${publish_id}`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
