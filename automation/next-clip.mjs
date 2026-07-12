/**
 * Returns the next clip info for a given campaign/platform
 * Used by GitHub Actions to determine what to download from R2
 *
 * Usage:
 *   node automation/next-clip.mjs daleel yt
 *   → outputs: KEY=daleel/yt/2.mov NUM=2
 *
 *   node automation/next-clip.mjs coinbase ig
 *   → outputs: KEY=coinbase/ig/4.mp4 NUM=4
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT       = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = join(ROOT, "automation", "state.json");

const DALEEL_EXTS = {
  1:"mov",2:"mov",3:"mov",4:"mov",5:"mov",
  6:"mov",7:"mov",8:"mov",9:"mov",
  10:"mp4",11:"mp4",12:"mp4",13:"mp4",14:"mp4",15:"mp4",
};

function getExt(campaign, num) {
  if (campaign === "daleel") return DALEEL_EXTS[num] || "mp4";
  return "mp4";
}

const [,, campaign, platform] = process.argv;
if (!campaign || !platform) {
  console.error("Usage: node automation/next-clip.mjs <campaign> <platform>");
  process.exit(1);
}

const state   = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
const stateKey = `${campaign}_${platform}`;
const num     = state[stateKey];

if (!num) {
  console.error(`❌ No state for ${stateKey}`);
  process.exit(1);
}

const ext = getExt(campaign, num);
const key = `${campaign}/${platform}/${num}.${ext}`;

// Output as env-style vars for GitHub Actions
console.log(`KEY=${key}`);
console.log(`NUM=${num}`);
console.log(`EXT=${ext}`);
console.log(`FILE=${num}.${ext}`);
