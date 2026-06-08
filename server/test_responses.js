import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Monitorando respostas de rede no Google Maps...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  // Interceptar respostas
  page.on("response", async (response) => {
    const url = response.url();
    // Procurar URLs que parecem chamadas de busca ou dados
    if (url.includes("search") || url.includes("preview") || url.includes("list")) {
      console.log(`[Response] URL: ${url.substring(0, 150)}`);
      try {
        const text = await response.text();
        if (text.includes("Barbearia O Senador") || text.includes("954848840")) {
          console.log(`>>> ENCONTREI DADOS NESTA RESPOSTA! Tamanho: ${text.length}`);
          fs.writeFileSync("response_data.txt", text);
        }
      } catch (e) {
        // Ignorar se não for texto ou der erro
      }
    }
  });

  try {
    const query = "barbearia mogi das cruzes";
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
      console.log("Barra lateral carregada!");
    } catch (e) {
      console.log("Timeout.");
    }
    
    // Rolar um pouco para disparar mais requisições
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollBy(0, 1000);
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
  } catch (err) {
    console.error("Erro no script:", err);
  } finally {
    await browser.close();
  }
}

run();
