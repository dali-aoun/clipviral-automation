/**
 * Returns the next clip info for a given campaign/platform
 * Used by GitHub Actions to determine what to download from R2
 *
 * Usage:
 *   node automation/next-clip.mjs daleel ig     → KEY=daleel/ig/1.mov NUM=1
 *   node automation/next-clip.mjs daleel tiktok → KEY=daleel/tiktok/1.mov NUM=1
 *   node automation/next-clip.mjs coinbase yt   → KEY=coinbase/yt/FINAL_clip_*.mp4 NUM=4
 *   node automation/next-clip.mjs coinbase ig   → KEY=coinbase/ig/IG_clip_4.mp4 NUM=4
 */
import { readFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT       = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = join(ROOT, "automation", "state.json");

// Campaign file path per campaign+platform (for named clips)
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

const [,, campaign, platform] = process.argv;
if (!campaign || !platform) {
  console.error("Usage: node automation/next-clip.mjs <campaign> <platform>");
  process.exit(1);
}

const state    = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
const stateKey = `${campaign}_${platform}`;
const num      = state[stateKey];

if (!num) {
  console.error(`❌ No state for ${stateKey}`);
  process.exit(1);
}

const campaignFileKey = `${campaign}_${platform}`;

if (CAMPAIGN_FILES[campaignFileKey]) {
  // Named clips (Coinbase): read actual filename from campaign file
  const { CLIPS } = await import(pathToFileURL(join(ROOT, CAMPAIGN_FILES[campaignFileKey])).href);
  const clip = CLIPS[num - 1];
  if (!clip) {
    console.error(`❌ Clip ${num} not found in campaign (max: ${CLIPS.length})`);
    process.exit(1);
  }
  const file = clip.file;
  const key  = `${campaign}/${platform}/${file}`;
  console.log(`KEY=${key}`);
  console.log(`NUM=${num}`);
  console.log(`FILE=${file}`);
} else {
  // Numbered clips (Daleel): use {num}.{ext}
  const ext  = campaign === "daleel" ? (DALEEL_EXTS[num] || "mp4") : "mp4";
  const file = `${num}.${ext}`;
  const key  = `${campaign}/${platform}/${file}`;
  console.log(`KEY=${key}`);
  console.log(`NUM=${num}`);
  console.log(`EXT=${ext}`);
  console.log(`FILE=${file}`);
}
