import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Analisando window.APP_INITIALIZATION_STATE...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  try {
    const query = "barbearia mogi das cruzes";
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    
    await page.goto(url, { waitUntil: "domcontentloaded" });
    
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
      console.log("Locais carregados!");
    } catch (e) {
      console.log("Timeout aguardando locais.");
    }
    
    // Obter o objeto window.APP_INITIALIZATION_STATE e stringificar
    const stateStr = await page.evaluate(() => {
      if (typeof window.APP_INITIALIZATION_STATE === 'undefined') {
        return "undefined";
      }
      return JSON.stringify(window.APP_INITIALIZATION_STATE);
    });
    
    fs.writeFileSync("maps_state.json", stateStr);
    console.log("State salvo em server/maps_state.json. Tamanho:", stateStr.length);
    
    // Vamos procurar por padrões de números de telefone e nomes conhecidos no JSON
    // De acordo com o teste anterior, a primeira barbearia é "Barbearia O Senador"
    const hasSenador = stateStr.includes("Barbearia O Senador");
    const hasHenriqueEroles = stateStr.includes("Henrique Eroles");
    console.log("Contém 'Barbearia O Senador'?", hasSenador);
    console.log("Contém 'Henrique Eroles' (Rua)?", hasHenriqueEroles);
    
    // Vamos procurar por telefones (padrão brasileiro: DDD + 9 ou 8 dígitos)
    const phoneRegex = /0\d{2}\s?\d{4,5}[-\s]?\d{4}|\+55\s?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}|\b\d{2}\s?9?\d{4}[-\s]?\d{4}\b/g;
    const matches = stateStr.match(phoneRegex);
    console.log("Matches de telefone encontrados no JSON:", matches ? [...new Set(matches)].slice(0, 10) : "Nenhum");

  } catch (err) {
    console.error("Erro no script:", err);
  } finally {
    await browser.close();
  }
}

run();
