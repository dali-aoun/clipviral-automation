/**
 * YouTube OAuth2 — @QuranKarim-84 (Daleel content)
 * Status: FUTURE — setup when channel is ready
 *
 * Setup:
 *   1. Create a new Google Cloud project for @QuranKarim-84
 *   2. Enable YouTube Data API v3
 *   3. Download OAuth credentials → youtube/QuranKarim-84/credentials.json (gitignored)
 *   4. node youtube/QuranKarim-84/auth.mjs
 *   5. Login with the @QuranKarim-84 Google account
 */
import { google } from "googleapis";
import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname        = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = join(__dirname, "credentials.json");
const TOKEN_PATH       = join(__dirname, "token.json");
const REDIRECT_URI     = "http://localhost:8080";
const SCOPES           = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"];

async function main() {
  const creds = JSON.parse(await readFile(CREDENTIALS_PATH, "utf-8"));
  const { client_id, client_secret } = creds.installed;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });

  console.log("\nYouTube Authorization — @QuranKarim-84 (Daleel)");
  console.log("=".repeat(50));
  console.log("\nOpen this URL in Chrome (@QuranKarim-84 account):");
  console.log("\n" + authUrl + "\n");

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url  = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<h1>Authorized!</h1>`);
        server.close();
        resolve(code);
      } else {
        res.writeHead(400); res.end("No code");
        reject(new Error("No code"));
      }
    });
    server.listen(8080, () => console.log("Waiting on http://localhost:8080 ..."));
    server.on("error", reject);
  });

  const { tokens } = await oauth2Client.getToken(code);
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log("\nToken saved. Now run: node youtube/QuranKarim-84/upload.mjs daleel 1");
}

main().catch(console.error);
