import { chromium } from "playwright";
import { randomUUID } from "crypto";
import db from "./db.js";

/**
 * Scrapes business leads from Google Maps based on query and niche.
 * 
 * @param {string} query - The search term for Google Maps
 * @param {string} nicho - The niche/category of the lead (mandatory)
 * @param {number} limit - Maximum number of leads to scrape
 * @returns {Promise<Array>} - List of captured leads
 */
export async function scrapeGoogleMaps(query, nicho, limit = 20, checkCancelled, onLeadSaved) {
  console.log(`Iniciando scraper do Google Maps. Query: "${query}", Nicho: "${nicho}", Limite: ${limit}`);
  
  // Pré-carregar os leads do banco de dados para este nicho e otimizar busca de duplicados em memória
  const existingLeads = db.prepare(`
    SELECT empresa, telefone, endereco FROM leads WHERE nicho = ?
  `).all(nicho);
  
  const normalize = (str) => {
    if (!str) return "";
    return str.toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .replace(/hamburguerias?/g, "")
      .replace(/adegas?/g, "")
      .replace(/barbearias?/g, "")
      .replace(/padarias?/g, "")
      .replace(/academias?/g, "")
      .replace(/mogi/g, "")
      .replace(/suzano/g, "")
      .replace(/spaulo/g, "")
      .replace(/saopaulo/g, "");
  };

  const existingNames = new Set();
  const existingPhones = new Set();
  
  for (const l of existingLeads) {
    const norm = normalize(l.empresa);
    if (norm.length >= 3) {
      existingNames.add(norm);
    }
    if (l.telefone) {
      existingPhones.add(l.telefone.replace(/\D/g, ""));
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/122.0.0.0 Safari/537.36",
    locale: "pt-BR"
  });
  const page = await context.newPage();
  
  const leadsList = [];
  
  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Allow panel loading
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
    } catch (e) {
      console.log("Seletor de locais não encontrado ou timeout. Tentando prosseguir.");
    }
    
    // Rolar o feed lateral dinamicamente até carregar locais novos suficientes
    const feedSelector = 'div[role="feed"]';
    let loadedCount = 0;
    let previousCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 30;

    while (loadedCount < limit && scrollAttempts < maxScrollAttempts) {
      console.log(`[Scraper] Simulando scroll automático na barra lateral para carregar blocos de 20 em 20 leads...`);
      if (checkCancelled && checkCancelled()) {
        console.log("[Scraper] Cancelamento detectado no loop de rolagem.");
        break;
      }

      // Coletar links e filtrar para contar apenas locais únicos NÃO duplicados em memória
      const links = await page.$$('a.hfpxzc, a[href*="/maps/place/"]');
      const uniqueHrefs = new Set();
      let nonDuplicateCount = 0;
      
      for (const link of links) {
        const href = await link.getAttribute("href").catch(() => null);
        if (href) {
          const cleanHref = href.split('?')[0];
          if (!uniqueHrefs.has(cleanHref)) {
            uniqueHrefs.add(cleanHref);
            
            // Pré-verificar nome no banco para pular contagem se for duplicado
            const labelName = await link.getAttribute("aria-label").catch(() => "");
            if (labelName) {
              const cleanName = normalize(labelName.split(/[|•-]/)[0]);
              if (cleanName.length >= 3 && existingNames.has(cleanName)) {
                continue; // É duplicado, não contar como novo local carregado
              }
            }
            nonDuplicateCount++;
          }
        }
      }
      loadedCount = nonDuplicateCount;

      if (loadedCount >= limit) {
        break;
      }

      await page.evaluate((sel) => {
        const feed = document.querySelector(sel);
        if (feed) {
          feed.scrollBy(0, 3000);
        } else {
          window.scrollBy(0, 2000);
        }
      }, feedSelector);

      await new Promise(r => setTimeout(r, 800));

      if (loadedCount === previousCount) {
        scrollAttempts++;
      } else {
        previousCount = loadedCount;
        scrollAttempts = 0; // reset attempts since we are successfully loading new items
      }
    }
    
    // Fetch place links inside feed and deduplicate by href
    const allLinks = await page.$$('a.hfpxzc, a[href*="/maps/place/"]');
    const seenHrefs = new Set();
    const placeLinks = [];
    
    for (const link of allLinks) {
      const href = await link.getAttribute("href").catch(() => null);
      if (href) {
        const cleanHref = href.split('?')[0]; 
        if (!seenHrefs.has(cleanHref)) {
          seenHrefs.add(cleanHref);
          placeLinks.push(link);
        }
      }
    }
    
    console.log(`Feed carregado da barra lateral: ${placeLinks.length} locais únicos encontrados.`);
    
    for (const link of placeLinks) {
      if (checkCancelled && checkCancelled()) {
        console.log("[Scraper] Operação cancelada pelo usuário. Parando...");
        break;
      }

      if (leadsList.length >= limit) {
        break;
      }
      
      try {
        // Obter nome esperado a partir do aria-label do link
        const expectedName = await link.getAttribute("aria-label").catch(() => "");
        
        // Pulo rápido em memória sem clicar se o nome já estiver cadastrado no banco de dados
        if (expectedName) {
          const cleanName = normalize(expectedName.split(/[|•-]/)[0]);
          if (cleanName.length >= 3 && existingNames.has(cleanName)) {
            console.log(`[Scraper] Pulo rápido (sem clicar): "${expectedName}" já cadastrado.`);
            continue;
          }
        }
        
        // Scroll the element into view and click
        await link.scrollIntoViewIfNeeded().catch(() => {});
        await link.click({ force: true }).catch(() => {});
        
        // Aguardar o painel de detalhes abrir e o telefone/dados estarem disponíveis no DOM
        const startTime = Date.now();
        let extracted = null;
        
        while (Date.now() - startTime < 3500) {
          if (checkCancelled && checkCancelled()) {
            break;
          }
          
          extracted = await page.evaluate((expectedName) => {
            const info = {
              empresa: "",
              telefone: "",
              endereco: "",
              site: "",
              loaded: false
            };

            const h1s = Array.from(document.querySelectorAll('h1'));
            const detailsH1 = h1s.find(h => h.innerText && h.innerText !== "Resultados" && h.innerText !== "Filtros");
            
            if (detailsH1) {
              info.empresa = detailsH1.innerText.trim();
              
              // Se o título do painel ainda não bater com o esperado (ou aproximado), ainda está carregando o local anterior
              if (expectedName) {
                const cleanExpected = expectedName.toLowerCase().replace(/[^a-z0-9]/g, "");
                const cleanDetails = info.empresa.toLowerCase().replace(/[^a-z0-9]/g, "");
                if (!cleanExpected.includes(cleanDetails) && !cleanDetails.includes(cleanExpected)) {
                  return info; // Ainda carregando
                }
              }
              
              info.loaded = true;
              
              // 1. Telefone
              const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
              if (phoneBtn) {
                info.telefone = phoneBtn.getAttribute('data-item-id').replace("phone:tel:", "").trim();
              }
              
              if (!info.telefone) {
                const telLink = document.querySelector('a[href^="tel:"]');
                if (telLink) {
                  info.telefone = telLink.getAttribute('href').replace("tel:", "").trim();
                }
              }
              
              if (!info.telefone) {
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const phoneEl = buttons.find(b => {
                  const label = b.getAttribute('aria-label') || '';
                  const tooltip = b.getAttribute('data-tooltip') || '';
                  return label.toLowerCase().includes('telefone') || label.toLowerCase().includes('phone') ||
                         tooltip.toLowerCase().includes('telefone') || tooltip.toLowerCase().includes('phone');
                });
                if (phoneEl) {
                  const label = phoneEl.getAttribute('aria-label') || '';
                  const match = label.match(/(?:\+55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/);
                  if (match) {
                    info.telefone = match[0];
                  } else {
                    const text = phoneEl.innerText || '';
                    const textMatch = text.match(/(?:\+55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/);
                    if (textMatch) {
                      info.telefone = textMatch[0];
                    }
                  }
                }
              }
              
              if (!info.telefone) {
                let parent = detailsH1.parentElement;
                let panelText = "";
                while (parent) {
                  const style = window.getComputedStyle(parent);
                  if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
                    panelText = parent.innerText;
                    break;
                  }
                  parent = parent.parentElement;
                }
                if (panelText) {
                  const matches = panelText.match(/(?:\+55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g);
                  if (matches && matches.length > 0) {
                    info.telefone = matches[0];
                  }
                }
              }
              
              // 2. Endereço
              const addressButton = document.querySelector('button[data-item-id^="address"]');
              if (addressButton) {
                info.endereco = addressButton.innerText.trim();
              }
              
              // 3. Site
              const websiteLink = document.querySelector('a[data-item-id="authority"]');
              if (websiteLink) {
                info.site = websiteLink.getAttribute("href") || "";
              }
            }
            
            return info;
          }, expectedName);
          
          if (extracted.loaded) {
            // Se já encontramos o telefone, ou se passou 1.2 segundos (tempo razoável para a API carregar os dados se existirem)
            if (extracted.telefone || (Date.now() - startTime > 1200)) {
              break;
            }
          }
          
          await new Promise(r => setTimeout(r, 150));
        }
        
        const empresa = extracted.empresa || expectedName || "";
        const telefone = extracted.telefone;
        const endereco = extracted.endereco;
        const site = extracted.site;
        
        // Salvar apenas se houver telefone
        if (!telefone) {
          console.log(`Lead "${empresa}" ignorado: Sem telefone visível.`);
          continue;
        }
        
        // Limpar telefone mantendo apenas números
        let phoneClean = telefone.replace(/\D/g, "");
        if (phoneClean.length === 10 || phoneClean.length === 11) {
          phoneClean = "55" + phoneClean; // Prefixo BR
        }
        
        // Extrair Cidade e Estado do Endereço
        let cidade = "";
        let estado = "";
        if (endereco) {
          const stateMatch = endereco.match(/\s-\s([A-Z]{2})\b/);
          if (stateMatch) {
            estado = stateMatch[1];
          }
          const cityMatch = endereco.match(/,\s?([^,]+)\s-\s[A-Z]{2}\b/);
          if (cityMatch) {
            cidade = cityMatch[1].trim();
          } else {
            const parts = endereco.split(",");
            const partsReversed = [...parts].reverse();
            if (partsReversed.length > 1) {
              const cityStatePart = partsReversed[1].trim();
              if (cityStatePart.includes("-")) {
                const sp = cityStatePart.split("-");
                cidade = sp[0].trim();
                if (!estado) estado = sp[1].trim();
              } else {
                cidade = cityStatePart;
              }
            }
          }
        }
        
        // Verificar duplicados usando os Sets em memória
        if (existingPhones.has(phoneClean)) {
          console.log(`Lead "${empresa}" (${phoneClean}) já cadastrado (Telefone duplicado). Ignorado.`);
          continue;
        }

        const normEmpresa = normalize(empresa);
        if (normEmpresa.length >= 3 && existingNames.has(normEmpresa)) {
          console.log(`Lead "${empresa}" (${phoneClean}) já cadastrado (Nome duplicado). Ignorado.`);
          continue;
        }

        // Verificar duplicados no banco (garantia extra)
        const duplicated = db.prepare(`
          SELECT id FROM leads 
          WHERE telefone = ? OR (empresa = ? AND endereco = ?)
        `).get(phoneClean, empresa, endereco);
        
        if (duplicated) {
          console.log(`Lead "${empresa}" (${phoneClean}) já cadastrado. Ignorado.`);
          // Sincronizar em memória
          existingPhones.add(phoneClean);
          if (normEmpresa.length >= 3) existingNames.add(normEmpresa);
          continue;
        }
        
        const now = new Date().toISOString();
        const lead = {
          id: randomUUID(),
          empresa,
          telefone: phoneClean,
          cidade: cidade || "Não Informada",
          estado: estado || "Não Informado",
          nicho,
          status: "disponivel",
          vendedor_id: null,
          origem: "Google Maps",
          query_origem: query,
          endereco: endereco || "Não Informado",
          site: site || "",
          ultima_mensagem: null,
          observacoes: "",
          criado_em: now,
          atualizado_em: now
        };
        
        db.prepare(`
          INSERT INTO leads (
            id, empresa, telefone, cidade, estado, nicho, status, vendedor_id, 
            origem, query_origem, endereco, site, ultima_mensagem, observacoes, criado_em, atualizado_em
          ) VALUES (
            @id, @empresa, @telefone, @cidade, @estado, @nicho, @status, @vendedor_id,
            @origem, @query_origem, @endereco, @site, @ultima_mensagem, @observacoes, @criado_em, @atualizado_em
          )
        `).run(lead);
        
        // Adicionar aos Sets para evitar duplicados nas próximas iterações
        existingPhones.add(phoneClean);
        if (normEmpresa.length >= 3) {
          existingNames.add(normEmpresa);
        }

        leadsList.push(lead);
        console.log(`Lead salvo no banco: ${empresa} - ${phoneClean}`);
        
        if (onLeadSaved) {
          try {
            onLeadSaved(lead);
          } catch (callbackErr) {
            console.error("Erro no callback onLeadSaved:", callbackErr.message);
          }
        }
      } catch (placeErr) {
        console.error(`Erro ao capturar detalhes de um local: ${placeErr.message}`);
      }
    }
  } catch (err) {
    console.error(`Erro geral no scraper do Google Maps: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
  
  return leadsList;
}
