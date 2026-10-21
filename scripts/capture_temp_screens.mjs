import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "../apps/web/node_modules/playwright-core/index.mjs";

const OUT_DIR =
  "C:\\Users\\aliha\\.gemini\\antigravity\\brain\\402fc4d3-dde6-4003-80f6-dc9090d89608";

const SCREENS = [
  "dossier",
  "studio",
  "benchmarks",
  "timeline",
  "lab",
  "carbon",
  "watchlist",
];

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

async function main() {
  const webDir = path.resolve("d:/terrashift-ai/apps/web");
  const nextBin = path.join(webDir, "node_modules", "next", "dist", "bin", "next");

  console.log("Starting Next.js production server on port 3045...");
  const srv = spawn(process.execPath, [nextBin, "start", "-p", "3045"], {
    cwd: webDir,
    stdio: "ignore",
  });

  try {
    await waitForServer("http://127.0.0.1:3045/temp");
    console.log("Server ready. Launching headless Chrome...");

    const browser = await chromium.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    for (const s of SCREENS) {
      const url = `http://127.0.0.1:3045/temp?screen=${s}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(350);
      const outPath = path.join(OUT_DIR, `ui_clean_${s}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Captured ${outPath}`);
    }

    await browser.close();
  } finally {
    srv.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
