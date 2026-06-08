import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Iniciando busca por dados ocultos no Google Maps...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  try {
    const query = "barbearia mogi das cruzes";
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    console.log(`Navegando para: ${url}`);
    
    await page.goto(url, { waitUntil: "domcontentloaded" });
    
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
      console.log("Locais carregados!");
    } catch (e) {
      console.log("Timeout aguardando locais.");
    }
    
    // Vamos varrer os scripts da página em busca de dados
    const scriptsData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      
      // Procurar scripts que contêm dados interessantes
      const candidates = [];
      scripts.forEach((script, index) => {
        const content = script.textContent || "";
        if (content.includes("APP_INITIALIZATION_STATE") || content.includes("initialData") || content.includes(";window._") || content.includes("cacheResponse")) {
          candidates.push({
            index,
            length: content.length,
            preview: content.substring(0, 200) + "..."
          });
        }
      });
      
      // Vamos ver se o window.APP_INITIALIZATION_STATE existe e o seu formato
      const hasInitState = typeof window.APP_INITIALIZATION_STATE !== 'undefined';
      let initStateKeys = [];
      if (hasInitState) {
        initStateKeys = Object.keys(window.APP_INITIALIZATION_STATE);
      }
      
      return {
        candidates,
        hasInitState,
        initStateKeys,
        windowKeys: Object.keys(window).filter(k => k.includes("STATE") || k.includes("DATA") || k.includes("google") || k.length < 5)
      };
    });
    
    console.log("Análise de scripts:", JSON.stringify(scriptsData, null, 2));
    
    // Vamos extrair o conteúdo de todos os scripts para um arquivo de texto para que possamos analisar e procurar por telefones conhecidos
    // Por exemplo, "Barbearia O Senador" tem o telefone "Av. Henrique Eroles, 1168"
    // Vamos procurar se nos scripts existe algum número de telefone conhecido.
    // De acordo com o teste anterior, a primeira barbearia é "Barbearia O Senador". O telefone dela no Google Maps costuma ser "+55 11 95484-8840" ou similar.
    // Vamos procurar nos scripts por padrões de telefone brasileiros
    const pageContent = await page.content();
    fs.writeFileSync("server/maps_page.html", pageContent);
    console.log("HTML completo salvo em server/maps_page.html para análise.");
    
    // Procurar por padrões de telefone comuns no HTML
    const phoneRegex = /\+55\s?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b|\b\d{2}\s9?\d{4}[-\s]?\d{4}\b/g;
    const matches = pageContent.match(phoneRegex);
    console.log("Telefones encontrados no HTML bruto da página principal:", matches ? [...new Set(matches)] : "Nenhum");
    
  } catch (err) {
    console.error("Erro no script:", err);
  } finally {
    await browser.close();
  }
}

run();
