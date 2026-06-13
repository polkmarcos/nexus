import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import db from "./db.js";

// Global map to hold active Playwright sessions
// Format: { sellerId => { browser, context, page, status, qrCode, monitorPromise } }
export const sessions = new Map();

// Tracks leads awaiting auto-reply after initial message was sent.
// Format: { leadId => { vendedorId, sentAt, resolved } }
const leadMonitorQueue = new Map();

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
    isSending: false,
    isProcessingQueue: false
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
              logDebug(vendedorId, `Botão de link por telefone localizado.`);
              
              const inputSelector = 'input[data-testid="phone-number-input"], input[type="text"], input[placeholder]';
              let phoneInput = null;
              
              // Wait 2 seconds for JS event listeners to hydrate
              await new Promise(r => setTimeout(r, 2000));
              
              for (let clickAttempt = 1; clickAttempt <= 4; clickAttempt++) {
                logDebug(vendedorId, `Clicando no botão de link por telefone (Tentativa ${clickAttempt}/4)...`);
                
                await linkBtn.click({ force: true }).catch(async () => {
                  await page.evaluate(el => {
                    el.scrollIntoView({ block: 'center' });
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                  }, linkBtn);
                });
                
                // Wait up to 3 seconds to see if the input modal opens
                try {
                  phoneInput = await page.waitForSelector(inputSelector, { timeout: 3000 });
                  if (phoneInput) {
                    logDebug(vendedorId, `Campo de entrada de telefone apareceu com sucesso!`);
                    break;
                  }
                } catch (timeoutErr) {
                  logDebug(vendedorId, `Campo de telefone não apareceu após tentativa ${clickAttempt}. Retentando...`);
                }
              }
              
              if (!phoneInput) {
                throw new Error("Não foi possível abrir a tela de entrada de telefone (timeout ao clicar no botão).");
              }
              
              // Dump elements in the modal to check initial state
              try {
                const dump = await page.evaluate(() => {
                  const elements = Array.from(document.querySelectorAll('input, button, [role="button"], select'));
                  return elements.map(el => {
                    return {
                      tagName: el.tagName,
                      type: el.getAttribute('type'),
                      dataTestId: el.getAttribute('data-testid'),
                      placeholder: el.getAttribute('placeholder'),
                      value: el.value || '',
                      text: el.innerText || '',
                      outerHTML: el.outerHTML.substring(0, 250)
                    };
                  });
                });
                logDebug(vendedorId, `DEBUG DOM FORMULÁRIO PAREAMENTO: ${JSON.stringify(dump, null, 2)}`);
              } catch (dumpErr) {
                logDebug(vendedorId, `Erro ao fazer dump dos elementos: ${dumpErr.message}`);
              }

              if (phoneInput) {
                logDebug(vendedorId, `Limpando o campo de telefone...`);
                // Clear using page.evaluate first to trigger React bindings
                await page.evaluate(el => {
                  el.value = "";
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                }, phoneInput);
                
                await phoneInput.focus();
                await phoneInput.click({ force: true }).catch(() => {});
                
                // Keyboard backup clear
                await page.keyboard.down("Control");
                await page.keyboard.press("A");
                await page.keyboard.up("Control");
                await page.keyboard.press("Backspace");
                for (let i = 0; i < 15; i++) {
                  await page.keyboard.press("Backspace");
                }
                
                let cleanPhone = telefone.replace(/\D/g, "");
                let phoneToType = "";
                if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
                  phoneToType = "+" + cleanPhone;
                } else {
                  phoneToType = "+55" + cleanPhone;
                }
                
                logDebug(vendedorId, `Digitando o número de telefone completo com DDI (+55): ${phoneToType}`);
                await page.keyboard.type(phoneToType, { delay: 150 });
                await new Promise(r => setTimeout(r, 1000));
                
                // Save screenshot after typing to see if it changed country to Brazil
                await page.screenshot({ path: path.join(sessionDir, "debug-screenshot.png") }).catch(() => {});

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
                
                // Save screenshot after clicking "Avançar"
                await new Promise(r => setTimeout(r, 3000));
                await page.screenshot({ path: path.join(sessionDir, "debug-screenshot.png") }).catch(() => {});
                
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
    let lastScanTime = 0;
    
    while (true) {
      if (page.isClosed()) {
        logDebug(vendedorId, `Página do navegador foi fechada pelo sistema.`);
        session.status = "disconnected";
        break;
      }

      // Check if logged in
      let isLoggedIn = null;
      try {
        isLoggedIn = await page.$('[data-testid="chat-list"], #pane-side, [data-testid="menu-bar-menu"], [data-testid="chatlist-search-input-search"], [data-testid="default-user-icon"], [data-testid="intro-text"]');
      } catch (err) {
        logDebug(vendedorId, `Aviso no monitor (contexto destruído/navegação em curso): ${err.message}`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      if (isLoggedIn) {
        if (session.status !== "connected") {
          session.status = "connected";
          session.qrCode = null;
          session.phoneCode = null;
          logDebug(vendedorId, `WhatsApp conectado com SUCESSO!`);
          
          // Update database info
          db.prepare("UPDATE vendedores SET ativo = 1 WHERE id = ?").run(vendedorId);
        }
        
        // Scan for unread messages if connected, idle, and 12 seconds have passed since last scan
        const now = Date.now();
        if (!session.isSending && !session.isProcessingQueue && (now - lastScanTime > 12000)) {
          lastScanTime = now;
          try {
            await scanUnreadMessages(vendedorId, page);
          } catch (scanErr) {
            console.error(`[Chat Monitor] Erro ao escanear mensagens não lidas:`, scanErr.message);
          }
        }
      } else {
        // If not logged in and not connected/syncing, check for codes
        if (session.status !== "connected" && session.status !== "syncing") {
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
            const elements = Array.from(document.querySelectorAll('div, span, button, p'));
            for (const el of elements) {
              const text = (el.innerText || "").trim().toUpperCase();
              if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(text)) {
                return text;
              }
              if (/^[A-Z0-9]{4}\s[A-Z0-9]{4}$/.test(text)) {
                return text.replace(/\s+/, "-");
              }
              if (/^[A-Z0-9]{4}\u00a0[A-Z0-9]{4}$/.test(text)) {
                return text.replace(/\u00a0/, "-");
              }
            }
            
            const chars = Array.from(document.querySelectorAll('[data-testid="phone-number-code-char"], [data-ref] span, ._akaw span'));
            if (chars.length === 8) {
              const joined = chars.map(c => c.innerText.trim().toUpperCase()).join("");
              if (/^[A-Z0-9]{8}$/.test(joined)) {
                return joined.substring(0, 4) + "-" + joined.substring(4);
              }
            }
            
            for (const el of elements) {
              const text = (el.innerText || "").trim().replace(/[-\s\u00a0]/g, "").toUpperCase();
              if (text.length === 8 && /^[A-Z0-9]{8}$/.test(text)) {
                return text.substring(0, 4) + "-" + text.substring(4);
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
        } else if (session.status === "connected") {
          // We were connected, but now isLoggedIn is false.
          // If we are currently sending or navigating, this is normal/temporary.
          if (session.isSending || session.isProcessingQueue) {
            // Skip checking connection loss during active send/nav operations
          } else {
            // Check if the QR code canvas or link button is actually visible on the page
            const hasLoginScreen = await page.$('canvas, [data-testid="qrcode"], [data-testid="link-device-phone-number-button"], [role="button"]:has-text("Link with phone number"), [role="button"]:has-text("Conectar com")').catch(() => null);
            if (hasLoginScreen) {
              logDebug(vendedorId, `Tela de login detectada. Conexão do WhatsApp perdida.`);
              session.status = "disconnected";
              break;
            } else {
              // No login screen visible. This is a temporary load, sync, or transition.
              // We do not disconnect.
              logDebug(vendedorId, `isLoggedIn falso, mas tela de login não detectada (carregando/sincronizando). Mantendo conexão.`);
            }
          }
        }
      }

      // Check timeout for connection (4 minutes)
      if (session.status !== "connected" && attempts > maxAttempts) {
        logDebug(vendedorId, `Tempo limite de conexão excedido (4 minutos).`);
        session.status = "disconnected";
        break;
      }

      // Take debug screenshot every 10 attempts
      if (attempts % 10 === 0) {
        try {
          const sessionDir = path.resolve(process.env.WHATSAPP_SESSIONS_DIR || "whatsapp-sessions", vendedorId);
          const debugScreenshotPath = path.join(sessionDir, "debug-screenshot.png");
          await page.screenshot({ path: debugScreenshotPath }).catch(() => {});
        } catch (e) {}
      }

      attempts++;
      await new Promise(r => setTimeout(r, 1000));
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
 * Scans the WhatsApp Web sidebar for unread chats and reads their messages.
 */
async function scanUnreadMessages(vendedorId, page) {
  const session = sessions.get(vendedorId);
  if (!session || session.isSending || session.isProcessingQueue) return;

  session.isSending = true;
  try {
    const unreadChats = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('div[role="row"]'));
    const unreads = [];
    for (const row of rows) {
      const unreadBadge = row.querySelector('span[aria-label*="unread"], span[aria-label*="não lida"], span[aria-label*="mensagem"]');
      if (unreadBadge) {
        const titleEl = row.querySelector('span[title], [data-testid="chat-title"]');
        const title = titleEl ? (titleEl.getAttribute('title') || titleEl.innerText) : '';
        unreads.push({ title });
      }
    }
    return unreads;
  }).catch(() => []);

  if (unreadChats.length === 0) return;

  // Query leads assigned to this seller first to filter chats BEFORE clicking
  const leads = db.prepare("SELECT * FROM leads WHERE vendedor_id = ?").all(vendedorId);

  const textboxSelector = '#main div[contenteditable="true"], div[data-testid="conversation-text-input"], div[data-testid="compose-input"]';

  for (const chat of unreadChats) {
    if (!chat.title) continue;

    // 1. Check if the chat matches a lead in our DB BEFORE clicking on it
    const cleanTitle = chat.title.replace(/\D/g, '');
    const titleIsNumeric = cleanTitle.length >= 10 && /^\d+$/.test(cleanTitle);

    let matchedLead = null;
    if (titleIsNumeric) {
      matchedLead = leads.find(l => {
        const cleanDb = l.telefone.replace(/\D/g, '');
        return cleanDb === cleanTitle || cleanDb.endsWith(cleanTitle) || cleanTitle.endsWith(cleanDb);
      });
    } else {
      const cleanTitleLower = chat.title.trim().toLowerCase();
      // Match by company name (empresa)
      matchedLead = leads.find(l => {
        const cleanEmpresa = l.empresa.trim().toLowerCase();
        return cleanEmpresa === cleanTitleLower || cleanEmpresa.includes(cleanTitleLower) || cleanTitleLower.includes(cleanEmpresa);
      });
    }

    // If the chat does NOT belong to one of our leads, completely skip it!
    // This prevents marking personal or unrelated chats as read.
    if (!matchedLead) {
      continue;
    }

    console.log(`[Chat Monitor] Lendo mensagens não lidas de: "${chat.title}" (Empresa: ${matchedLead.empresa})`);

    // Click row with this title
    const chatRowSelector = `div[role="row"]:has(span[title="${chat.title}"]), div[role="row"]:has([data-testid="chat-title"]:has-text("${chat.title}"))`;
    const rowEl = await page.$(chatRowSelector).catch(() => null);
    if (rowEl) {
      await rowEl.click().catch(() => {});
      await new Promise(r => setTimeout(r, 2000)); // Wait for messages to load

      // Extract last 5 messages from `#main`
      const chatMsgs = await page.evaluate(() => {
        const bubbles = Array.from(document.querySelectorAll('#main div[data-testid="msg-container"], #main div.message-in, #main div.message-out'));
        const lastBubbles = bubbles.slice(-5);
        return lastBubbles.map(b => {
          const isOut = b.classList.contains('message-out') || !!b.querySelector('.message-out') || b.innerHTML.includes('message-out');
          const textEl = b.querySelector('span.selectable-text, span.copyable-text');
          const text = textEl ? textEl.innerText : '';
          return {
            direcao: isOut ? 'out' : 'in',
            texto: text
          };
        }).filter(m => m.texto.trim() !== '');
      }).catch(() => []);

      let newMessages = 0;
      for (const msg of chatMsgs) {
        const exists = db.prepare(`
          SELECT 1 FROM mensagens_chat
          WHERE lead_id = ? AND direcao = ? AND texto = ?
        `).get(matchedLead.id, msg.direcao, msg.texto);

        if (!exists) {
          const idMsg = 'wa_' + Math.random().toString(36).substring(2, 11);
          const now = new Date().toISOString();
          db.prepare(`
            INSERT INTO mensagens_chat (id, lead_id, vendedor_id, direcao, texto, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(idMsg, matchedLead.id, vendedorId, msg.direcao, msg.texto, now);
          newMessages++;

          if (msg.direcao === 'in') {
            db.prepare(`
              UPDATE leads
              SET status = 'Conversando', atualizado_em = ?
              WHERE id = ?
            `).run(now, matchedLead.id);
          }
        }
      }

      if (newMessages > 0) {
        console.log(`[Chat Monitor] ${newMessages} novas mensagens salvas para: ${matchedLead.empresa}`);
      }
    }
  }
} finally {
  session.isSending = false;
  // Go back to clean state
  await page.keyboard.press("Escape").catch(() => {});
}
}

/**
 * Classifies whether a WhatsApp reply is from a bot or a human.
 *
 * @param {string} texto - The reply message text
 * @param {number} sentAt - Timestamp (ms) when the initial message was sent
 * @param {string|null} replyTimestampStr - WhatsApp displayed time string e.g. "[10:30, 11/06/2026]"
 * @returns {'robo'|'humano'}
 */
function classificarResposta(texto, sentAt, replyTimestampStr) {
  const lower = texto.toLowerCase();

  // ── 1. Check keywords (strongest signal) ──────────────────────────────────
  const keywordsRobo = [
    'atendimento automático', 'atendimento automatico',
    'assistente virtual', 'chatbot', ' bot ', 'sou um robô', 'sou um robo',
    'horário de funcionamento', 'horario de funcionamento',
    'horário de atendimento', 'horario de atendimento',
    'fora do horário', 'fora do horario',
    'indisponível', 'indisponivel',
    'não estou disponível', 'nao estou disponivel',
    'não estou aqui', 'nao estou aqui',
    'digite 1', 'digite 2', 'digite 3', 'digite 4', 'digite 5',
    'pressione 1', 'pressione 2',
    'para falar com', 'para ser atendido',
    'transferir para', 'nosso atendente',
    'menu principal', 'menu de opções', 'menu de opcoes',
    'olá! sou', 'olá, sou', 'ola! sou', 'ola, sou',
    'sou o assistente', 'sou a assistente',
    'mensagem automática', 'mensagem automatica',
    'resposta automática', 'resposta automatica',
    'este é um número automático', 'este e um numero automatico',
    'não monitored', 'noreply',
    'em breve retornaremos', 'entraremos em contato',
  ];

  for (const kw of keywordsRobo) {
    if (lower.includes(kw)) {
      console.log(`[AutoResposta] Classificado como ROBÔ por palavra-chave: "${kw}"`);
      return 'robo';
    }
  }

  // ── 2. Long message with many line breaks (menu-style) ────────────────────
  const lineBreaks = (texto.match(/\n/g) || []).length;
  if (texto.length > 300 && lineBreaks >= 4) {
    console.log(`[AutoResposta] Classificado como ROBÔ por mensagem longa com menu (${texto.length} chars, ${lineBreaks} quebras)`);
    return 'robo';
  }

  // ── 3. Timestamp comparison (< 3-second response = very likely bot) ───────
  // WhatsApp shows time as "[HH:MM, DD/MM/YYYY]" in data-pre-plain-text
  // We compare with sentAt to check if reply was within the same minute
  if (replyTimestampStr && sentAt) {
    try {
      // Extract HH:MM from string like "[10:30, 11/06/2026]" or "10:30"
      const timeMatch = replyTimestampStr.match(/(\d{1,2}):(\d{2})/);
      const dateMatch = replyTimestampStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

      if (timeMatch) {
        const replyHour = parseInt(timeMatch[1], 10);
        const replyMin = parseInt(timeMatch[2], 10);

        const sentDate = new Date(sentAt);
        const sentHour = sentDate.getHours();
        const sentMin = sentDate.getMinutes();

        // Same minute or within 1 minute = "instant" response (bot-like)
        const samMin = replyHour === sentHour && replyMin === sentMin;
        const nextMin = replyHour === sentHour && replyMin === sentMin + 1;
        const wrapMin = sentHour === 23 && replyHour === 0 && sentMin === 59 && replyMin === 0;

        if (samMin || nextMin || wrapMin) {
          console.log(`[AutoResposta] Classificado como ROBÔ por tempo de resposta rápido (enviado ${sentHour}:${sentMin}, respondeu ${replyHour}:${replyMin})`);
          return 'robo';
        }
      }
    } catch (e) {
      // Ignore parse errors — fall through to human classification
    }
  }

  // ── 4. Default: human ─────────────────────────────────────────────────────
  console.log(`[AutoResposta] Classificado como HUMANO`);
  return 'humano';
}

/**
 * Sends the automatic follow-up message to a lead via WhatsApp Web.
 * Waits until the session is not busy (isSending = false) before sending.
 *
 * @param {string} vendedorId
 * @param {object} lead
 * @param {string} texto
 */
async function enviarRespostaAutomatica(vendedorId, lead, texto) {
  const MAX_WAIT_MS = 30 * 60 * 1000; // Wait up to 30 min for dispatch to finish
  const CHECK_INTERVAL = 5000;
  let waited = 0;

  while (waited < MAX_WAIT_MS) {
    const session = sessions.get(vendedorId);
    if (!session || session.status !== 'connected') {
      console.log(`[AutoResposta] Sessão do vendedor ${vendedorId} encerrada. Cancelando auto-resposta para ${lead.empresa}.`);
      return;
    }

    if (!session.isSending) break;

    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
    waited += CHECK_INTERVAL;
  }

  try {
    // Call enviarMensagemAvulsa directly — defined later in this same module
    await enviarMensagemAvulsa(vendedorId, lead.telefone, texto);
    console.log(`[AutoResposta] Resposta automática enviada para ${lead.empresa}: "${texto.substring(0, 50)}..."`);
  } catch (err) {
    console.error(`[AutoResposta] Erro ao enviar resposta automática para ${lead.empresa}: ${err.message}`);
  }
}

/**
 * Monitors a lead for a reply after the initial message was sent.
 * Runs in the background (do not await). Polls every 30 seconds for up to 4 hours.
 * When a reply is detected, classifies it as bot or human and sends the appropriate response.
 *
 * @param {string} vendedorId
 * @param {object} lead - Lead record from the DB
 * @param {number} sentAt - Timestamp (ms) when the initial message was sent
 * @param {{ msgRobo: string, msgHumano: string }} msgsConfig
 */
/**
 * Recupera uma mensagem secundária ativa aleatória adaptada para o lead.
 */
function obterMensagemSecundaria(lead, vendedorId) {
  const msgsAtivas = db.prepare("SELECT * FROM mensagens WHERE ativa = 1 AND tipo = 'secundaria'").all();
  if (msgsAtivas.length === 0) return null;

  const temSite = !!(lead.site && lead.site.trim() !== "" && lead.site !== "Não Informado" && lead.site !== "Não Informada");
  const msgsFiltradas = msgsAtivas.filter(m => {
    const cond = m.condicao_site || 'qualquer';
    if (cond === 'com_site') return temSite;
    if (cond === 'sem_site') return !temSite;
    return true;
  });

  const msgsParaUsar = msgsFiltradas.length > 0 ? msgsFiltradas : msgsAtivas;
  const msgEscolhida = msgsParaUsar[Math.floor(Math.random() * msgsParaUsar.length)];
  let texto = msgEscolhida.texto;

  // Substituir variáveis
  const saudacao = getSaudacao();
  let linkKiwify = "";
  const vendedor = db.prepare("SELECT link_kiwify FROM vendedores WHERE id = ?").get(vendedorId);
  if (vendedor && vendedor.link_kiwify) {
    linkKiwify = vendedor.link_kiwify;
  }
  if (!linkKiwify) {
    const globalConfig = db.prepare("SELECT valor FROM configuracoes WHERE chave = ?").get("link_venda_padrao");
    if (globalConfig) {
      linkKiwify = globalConfig.valor;
    }
  }

  texto = texto
    .replace(/{saudacao}/gi, saudacao)
    .replace(/{empresa}/gi, lead.company_name || lead.empresa || "")
    .replace(/{nicho}/gi, lead.nicho || "")
    .replace(/{link_kiwify}/gi, linkKiwify || "");

  return texto;
}

/**
 * Monitors a lead for a reply after the initial message was sent.
 * Runs in the background (do not await). Polls every 30 seconds for up to 4 hours.
 * When a reply is detected, classifies it as bot or human and sends the appropriate response.
 *
 * @param {string} vendedorId
 * @param {object} lead - Lead record from the DB
 * @param {number} sentAt - Timestamp (ms) when the initial message was sent
 * @param {{ msgRobo: string, msgHumano: string }} msgsConfig
 */
export async function monitorarRespostaLead(vendedorId, lead, sentAt, msgsConfig) {
  const POLL_INTERVAL_MS = 30_000;          // 30 seconds between checks
  const MAX_MONITOR_MS   = 4 * 60 * 60 * 1000; // 4 hours total
  const { msgRobo, msgHumano } = msgsConfig;

  // Register in queue
  leadMonitorQueue.set(lead.id, { vendedorId, sentAt, resolved: false });
  console.log(`[Monitor] Iniciando monitoramento de resposta para: ${lead.empresa} (${lead.telefone}) — até 4h`);

  const phoneClean = lead.telefone.replace(/\D/g, '');

  const startedAt = Date.now();

  while (Date.now() - startedAt < MAX_MONITOR_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    // Check if already resolved (e.g., by another path)
    const entry = leadMonitorQueue.get(lead.id);
    if (!entry || entry.resolved) {
      console.log(`[Monitor] Lead ${lead.empresa} já resolvido. Encerrando monitor.`);
      break;
    }

    const session = sessions.get(vendedorId);
    if (!session || session.status !== 'connected') {
      console.log(`[Monitor] Sessão do vendedor ${vendedorId} encerrada. Encerrando monitor de ${lead.empresa}.`);
      leadMonitorQueue.delete(lead.id);
      break;
    }

    // 1. Check if there are active secondary messages
    const temMensagensSecundarias = db.prepare("SELECT 1 FROM mensagens WHERE ativa = 1 AND tipo = 'secundaria'").get();

    // 2. Timeout check: if secondary messages are active and 5 minutes passed, send it and terminate
    if (temMensagensSecundarias && (Date.now() - startedAt >= 5 * 60 * 1000)) {
      console.log(`[Monitor] 5 minutos sem resposta de ${lead.empresa}. Enviando mensagem secundária...`);
      const textoSecundario = obterMensagemSecundaria(lead, vendedorId);
      if (textoSecundario) {
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE leads SET status = 'Conversando', atualizado_em = ? WHERE id = ?
        `).run(now, lead.id);

        const idNote = 'sys_' + Math.random().toString(36).substring(2, 11);
        db.prepare(`
          INSERT INTO mensagens_chat (id, lead_id, vendedor_id, direcao, texto, timestamp)
          VALUES (?, ?, ?, 'system', ?, ?)
        `).run(idNote, lead.id, vendedorId, `[Auto] Sem resposta após 5 minutos. Enviando mensagem secundária.`, now);

        leadMonitorQueue.set(lead.id, { ...entry, resolved: true });

        enviarRespostaAutomatica(vendedorId, lead, textoSecundario).then(() => {
          const idMsgSent = 'wa_' + Math.random().toString(36).substring(2, 11);
          const nowSent = new Date().toISOString();
          db.prepare(`
            INSERT INTO mensagens_chat (id, lead_id, vendedor_id, direcao, texto, timestamp)
            VALUES (?, ?, ?, 'out', ?, ?)
          `).run(idMsgSent, lead.id, vendedorId, textoSecundario, nowSent);
        }).catch(console.error);
      }

      leadMonitorQueue.delete(lead.id);
      break;
    }

    // Skip if currently sending — don't interrupt dispatch
    if (session.isSending || session.isProcessingQueue) {
      console.log(`[Monitor] Sessão ocupada com disparo. Aguardando próxima janela para checar ${lead.empresa}...`);
      continue;
    }

    // Mark session as busy during check
    session.isSending = true;
    try {
      const page = session.page;
      const chatUrl = `https://web.whatsapp.com/send?phone=${phoneClean}`;
      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});

      const textboxSelector = '#main div[contenteditable="true"], div[data-testid="conversation-text-input"]';
      await page.waitForSelector(textboxSelector, { timeout: 12000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));

      // Extract messages from chat — we want direction, text, and WhatsApp's displayed timestamp
      const chatMsgs = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll(
          '#main div[data-testid="msg-container"], #main div.message-in, #main div.message-out'
        ));
        return containers.slice(-20).map(b => {
          const isOut = b.classList.contains('message-out') ||
                        !!b.querySelector('.message-out') ||
                        b.innerHTML.includes('message-out');
          const textEl = b.querySelector('span.selectable-text, span.copyable-text');
          const text = textEl ? textEl.innerText.trim() : '';
          // Try to get the WhatsApp message timestamp
          const prePlain = b.getAttribute('data-pre-plain-text') || '';
          const timeEl = b.querySelector('[data-testid="msg-time"], span.x1c4vz4f');
          const timeStr = timeEl ? timeEl.innerText.trim() : '';
          return {
            direcao: isOut ? 'out' : 'in',
            texto: text,
            prePlain,    // e.g. "[10:30, 11/06/2026] Empresa XYZ:"
            timeStr      // e.g. "10:30"
          };
        }).filter(m => m.texto !== '');
      }).catch(() => []);

      // Find new inbound messages not yet in our DB
      for (const msg of chatMsgs) {
        if (msg.direcao !== 'in') continue;

        const exists = db.prepare(`
          SELECT 1 FROM mensagens_chat WHERE lead_id = ? AND direcao = 'in' AND texto = ?
        `).get(lead.id, msg.texto);

        if (!exists) {
          // New inbound message found!
          console.log(`[Monitor] Resposta detectada de ${lead.empresa}: "${msg.texto.substring(0, 80)}"`);

          // Save to mensagens_chat
          const idMsg = 'wa_' + Math.random().toString(36).substring(2, 11);
          const now = new Date().toISOString();
          db.prepare(`
            INSERT INTO mensagens_chat (id, lead_id, vendedor_id, direcao, texto, timestamp)
            VALUES (?, ?, ?, 'in', ?, ?)
          `).run(idMsg, lead.id, vendedorId, msg.texto, now);

          let textoResposta = null;
          let noteMsg = "";
          
          if (temMensagensSecundarias) {
            textoResposta = obterMensagemSecundaria(lead, vendedorId);
            noteMsg = "[Auto] Cliente respondeu. Enviando mensagem secundária.";
          } else {
            // Classify: bot or human?
            const timestampStr = msg.prePlain || msg.timeStr;
            const tipo = classificarResposta(msg.texto, sentAt, timestampStr);
            textoResposta = tipo === 'robo' ? msgRobo : msgHumano;
            noteMsg = `[Auto] Detectado: ${tipo === 'robo' ? '🤖 Robô' : '👤 Humano'}`;

            // Replace placeholders ({link_kiwify}, {empresa}) in auto-replies
            if (textoResposta) {
              let linkKiwify = "";
              const vendedor = db.prepare("SELECT link_kiwify FROM vendedores WHERE id = ?").get(vendedorId);
              if (vendedor && vendedor.link_kiwify) {
                linkKiwify = vendedor.link_kiwify;
              }
              if (!linkKiwify) {
                const globalConfig = db.prepare("SELECT valor FROM configuracoes WHERE chave = ?").get("link_venda_padrao");
                if (globalConfig) {
                  linkKiwify = globalConfig.valor;
                }
              }
              textoResposta = textoResposta.replace(/{link_kiwify}/g, linkKiwify || "");
              textoResposta = textoResposta.replace(/{empresa}/g, lead.empresa || "");
            }
          }

          // Update lead status
          db.prepare(`
            UPDATE leads SET status = 'Conversando', atualizado_em = ? WHERE id = ?
          `).run(now, lead.id);

          // Save system note to mensagens_chat
          const idNote = 'sys_' + Math.random().toString(36).substring(2, 11);
          db.prepare(`
            INSERT INTO mensagens_chat (id, lead_id, vendedor_id, direcao, texto, timestamp)
            VALUES (?, ?, ?, 'system', ?, ?)
          `).run(idNote, lead.id, vendedorId, noteMsg, now);

          // Mark as resolved
          leadMonitorQueue.set(lead.id, { ...entry, resolved: true });

          // Go back before sending (restore session)
          session.isSending = false;
          await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

          // Send the appropriate response (waits for any ongoing dispatch to finish)
          if (textoResposta && textoResposta.trim()) {
            console.log(`[Monitor] Enviando resposta automática para ${lead.empresa}...`);
            enviarRespostaAutomatica(vendedorId, lead, textoResposta).then(() => {
              const idMsgSent = 'wa_' + Math.random().toString(36).substring(2, 11);
              const nowSent = new Date().toISOString();
              db.prepare(`
                INSERT INTO mensagens_chat (id, lead_id, vendedor_id, direcao, texto, timestamp)
                VALUES (?, ?, ?, 'out', ?, ?)
              `).run(idMsgSent, lead.id, vendedorId, textoResposta, nowSent);
            }).catch(console.error);
          }

          leadMonitorQueue.delete(lead.id);
          return; // Exit the monitoring loop
        }
      }

      // No new messages — go back to main screen
      await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

    } catch (err) {
      console.error(`[Monitor] Erro ao verificar chat de ${lead.empresa}: ${err.message}`);
    } finally {
      session.isSending = false;
    }
  }

  // Timeout reached without reply
  if (leadMonitorQueue.has(lead.id)) {
    console.log(`[Monitor] Tempo limite (4h) atingido para ${lead.empresa}. Encerrando monitoramento.`);
    leadMonitorQueue.delete(lead.id);
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

    // Load auto-reply configs for bot vs human responses
    const msgRoboRow    = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'mensagem_resposta_robo'").get();
    const msgHumanoRow  = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'mensagem_resposta_humano'").get();
    const msgRobo   = msgRoboRow   ? msgRoboRow.valor   : '';
    const msgHumano = msgHumanoRow ? msgHumanoRow.valor : '';
    
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
        
        // Record exact time we're sending — used later for bot/human detection by response speed
        const sentAt = Date.now();

        // Open direct URL to WhatsApp API send interface
        const sendUrl = `https://web.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(textoPersonalizado)}`;
        await page.goto(sendUrl, { waitUntil: "domcontentloaded" });

        const sendButtonSelector = '#main span[data-icon="send"], #main button[data-testid="compose-btn-send"], button[data-testid="compose-btn-send"]';
        const textboxSelector = '#main div[contenteditable="true"], div[data-testid="conversation-text-input"], div[data-testid="compose-input"]';
        
        // Wait for either the send button, the textbox, or the "Invalid Phone Number" dialog
        let action = await Promise.race([
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
          
          if (/iniciando|carregando|conectando|starting|loading|connecting/i.test(dialogText)) {
            console.log(`[DEBUG] Diálogo de carregamento detectado. Aguardando a conversa carregar de fato...`);
            
            // Wait up to 25 seconds for the loading dialog to disappear and the chat elements to load
            const secondAction = await Promise.race([
              page.waitForSelector(sendButtonSelector, { timeout: 25000 }).then(() => "send_btn"),
              page.waitForSelector(textboxSelector, { timeout: 25000 }).then(() => "textbox"),
              page.waitForFunction(() => {
                const el = document.querySelector('div[role="dialog"]');
                if (!el) return false;
                const text = el.innerText || "";
                return !/iniciando|carregando|conectando|starting|loading|connecting/i.test(text);
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
          } else {
            console.log(`[DEBUG] Diálogo não-sistema detectado. Tentando fechar...`);
            const buttons = await page.$$('div[role="dialog"] button, div[role="dialog"] [role="button"]');
            let closed = false;
            for (const btn of buttons) {
              const btnText = await page.evaluate(el => el.innerText || "", btn);
              if (/ok|entendi|fechar|close|avançar|next/i.test(btnText)) {
                console.log(`[DEBUG] Clicando no botão "${btnText}" para fechar diálogo.`);
                await btn.click().catch(() => {});
                closed = true;
                break;
              }
            }
            if (!closed && buttons.length > 0) {
              console.log(`[DEBUG] Nenhum botão de fechar correspondente encontrado. Clicando no primeiro botão do diálogo.`);
              await buttons[0].click().catch(() => {});
            }
            
            // Wait a moment for it to close
            await new Promise(r => setTimeout(r, 2000));

            // Recheck if elements are now available, otherwise re-navigate to sendUrl
            let checkSendBtn = await page.$(sendButtonSelector);
            let checkTextbox = await page.$(textboxSelector);
            if (!checkSendBtn && !checkTextbox) {
              console.log(`[DEBUG] Elementos de envio ainda ausentes após fechar diálogo. Re-navegando para a URL de envio...`);
              await page.goto(sendUrl, { waitUntil: "domcontentloaded" });
              
              // Wait again for elements
              action = await Promise.race([
                page.waitForSelector(sendButtonSelector, { timeout: 20000 }).then(() => "send_btn"),
                page.waitForSelector(textboxSelector, { timeout: 20000 }).then(() => "textbox"),
                page.waitForSelector('div[role="dialog"]', { timeout: 20000 }).then(() => "dialog")
              ]).catch(() => "timeout");
            }
          }
        }

        if (action === "timeout") {
          throw new Error("Tempo limite de carregamento da conversa excedido.");
        }

        // Small pause to let elements settle
        await new Promise(r => setTimeout(r, 2000));

        const textbox = await page.$(textboxSelector);
        if (textbox) {
          // Check if there is already text inside the textbox (hydrated from sendUrl)
          const currentText = await page.evaluate(el => el.innerText || "", textbox);
          if (!currentText.trim()) {
            console.log(`[DEBUG] Campo de texto vazio. Digitando a mensagem manualmente...`);
            await textbox.focus();
            await page.keyboard.type(textoPersonalizado, { delay: 50 });
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        const sendBtn = await page.$(sendButtonSelector);
        if (sendBtn) {
          await sendBtn.click();
        } else {
          if (textbox) {
            await textbox.focus();
            await page.keyboard.press("Enter");
          } else {
            throw new Error("Elementos de envio não encontrados.");
          }
        }

        // Wait a moment for transmission
        await new Promise(r => setTimeout(r, 4000));
        await arquivarConversaAtiva(page).catch(console.error);

        const now = new Date().toISOString();
        db.prepare(`
          UPDATE leads 
          SET status = 'Mensagem enviada', ultima_mensagem = ?, atualizado_em = ? 
          WHERE id = ?
        `).run(textoPersonalizado, now, lead.id);

        resultados.push({ id: lead.id, empresa: lead.empresa, status: "Mensagem enviada" });
        console.log(`Mensagem enviada com sucesso para ${lead.empresa}`);

        // Start background monitor for this lead's reply (bot vs human detection)
        monitorarRespostaLead(vendedorId, lead, sentAt, { msgRobo, msgHumano }).catch(err => {
          console.error(`[Monitor] Erro no monitor de ${lead.empresa}:`, err.message);
        });

      } catch (err) {
        console.error(`Erro ao disparar para ${lead.empresa}:`, err.message);
        resultados.push({ id: lead.id, empresa: lead.empresa, status: lead.status, erro: err.message });
      }

      // Apply random delay (5 to 15 seconds) to avoid WhatsApp spam bans
      const delay = Math.floor(Math.random() * 10000) + 5000;
      await new Promise(r => setTimeout(r, delay));
    }

    // (Stay on last chat screen to prevent full page reload)

    return resultados;
  } finally {
    session.isSending = false;
  }
}

/**
 * Arquiva a conversa ativa no cabeçalho do chat do WhatsApp Web.
 */
async function arquivarConversaAtiva(page) {
  try {
    // 1. Tentar focar a caixa de texto para garantir foco na conversa
    const textboxSelector = '#main div[contenteditable="true"], div[data-testid="conversation-text-input"], div[data-testid="compose-input"]';
    const textbox = await page.$(textboxSelector).catch(() => null);
    if (textbox) {
      await textbox.focus().catch(() => {});
    }
    
    // 2. Tentar arquivar usando o atalho oficial do WhatsApp Web (Ctrl + Alt + Shift + E)
    console.log("[Archive] Tentando arquivar conversa via atalho de teclado (Ctrl+Alt+Shift+E)...");
    await page.keyboard.press("Control+Alt+Shift+E").catch(() => {});
    await new Promise(r => setTimeout(r, 2000)); // Espera animação
    
    // Verificar se o painel do chat sumiu. Se sumiu, deu certo!
    const aindaVisivel = await page.$('#main').catch(() => null);
    if (!aindaVisivel) {
      console.log("[Archive] Conversa arquivada com sucesso via atalho de teclado.");
      return true;
    }
    
    console.log("[Archive] Atalho não fechou a conversa. Tentando via clique no menu...");
    // 3. Fallback: Procurar o botão de menu (três pontos) no cabeçalho do chat
    const headerMenuSelector = [
      '#main header [data-testid="menu"]',
      '#main header [data-testid="conversation-menu-button"]',
      '#main header span[data-icon="menu"]',
      '#main header span[data-icon="overflow-menu-vertical"]',
      '#main header button[aria-label*="opções"]',
      '#main header button[title*="opções"]',
      '#main header button[aria-label*="options"]',
      '#main header button[title*="options"]',
      '#main header [role="button"][aria-label*="opções"]',
      '#main header [role="button"][title*="opções"]',
      '#main header [role="button"][aria-label*="options"]',
      '#main header [role="button"][title*="options"]',
      '#main header [role="button"]:has(span[data-icon="menu"])',
      '#main header [role="button"]:has(span[data-icon="overflow-menu-vertical"])'
    ].join(', ');
    
    const menuBtn = await page.waitForSelector(headerMenuSelector, { timeout: 8000 }).catch(() => null);
    if (!menuBtn) {
      console.log("[Archive] Não foi possível encontrar o botão de menu no cabeçalho do chat.");
      return false;
    }
    await menuBtn.click();
    await new Promise(r => setTimeout(r, 1000)); // Espera abrir o menu dropdown
    
    // Procura pela opção que contém "arquivar" ou "archive" no menu dropdown
    const items = await page.$$('div[role="button"], [role="menuitem"], span, div');
    let clicked = false;
    for (const item of items) {
      const text = await page.evaluate(el => el.innerText || "", item);
      if (/arquivar|archive/i.test(text)) {
        await item.click().catch(() => {});
        clicked = true;
        console.log(`[Archive] Opção de menu "${text.trim()}" clicada com sucesso.`);
        break;
      }
    }
    
    if (!clicked) {
      // Fecha o menu apertando Escape se não encontrou o item
      await page.keyboard.press("Escape").catch(() => {});
      console.log("[Archive] Opção 'Arquivar' não encontrada no menu.");
      return false;
    }
    
    await new Promise(r => setTimeout(r, 2000)); // Espera animação de arquivamento
    return true;
  } catch (err) {
    console.error("[Archive] Erro ao arquivar conversa ativa:", err.message);
    return false;
  }
}

/**
 * Sends a single WhatsApp message using Playwright session.
 */
export async function enviarMensagemAvulsa(vendedorId, telefone, texto) {
  const session = sessions.get(vendedorId);
  if (!session || session.status !== "connected") {
    throw new Error("WhatsApp não está conectado para este vendedor.");
  }

  // Wait if another operation (like background sync) is in progress
  let waitAttempts = 0;
  while ((session.isSending || session.isProcessingQueue) && waitAttempts < 30) {
    await new Promise(r => setTimeout(r, 500));
    waitAttempts++;
  }

  session.isSending = true;
  try {
    const page = session.page;
    const phoneClean = formatarTelefoneWhatsApp(telefone);
    const sendUrl = `https://web.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(texto)}`;
    
    logDebug(vendedorId, `Iniciando envio de mensagem avulsa para ${telefone}...`);
    await page.goto(sendUrl, { waitUntil: "domcontentloaded" });

    const sendButtonSelector = '#main span[data-icon="send"], #main button[data-testid="compose-btn-send"], button[data-testid="compose-btn-send"]';
    const textboxSelector = '#main div[contenteditable="true"], div[data-testid="conversation-text-input"], div[data-testid="compose-input"]';
    
    let action = await Promise.race([
      page.waitForSelector(sendButtonSelector, { timeout: 30000 }).then(() => "send_btn"),
      page.waitForSelector(textboxSelector, { timeout: 30000 }).then(() => "textbox"),
      page.waitForSelector('div[role="dialog"]', { timeout: 30000 }).then(() => "dialog")
    ]).catch(() => "timeout");

    if (action === "dialog") {
      const dialogText = await page.evaluate(() => {
        const el = document.querySelector('div[role="dialog"]');
        return el ? el.innerText : "";
      }).catch(() => "");
      logDebug(vendedorId, `Diálogo detectado no envio avulso: "${dialogText}"`);
      
      if (/iniciando|carregando|conectando|starting|loading|connecting/i.test(dialogText)) {
        const secondAction = await Promise.race([
          page.waitForSelector(sendButtonSelector, { timeout: 25000 }).then(() => "send_btn"),
          page.waitForSelector(textboxSelector, { timeout: 25000 }).then(() => "textbox"),
          page.waitForFunction(() => {
            const el = document.querySelector('div[role="dialog"]');
            if (!el) return false;
            return !/iniciando|carregando|conectando|starting|loading|connecting/i.test(el.innerText || "");
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
          
          if (/inválido|invalid|não existe|não está|not exist|incorrect|not registered/i.test(finalDialogText)) {
            const okBtn = await page.$('div[role="dialog"] button');
            if (okBtn) await okBtn.click();
            throw new Error("Número de telefone inválido ou não cadastrado no WhatsApp.");
          }
        }
      } else if (/inválido|invalid|não existe|não está|not exist|incorrect|not registered/i.test(dialogText)) {
        const okBtn = await page.$('div[role="dialog"] button');
        if (okBtn) await okBtn.click();
        throw new Error("Número de telefone inválido ou não cadastrado no WhatsApp.");
      } else {
        const buttons = await page.$$('div[role="dialog"] button, div[role="dialog"] [role="button"]');
        if (buttons.length > 0) {
          await buttons[0].click().catch(() => {});
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (action === "timeout") {
      throw new Error("Tempo limite excedido ao carregar tela de envio.");
    }

    await new Promise(r => setTimeout(r, 2000));

    const textbox = await page.$(textboxSelector);
    if (textbox) {
      const currentText = await page.evaluate(el => el.innerText || "", textbox);
      if (!currentText.trim()) {
        await textbox.focus();
        await page.keyboard.type(texto, { delay: 50 });
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const sendBtn = await page.$(sendButtonSelector);
    if (sendBtn) {
      await sendBtn.click();
    } else {
      if (textbox) {
        await textbox.focus();
        await page.keyboard.press("Enter");
      } else {
        throw new Error("Elementos de envio não encontrados.");
      }
    }

    await new Promise(r => setTimeout(r, 4000));
    await arquivarConversaAtiva(page).catch(console.error);

    // Update lead's ultima_mensagem in DB
    const now = new Date().toISOString();
    const cleanTel = telefone.replace(/\D/g, '');
    const lead = db.prepare("SELECT * FROM leads WHERE vendedor_id = ?").all(vendedorId).find(l => {
      const cleanDb = l.telefone.replace(/\D/g, '');
      return cleanDb === cleanTel || cleanDb.endsWith(cleanTel) || cleanTel.endsWith(cleanDb);
    });

    if (lead) {
      db.prepare(`
        UPDATE leads 
        SET ultima_mensagem = ?, atualizado_em = ?
        WHERE id = ?
      `).run(texto, now, lead.id);
    }

    logDebug(vendedorId, `Mensagem avulsa enviada com sucesso para ${telefone}`);
    return true;
  } catch (err) {
    logDebug(vendedorId, `Erro ao enviar mensagem avulsa para ${telefone}: ${err.message}`);
    throw err;
  } finally {
    if (session.status === "connected") {
      await session.page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" }).catch(() => {});
    }
    session.isSending = false;
  }
}

/**
 * Synchronizes the chat history for a specific lead.
 */
export async function sincronizarChatLead(vendedorId, leadId) {
  const session = sessions.get(vendedorId);
  if (!session || session.status !== "connected" || session.isSending || session.isProcessingQueue) {
    return false;
  }

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
  if (!lead) return false;

  session.isSending = true;
  try {
    const page = session.page;
    const phoneClean = formatarTelefoneWhatsApp(lead.telefone);
    const chatUrl = `https://web.whatsapp.com/send?phone=${phoneClean}`;
    
    logDebug(vendedorId, `Sincronizando chat em background para: ${lead.empresa} (${lead.telefone})...`);
    await page.goto(chatUrl, { waitUntil: "domcontentloaded" });

    const sendButtonSelector = '#main span[data-icon="send"], #main button[data-testid="compose-btn-send"], button[data-testid="compose-btn-send"]';
    const textboxSelector = '#main div[contenteditable="true"], div[data-testid="conversation-text-input"], div[data-testid="compose-input"]';
    
    let action = await Promise.race([
      page.waitForSelector(sendButtonSelector, { timeout: 15000 }).then(() => "loaded"),
      page.waitForSelector(textboxSelector, { timeout: 15000 }).then(() => "loaded"),
      page.waitForSelector('div[role="dialog"]', { timeout: 15000 }).then(() => "dialog")
    ]).catch(() => "timeout");

    if (action === "dialog") {
      const dialogText = await page.evaluate(() => {
        const el = document.querySelector('div[role="dialog"]');
        return el ? el.innerText : "";
      }).catch(() => "");
      
      if (/iniciando|carregando|conectando|starting|loading|connecting/i.test(dialogText)) {
        await Promise.race([
          page.waitForSelector(sendButtonSelector, { timeout: 15000 }).then(() => "loaded"),
          page.waitForSelector(textboxSelector, { timeout: 15000 }).then(() => "loaded")
        ]).catch(() => "timeout");
      }
    }

    await new Promise(r => setTimeout(r, 2000)); // Let messages render

    // Extract last 15 messages from `#main`
    const chatMsgs = await page.evaluate(() => {
      const bubbles = Array.from(document.querySelectorAll('#main div[data-testid="msg-container"], #main div.message-in, #main div.message-out'));
      const lastBubbles = bubbles.slice(-15);
      return lastBubbles.map(b => {
        const isOut = b.classList.contains('message-out') || !!b.querySelector('.message-out') || b.innerHTML.includes('message-out');
        const textEl = b.querySelector('span.selectable-text, span.copyable-text');
        const text = textEl ? textEl.innerText : '';
        return {
          direcao: isOut ? 'out' : 'in',
          texto: text
        };
      }).filter(m => m.texto.trim() !== '');
    }).catch(() => []);

    let newMessages = 0;
    for (const msg of chatMsgs) {
      const exists = db.prepare(`
        SELECT 1 FROM mensagens_chat
        WHERE lead_id = ? AND direcao = ? AND texto = ?
      `).get(lead.id, msg.direcao, msg.texto);

      if (!exists) {
        const idMsg = 'wa_' + Math.random().toString(36).substring(2, 11);
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO mensagens_chat (id, lead_id, vendedor_id, direcao, texto, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(idMsg, lead.id, vendedorId, msg.direcao, msg.texto, now);
        newMessages++;
      }
    }

    if (newMessages > 0) {
      logDebug(vendedorId, `Sincronizados ${newMessages} novos registros para: ${lead.empresa}`);
    }

    return true;
  } catch (err) {
    logDebug(vendedorId, `Erro ao sincronizar chat para ${lead.empresa}: ${err.message}`);
    return false;
  } finally {
    if (session.status === "connected") {
      await session.page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" }).catch(() => {});
    }
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
    isSending: session.isSending || session.isProcessingQueue || false
  };
}
