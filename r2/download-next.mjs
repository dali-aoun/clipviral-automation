/**
 * Download the next available clip from R2 — used by GitHub Actions
 *
 * Usage:
 *   node r2/download-next.mjs <campaign> <platform> <output_dir>
 *   node r2/download-next.mjs daleel yt /tmp/clips
 *
 * Writes:
 *   {output_dir}/{filename}   — the video file
 *   {output_dir}/.clip_num    — the clip number (for upload.mjs)
 *   {output_dir}/.r2_key      — the R2 key (for delete.mjs)
 *
 * Exits with code 2 if no clips are available (workflow should skip).
 */
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream, mkdirSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { pipeline } from "stream/promises";

const { r2, BUCKET } = await import("./client.mjs");

async function main() {
  const [,, campaign, platform, outputDir] = process.argv;
  if (!campaign || !platform || !outputDir) {
    console.error("Usage: node r2/download-next.mjs <campaign> <platform> <output_dir>");
    process.exit(1);
  }

  const prefix = `${campaign}/${platform}/`;
  const res    = await r2.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  const objects = (res.Contents || []).sort((a, b) => {
    const numA = parseInt(a.Key.replace(prefix, "").split(".")[0], 10);
    const numB = parseInt(b.Key.replace(prefix, "").split(".")[0], 10);
    return numA - numB;
  });

  if (objects.length === 0) {
    console.log(`⚠️  No clips available in R2 for ${campaign}/${platform} — skipping`);
    process.exit(2);
  }

  const next    = objects[0];
  const key     = next.Key;
  const file    = basename(key);
  const clipNum = parseInt(file.split(".")[0], 10);

  console.log(`Downloading ${key} (${(next.Size / 1024 / 1024).toFixed(1)} MB)...`);
  mkdirSync(outputDir, { recursive: true });

  const obj      = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const outPath  = join(outputDir, file);
  await pipeline(obj.Body, createWriteStream(outPath));

  writeFileSync(join(outputDir, ".clip_num"), String(clipNum));
  writeFileSync(join(outputDir, ".r2_key"),   key);

  console.log(`✅ Downloaded → ${outPath}`);
  console.log(`   Clip num: ${clipNum} | R2 key: ${key}`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
