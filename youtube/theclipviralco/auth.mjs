/**
 * YouTube OAuth2 — @theclipviralco
 * Run ONCE to authorize the channel. Saves token to youtube/theclipviralco/token.json (gitignored).
 *
 * Setup:
 *   1. Place your Google API credentials at youtube/theclipviralco/credentials.json (gitignored)
 *      → Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Desktop)
 *   2. node youtube/theclipviralco/auth.mjs
 *   3. Login with the @theclipviralco Google account
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

  console.log("\nYouTube Authorization — @theclipviralco");
  console.log("=".repeat(50));
  console.log("\n1. Open this URL in Chrome (ClipViral account):");
  console.log("\n" + authUrl + "\n");
  console.log("2. Login with the @theclipviralco Google account");
  console.log("3. Accept permissions");
  console.log("4. Waiting for redirect to localhost...\n");

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url  = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<h1>Authorized! Return to terminal.</h1>`);
        server.close();
        resolve(code);
      } else {
        res.writeHead(400); res.end("No code");
        reject(new Error("No code in callback"));
      }
    });
    server.listen(8080, () => console.log("Waiting on http://localhost:8080 ..."));
    server.on("error", reject);
  });

  const { tokens } = await oauth2Client.getToken(code);
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log("\nToken saved to token.json");
  console.log("Now run: node youtube/theclipviralco/upload.mjs coinbase 1");
}

main().catch(console.error);
