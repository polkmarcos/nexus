import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function testLaunch() {
  console.log("Starting Playwright launch diagnostic...");
  const tempDir = path.resolve("./whatsapp-sessions-temp-test");
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log("Launching persistent context at:", tempDir);
    const context = await chromium.launchPersistentContext(tempDir, {
      headless: true,
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--no-first-run",
        "--no-default-browser-check"
      ]
    });
    
    console.log("Successfully launched persistent context!");
    console.log("Opening new page...");
    const page = await context.newPage();
    
    console.log("Navigating to WhatsApp Web...");
    await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("Loaded WhatsApp Web successfully! Title:", await page.title());
    
    await context.close();
    console.log("Closed browser context successfully.");
  } catch (error) {
    console.error("Playwright Launch ERROR:", error);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

testLaunch();
