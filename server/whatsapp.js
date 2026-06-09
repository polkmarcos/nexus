import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import db from "./db.js";

// Global map to hold active Playwright sessions
// Format: { sellerId => { browser, context, page, status, qrCode, monitorPromise } }
export const sessions = new Map();

const VARIANTES_MENSAGENS = [
  "Oi, é da {empresa}, tudo bem, sabe eu estava vendo aqui e notei que vocês podem aumentar as vendas com um site próprio otimizado, criei uma demonstração, posso te mandar?",
  "Opa, é da {empresa}, tudo joia, então eu estava dando uma olhada e vi que dá pra puxar muito mais pedido no delivery com um site próprio otimizado, fiz uma demo aqui, posso te enviar?",
  "Oi tudo bem, é da {empresa}, sabe que eu estava vendo o perfil de vocês e notei que um site próprio bem otimizado ia ajudar demais a aumentar as vendas, montei uma demonstração, posso mandar?",
  "E aí, é da {empresa}, beleza, tava reparando aqui que vocês conseguem bombar mais as vendas tendo um site próprio otimizado pro celular, preparei uma demo rápida, posso te mandar o link?",
  "Oi, é da pizzaria {empresa}, tudo certo, sabe eu estava dando uma espiada e notei que vocês conseguem escalar as vendas com um site próprio otimizado, montei uma demonstração de exemplo, posso te mostrar?",
  "Opa, é com o pessoal da {empresa}, tudo bem, tava vendo as opções na região e notei que vocês podiam lucrar bem mais nas vendas com um site próprio otimizado, desenhei uma demo de teste, posso te passar?",
  "Oi, tudo joia, é da {empresa}, tava analisando aqui e notei que dá pra aumentar muito as vendas do delivery com um site próprio otimizado, fiz um rascunho de demonstração, posso enviar?",
  "Opa tudo bom, é da {empresa}, tava olhando o negócio de vocês e notei que vocês podem alavancar as vendas com um site próprio otimizado, criei uma demonstração, posso te mandar?",
  "Oi é da equipe da {empresa}, tudo bem, tava vendo aqui e notei que dá pra aumentar bastante as vendas de vocês com um site próprio otimizado, fiz uma demonstração prática, posso mandar o link?",
  "E aí beleza, é da {empresa}, tudo certo, tava passando por aqui e notei que vocês conseguem otimizar e aumentar as vendas com um site próprio bem rápido, montei uma demo de exemplo com o nome de vocês, posso enviar?"
];

/**
 * Gets greeting based on the current hour.
 */
export function getSaudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Formats a phone number for WhatsApp Web API.
 * Ensures the country code is 55 (Brazil) and removes any leading 0.
 */
export function formatarTelefoneWhatsApp(telefone) {
  if (!telefone) return "";
  let clean = telefone.replace(/\D/g, "");
  
  if (clean.startsWith("0")) {
    clean = clean.substring(1);
  }
  
  if (clean.startsWith("550")) {
    clean = "55" + clean.substring(3);
  }
  
  if (!clean.startsWith("55") && (clean.length === 10 || clean.length === 11)) {
    clean = "55" + clean;
  }
  
  return clean;
}


/**
 * Diagnostic logger that prints to console and writes to whatsapp-debug.log inside the sessions directory.
 */
export function logDebug(vendedorId, mensagem) {
  const logMsg = `[${new Date().toLocaleString("pt-BR")}] [Vendedor ${vendedorId}] ${mensagem}`;
  console.log(logMsg);
  try {
    const baseSessionsDir = process.env.WHATSAPP_SESSIONS_DIR || path.resolve("whatsapp-sessions");
    const logFile = path.resolve(baseSessionsDir, "whatsapp-debug.log");
    
    if (!fs.existsSync(baseSessionsDir)) {
      fs.mkdirSync(baseSessionsDir, { recursive: true });
    }
    
    fs.appendFileSync(logFile, logMsg + "\n");
  } catch (e) {
    console.error("Erro ao escrever no arquivo de logs de depuração:", e.message);
  }
}

/**
 * Starts or connects to a WhatsApp Web session for a seller, optionally using a phone number.
 */
export async function conectarWhatsapp(vendedorId, telefone) {
  logDebug(vendedorId, `Solicitação de conexão do WhatsApp recebida. Método: ${telefone ? "Telefone: " + telefone : "QR Code"}`);

  if (sessions.has(vendedorId)) {
    const s = sessions.get(vendedorId);
    if (s.status === "connected") {
      logDebug(vendedorId, `Sessão já está ativa e conectada.`);
      return s;
    }
    logDebug(vendedorId, `Fechando sessão anterior do vendedor em estado "${s.status}" para iniciar nova conexão.`);
    try {
      if (s.context) {
        await s.context.close().catch(() => {});
      }
    } catch (e) {
      logDebug(vendedorId, `Erro ao fechar contexto anterior: ${e.message}`);
    }
    sessions.delete(vendedorId);
  }

  const baseSessionsDir = process.env.WHATSAPP_SESSIONS_DIR || path.resolve("whatsapp-sessions");
  const sessionDir = path.resolve(baseSessionsDir, vendedorId);
  
  // Clean SingletonLock symlink to prevent Chromium startup crashes in Docker
  try {
    const lockPath = path.join(sessionDir, "SingletonLock");
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      logDebug(vendedorId, `Lock de sessão anterior 'SingletonLock' removido de forma preventiva em: ${lockPath}`);
    }
  } catch (lockErr) {
    logDebug(vendedorId, `Aviso ao remover lock 'SingletonLock' anterior: ${lockErr.message}`);
  }

  if (!fs.existsSync(baseSessionsDir)) {
    fs.mkdirSync(baseSessionsDir, { recursive: true });
  }

  const sessionInfo = {
    context: null,
    page: null,
    status: "starting",
    qrCode: null,
    phoneCode: null,
    isSending: false
  };
  
  sessions.set(vendedorId, sessionInfo);

  // Perform Playwright startup asynchronously so the HTTP request returns instantly
  (async () => {
    try {
      logDebug(vendedorId, `Iniciando persistent context do Chromium no diretório: ${sessionDir}`);
      const context = await chromium.launchPersistentContext(sessionDir, {
        headless: true,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        locale: "pt-BR",
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

      logDebug(vendedorId, `Navegador Chromium lançado com sucesso. Criando nova página...`);
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);
      
      sessionInfo.context = context;
      sessionInfo.page = page;
      sessionInfo.status = "loading";

      logDebug(vendedorId, `Navegando para https://web.whatsapp.com/...`);
      await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" });
      logDebug(vendedorId, `Navegação para WhatsApp Web concluída.`);

      if (telefone) {
        logDebug(vendedorId, `Iniciando fluxo de login por número de telefone: ${telefone}`);
        try {
          const linkSelector = [
            '[data-testid="link-device-phone-number-button"]',
            'div:has-text("Entrar com número de telefone"):not(:has(div))',
            'div:has-text("Conectar com número de telefone"):not(:has(div))',
            'span:has-text("Conectar com o número de telefone")',
            'span:has-text("Entrar com o número de telefone")',
            'span:has-text("Link with phone number")',
            '[role="button"]:has-text("Link with phone number")',
            '[role="button"]:has-text("Conectar com")'
          ].join(', ');
          
          logDebug(vendedorId, `Aguardando botão de pareamento ou painel de chat...`);
          const elementFound = await Promise.race([
            page.waitForSelector('[data-testid="chat-list"], #pane-side', { timeout: 60000 }).then(() => "logged_in"),
            page.waitForSelector(linkSelector, { timeout: 60000 }).then(() => "link_button")
          ]).catch(() => "timeout");

          logDebug(vendedorId, `Elemento localizado na página: ${elementFound}`);

          if (elementFound === "link_button") {
            const linkBtn = await page.$(linkSelector);
            if (linkBtn) {
              logDebug(vendedorId, `Botão de link por telefone localizado. Clicando...`);
              await linkBtn.click({ force: true }).catch(async () => {
                await page.evaluate(el => {
                  el.scrollIntoView({ block: 'center' });
                  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                }, linkBtn);
              });
              
              const inputSelector = 'input[data-testid="phone-number-input"], input[type="text"], input[placeholder]';
              logDebug(vendedorId, `Aguardando campo de entrada do telefone...`);
              const phoneInput = await page.waitForSelector(inputSelector, { timeout: 30000 });
              if (phoneInput) {
                logDebug(vendedorId, `Focando e limpando o campo de telefone...`);
                await phoneInput.focus();
                await phoneInput.click({ force: true }).catch(() => {});
                
                await page.keyboard.down("Control");
                await page.keyboard.press("A");
                await page.keyboard.up("Control");
                await page.keyboard.press("Backspace");
                
                let cleanPhone = telefone.replace(/\D/g, "");
                if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
                  cleanPhone = cleanPhone.substring(2);
                }
                
                logDebug(vendedorId, `Digitando o número de telefone (DDI+DDD): ${cleanPhone}`);
                await page.keyboard.type(cleanPhone, { delay: 100 });
                await new Promise(r => setTimeout(r, 500));
                await page.keyboard.press("Enter");
                
                const nextSelector = 'button:has-text("Avançar"), button:has-text("Next"), button:has-text("Avancar"), button[type="submit"]';
                const nextBtn = await page.$(nextSelector).catch(() => null);
                if (nextBtn) {
                  logDebug(vendedorId, `Clicando no botão 'Avançar'...`);
                  await nextBtn.click({ force: true }).catch(async () => {
                    await page.evaluate(el => {
                      el.scrollIntoView({ block: 'center' });
                      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    }, nextBtn);
                  });
                }
                logDebug(vendedorId, `Fluxo de telefone enviado com sucesso.`);
              }
            }
          } else if (elementFound === "logged_in") {
            logDebug(vendedorId, `Usuário já está conectado no WhatsApp Web.`);
            sessionInfo.status = "connected";
          } else {
            logDebug(vendedorId, `Timeout aguardando elementos iniciais do WhatsApp Web.`);
          }
        } catch (err) {
          logDebug(vendedorId, `Erro interno na configuração de pareamento por telefone: ${err.message}`);
        }
      }

      logDebug(vendedorId, `Iniciando monitor de sessão...`);
      sessionInfo.monitorPromise = monitorSession(vendedorId, context, page);

    } catch (err) {
      logDebug(vendedorId, `ERRO CRÍTICO na inicialização da sessão: ${err.message}\nStack: ${err.stack}`);
      sessionInfo.status = "disconnected";
      if (sessionInfo.context) {
        await sessionInfo.context.close().catch(() => {});
      }
      sessions.delete(vendedorId);
    }
  })();

  return sessionInfo;
}

/**
 * Monitors the browser state to check for QR code updates, phone connection code, or successful connection.
 */
async function monitorSession(vendedorId, context, page) {
  const session = sessions.get(vendedorId);
  if (!session) return;

  try {
    let attempts = 0;
    const maxAttempts = 300; // ~4 minutes total monitoring with 800ms steps
    
    while (attempts < maxAttempts) {
      if (page.isClosed()) {
        logDebug(vendedorId, `Página do navegador foi fechada pelo sistema.`);
        session.status = "disconnected";
        break;
      }

      // Check if logged in
      const isLoggedIn = await page.$('[data-testid="chat-list"], #pane-side, [data-testid="menu-bar-menu"], [data-testid="chatlist-search-input-search"], [data-testid="default-user-icon"], [data-testid="intro-text"]');
      if (isLoggedIn) {
        session.status = "connected";
        session.qrCode = null;
        session.phoneCode = null;
        logDebug(vendedorId, `WhatsApp conectado com SUCESSO!`);
        
        // Update database info
        db.prepare("UPDATE vendedores SET ativo = 1 WHERE id = ?").run(vendedorId);
        break;
      }

      // Check if syncing/loading conversations after scanning
      const isSyncing = await page.$('[data-testid="startup-progress"], [role="progressbar"], .progress, div:has-text("Carregando"), div:has-text("Loading")');
      if (isSyncing) {
        if (session.status !== "syncing") {
          logDebug(vendedorId, `WhatsApp está sincronizando conversas...`);
        }
        session.status = "syncing";
        session.qrCode = null;
        session.phoneCode = null;
      }

      // Check if click-to-retry or generic reload buttons are there
      const retryBtn = await page.$('button._ak45, button[data-testid="popup-controls-ok"]');
      if (retryBtn) {
        logDebug(vendedorId, `Botão de erro do popup/recarregar detectado. Clicando...`);
        await retryBtn.click().catch(() => {});
      }

      // Auto-refresh expired QR codes
      const qrRefreshBtn = await page.$('[data-testid="qrcode"] button, [data-testid="qrcode"] [role="button"], button:has-text("Clique para recarregar"), button:has-text("Click to reload"), span[data-icon="refresh"]');
      if (qrRefreshBtn) {
        logDebug(vendedorId, `QR code expirado detectado. Clicando para recarregar...`);
        await qrRefreshBtn.click().catch(() => {});
      }

      // Check for phone pairing code
      const phoneCode = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('div, span, button'));
        for (const el of elements) {
          const text = (el.innerText || "").trim();
          if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(text)) {
            return text;
          }
          if (/^[A-Z0-9]{4}\s[A-Z0-9]{4}$/.test(text)) {
            return text.replace(/\s+/, "-");
          }
        }
        
        const chars = Array.from(document.querySelectorAll('[data-testid="phone-number-code-char"], [data-ref] span'));
        if (chars.length === 8) {
          const joined = chars.map(c => c.innerText.trim()).join("");
          if (/^[A-Z0-9]{8}$/.test(joined)) {
            return joined.substring(0, 4) + "-" + joined.substring(4);
          }
        }
        return null;
      });

      if (phoneCode) {
        if (session.phoneCode !== phoneCode) {
          logDebug(vendedorId, `Código de pareamento por telefone obtido: ${phoneCode}`);
        }
        session.phoneCode = phoneCode;
        if (session.status !== "syncing") {
          session.status = "connecting";
        }
        
        const screenshotBuffer = await page.screenshot().catch(() => null);
        if (screenshotBuffer) {
          session.qrCode = screenshotBuffer.toString("base64");
        }
      } else {
        session.phoneCode = null;
        
        const canvas = await page.$('canvas');
        if (canvas) {
          if (session.status !== "syncing" && session.status !== "connecting") {
            logDebug(vendedorId, `Canvas do QR Code detectado na página. Status definido para connecting.`);
          }
          if (session.status !== "syncing") {
            session.status = "connecting";
          }
          const qrBuffer = await canvas.screenshot().catch(() => null);
          if (qrBuffer) {
            session.qrCode = qrBuffer.toString("base64");
          }
        }
      }

      attempts++;
      await new Promise(r => setTimeout(r, 800));
    }

    if (session.status !== "connected") {
      logDebug(vendedorId, `Tempo limite excedido ou monitoramento encerrado sem conexão.`);
      session.status = "disconnected";
      await context.close().catch(() => {});
      sessions.delete(vendedorId);
    }
  } catch (err) {
    logDebug(vendedorId, `Erro crítico ao monitorar sessão: ${err.message}`);
    session.status = "disconnected";
    await context.close().catch(() => {});
    sessions.delete(vendedorId);
  }
}

/**
 * Dispatches WhatsApp messages to a seller's assigned leads.
 */
export async function dispararMensagens(vendedorId, mensagemTexto, leads) {
  const session = sessions.get(vendedorId);
  if (!session || session.status !== "connected") {
    throw new Error("WhatsApp não está conectado para este vendedor. Conecte primeiro.");
  }

  session.isSending = true;
  session.abortSending = false;
  try {
    const page = session.page;
    const resultados = [];
    
    // Ensure we have an array of template texts
    const msgTemplates = Array.isArray(mensagemTexto) ? mensagemTexto : [mensagemTexto];

    for (const lead of leads) {
      if (session.status !== "connected") {
        resultados.push({ id: lead.id, empresa: lead.empresa, status: lead.status, erro: "Sessão desconectada" });
        continue;
      }

      if (session.abortSending) {
        console.log(`[WhatsApp] Envio cancelado pelo usuário para o vendedor: ${vendedorId}`);
        break;
      }

      try {
        console.log(`Enviando mensagem para ${lead.empresa} (${lead.telefone})...`);
        
        // Select a random template text strictly from VARIANTES_MENSAGENS
        const baseText = VARIANTES_MENSAGENS[Math.floor(Math.random() * VARIANTES_MENSAGENS.length)];
        
        // Replace placeholders
        const saudacao = getSaudacao();
        let textoPersonalizado = baseText
          .replace(/{saudacao}/gi, saudacao)
          .replace(/{empresa}/gi, lead.company_name || lead.empresa || "")
          .replace(/{nicho}/gi, lead.nicho)
          .replace(/{site_demo}/gi, "");

        // Clean phone numbers
        const phoneClean = formatarTelefoneWhatsApp(lead.telefone);
        
        // Open direct URL to WhatsApp API send interface
        const sendUrl = `https://web.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(textoPersonalizado)}`;
        await page.goto(sendUrl, { waitUntil: "domcontentloaded" });

        const sendButtonSelector = 'span[data-icon="send"], button[data-testid="compose-btn-send"]';
        const textboxSelector = 'div[contenteditable="true"]';
        
        // Wait for either the send button, the textbox, or the "Invalid Phone Number" dialog
        const action = await Promise.race([
          page.waitForSelector(sendButtonSelector, { timeout: 30000 }).then(() => "send_btn"),
          page.waitForSelector(textboxSelector, { timeout: 30000 }).then(() => "textbox"),
          page.waitForSelector('div[role="dialog"]', { timeout: 30000 }).then(() => "dialog")
        ]).catch(() => "timeout");

        if (action === "dialog") {
          const dialogText = await page.evaluate(() => {
            const el = document.querySelector('div[role="dialog"]');
            return el ? el.innerText : "";
          }).catch(() => "");
          console.log(`[DEBUG] Diálogo detectado: "${dialogText.replace(/\n/g, ' ')}"`);
          
          if (/iniciando|carregando|starting|loading/i.test(dialogText)) {
            console.log(`[DEBUG] Diálogo de carregamento detectado. Aguardando a conversa carregar de fato...`);
            
            // Wait up to 25 seconds for the loading dialog to disappear and the chat elements to load
            const secondAction = await Promise.race([
              page.waitForSelector(sendButtonSelector, { timeout: 25000 }).then(() => "send_btn"),
              page.waitForSelector(textboxSelector, { timeout: 25000 }).then(() => "textbox"),
              page.waitForFunction(() => {
                const el = document.querySelector('div[role="dialog"]');
                if (!el) return false;
                const text = el.innerText || "";
                return !/iniciando|carregando|starting|loading/i.test(text);
              }, { timeout: 25000 }).then(() => "dialog")
            ]).catch(() => "timeout");
            
            if (secondAction === "timeout") {
              throw new Error("Tempo limite de carregamento da conversa excedido.");
            }
            
            if (secondAction === "dialog") {
              const finalDialogText = await page.evaluate(() => {
                const el = document.querySelector('div[role="dialog"]');
                return el ? el.innerText : "";
              }).catch(() => "");
              console.log(`[DEBUG] Diálogo final pós-carregamento: "${finalDialogText.replace(/\n/g, ' ')}"`);
              
              if (/inválido|invalid|não existe|não está|not exist|incorrect|not registered/i.test(finalDialogText)) {
                console.log(`Número de telefone ${lead.telefone} é de fato inválido.`);
                const okBtn = await page.$('div[role="dialog"] button');
                if (okBtn) await okBtn.click();
                db.prepare("UPDATE leads SET status = 'Vácuo', atualizado_em = ? WHERE id = ?")
                  .run(new Date().toISOString(), lead.id);
                resultados.push({ id: lead.id, empresa: lead.empresa, status: "Vácuo", erro: "Número inválido" });
                continue;
              }
            }
          } else if (/inválido|invalid|não existe|não está|not exist|incorrect|not registered/i.test(dialogText)) {
            console.log(`Número de telefone ${lead.telefone} é de fato inválido.`);
            const okBtn = await page.$('div[role="dialog"] button');
            if (okBtn) await okBtn.click();
            db.prepare("UPDATE leads SET status = 'Vácuo', atualizado_em = ? WHERE id = ?")
                  .run(new Date().toISOString(), lead.id);
            resultados.push({ id: lead.id, empresa: lead.empresa, status: "Vácuo", erro: "Número inválido" });
            continue;
          }
        }

        if (action === "timeout") {
          throw new Error("Tempo limite de carregamento da conversa excedido.");
        }

        // Small pause to let elements settle
        await new Promise(r => setTimeout(r, 2000));

        const sendBtn = await page.$(sendButtonSelector);
        if (sendBtn) {
          await sendBtn.click();
        } else {
          const textbox = await page.$(textboxSelector);
          if (textbox) {
            await textbox.focus();
            await page.keyboard.press("Enter");
          } else {
            throw new Error("Elementos de envio não encontrados.");
          }
        }

        // Wait a moment for transmission
        await new Promise(r => setTimeout(r, 4000));

        const now = new Date().toISOString();
        db.prepare(`
          UPDATE leads 
          SET status = 'Mensagem enviada', ultima_mensagem = ?, atualizado_em = ? 
          WHERE id = ?
        `).run(textoPersonalizado, now, lead.id);

        resultados.push({ id: lead.id, empresa: lead.empresa, status: "Mensagem enviada" });
        console.log(`Mensagem enviada com sucesso para ${lead.empresa}`);

      } catch (err) {
        console.error(`Erro ao disparar para ${lead.empresa}:`, err.message);
        resultados.push({ id: lead.id, empresa: lead.empresa, status: lead.status, erro: err.message });
      }

      // Apply random delay (5 to 15 seconds) to avoid WhatsApp spam bans
      const delay = Math.floor(Math.random() * 10000) + 5000;
      await new Promise(r => setTimeout(r, delay));
    }

    // Go back to main interface
    if (session.status === "connected") {
      await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" }).catch(() => {});
    }

    return resultados;
  } finally {
    session.isSending = false;
  }
}

/**
 * Checks connection status of a seller's WhatsApp session.
 */
export async function checkSessionStatus(vendedorId) {
  const session = sessions.get(vendedorId);
  if (!session) {
    return { status: "disconnected", qrCode: null, phoneCode: null };
  }
  return {
    status: session.status,
    qrCode: session.qrCode,
    phoneCode: session.phoneCode || null,
    isSending: session.isSending || false
  };
}
