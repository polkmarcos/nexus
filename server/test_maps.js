import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Iniciando teste Google Maps...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  try {
    const query = "barbearia mogi das cruzes";
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    console.log(`Navegando para: ${url}`);
    
    await page.goto(url, { waitUntil: "domcontentloaded" });
    
    // Esperar um pouco para carregar a barra lateral
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
      console.log("Seletor de locais encontrado!");
    } catch (e) {
      console.log("Timeout aguardando locais.");
    }
    
    await page.screenshot({ path: "test_maps_screenshot.png" });
    console.log("Screenshot salva em server/test_maps_screenshot.png");
    
    // Analisar os elementos da lista
    const linksData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
      return links.slice(0, 5).map(link => {
        const text = link.innerText || "";
        const href = link.getAttribute("href") || "";
        const ariaLabel = link.getAttribute("aria-label") || "";
        // Vamos ver os elementos irmãos ou o html interno do link para ver se o telefone está lá
        const parentText = link.parentElement ? link.parentElement.innerText : "";
        return {
          ariaLabel,
          href: href.substring(0, 100) + "...",
          text: text.substring(0, 100),
          parentText: parentText.replace(/\n/g, " | ").substring(0, 200)
        };
      });
    });
    
    console.log("Links de locais encontrados:", JSON.stringify(linksData, null, 2));
    
  } catch (err) {
    console.error("Erro no script:", err);
  } finally {
    await browser.close();
  }
}

run();
