import { chromium } from "playwright";

async function run() {
  console.log("Iniciando teste de otimização de carregamento...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    locale: "pt-BR"
  });
  
  // Otimizar rede: Bloquear imagens, fontes, estilos pesados e tiles do mapa
  await context.route("**/*", (route) => {
    const url = route.request().url();
    const type = route.request().resourceType();
    
    if (
      type === "image" || 
      type === "font" || 
      type === "media" ||
      url.includes("google-analytics") ||
      url.includes("analytics") ||
      url.includes("vt/pb=") || // Map tiles
      url.includes("vt/stream=") ||
      url.includes("/log204") // Analytics logging
    ) {
      route.abort();
    } else {
      route.continue();
    }
  });

  const page = await context.newPage();
  
  try {
    const startTime = Date.now();
    // URL direta para JK Barbearia (obtida nos testes anteriores)
    const url = "https://www.google.com/maps/place/JK+Barbearia/data=!4m7!3m6!1s0x94cdd962c86f145b:0x81024a35798a3f85!8m2!3d-23.5168007!4d-46.2001509!16s%2Fg%2F11sbj2l5p0";
    
    console.log(`Navegando diretamente para a URL do local...`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    
    // Aguardar o H1 de detalhes
    console.log("Aguardando carregamento dos detalhes...");
    const phoneBtnSelector = 'button[data-item-id^="phone:tel:"], a[href^="tel:"]';
    
    // Esperar pelo H1 ou pelo telefone aparecer
    const found = await Promise.race([
      page.waitForSelector('h1', { timeout: 10000 }).then(() => "h1"),
      page.waitForSelector(phoneBtnSelector, { timeout: 10000 }).then(() => "phone")
    ]).catch(() => "timeout");
    
    console.log(`Carregamento concluído em ${Date.now() - startTime}ms. Elemento encontrado: ${found}`);
    
    // Extrair os dados do local
    const extracted = await page.evaluate(() => {
      const info = {
        empresa: "",
        telefone: "",
        endereco: ""
      };
      
      const h1 = document.querySelector('h1');
      if (h1) info.empresa = h1.innerText.trim();
      
      const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
      if (phoneBtn) {
        info.telefone = phoneBtn.getAttribute('data-item-id').replace("phone:tel:", "").trim();
      }
      
      const addressBtn = document.querySelector('button[data-item-id^="address"]');
      if (addressBtn) info.endereco = addressBtn.innerText.trim();
      
      return info;
    });
    
    console.log("Dados extraídos com otimização:", JSON.stringify(extracted, null, 2));
    
  } catch (err) {
    console.error("Erro no teste:", err);
  } finally {
    await browser.close();
  }
}

run();
