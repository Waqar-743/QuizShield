const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const DIR = "D:/Projects/QuizShield/video";
const HTML_URL = "file:///D:/Projects/QuizShield/video/index.html";

const FONT_WARMUP = `<!DOCTYPE html><html><head>
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
</head><body style="background:#05070B;color:#fff">
<span style="font-family:'Clash Display';font-weight:600">warm 600</span>
<span style="font-family:'Clash Display';font-weight:700">warm 700</span>
<span style="font-family:'Plus Jakarta Sans';font-weight:400">warm 400</span>
<span style="font-family:'Plus Jakarta Sans';font-weight:800">warm 800</span>
<span style="font-family:'JetBrains Mono';font-weight:500">warm 500</span>
<span style="font-family:'JetBrains Mono';font-weight:600">warm 600</span>
</body></html>`;

(async () => {
  const timings = JSON.parse(fs.readFileSync(path.join(DIR, "timings.json"), "utf8"));
  const rawDir = path.join(DIR, "raw");
  fs.mkdirSync(rawDir, { recursive: true });

  const args = [
    "--force-color-profile=srgb",
    "--disable-lcd-text",
    "--font-render-hinting=none",
    "--hide-scrollbars",
    "--mute-audio",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ];

  let browser;
  try {
    browser = await chromium.launch({ channel: "chromium", headless: true, args });
  } catch (e) {
    console.log("channel launch failed, falling back to executablePath:", e.message);
    browser = await chromium.launch({
      executablePath: path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1248", "chrome-win64", "chrome.exe"),
      headless: true,
      args,
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  });
  await context.addInitScript((t) => { window.__TIMINGS = t; }, timings);

  const page1 = await context.newPage();
  page1.on("pageerror", (e) => console.log("WARMUP pageerror:", e.message));
  await page1.setContent(FONT_WARMUP, { waitUntil: "load", timeout: 30000 });
  const fonts = await page1
    .waitForFunction(
      () => document.fonts.status === "loaded" && document.fonts.size >= 4,
      null,
      { timeout: 30000 }
    )
    .then(() => "loaded")
    .catch(() => "timeout");
  const checks = await page1.evaluate(() => ({
    clash: document.fonts.check('16px "Clash Display"'),
    jakarta: document.fonts.check('16px "Plus Jakarta Sans"'),
    jetbrains: document.fonts.check('16px "JetBrains Mono"'),
    size: document.fonts.size,
  }));
  console.log("fonts:", fonts, JSON.stringify(checks));
  await page1.close();

  const created = Date.now();
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });

  await page.goto(HTML_URL, { waitUntil: "load", timeout: 30000 });
  const ready = await page
    .waitForFunction(() => window.__ready === true, null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  console.log("ready:", ready);
  await page.waitForTimeout(350);

  const startT = Date.now();
  await page.evaluate(() => window.__start());
  const lead = Math.max(0, (startT - created) / 1000 - 0.12);
  console.log("measured lead:", lead.toFixed(3), "s");

  await page.waitForTimeout((timings.total - lead + 0.9) * 1000);

  const video = page.video();
  await context.close();
  const videoPath = await video.path();
  const dest = path.join(rawDir, "film.webm");
  fs.copyFileSync(videoPath, dest);
  fs.writeFileSync(path.join(rawDir, "lead.json"), JSON.stringify({ lead: +lead.toFixed(3) }));
  console.log("raw video:", dest);
  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
