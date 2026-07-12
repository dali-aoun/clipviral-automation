/**
 * YouTube Shorts Uploader — @theclipviralco
 * Account: @theclipviralco
 *
 * Setup:
 *   1. Run auth.mjs once to create token.json
 *   2. node youtube/theclipviralco/upload.mjs [campaign] [clip_number]
 *
 * Examples:
 *   node youtube/theclipviralco/upload.mjs coinbase 1
 *   npm run yt:cv -- coinbase 3
 */
import { google } from "googleapis";
import { createReadStream, statSync, existsSync, readFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname        = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = join(__dirname, "credentials.json");
const TOKEN_PATH       = join(__dirname, "token.json");

const ROOT      = resolve(__dirname, "../..");
const env       = loadEnv(join(ROOT, ".env"));
const CLIPS_DIR = env.CLIPS_DIR;

function loadEnv(path) {
  if (!existsSync(path)) { console.error(`❌ .env not found at ${path}`); process.exit(1); }
  return Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()])
  );
}

async function getAuthClient() {
  const creds = JSON.parse(await readFile(CREDENTIALS_PATH, "utf-8"));
  const { client_id, client_secret } = creds.installed;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, "http://localhost:8080");

  if (!existsSync(TOKEN_PATH)) {
    console.error("❌ token.json not found — run: node youtube/theclipviralco/auth.mjs");
    process.exit(1);
  }

  const token = JSON.parse(await readFile(TOKEN_PATH, "utf-8"));
  oauth2Client.setCredentials(token);
  oauth2Client.on("tokens", async (tokens) => {
    const current = JSON.parse(await readFile(TOKEN_PATH, "utf-8"));
    await writeFile(TOKEN_PATH, JSON.stringify({ ...current, ...tokens }, null, 2));
    console.log("  Token refreshed");
  });
  return oauth2Client;
}

async function uploadClip(clip, clipNum) {
  const filePath = join(CLIPS_DIR, clip.file);
  if (!existsSync(filePath)) { console.error(`❌ Not found: ${filePath}`); process.exit(1); }

  const fileSize   = statSync(filePath).size;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);

  console.log(`\nYouTube Upload — @theclipviralco`);
  console.log(`Clip  : ${clipNum} — ${clip.title}`);
  console.log(`File  : ${clip.file} (${fileSizeMB} MB)`);
  console.log("Uploading...");

  const auth    = await getAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title:           clip.title,
        description:     clip.description,
        tags:            clip.tags,
        categoryId:      "22",
        defaultLanguage: "en",
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    },
    media: { body: createReadStream(filePath) },
  }, {
    onUploadProgress: (evt) => {
      const pct = Math.round((evt.bytesRead / fileSize) * 100);
      process.stdout.write(`\r  Progress: ${pct}% (${(evt.bytesRead / 1024 / 1024).toFixed(1)} MB)`);
    },
  });

  const videoUrl = `https://www.youtube.com/watch?v=${res.data.id}`;
  console.log(`\n\nUPLOADED: ${videoUrl}`);

  // Auto-submit to Whop ContentRewards
  console.log("\nSubmitting to Whop ContentRewards...");
  const whopScript = join(ROOT, "whop", "submit.mjs");
  execSync(`node "${whopScript}" "${clip.title}" "${videoUrl}"`, { stdio: "inherit", cwd: ROOT });

  return videoUrl;
}

async function main() {
  const campaignName = process.argv[2] || "coinbase";
  const clipNum      = parseInt(process.argv[3] ?? "1", 10);

  const { CLIPS } = await import(`./campaigns/${campaignName}.js`);
  const clip = CLIPS[clipNum - 1];
  if (!clip) { console.error(`Clip ${clipNum} not found in campaign "${campaignName}" (max: ${CLIPS.length})`); process.exit(1); }

  await uploadClip(clip, clipNum);
}

main().catch(e => {
  console.error("\n❌", e.message);
  if (e.message.includes("invalid_grant")) console.error("Token expired — run: node youtube/theclipviralco/auth.mjs");
  process.exit(1);
});
