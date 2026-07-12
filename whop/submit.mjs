/**
 * Whop ContentRewards Auto-Submit — @clipviral_viralclips
 *
 * SETUP (once):
 *   node whop/submit.mjs --setup
 *   → Opens Chrome, login to Whop, submit ONE video manually, close window
 *
 * SUBMIT:
 *   node whop/submit.mjs "<title>" "<instagram_url>"
 */
import { chromium } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname    = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dirname, "session.json");
const WHOP_PROFILE = join(__dirname, ".whop-profile");
const CHROME_EXE   = process.env.CHROME_EXE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Discovered during setup — Whop embedded app endpoints
const APP_BASE     = "https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com";
const EXPERIENCE   = "exp_7JCcUJtwdGEme8";
const CAMPAIGN_ID  = "c60b3049-e616-4a20-af96-93202d929748";
const APP_URL      = `${APP_BASE}/experiences/${EXPERIENCE}/discover/${CAMPAIGN_ID}`;
const WHOP_URL     = "https://whop.com/joined/cliphaus-inc/exp_7JCcUJtwdGEme8/app/";

function loadSession() {
  if (!existsSync(SESSION_FILE)) {
    console.error("❌ No session. Run: node whop/submit.mjs --setup");
    process.exit(1);
  }
  return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
}

function saveSession(data) {
  writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
}

function launchChrome(headless = true) {
  return chromium.launchPersistentContext(WHOP_PROFILE, {
    headless,
    executablePath: CHROME_EXE,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
    ignoreDefaultArgs: ["--enable-automation"],
    slowMo: headless ? 0 : 80,
  });
}

async function autoSubmit(title, videoUrl) {
  console.log(`Submitting: "${title}"\n  ${videoUrl}`);
  const context = await launchChrome(false); // visible for debugging
  const page    = await context.newPage();

  try {
    await page.goto(WHOP_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    // The submit form is inside an iframe from apps.whop.com
    const frames = page.frames();
    console.log(`  Frames found: ${frames.length}`);
    frames.forEach((f, i) => console.log(`    [${i}] ${f.url()}`));

    // Find the apps.whop.com iframe and navigate it to the campaign submit page
    const appFrame = frames.find(f => f.url().includes("apps.whop.com"));
    if (!appFrame) throw new Error("apps.whop.com iframe not found");
    console.log(`  App frame: ${appFrame.url()}`);

    await appFrame.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log(`  Navigated to campaign submit page`);
    await appFrame.waitForTimeout(4000);
    const target = appFrame;

    // Click "Submit Video" button to open the submission form
    const submitVideoBtn = target.locator('button:has-text("Submit Video")').first();
    await submitVideoBtn.waitFor({ timeout: 15000 });
    await submitVideoBtn.click();
    console.log("  Clicked 'Submit Video'");
    await target.waitForTimeout(2000);

    // Now the URL input should appear
    const urlInput = target.locator('input[type="url"], input[placeholder*="instagram" i], input[placeholder*="http" i], input[placeholder*="url" i], input[placeholder*="link" i]').first();
    await urlInput.waitFor({ timeout: 15000 });
    await urlInput.fill(videoUrl);
    console.log("  URL filled");
    await target.waitForTimeout(1000);

    // Fill title if present
    const titleInput = target.locator('input[placeholder*="title" i], input[name*="title" i]').first();
    if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await titleInput.fill(title);
      console.log("  Title filled");
    }

    // Click submit — use force:true to bypass modal overlay interception
    const submitBtn = target.locator('button:has-text("Submit"), button[type="submit"], button:has-text("Post")').first();
    await submitBtn.waitFor({ timeout: 10000 });
    await submitBtn.click({ force: true });
    console.log("  Submit clicked");

    await target.waitForTimeout(4000);
    const success = await target.locator("text=/success|submitted|pending|approved|thank/i").first()
      .isVisible({ timeout: 10000 }).catch(() => false);

    console.log(success ? "✅ Submitted successfully!" : "⚠️  Result uncertain — verify on Whop");
    return success;
  } finally {
    await page.waitForTimeout(2000);
    await context.close();
  }
}

async function setup() {
  console.log("\nSETUP MODE — ContentRewards");
  console.log("1. Chrome will open (separate profile)");
  console.log("2. Login to Whop with Google if needed");
  console.log("3. Submit ONE video manually");
  console.log("4. Close the window → session saved\n");

  const context = await launchChrome(false);
  const page    = await context.newPage();

  const captured = [];
  context.on("request", req => {
    if (req.method() === "POST" && req.url().includes("whop.com") && !req.url().includes("analytics") && !req.url().includes("cdn-cgi")) {
      const body = req.postData() || "";
      captured.push({ url: req.url(), headers: req.headers(), body, ts: Date.now() });
      if (body.length > 10) console.log(`  POST [${new Date().toISOString().slice(11,19)}]: ${req.url()}\n    ${body.substring(0, 120)}`);
    }
  });

  try { await page.goto(WHOP_URL, { waitUntil: "domcontentloaded", timeout: 90000 }); }
  catch (e) { console.log(`Navigation warning: ${e.message.substring(0, 80)}`); }

  await new Promise(r => setTimeout(r, 6000));
  captured.length = 0;
  console.log("\n>>> Ready — paste video URL in Whop, click Submit, then CLOSE the window. <<<\n");

  await new Promise(resolve => {
    const timeout = setTimeout(resolve, 600000);
    context.on("close", () => { clearTimeout(timeout); resolve(); });
    page.on("close",    () => { clearTimeout(timeout); resolve(); });
  });

  let cookies = [];
  try { cookies = await context.cookies(); } catch {}

  const realSubmit = captured.find(r => /instagram|youtube|youtu\.be|tiktok/i.test(r.body))
    || captured.filter(r => r.body.length > 20).sort((a, b) => b.ts - a.ts)[0];

  let apiFormat = null;
  if (realSubmit) {
    let payload, contentType;
    try   { payload = JSON.parse(realSubmit.body); contentType = "application/json"; }
    catch { payload = Object.fromEntries(new URLSearchParams(realSubmit.body)); contentType = "application/x-www-form-urlencoded"; }
    const urlKey   = Object.keys(payload).find(k => /url|link|video/i.test(k));
    const titleKey = Object.keys(payload).find(k => /title|name/i.test(k));
    apiFormat = { url: realSubmit.url, headers: realSubmit.headers, contentType, payload, urlKey, titleKey };
    console.log(`\nAPI format captured! url="${realSubmit.url}" urlKey="${urlKey}"`);
  }

  saveSession({ cookies, apiFormat, capturedRequests: captured.slice(-15) });
  console.log(`Session saved (${cookies.length} cookies) → node whop/submit.mjs "<title>" "<url>"`);
  try { await context.close(); } catch {}
}

async function main() {
  const [,, arg1, arg2] = process.argv;

  if (arg1 === "--setup") { await setup(); return; }

  if (!arg1 || !arg2) {
    console.log("Usage:");
    console.log("  Setup:  node whop/submit.mjs --setup");
    console.log('  Submit: node whop/submit.mjs "<title>" "<url>"');
    process.exit(1);
  }

  loadSession(); // verify session exists
  await autoSubmit(arg1, arg2);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
