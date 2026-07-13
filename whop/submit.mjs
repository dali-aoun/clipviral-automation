/**
 * Whop ContentRewards Auto-Submit
 * Submits uploaded video URLs to the ContentRewards campaign on Whop.
 *
 * SETUP (once):
 *   node whop/submit.mjs --setup
 *   → Opens Chrome, login to Whop, submit ONE video manually
 *   → Script captures the API format automatically → saves to session.json (gitignored)
 *
 * SUBMIT:
 *   node whop/submit.mjs "<video title>" "<video url>"
 *   node whop/submit.mjs "Coinbase AI Advisor" "https://www.youtube.com/watch?v=..."
 *
 * INSPECT (if API format changes):
 *   node whop/submit.mjs --inspect
 */
import { chromium } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname    = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dirname, "session.json");
const SUBMIT_URL   = "https://whop.com/hub/cliphaus/coinbase/submit/";
const CHROME_EXE   = process.env.CHROME_EXE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CHROME_DATA  = process.env.CHROME_USER_DATA || "C:\\Users\\DALI\\AppData\\Local\\Google\\Chrome\\User Data";

function loadSession() {
  if (!existsSync(SESSION_FILE)) {
    console.error("❌ No session. Run: node whop/submit.mjs --setup");
    process.exit(1);
  }
  return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
}

function saveSession(session) {
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function buildCookieHeader(cookies) {
  return cookies
    .filter(c => c.domain && (c.domain.includes("whop.com") || c.domain.startsWith(".")))
    .map(c => `${c.name}=${c.value}`)
    .join("; ");
}

async function apiSubmit(title, videoUrl, session) {
  const fmt = session.apiFormat;
  if (!fmt) return false;

  console.log("Submitting via API...");
  const cookieHeader = buildCookieHeader(session.cookies);
  const csrfToken    = session.cookies.find(c => c.name.includes("csrf"))?.value || "";

  let body;
  if (fmt.contentType === "application/json") {
    const payload = { ...fmt.payload };
    if (fmt.titleKey) payload[fmt.titleKey] = title;
    if (fmt.urlKey)   payload[fmt.urlKey]   = videoUrl;
    body = JSON.stringify(payload);
  } else {
    const params = new URLSearchParams(fmt.payload);
    if (fmt.titleKey) params.set(fmt.titleKey, title);
    if (fmt.urlKey)   params.set(fmt.urlKey, videoUrl);
    body = params.toString();
  }

  const headers = { ...fmt.headers, "cookie": cookieHeader, "x-csrf-token": csrfToken, "content-type": fmt.contentType || "application/json" };
  delete headers["content-length"];

  try {
    const res = await fetch(fmt.url, { method: "POST", headers, body });
    const text = await res.text().catch(() => "");
    if (res.ok || res.status === 201 || res.status === 202) {
      console.log(`Submitted! (HTTP ${res.status})`);
      return true;
    }
    console.log(`API ${res.status}: ${text.substring(0, 200)}`);
    return false;
  } catch (e) {
    console.log(`Network error: ${e.message}`);
    return false;
  }
}

async function browserSubmit(title, videoUrl, session, headless = false) {
  console.log(`Opening Chrome${headless ? " (headless)" : ""}...`);
  if (!headless) console.log("  Close Chrome completely before running this script!\n");

  const context = await chromium.launchPersistentContext(CHROME_DATA, {
    headless,
    executablePath: CHROME_EXE,
    channel: "chrome",
    args: ["--profile-directory=Default", "--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
    ignoreDefaultArgs: ["--enable-automation"],
    slowMo: headless ? 0 : 150,
  });
  const page = await context.newPage();

  const captured = [];
  page.on("request", req => {
    if (req.method() === "POST" && req.url().includes("whop.com") && !req.url().includes("cdn-cgi")) {
      const body = req.postData() || "";
      captured.push({ url: req.url(), headers: req.headers(), body, ts: Date.now() });
    }
  });

  await page.goto(SUBMIT_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);

  // Fill URL field
  const urlSelectors = ['input[placeholder*="http" i]','input[placeholder*="youtube" i]','input[placeholder*="url" i]','input[type="url"]','input[name*="url" i]'];
  for (const sel of urlSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) { await el.fill(videoUrl); break; }
  }

  // Fill title field
  const titleSelectors = ['input[placeholder*="title" i]','input[name*="title" i]','textarea[placeholder*="title" i]'];
  for (const sel of titleSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) { await el.fill(title); break; }
  }

  // Check checkboxes
  const checkboxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < await checkboxes.count(); i++) {
    const cb = checkboxes.nth(i);
    if (await cb.isVisible({ timeout: 500 }).catch(() => false) && !await cb.isChecked()) await cb.check();
  }

  captured.length = 0;
  await page.waitForTimeout(1000);

  const submitSelectors = ['button:has-text("Submit for approval")','button:has-text("Submit")','button[type="submit"]'];
  for (const sel of submitSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) { await btn.click(); break; }
  }

  await page.waitForTimeout(4000);
  const success = await page.locator("text=/success|submitted|pending|approved/i").first().isVisible({ timeout: 5000 }).catch(() => false);
  if (success) console.log("Submitted successfully!");
  else console.log("Result uncertain — verify on Whop");

  const realSubmit = captured.find(r => r.url.includes("/submit/") && r.body && r.body.length > 4);
  if (realSubmit) {
    let payload, contentType;
    try { payload = JSON.parse(realSubmit.body); contentType = "application/json"; }
    catch { payload = Object.fromEntries(new URLSearchParams(realSubmit.body)); contentType = "application/x-www-form-urlencoded"; }
    const titleKey = Object.keys(payload).find(k => /title|name/i.test(k));
    const urlKey   = Object.keys(payload).find(k => /url|link|video/i.test(k));
    session.apiFormat = { url: realSubmit.url, headers: realSubmit.headers, contentType, payload, titleKey, urlKey };
    console.log(`API format captured. titleKey="${titleKey}" urlKey="${urlKey}"`);
  }

  session.cookies = await context.cookies();
  saveSession(session);
  await context.close();
  return success || Boolean(realSubmit);
}

async function setup() {
  console.log("\nSETUP MODE — ContentRewards");
  console.log("1. Chrome will open → login to Whop");
  console.log("2. Submit ONE video manually");
  console.log("3. Script captures API format automatically\n");
  console.log("   Close Chrome completely first!\n");

  const context = await chromium.launchPersistentContext(CHROME_DATA, {
    headless: false,
    executablePath: CHROME_EXE,
    channel: "chrome",
    args: ["--profile-directory=Default", "--disable-blink-features=AutomationControlled", "--no-first-run"],
    ignoreDefaultArgs: ["--enable-automation"],
    slowMo: 100,
  });
  const page = await context.newPage();

  const captured = [];
  page.on("request", req => {
    if (req.method() === "POST" && req.url().includes("whop.com") && !req.url().includes("cdn-cgi")) {
      const body = req.postData() || "";
      captured.push({ url: req.url(), headers: req.headers(), body });
      if (body.length > 4) console.log(`  POST captured: ${req.url()}`);
    }
  });

  await page.goto(SUBMIT_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  console.log("Waiting... Submit a video in the browser. Window closes automatically.");

  await new Promise(resolve => {
    const check   = setInterval(() => { const r = captured.find(r => r.url.includes("submit") && r.body.length > 10); if (r) { clearInterval(check); clearTimeout(timeout); resolve(r); } }, 500);
    const timeout = setTimeout(() => { clearInterval(check); resolve(null); }, 600000);
  });

  const cookies  = await context.cookies();
  const realSubmit = captured.find(r => r.url.includes("submit") && r.body.length > 10);
  let apiFormat = null;
  if (realSubmit) {
    let payload, contentType;
    try { payload = JSON.parse(realSubmit.body); contentType = "application/json"; }
    catch { payload = Object.fromEntries(new URLSearchParams(realSubmit.body)); contentType = "application/x-www-form-urlencoded"; }
    const titleKey = Object.keys(payload).find(k => /title|name/i.test(k));
    const urlKey   = Object.keys(payload).find(k => /url|link|video/i.test(k));
    apiFormat = { url: realSubmit.url, headers: realSubmit.headers, contentType, payload, titleKey, urlKey };
    console.log(`\nAPI format captured! titleKey="${titleKey}" urlKey="${urlKey}"`);
  }

  saveSession({ cookies, apiFormat, capturedRequests: captured.slice(-10) });
  console.log("Session saved → node whop/submit.mjs \"<title>\" \"<url>\"");
  await context.close();
}

async function main() {
  const [,, arg1, arg2] = process.argv;

  if (arg1 === "--setup")   { await setup(); return; }
  if (arg1 === "--inspect") { await browserSubmit("Test", "https://youtube.com/watch?v=test", loadSession(), false); return; }

  // Accept either: submit.mjs "<url>"  OR  submit.mjs "<title>" "<url>"
  let title, videoUrl;
  if (!arg1) {
    console.log("Usage:");
    console.log("  Setup:   node whop/submit.mjs --setup");
    console.log("  Inspect: node whop/submit.mjs --inspect");
    console.log('  Submit:  node whop/submit.mjs "<url>"');
    console.log('           node whop/submit.mjs "<title>" "<url>"');
    process.exit(1);
  }
  if (arg2) {
    title = arg1;
    videoUrl = arg2;
  } else {
    title = "Viral Clip";
    videoUrl = arg1;
  }

  const session = loadSession();
  if (session.apiFormat) {
    const ok = await apiSubmit(title, videoUrl, session);
    if (ok) return;
    console.log("Direct API failed, falling back to browser...");
  }
  await browserSubmit(title, videoUrl, session, true);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
