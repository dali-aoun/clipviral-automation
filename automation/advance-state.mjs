/**
 * Increments the clip counter for a campaign/platform in state.json
 * Called by GitHub Actions after successful publication
 *
 * Usage:
 *   node automation/advance-state.mjs daleel yt
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT       = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = join(ROOT, "automation", "state.json");

const [,, campaign, platform] = process.argv;
if (!campaign || !platform) {
  console.error("Usage: node automation/advance-state.mjs <campaign> <platform>");
  process.exit(1);
}

const state    = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
const stateKey = `${campaign}_${platform}`;
const current  = state[stateKey];

state[stateKey] = current + 1;
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
console.log(`✅ ${stateKey}: ${current} → ${state[stateKey]}`);
