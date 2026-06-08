import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Iniciando teste tbm=lcl no servidor...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  try {
    const query = "barbearia mogi das cruzes";
    const url = `https://www.google.com/search?tbm=lcl&q=${encodeURIComponent(query)}`;
    console.log(`Navegando para: ${url}`);
    
    await page.goto(url, { waitUntil: "networkidle" });
    
    // Tirar screenshot para debug
    await page.screenshot({ path: "test_tbm_lcl_screenshot.png" });
    console.log("Screenshot salva em server/test_tbm_lcl_screenshot.png");
    
    // Analisar elementos da página
    const data = await page.evaluate(() => {
      const results = [];
      
      // Procurar todos os blocos com data-cid
      const localResults = document.querySelectorAll('[data-cid]');
      
      localResults.forEach(el => {
        const text = el.innerText || "";
        results.push({
          cid: el.getAttribute('data-cid'),
          text: text.substring(0, 300).replace(/\n/g, ' | ')
        });
      });
      
      // Também vamos pegar todos os links que tenham classe contendo 't' ou 'title' ou algo
      // pra ver se achamos a estrutura real
      const allDivs = Array.from(document.querySelectorAll('div.Vk1aBb'));
      const divTexts = allDivs.slice(0, 5).map(d => d.innerText.replace(/\n/g, ' | '));
      
      return {
        totalCids: localResults.length,
        results: results.slice(0, 10),
        divsCount: allDivs.length,
        divsTexts: divTexts,
        htmlLength: document.documentElement.outerHTML.length
      };
    });
    
    console.log("Dados extraídos:", JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error("Erro no script:", err);
  } finally {
    await browser.close();
  }
}

run();
