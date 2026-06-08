import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Iniciando teste tbm=lcl...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  try {
    const query = "barbearia mogi das cruzes";
    const url = `https://www.google.com/search?tbm=lcl&q=${encodeURIComponent(query)}`;
    console.log(`Navegando para: ${url}`);
    
    await page.goto(url, { waitUntil: "networkidle" });
    
    // Tirar screenshot para debug
    await page.screenshot({ path: "scratch/tbm_lcl_screenshot.png" });
    console.log("Screenshot salva em scratch/tbm_lcl_screenshot.png");
    
    // Analisar elementos da página
    const data = await page.evaluate(() => {
      // Procurar todos os blocos de resultados locais. Eles costumam ter atributos como data-cid, ou classes específicas.
      // Vamos obter a lista de elementos que parecem resultados de busca local.
      // Em tbm=lcl, a lista costuma estar em divs com a classe 'Vk1aBb' ou similar, ou conter links para mapas.
      const results = [];
      
      // Vamos vasculhar todos os elementos que possuem texto e tentar localizar telefone/nome
      const cards = Array.from(document.querySelectorAll('div'));
      
      // Filtramos divs que contêm o nome da empresa e outras informações
      // Uma técnica comum é procurar por elementos que contêm o nome em um link com classe de título ou data-cid
      const localResults = document.querySelectorAll('[data-cid]');
      
      localResults.forEach(el => {
        const text = el.innerText || "";
        results.push({
          cid: el.getAttribute('data-cid'),
          text: text.substring(0, 300).replace(/\n/g, ' | ')
        });
      });
      
      return {
        totalCids: localResults.length,
        results: results.slice(0, 10),
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
