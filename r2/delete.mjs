/**
 * Delete a clip from R2 after successful publication — used by GitHub Actions
 *
 * Usage:
 *   node r2/delete.mjs <r2_key>
 *   node r2/delete.mjs "daleel/yt/1.mov"
 */
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

const { r2, BUCKET } = await import("./client.mjs");

async function main() {
  const [,, key] = process.argv;
  if (!key) {
    console.error("Usage: node r2/delete.mjs <r2_key>");
    process.exit(1);
  }

  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log(`✅ Deleted from R2: ${key}`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
