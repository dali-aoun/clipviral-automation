/**
 * Instagram Reels Uploader — @clipviral_viralclips
 * Account: clipviral_viralclips | User ID: 27308818108747028
 *
 * Setup:
 *   1. Copy .env.example to .env and fill IG_CV_TOKEN + IG_CV_USER_ID
 *   2. node instagram/clipviral_viralclips/upload.mjs [campaign] [clip_number]
 *
 * Examples:
 *   node instagram/clipviral_viralclips/upload.mjs coinbase 1
 *   npm run ig:cv -- coinbase 3
 */
import { createReadStream, existsSync, statSync, readFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import fetch from "node-fetch";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const env  = loadEnv(join(ROOT, ".env"));

const IG_TOKEN   = env.IG_CV_TOKEN;
const IG_USER_ID = env.IG_CV_USER_ID;
const CLIPS_DIR  = env.CLIPS_DIR;

if (!IG_TOKEN || !IG_USER_ID) {
  console.error("❌ IG_CV_TOKEN and IG_CV_USER_ID required in .env");
  process.exit(1);
}

function loadEnv(path) {
  if (!existsSync(path)) { console.error(`❌ .env not found at ${path}`); process.exit(1); }
  return Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()])
  );
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function uploadToLitterbox(filePath) {
  console.log("  Uploading to litterbox.catbox.moe...");
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("time", "72h");
  form.append("fileToUpload", createReadStream(filePath));
  const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
    method: "POST", body: form, headers: form.getHeaders(),
  });
  const url = (await res.text()).trim();
  if (!url.startsWith("https://")) throw new Error(`litterbox failed: ${url}`);
  console.log(`  Public URL: ${url}`);
  return url;
}

async function igPost(videoUrl, caption) {
  const base = `https://graph.instagram.com/v21.0/${IG_USER_ID}`;

  console.log("  Creating Instagram container...");
  const cRes = await fetch(`${base}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "REELS", video_url: videoUrl, caption, share_to_feed: true, access_token: IG_TOKEN }),
  });
  const container = await cRes.json();
  if (!container.id) throw new Error(`Container failed: ${JSON.stringify(container)}`);
  console.log(`  Container: ${container.id}`);

  console.log("  Processing...");
  let status = "IN_PROGRESS";
  for (let i = 0; i < 30 && status !== "FINISHED"; i++) {
    await sleep(10000);
    const s = await (await fetch(`https://graph.instagram.com/v21.0/${container.id}?fields=status_code&access_token=${IG_TOKEN}`)).json();
    status = s.status_code;
    process.stdout.write(`\r  Status: ${status} (${i + 1}/30)  `);
    if (status === "ERROR") throw new Error(`Processing error: ${JSON.stringify(s)}`);
  }
  if (status !== "FINISHED") throw new Error("Timeout");
  console.log();

  console.log("  Publishing...");
  const pub = await (await fetch(`${base}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: IG_TOKEN }),
  })).json();
  if (!pub.id) throw new Error(`Publish failed: ${JSON.stringify(pub)}`);

  const media = await (await fetch(`https://graph.instagram.com/v21.0/${pub.id}?fields=permalink&access_token=${IG_TOKEN}`)).json();
  return media.permalink || `https://www.instagram.com/reel/${pub.id}/`;
}

async function main() {
  const campaignName = process.argv[2] || "coinbase";
  const clipNum      = parseInt(process.argv[3] ?? "1", 10) - 1;

  const { CLIPS } = await import(`./campaigns/${campaignName}.js`);
  const clip = CLIPS[clipNum];
  if (!clip) { console.error(`Clip ${clipNum + 1} not found in campaign "${campaignName}" (max: ${CLIPS.length})`); process.exit(1); }

  const filePath = join(CLIPS_DIR, clip.file);
  if (!existsSync(filePath)) { console.error(`❌ Not found: ${filePath}`); process.exit(1); }

  const mb = (statSync(filePath).size / 1024 / 1024).toFixed(1);
  console.log(`\nInstagram Upload — @clipviral_viralclips`);
  console.log(`Campaign : ${campaignName} | Clip ${clipNum + 1}`);
  console.log(`File     : ${clip.file} (${mb} MB)`);

  const publicUrl = await uploadToLitterbox(filePath);
  const postUrl   = await igPost(publicUrl, clip.caption);

  console.log(`\nPOSTED: ${postUrl}`);
  console.log(`Submit on Whop: contentrewards.com → ${campaignName} campaign → ${postUrl}`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
