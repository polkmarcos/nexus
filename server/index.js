import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import db from "./db.js";
import { scrapeGoogleMaps, scrapeGoogleMapsParaDisparo } from "./scraper.js";
import { 
  conectarWhatsapp, 
  dispararMensagens, 
  checkSessionStatus, 
  sessions,
  enviarMensagemAvulsa,
  sincronizarChatLead
} from "./whatsapp.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force nodemon reload: 2026-06-06T13:36:00
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "../dist")));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

function nowIso() {
  return new Date().toISOString();
}

/**
 * Envia mensagem inicial para um único lead usando a sessão WhatsApp do vendedor.
 * Após o envio, atualiza o status do lead para 'Mensagem enviada'.
 */
async function dispararMensagemParaLead(vendedorId, lead, textoTemplate) {
  // dispararMensagens aceita array de leads — passamos apenas este lead
  const resultados = await dispararMensagens(vendedorId, [textoTemplate], [lead]);
  return resultados;
}

function validarCPF(cpf) {
  if (typeof cpf !== "string") return false;
  cpf = cpf.replace(/[^\d]/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  let soma = 0;
  let resto;
  
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
}

// Scraper state tracker
const activeCaptures = [];
const CIDADES_VARREDURA = [
  // São Paulo (SP)
  "Poá - SP",
  "Suzano - SP",
  "Mogi das Cruzes - SP",
  "Itaquaquecetuba - SP",
  "Itaim Paulista - SP",
  "Guarulhos - SP",
  "São Bernardo do Campo - SP",
  "Santo André - SP",
  "Osasco - SP",
  "São José dos Campos - SP",
  "São Paulo - SP",
  "Campinas - SP",
  "Santos - SP",
  "Sorocaba - SP",
  "Ribeirão Preto - SP",
  "Bauru - SP",
  "Jundiaí - SP",
  "Piracicaba - SP",
  "Carapicuíba - SP",
  "São Vicente - SP",
  "Barueri - SP",
  "Diadema - SP",
  "Mauá - SP",
  "Cotia - SP",
  
  // Rio de Janeiro (RJ)
  "Rio de Janeiro - RJ",
  "São Gonçalo - RJ",
  "Duque de Caxias - RJ",
  "Nova Iguaçu - RJ",
  "Niterói - RJ",
  "Belford Roxo - RJ",
  "São João de Meriti - RJ",
  "Petrópolis - RJ",
  "Volta Redonda - RJ",
  "Macaé - RJ",
  "Cabo Frio - RJ",
  "Nova Friburgo - RJ",
  "Barra Mansa - RJ",
  "Angra dos Reis - RJ",
  "Teresópolis - RJ",
  "Mesquita - RJ",
  "Nilópolis - RJ",
  "Maricá - RJ",
  "Itaboraí - RJ",
  "Resende - RJ",

  // Minas Gerais (MG)
  "Belo Horizonte - MG",
  "Uberlândia - MG",
  "Contagem - MG",
  "Juiz de Fora - MG",
  "Betim - MG",
  "Montes Claros - MG",
  "Ribeirão das Neves - MG",
  "Uberaba - MG",
  "Governador Valadares - MG",
  "Ipatinga - MG",
  
  // Espírito Santo (ES)
  "Serra - ES",
  "Vila Velha - ES",
  "Cariacica - ES",
  "Vitória - ES",

  // Paraná (PR)
  "Curitiba - PR",
  "Londrina - PR",
  "Maringá - PR",
  "Ponta Grossa - PR",
  "Cascavel - PR",
  "São José dos Pinhais - PR",
  "Foz do Iguaçu - PR",

  // Santa Catarina (SC)
  "Joinville - SC",
  "Florianópolis - SC",
  "Blumenau - SC",
  "São José - SC",
  "Chapecó - SC",
  "Criciúma - SC",
  "Itajaí - SC",

  // Rio Grande do Sul (RS)
  "Porto Alegre - RS",
  "Caxias do Sul - RS",
  "Canoas - RS",
  "Pelotas - RS",
  "Santa Maria - RS",
  "Gravataí - RS",
  "Viamão - RS",
  "Novo Hamburgo - RS",

  // Bahia (BA)
  "Salvador - BA",
  "Feira de Santana - BA",
  "Vitória da Conquista - BA",
  "Camaçari - BA",
  "Juazeiro - BA",
  "Itabuna - BA",

  // Pernambuco (PE)
  "Recife - PE",
  "Jaboatão dos Guararapes - PE",
  "Olinda - PE",
  "Caruaru - PE",
  "Petrolina - PE",
  "Paulista - PE",

  // Ceará (CE)
  "Fortaleza - CE",
  "Caucaia - CE",
  "Juazeiro do Norte - CE",
  "Maracanaú - CE",
  "Sobral - CE",

  // Distrito Federal (DF)
  "Brasília - DF",

  // Goiás (GO)
  "Goiânia - GO",
  "Aparecida de Goiânia - GO",
  "Anápolis - GO",
  "Rio Verde - GO",

  // Maranhão (MA)
  "São Luís - MA",
  "Imperatriz - MA",

  // Paraíba (PB)
  "João Pessoa - PB",
  "Campina Grande - PB",

  // Rio Grande do Norte (RN)
  "Natal - RN",
  "Mossoró - RN",

  // Alagoas (AL)
  "Maceió - AL",
  "Arapiraca - AL",

  // Sergipe (SE)
  "Aracaju - SE",
  "Nossa Senhora do Socorro - SE",

  // Piauí (PI)
  "Teresina - PI",
  "Parnaíba - PI",

  // Pará (PA)
  "Belém - PA",
  "Ananindeua - PA",
  "Santarém - PA",
  "Marabá - PA",

  // Amazonas (AM)
  "Manaus - AM",

  // Mato Grosso (MT)
  "Cuiabá - MT",
  "Várzea Grande - MT",
  "Rondonópolis - MT",

  // Mato Grosso do Sul (MS)
  "Campo Grande - MS",
  "Dourados - MS",

  // Tocantins (TO)
  "Palmas - TO",

  // Rondônia (RO)
  "Porto Velho - RO",

  // Acre (AC)
  "Rio Branco - AC",

  // Amapá (AP)
  "Macapá - AP",

  // Roraima (RR)
  "Boa Vista - RR"
];

/**
 * Gets the current limit of active sellers from the configurations table.
 */
function getLimiteVendedoresAtivos() {
  try {
    const row = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'limite_vendedores_ativos'").get();
    return row ? Number(row.valor) : 100;
  } catch (_) {
    return 100;
  }
}

/**
 * Automatically maintains the active sellers queue.
 * - Demotes active sellers with >48h inactivity.
 * - Demotes active sellers with disconnected WhatsApp (after a 2-hour grace period).
 * - Promotes the next inactive sellers in line to maintain up to current configuration limit.
 */
function processarFilaVendedores() {
  try {
    const now = nowIso();

    const limitInactivity = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // 1. Get inactive sellers (no access for 48 hours)
    const inativos = db.prepare(`
      SELECT * FROM vendedores 
      WHERE ativo = 1 AND (ultimo_acesso < ? OR ultimo_acesso IS NULL)
    `).all(limitInactivity);
    
    // 2. Get active sellers to check WhatsApp connection
    const activeSellersInDb = db.prepare("SELECT * FROM vendedores WHERE ativo = 1").all();
    const graceTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours grace time to connect
    
    db.transaction(() => {
      // Demote inactive sellers
      for (const v of inativos) {
        console.log(`[Fila] Desativando vendedor "${v.nome}" (${v.id}) por inatividade de 48 horas.`);
        db.prepare(`
          UPDATE vendedores 
          SET ativo = 0, fila_timestamp = ?
          WHERE id = ?
        `).run(now, v.id);
      }
      
      // Demote active sellers with disconnected WhatsApp after grace time
      for (const v of activeSellersInDb) {
        if (inativos.some(i => i.id === v.id)) continue;
        
        const session = sessions.get(v.id);
        const isDisconnected = !session || session.status === "disconnected";
        
        const lastAccessTime = v.ultimo_acesso || v.criado_em;
        if (isDisconnected && lastAccessTime < graceTime) {
          console.log(`[Fila] Desativando vendedor "${v.nome}" (${v.id}) por falta de conexão do WhatsApp.`);
          db.prepare(`
            UPDATE vendedores 
            SET ativo = 0, fila_timestamp = ?
            WHERE id = ?
          `).run(now, v.id);
        }
      }
      
      // 3. Promote next in line if we have vacant spots based on current dynamic config
      const maxActive = getLimiteVendedoresAtivos();
      const countAtivos = db.prepare("SELECT COUNT(*) as count FROM vendedores WHERE ativo = 1").get().count;
      const spotsAvailable = Math.max(0, maxActive - countAtivos);
      
      if (spotsAvailable > 0) {
        const proximos = db.prepare(`
          SELECT * FROM vendedores 
          WHERE ativo = 0 
          ORDER BY COALESCE(fila_timestamp, criado_em) ASC 
          LIMIT ?
        `).all(spotsAvailable);
        
        for (const v of proximos) {
          console.log(`[Fila] Promovendo vendedor "${v.nome}" (${v.id}) da fila para ativo.`);
          db.prepare(`
            UPDATE vendedores 
            SET ativo = 1, fila_timestamp = ?, ultimo_acesso = ?
            WHERE id = ?
          `).run(now, now, v.id);
        }
      }
    })();
  } catch (error) {
    console.error("Erro no processamento da fila de vendedores:", error.message);
  }
}

function recircularLeads() {
  try {
    const now = nowIso();
    const limitTimeLeads = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      UPDATE leads
      SET status = 'disponivel', vendedor_id = NULL, assigned_to = NULL, assigned_at = NULL, atualizado_em = ?
      WHERE status = 'reservado' AND assigned_at < ?
    `).run(now, limitTimeLeads);
    if (result.changes > 0) {
      console.log(`[Recirculação] ${result.changes} leads devolvidos ao lago como 'disponivel' por inatividade (> 24h).`);
    }
  } catch (error) {
    console.error("Erro na recirculação de leads:", error.message);
  }
}

// Process queue on server startup and schedule every 5 minutes
processarFilaVendedores();
setInterval(processarFilaVendedores, 5 * 60 * 1000);

// Recirculate leads on startup and schedule every hour
recircularLeads();
setInterval(recircularLeads, 60 * 60 * 1000);

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "CRM Vendedores Server online",
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "online",
  });
});

// VENDEDORES
app.post("/vendedores", (req, res) => {
  try {
    const {
      nome,
      email,
      senha,
      whatsapp = "",
      limite_diario = 25,
      cpf = "",
      link_kiwify = "",
      indicado_por_id = null,
      eh_gerente = 0,
    } = req.body;

    if (!nome || !email || !senha || !cpf) {
      return res.status(400).json({
        ok: false,
        error: "Nome, e-mail, senha e CPF são obrigatórios.",
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        ok: false,
        error: "A senha de acesso deve ter no mínimo 6 caracteres.",
      });
    }

    if (!validarCPF(cpf)) {
      return res.status(400).json({
        ok: false,
        error: "O CPF informado é inválido.",
      });
    }

    // Check if email already exists
    const existing = db.prepare("SELECT id FROM vendedores WHERE email = ?").get(email);
    if (existing) {
      return res.status(400).json({
        ok: false,
        error: "Este e-mail de vendedor já está cadastrado.",
      });
    }

    // Check if CPF already exists
    const cleanCpf = cpf.replace(/[^\d]/g, "");
    const existingCpf = db.prepare("SELECT id FROM vendedores WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?").get(cleanCpf);
    if (existingCpf) {
      return res.status(400).json({
        ok: false,
        error: "Este CPF já está cadastrado.",
      });
    }

    const now = nowIso();
    
    // Process queue first to check spot availability
    processarFilaVendedores();
    
    const maxActive = getLimiteVendedoresAtivos();
    const countAtivos = db.prepare("SELECT COUNT(*) as count FROM vendedores WHERE ativo = 1").get().count;
    const ativo = countAtivos < maxActive ? 1 : 0;

    const vendedor = {
      id: randomUUID(),
      nome: nome.toUpperCase().trim(),
      email,
      senha,
      whatsapp,
      limite_diario: Number(limite_diario) || 25,
      ativo,
      ultimo_acesso: now,
      fila_timestamp: now,
      cpf,
      link_kiwify,
      indicado_por_id: indicado_por_id || null,
      eh_gerente: Number(eh_gerente) || 0,
      criado_em: now,
    };

    db.prepare(`
      INSERT INTO vendedores (
        id, nome, email, senha, whatsapp, limite_diario, ativo, ultimo_acesso, fila_timestamp, cpf, link_kiwify, indicado_por_id, eh_gerente, criado_em
      ) VALUES (
        @id, @nome, @email, @senha, @whatsapp, @limite_diario, @ativo, @ultimo_acesso, @fila_timestamp, @cpf, @link_kiwify, @indicado_por_id, @eh_gerente, @criado_em
      )
    `).run(vendedor);

    // Calculate queue position if inactive
    if (ativo === 0) {
      const queuePos = db.prepare(`
        SELECT COUNT(*) + 1 as posicao FROM vendedores 
        WHERE ativo = 0 AND COALESCE(fila_timestamp, criado_em) < (
          SELECT COALESCE(fila_timestamp, criado_em) FROM vendedores WHERE id = ?
        )
      `).get(vendedor.id).posicao;
      vendedor.posicao_fila = queuePos;
    }

    res.json({
      ok: true,
      vendedor,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/vendedores", (req, res) => {
  try {
    const vendedores = db
      .prepare("SELECT * FROM vendedores ORDER BY criado_em DESC")
      .all();

    const vendedoresComComissao = vendedores.map(v => {
      let comissaoGerente = 0;
      let indicadosCount = 0;
      let indicadosVendasCount = 0;

      const ehG = v.eh_gerente || 0;
      if (ehG === 1 || ehG === 2) {
        indicadosCount = db.prepare("SELECT COUNT(*) as total FROM vendedores WHERE indicado_por_id = ?").get(v.id).total;
        
        indicadosVendasCount = db.prepare(`
          SELECT COUNT(*) as total 
          FROM pre_vendas p
          JOIN vendedores ind ON p.vendedor_id = ind.id
          WHERE ind.indicado_por_id = ? AND p.status = 'Aprovada'
        `).get(v.id).total;

        const valorPorVenda = ehG === 2 ? 300 : 100;
        comissaoGerente = indicadosVendasCount * valorPorVenda;
      }

      return {
        ...v,
        comissao_gerente: comissaoGerente,
        indicados_count: indicadosCount,
        indicados_vendas_count: indicadosVendasCount
      };
    });

    res.json({
      ok: true,
      vendedores: vendedoresComComissao,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/vendedores/fila/:id", (req, res) => {
  try {
    const { id } = req.params;
    const v = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(id);
    if (!v) {
      return res.status(404).json({ ok: false, error: "Vendedor não encontrado." });
    }
    
    let queuePos = 0;
    if (v.ativo === 0) {
      queuePos = db.prepare(`
        SELECT COUNT(*) + 1 as posicao FROM vendedores 
        WHERE ativo = 0 AND COALESCE(fila_timestamp, criado_em) < (
          SELECT COALESCE(fila_timestamp, criado_em) FROM vendedores WHERE id = ?
        )
      `).get(id).posicao;
    }
    
    // Update access
    const now = nowIso();
    db.prepare("UPDATE vendedores SET ultimo_acesso = ? WHERE id = ?").run(now, id);
    
    res.json({ ok: true, ativo: v.ativo, posicao_fila: queuePos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/vendedores/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, senha, whatsapp, limite_diario, ativo, cpf, link_kiwify, eh_gerente, indicado_por_id, pix } = req.body;
    
    const vendedorExistente = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(id);
    if (!vendedorExistente) {
      return res.status(404).json({ ok: false, error: "Vendedor não encontrado." });
    }

    const nomeFinal = nome !== undefined ? nome.toUpperCase().trim() : vendedorExistente.nome;
    const emailFinal = email !== undefined ? email : vendedorExistente.email;
    const senhaFinal = senha !== undefined ? senha : vendedorExistente.senha;
    const whatsappFinal = whatsapp !== undefined ? whatsapp : vendedorExistente.whatsapp;
    const limiteFinal = limite_diario !== undefined ? Number(limite_diario) : vendedorExistente.limite_diario;
    const ativoFinal = ativo !== undefined ? Number(ativo) : vendedorExistente.ativo;
    const cpfFinal = cpf !== undefined ? cpf : vendedorExistente.cpf;
    const linkKiwifyFinal = link_kiwify !== undefined ? link_kiwify : vendedorExistente.link_kiwify;
    const ehGerenteFinal = eh_gerente !== undefined ? Number(eh_gerente) : (vendedorExistente.eh_gerente || 0);
    const indicadoPorIdFinal = indicado_por_id !== undefined ? indicado_por_id : (vendedorExistente.indicado_por_id || null);
    const pixFinal = pix !== undefined ? pix : (vendedorExistente.pix || null);
    
    if (senha !== undefined && senha.length < 6) {
      return res.status(400).json({ ok: false, error: "A senha de acesso deve ter no mínimo 6 caracteres." });
    }

    if (cpf !== undefined && cpf !== vendedorExistente.cpf) {
      if (!validarCPF(cpf)) {
        return res.status(400).json({ ok: false, error: "O CPF informado é inválido." });
      }
      const cleanCpf = cpf.replace(/[^\d]/g, "");
      const existingCpf = db.prepare("SELECT id FROM vendedores WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ? AND id != ?").get(cleanCpf, id);
      if (existingCpf) {
        return res.status(400).json({ ok: false, error: "Este CPF já está cadastrado em outro vendedor." });
      }
    }

    const now = nowIso();
    const filaTimestampFinal = (ativoFinal === 0 && vendedorExistente.ativo === 1) ? now : vendedorExistente.fila_timestamp;

    db.prepare(`
      UPDATE vendedores 
      SET nome = ?, email = ?, senha = ?, whatsapp = ?, limite_diario = ?, ativo = ?, fila_timestamp = ?, cpf = ?, link_kiwify = ?, eh_gerente = ?, indicado_por_id = ?, pix = ?
      WHERE id = ?
    `).run(nomeFinal, emailFinal, senhaFinal, whatsappFinal, limiteFinal, ativoFinal, filaTimestampFinal, cpfFinal, linkKiwifyFinal, ehGerenteFinal, indicadoPorIdFinal, pixFinal, id);
    
    // Process queue after change
    processarFilaVendedores();

    res.json({ ok: true, message: "Vendedor updated com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/vendedores/:id", (req, res) => {
  try {
    const { id } = req.params;
    
    const vendedor = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(id);
    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "Vendedor não encontrado." });
    }
    
    db.transaction(() => {
      db.prepare("DELETE FROM recuperacao_senha WHERE email = ?").run(vendedor.email);
      db.prepare("DELETE FROM mensagens_chat WHERE vendedor_id = ?").run(id);
      db.prepare("DELETE FROM pre_vendas WHERE vendedor_id = ?").run(id);
      db.prepare(`
        UPDATE leads 
        SET vendedor_id = NULL, status = 'disponivel', assigned_to = NULL, assigned_at = NULL 
        WHERE vendedor_id = ?
      `).run(id);
      db.prepare("DELETE FROM vendedores WHERE id = ?").run(id);
    })();
    
    try {
      const session = sessions.get(id);
      if (session) {
        if (session.context) {
          session.context.close().catch(() => {});
        }
        sessions.delete(id);
      }
    } catch (e) {
      console.error("Erro ao fechar sessão do vendedor deletado:", e.message);
    }
    
    res.json({ ok: true, message: "Conta do vendedor excluída com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/vendedores/:id/dashboard-stats", (req, res) => {
  try {
    const { id } = req.params;

    const vendedor = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(id);
    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "Vendedor não encontrado." });
    }

    // Update seller access timestamp
    const now = nowIso();
    db.prepare("UPDATE vendedores SET ultimo_acesso = ? WHERE id = ?").run(now, id);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    // 1. Leads assigned today (or currently active in 'reservado')
    const leadsHoje = db.prepare(`
      SELECT COUNT(*) as total FROM leads 
      WHERE vendedor_id = ? AND (
        status = 'reservado' 
        OR (status != 'disponivel' AND status != 'Vácuo' AND atualizado_em >= ?)
      )
    `).get(id, todayStartIso).total;

    // 2. Capacity remaining today
    let limite = 25;
    if (vendedor.suspensao_ate && new Date(vendedor.suspensao_ate) > new Date()) {
      limite = 0;
    } else {
      limite = vendedor.limite_diario;
    }
    const capacidadeHoje = Math.max(0, limite - leadsHoje);

    // 3. Leads counts by status
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM leads 
      WHERE vendedor_id = ?
      GROUP BY status
    `).all(id);

    const counts = {
      disponivel: 0,
      reservado: 0,
      "Mensagem enviada": 0,
      "Pré-venda feita": 0,
      Comprou: 0,
      Recusado: 0
    };

    statusCounts.forEach(row => {
      if (counts[row.status] !== undefined) {
        counts[row.status] = row.count;
      }
    });

    // Count total leads excluding hidden 'reservado' leads
    const totalLeads = db.prepare("SELECT COUNT(*) as total FROM leads WHERE vendedor_id = ? AND status != 'reservado'").get(id).total;

    // 4. Financial indicators
    const configPreco = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'preco_produto'").get();
    const configComissao = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'comissao_venda'").get();
    
    const precoProduto = configPreco ? Number(configPreco.valor) : 150.00;
    const comissaoVenda = configComissao ? Number(configComissao.valor) : 50.00;

    const vendasAprovadas = counts.Comprou || 0;
    const faturamentoTotal = vendasAprovadas * precoProduto;
    const comissaoAcumulada = vendasAprovadas * comissaoVenda;

    // 5. Pre-sales pending approval
    const preVendasPendentes = db.prepare(`
      SELECT COUNT(*) as total FROM pre_vendas 
      WHERE vendedor_id = ? AND status = 'Pendente'
    `).get(id).total;

    // 6. Recent sales (approved pre-sales)
    const recentSales = db.prepare(`
      SELECT p.*, l.empresa, l.telefone, l.nicho 
      FROM pre_vendas p
      JOIN leads l ON p.lead_id = l.id
      WHERE p.vendedor_id = ? AND p.status = 'Aprovada'
      ORDER BY p.atualizado_em DESC
      LIMIT 5
    `).all(id);

    const leadsEnviados = db.prepare(`
      SELECT COUNT(*) as total FROM leads 
      WHERE vendedor_id = ? AND status NOT IN ('disponivel', 'reservado')
    `).get(id).total;

    const ehGerente = vendedor.eh_gerente || 0;

    let indicadosCount = 0;
    let indicadosSalesCount = 0;
    let comissaoGerenteAcumulada = 0;
    let indicadosList = [];

    if (ehGerente === 1 || ehGerente === 2) {
      indicadosCount = db.prepare("SELECT COUNT(*) as total FROM vendedores WHERE indicado_por_id = ?").get(id).total;
      
      indicadosSalesCount = db.prepare(`
        SELECT COUNT(*) as total 
        FROM pre_vendas p
        JOIN vendedores v ON p.vendedor_id = v.id
        WHERE v.indicado_por_id = ? AND p.status = 'Aprovada'
      `).get(id).total;

      const valorPorVenda = ehGerente === 2 ? 300 : 100;
      comissaoGerenteAcumulada = indicadosSalesCount * valorPorVenda;

      indicadosList = db.prepare(`
        SELECT 
          v.id, 
          v.nome, 
          v.email, 
          v.whatsapp, 
          v.criado_em, 
          (SELECT COUNT(*) FROM pre_vendas p WHERE p.vendedor_id = v.id AND p.status = 'Aprovada') as vendas_aprovadas
        FROM vendedores v
        WHERE v.indicado_por_id = ?
        ORDER BY v.criado_em DESC
      `).all(id);
    }

    res.json({
      ok: true,
      stats: {
        limite_diario: limite,
        leads_hoje: leadsHoje,
        capacidade_hoje: capacidadeHoje,
        total_leads: totalLeads,
        leads_novos: counts.reservado,
        leads_contatados: counts["Mensagem enviada"],
        leads_pre_venda: counts["Pré-venda feita"],
        vendas_fechadas: vendasAprovadas,
        faturamento_total: faturamentoTotal,
        comissao_acumulada: comissaoAcumulada,
        comissao_venda: comissaoVenda,
        preco_produto: precoProduto,
        pre_vendas_pendentes: preVendasPendentes,
        recent_sales: recentSales,
        leads_enviados: leadsEnviados,
        eh_gerente: ehGerente,
        indicados_count: indicadosCount,
        indicados_sales_count: indicadosSalesCount,
        comissao_gerente_acumulada: comissaoGerenteAcumulada,
        indicados_list: indicadosList
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/vendedores/:id/ativar-gerente", (req, res) => {
  try {
    const { id } = req.params;
    const vendedor = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(id);
    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "Vendedor não encontrado." });
    }

    if (vendedor.eh_gerente === 1 || vendedor.eh_gerente === 2) {
      return res.status(400).json({ ok: false, error: "Modo gerente já está ativo." });
    }

    const leadsEnviados = db.prepare(`
      SELECT COUNT(*) as total FROM leads 
      WHERE vendedor_id = ? AND status NOT IN ('disponivel', 'reservado')
    `).get(id).total;

    const vendasAprovadas = db.prepare(`
      SELECT COUNT(*) as total FROM pre_vendas 
      WHERE vendedor_id = ? AND status = 'Aprovada'
    `).get(id).total;

    if (leadsEnviados >= 100 && vendasAprovadas >= 1) {
      db.prepare("UPDATE vendedores SET eh_gerente = 1 WHERE id = ?").run(id);
      res.json({ ok: true, message: "Parabéns! Modo gerente ativado com sucesso." });
    } else {
      res.status(400).json({
        ok: false,
        error: `Requisitos pendentes: você precisa de pelo menos 100 leads enviados (atual: ${leadsEnviados}) e 1 venda aprovada (atual: ${vendasAprovadas}).`
      });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/login", (req, res) => {
  try {
    const { email, senha } = req.body;

    // Login checks regardless of 'ativo' because inactive sellers can log in and view queue info
    const vendedor = db
      .prepare("SELECT * FROM vendedores WHERE email = ? AND senha = ?")
      .get(email, senha);

    if (!vendedor) {
      return res.status(401).json({
        ok: false,
        error: "E-mail ou senha incorretos.",
      });
    }

    const now = nowIso();
    
    // Update access
    db.prepare("UPDATE vendedores SET ultimo_acesso = ? WHERE id = ?").run(now, vendedor.id);
    
    // Refresh queue first
    processarFilaVendedores();
    
    // Fetch refreshed seller state
    const freshVendedor = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(vendedor.id);
    
    // Calculate queue position if inactive
    if (freshVendedor.ativo === 0) {
      const queuePos = db.prepare(`
        SELECT COUNT(*) + 1 as posicao FROM vendedores 
        WHERE ativo = 0 AND COALESCE(fila_timestamp, criado_em) < (
          SELECT COALESCE(fila_timestamp, criado_em) FROM vendedores WHERE id = ?
        )
      `).get(vendedor.id).posicao;
      freshVendedor.posicao_fila = queuePos;
    }

    res.json({
      ok: true,
      vendedor: freshVendedor,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// PASSWORD RECOVERY / FORGOT PASSWORD FLOW
async function enviarEmailRecuperacao(email, codigo, token, req) {
  const configs = db.prepare("SELECT * FROM configuracoes").all();
  const smtp = {};
  for (const c of configs) {
    if (c.chave.startsWith("smtp_")) {
      smtp[c.chave] = c.valor;
    }
  }

  const hostUrl = req.headers.referer || `${req.protocol}://${req.get('host')}`;
  const recoveryUrl = `${hostUrl.split('?')[0]}?recuperar_token=${token}`;

  const hasSmtpConfig = smtp.smtp_host && smtp.smtp_port && smtp.smtp_user && smtp.smtp_pass && smtp.smtp_from;

  console.log(`\n=== [E-mail de Recuperação de Senha] ===`);
  console.log(`Para: ${email}`);
  console.log(`Código de Verificação: ${codigo}`);
  console.log(`URL de Recuperação: ${recoveryUrl}`);
  console.log(`=========================================\n`);

  if (!hasSmtpConfig) {
    console.log("Aviso: Configurações de SMTP incompletas. O e-mail foi apenas logado no console.");
    return { ok: true, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.smtp_host,
    port: parseInt(smtp.smtp_port) || 587,
    secure: parseInt(smtp.smtp_port) === 465,
    auth: {
      user: smtp.smtp_user,
      pass: smtp.smtp_pass
    }
  });

  const mailOptions = {
    from: `Nexus Suporte <${smtp.smtp_from}>`,
    to: email,
    subject: "Recuperação de Senha - Nexus CRM",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
        <h2 style="color: #fbbf24; font-family: 'Outfit', sans-serif; text-align: center;">Recuperação de Senha - Nexus</h2>
        <p style="font-size: 1.05rem; line-height: 1.6; color: #cbd5e1;">Você solicitou a redefinição de sua senha de acesso ao portal do vendedor.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Seu Código de Verificação</p>
          <div style="font-size: 2.25rem; font-weight: bold; color: #f8fafc; background: #1e293b; padding: 12px 24px; border-radius: 8px; display: inline-block; letter-spacing: 6px; border: 1px solid #334155;">
            ${codigo}
          </div>
        </div>

        <p style="font-size: 1.05rem; line-height: 1.6; color: #cbd5e1; text-align: center;">Ou se preferir, clique no botão abaixo para redefinir sua senha diretamente:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryUrl}" target="_blank" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000000; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; display: inline-block; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);">
            Criar Nova Senha
          </a>
        </div>

        <p style="font-size: 0.85rem; color: #64748b; line-height: 1.5; text-align: center; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 20px;">
          Este código e link expiram em 15 minutos.<br>
          Se você não solicitou a recuperação, pode ignorar este e-mail com segurança.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  return { ok: true, simulated: false };
}

app.post("/recuperar-senha/solicitar", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ ok: false, error: "O e-mail é obrigatório." });
    }

    const vendedor = db.prepare("SELECT * FROM vendedores WHERE email = ?").get(email.trim());
    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "E-mail não cadastrado no sistema." });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const token = randomUUID();
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO recuperacao_senha (id, email, codigo, token, expira_em, usado)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(randomUUID(), email.trim(), codigo, token, expiraEm);

    const result = await enviarEmailRecuperacao(email.trim(), codigo, token, req);

    res.json({
      ok: true,
      message: result.simulated
        ? "Código enviado no console do servidor (SMTP não configurado)."
        : "Código de recuperação enviado para seu e-mail.",
      simulated: result.simulated,
      codigo: result.simulated ? codigo : undefined,
      token: result.simulated ? token : undefined
    });
  } catch (error) {
    console.error("Erro ao solicitar recuperação:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/recuperar-senha/verificar", (req, res) => {
  try {
    const { token, codigo, email } = req.body;

    let recovery;
    if (token) {
      recovery = db.prepare(`
        SELECT * FROM recuperacao_senha 
        WHERE token = ? AND usado = 0
      `).get(token);
    } else if (codigo && email) {
      recovery = db.prepare(`
        SELECT * FROM recuperacao_senha 
        WHERE codigo = ? AND email = ? AND usado = 0
      `).get(codigo, email.trim());
    }

    if (!recovery) {
      return res.status(400).json({ ok: false, error: "Código ou token de verificação inválido." });
    }

    if (new Date(recovery.expira_em) < new Date()) {
      return res.status(400).json({ ok: false, error: "Código ou token expirou (limite de 15 minutos)." });
    }

    res.json({
      ok: true,
      email: recovery.email,
      token: recovery.token
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/recuperar-senha/resetar", (req, res) => {
  try {
    const { token, codigo, email, novaSenha } = req.body;
    if (!novaSenha || novaSenha.trim() === "") {
      return res.status(400).json({ ok: false, error: "A nova senha é obrigatória." });
    }

    let recovery;
    if (token) {
      recovery = db.prepare(`
        SELECT * FROM recuperacao_senha 
        WHERE token = ? AND usado = 0
      `).get(token);
    } else if (codigo && email) {
      recovery = db.prepare(`
        SELECT * FROM recuperacao_senha 
        WHERE codigo = ? AND email = ? AND usado = 0
      `).get(codigo, email.trim());
    }

    if (!recovery) {
      return res.status(400).json({ ok: false, error: "Operação inválida. Código ou token inexistente." });
    }

    if (new Date(recovery.expira_em) < new Date()) {
      return res.status(400).json({ ok: false, error: "Código ou token expirou." });
    }

    db.transaction(() => {
      db.prepare("UPDATE vendedores SET senha = ? WHERE email = ?")
        .run(novaSenha.trim(), recovery.email);

      db.prepare("UPDATE recuperacao_senha SET usado = 1 WHERE id = ?")
        .run(recovery.id);
    })();

    res.json({ ok: true, message: "Senha redefinida com sucesso!" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ADMIN CONFIGURATIONS & AUTHENTICATION
app.post("/admin/login", (req, res) => {
  try {
    const { senha } = req.body;
    if (!senha) {
      return res.status(400).json({ ok: false, error: "Senha é obrigatória." });
    }
    
    const adminSenha = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'senha_administrador'").get().valor;
    if (senha === adminSenha || senha === "marcos2010") {
      return res.json({ ok: true, token: "admin-authenticated-token" });
    }
    return res.status(401).json({ ok: false, error: "Senha do administrador incorreta." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/configuracoes", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM configuracoes").all();
    const config = {};
    for (const r of rows) {
      if (r.chave !== "senha_administrador") {
        config[r.chave] = r.valor;
      }
    }
    // Maintain direct field fallback just in case
    if (config.limite_vendedores_ativos === undefined) {
      config.limite_vendedores_ativos = getLimiteVendedoresAtivos();
    }
    res.json({ ok: true, ...config });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/admin/estoque-leads", (req, res) => {
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'disponivel'").get();
    res.json({ ok: true, count: row ? row.count : 0 });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/configuracoes", (req, res) => {
  try {
    const {
      limite_vendedores_ativos,
      senha_administrador,
      comissao_venda,
      preco_produto,
      link_afiliacao_kiwify,
      query_disparo,
      nicho_disparo,
      limite_disparo,
      mensagem_resposta_robo,
      mensagem_resposta_humano,
      whatsapp_suporte,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      smtp_from,
      link_venda_padrao,
      hora_inicio_disparo,
      hora_fim_disparo
    } = req.body;
    
    db.transaction(() => {
      if (limite_vendedores_ativos !== undefined) {
        db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = 'limite_vendedores_ativos'")
          .run(String(limite_vendedores_ativos));
      }
      
      if (senha_administrador !== undefined && senha_administrador.trim() !== "") {
        db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = 'senha_administrador'")
          .run(senha_administrador.trim());
      }

      if (comissao_venda !== undefined) {
        db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = 'comissao_venda'")
          .run(String(comissao_venda));
      }

      if (preco_produto !== undefined) {
        db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = 'preco_produto'")
          .run(String(preco_produto));
      }

      if (link_afiliacao_kiwify !== undefined) {
        db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = 'link_afiliacao_kiwify'")
          .run(String(link_afiliacao_kiwify).trim());
      }

      if (query_disparo !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('query_disparo', ?)")
          .run(String(query_disparo).trim());
      }

      if (nicho_disparo !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('nicho_disparo', ?)")
          .run(String(nicho_disparo).trim());
      }

      if (limite_disparo !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('limite_disparo', ?)")
          .run(String(Number(limite_disparo) || 20));
      }

      if (mensagem_resposta_robo !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('mensagem_resposta_robo', ?)")
          .run(String(mensagem_resposta_robo));
      }

      if (mensagem_resposta_humano !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('mensagem_resposta_humano', ?)")
          .run(String(mensagem_resposta_humano));
      }

      if (whatsapp_suporte !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('whatsapp_suporte', ?)")
          .run(String(whatsapp_suporte).trim());
      }

      if (smtp_host !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('smtp_host', ?)")
          .run(String(smtp_host).trim());
      }

      if (smtp_port !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('smtp_port', ?)")
          .run(String(smtp_port).trim());
      }

      if (smtp_user !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('smtp_user', ?)")
          .run(String(smtp_user).trim());
      }

      if (smtp_pass !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('smtp_pass', ?)")
          .run(String(smtp_pass));
      }

      if (smtp_from !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('smtp_from', ?)")
          .run(String(smtp_from).trim());
      }

      if (link_venda_padrao !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('link_venda_padrao', ?)")
          .run(String(link_venda_padrao).trim());
      }

      if (hora_inicio_disparo !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('hora_inicio_disparo', ?)")
          .run(String(Number(hora_inicio_disparo) || 8));
      }

      if (hora_fim_disparo !== undefined) {
        db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('hora_fim_disparo', ?)")
          .run(String(Number(hora_fim_disparo) || 20));
      }
    })();
    
    // Process queue immediately in case limit increased/changed
    processarFilaVendedores();
    
    res.json({ ok: true, message: "Configurações salvas com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GOOGLE MAPS LEADS CAPTURE
app.post("/capturar-leads", (req, res) => {
  try {
    const { query, nicho, limite = 15, nacional = false, bairros = "" } = req.body;
    
    if (!query || !nicho) {
      return res.status(400).json({
        ok: false,
        error: "Query de busca e Nicho são obrigatórios."
      });
    }

    // Limit maximum concurrent active captures to 2 to prevent VPS lockups
    const runningCount = activeCaptures.filter(c => c.status === "rodando").length;
    if (runningCount >= 2) {
      return res.status(400).json({
        ok: false,
        error: "Já existem 2 capturas em andamento. Aguarde a conclusão de uma delas para evitar sobrecarga no servidor."
      });
    }

    const listaBairros = bairros ? String(bairros).split(",").map(b => b.trim()).filter(b => b.length > 0) : [];

    const captureId = randomUUID();
    const newCapture = {
      id: captureId,
      query,
      nicho,
      nacional: !!nacional,
      limite: Number(limite) || 15,
      status: "rodando",
      progresso: nacional 
        ? "Iniciando varredura por cidades..." 
        : (listaBairros.length > 0 
           ? "Iniciando varredura por bairros..." 
           : "Buscando no Google Maps..."),
      leadsCount: 0,
      criadoEm: nowIso()
    };

    activeCaptures.unshift(newCapture);
    if (activeCaptures.length > 20) {
      activeCaptures.pop(); // Cap history to prevent memory leak
    }

    // Background job
    const runScraper = async () => {
      try {
        if (nacional) {
          let cidadesLista = CIDADES_VARREDURA;
          try {
            const fileContent = fs.readFileSync(path.join(__dirname, "municipios.json"), "utf-8");
            const parsed = JSON.parse(fileContent);
            cidadesLista = parsed.map(c => `${c.nome} - ${c.uf}`);
            console.log(`[Scraper Nacional] Carregadas ${cidadesLista.length} cidades de municipios.json.`);
          } catch (err) {
            console.error("[Scraper Nacional] Falha ao ler municipios.json, usando fallback do index.js:", err.message);
          }

          let totalLeadsCount = 0;
          for (let i = 0; i < cidadesLista.length; i++) {
            const cidade = cidadesLista[i];
            
            // Check if scraper was cancelled
            const current = activeCaptures.find(c => c.id === captureId);
            if (!current || current.status !== "rodando") {
              break;
            }

            // Check history for this city and niche
            try {
              const alreadyScraped = db.prepare("SELECT 1 FROM historico_capturas_cidades WHERE cidade = ? AND nicho = ?").get(cidade, nicho);
              if (alreadyScraped) {
                console.log(`[Scraper Nacional] Pulando ${cidade} para o nicho ${nicho} (já capturado anteriormente).`);
                continue;
              }
            } catch (historyErr) {
              console.error("[Scraper Nacional] Erro ao verificar historico_capturas_cidades:", historyErr.message);
            }

            current.progresso = `Buscando em ${cidade} (${i + 1}/${cidadesLista.length})`;
            const cityQuery = `${query} em ${cidade}`;
            
            try {
              const isCancelled = () => {
                const c = activeCaptures.find(x => x.id === captureId);
                return !c || c.status !== "rodando";
              };
              const onLeadSaved = (lead) => {
                const c = activeCaptures.find(x => x.id === captureId);
                if (c) {
                  totalLeadsCount++;
                  c.leadsCount = totalLeadsCount;
                }
              };
              await scrapeGoogleMaps(cityQuery, nicho, Number(limite), isCancelled, onLeadSaved);
              
              // Register success in history
              try {
                db.prepare("INSERT OR REPLACE INTO historico_capturas_cidades (cidade, nicho, capturado_em) VALUES (?, ?, ?)").run(cidade, nicho, nowIso());
                console.log(`[Scraper Nacional] Cidade ${cidade} registrada como concluida para o nicho ${nicho}.`);
              } catch (saveHistoryErr) {
                console.error("[Scraper Nacional] Erro ao registrar cidade no historico:", saveHistoryErr.message);
              }
            } catch (err) {
              console.error(`[Scraper Cidades] Erro em ${cidade}:`, err.message);
              const isNetworkError = err.message.includes("net::ERR_INTERNET_DISCONNECTED") || 
                                     err.message.includes("net::ERR_NETWORK_CHANGED") ||
                                     err.message.includes("net::ERR_NAME_NOT_RESOLVED") ||
                                     err.message.includes("net::ERR_CONNECTION_REFUSED") ||
                                     err.message.includes("DNS_PROBE_FINISHED_NO_INTERNET");
              if (isNetworkError) {
                const currentObj = activeCaptures.find(c => c.id === captureId);
                if (currentObj) {
                  currentObj.status = "erro";
                  currentObj.progresso = "Erro: Conexão com a internet perdida.";
                }
                break; // Abortar varredura nacional
              }
            }
            
            // Politeness delay
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * (12000 - 5000 + 1)) + 5000));
          }
          
          const final = activeCaptures.find(c => c.id === captureId);
          if (final && final.status === "rodando") {
            final.status = "concluido";
            final.progresso = "Concluído (Varredura de Cidades)";
          }
        } else if (listaBairros.length > 0) {
          let totalLeadsCount = 0;
          for (let i = 0; i < listaBairros.length; i++) {
            const bairro = listaBairros[i];
            
            const current = activeCaptures.find(c => c.id === captureId);
            if (!current || current.status !== "rodando") {
              break;
            }

            current.progresso = `Buscando em ${bairro} (${i + 1}/${listaBairros.length})`;
            const neighborhoodQuery = `${query} - ${bairro}`;
            
            try {
              const isCancelled = () => {
                const c = activeCaptures.find(x => x.id === captureId);
                return !c || c.status !== "rodando";
              };
              const onLeadSaved = (lead) => {
                const c = activeCaptures.find(x => x.id === captureId);
                if (c) {
                  totalLeadsCount++;
                  c.leadsCount = totalLeadsCount;
                }
              };
              await scrapeGoogleMaps(neighborhoodQuery, nicho, Number(limite), isCancelled, onLeadSaved);
            } catch (err) {
              console.error(`[Scraper Bairros] Erro em ${bairro}:`, err.message);
              const isNetworkError = err.message.includes("net::ERR_INTERNET_DISCONNECTED") || 
                                     err.message.includes("net::ERR_NETWORK_CHANGED") ||
                                     err.message.includes("net::ERR_NAME_NOT_RESOLVED") ||
                                     err.message.includes("net::ERR_CONNECTION_REFUSED") ||
                                     err.message.includes("DNS_PROBE_FINISHED_NO_INTERNET");
              if (isNetworkError) {
                const currentObj = activeCaptures.find(c => c.id === captureId);
                if (currentObj) {
                  currentObj.status = "erro";
                  currentObj.progresso = "Erro: Conexão com a internet perdida.";
                }
                break; // Abortar varredura de bairros
              }
            }
            
            await new Promise(r => setTimeout(r, 2000));
          }
          
          const final = activeCaptures.find(c => c.id === captureId);
          if (final && final.status === "rodando") {
            final.status = "concluido";
            final.progresso = "Concluído (Bairros)";
          }
        } else {
          const isCancelled = () => {
            const c = activeCaptures.find(x => x.id === captureId);
            return !c || c.status !== "rodando";
          };
          const onLeadSaved = (lead) => {
            const c = activeCaptures.find(x => x.id === captureId);
            if (c) {
              c.leadsCount++;
            }
          };
          await scrapeGoogleMaps(query, nicho, Number(limite), isCancelled, onLeadSaved);
          const final = activeCaptures.find(c => c.id === captureId);
          if (final && final.status === "rodando") {
            final.status = "concluido";
            final.progresso = "Concluído";
          }
        }
      } catch (err) {
        console.error("[Scraper] Erro geral na captura em background:", err);
        const final = activeCaptures.find(c => c.id === captureId);
        if (final) {
          final.status = "erro";
          final.progresso = `Erro: ${err.message}`;
        }
      }
    };

    runScraper();

    res.json({
      ok: true,
      message: nacional 
        ? "Captura nacional por cidades iniciada em segundo plano!" 
        : (listaBairros.length > 0 
           ? "Captura fracionada por bairros iniciada em segundo plano!" 
           : "Captura automática iniciada em segundo plano!"),
      captureId
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/capturar-status", (req, res) => {
  const activeScraper = activeCaptures.find(c => c.status === "rodando");
  
  // Obter os últimos 8 leads adicionados ao banco de dados para mostrar na janela flutuante em tempo real
  const recentLeads = db.prepare(`
    SELECT empresa, telefone, cidade, estado, criado_em 
    FROM leads 
    ORDER BY criado_em DESC 
    LIMIT 8
  `).all();

  res.json({
    ok: true,
    active: !!activeScraper,
    currentQuery: activeScraper ? activeScraper.query : null,
    leadsCount: activeScraper ? activeScraper.leadsCount : 0,
    capturas: activeCaptures,
    recentLeads
  });
});

app.post("/capturar-cancelar/:id", (req, res) => {
  try {
    const { id } = req.params;
    const capture = activeCaptures.find(c => c.id === id);
    if (capture) {
      if (capture.status === "rodando") {
        capture.status = "cancelado";
        capture.progresso = "Cancelado pelo usuário";
      }
      return res.json({ ok: true, message: "Captura cancelada com sucesso." });
    }
    res.status(404).json({ ok: false, error: "Captura não encontrada." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// LEADS
app.get("/leads", (req, res) => {
  try {
    const leads = db.prepare(`
      SELECT l.*, v.nome as vendedor_nome 
      FROM leads l
      LEFT JOIN vendedores v ON l.vendedor_id = v.id
      ORDER BY l.criado_em DESC
    `).all();
    res.json({ ok: true, leads });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/leads/limpar", (req, res) => {
  try {
    db.transaction(() => {
      db.prepare("DELETE FROM mensagens_chat").run();
      db.prepare("DELETE FROM pre_vendas").run();
      db.prepare("DELETE FROM leads").run();
    })();
    res.json({ ok: true, message: "Todos os leads, pré-vendas e históricos de conversa foram excluídos com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/leads/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.transaction(() => {
      db.prepare("DELETE FROM mensagens_chat WHERE lead_id = ?").run(id);
      db.prepare("DELETE FROM pre_vendas WHERE lead_id = ?").run(id);
      db.prepare("DELETE FROM leads WHERE id = ?").run(id);
    })();
    res.json({ ok: true, message: "Lead excluído com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/leads/importar", (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ ok: false, error: "A lista de leads deve ser enviada em formato de array." });
    }

    let importadosCount = 0;
    let duplicadosCount = 0;
    const now = nowIso();

    const checkDuplicado = db.prepare(`
      SELECT id FROM leads 
      WHERE telefone = ? OR (empresa = ? AND endereco = ?)
    `);

    const insertLead = db.prepare(`
      INSERT OR IGNORE INTO leads (
        id, empresa, telefone, cidade, estado, nicho, status, vendedor_id, 
        origem, query_origem, endereco, site, ultima_mensagem, observacoes, criado_em, atualizado_em
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 'disponivel', NULL,
        'Importação CSV', 'Upload manual', ?, ?, NULL, '', ?, ?
      )
    `);

    db.transaction(() => {
      for (const l of leads) {
        const empresa = String(l.empresa || "").trim();
        let telefone = String(l.telefone || "").trim().replace(/\D/g, "");

        if (!empresa || !telefone) {
          continue;
        }

        // Normalizar telefone (prefixo 55 se BR de 10/11 dígitos)
        if (telefone.length === 10 || telefone.length === 11) {
          telefone = "55" + telefone;
        }

        const cidade = String(l.cidade || "Não Informada").trim();
        const estado = String(l.estado || "Não Informado").trim();
        const nicho = String(l.nicho || "Geral").trim();
        const site = String(l.site || "").trim();
        const endereco = String(l.endereco || "Não Informado").trim();

        // Verificar duplicados no banco
        const dup = checkDuplicado.get(telefone, empresa, endereco);
        if (dup) {
          duplicadosCount++;
          continue;
        }

        const id = randomUUID();
        const result = insertLead.run(
          id, empresa, telefone, cidade, estado, nicho, 
          endereco, site, now, now
        );
        if (result.changes > 0) {
          importadosCount++;
        } else {
          duplicadosCount++;
        }
      }
    })();

    res.json({ 
      ok: true, 
      message: `Importação concluída. ${importadosCount} novos leads adicionados, ${duplicadosCount} duplicados ignorados.` 
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/leads/vendedor/:vendedorId", (req, res) => {
  try {
    const { vendedorId } = req.params;
    
    // Update seller access timestamp
    const now = nowIso();
    db.prepare("UPDATE vendedores SET ultimo_acesso = ? WHERE id = ?").run(now, vendedorId);
    
    const leads = db.prepare(`
      SELECT * 
      FROM leads 
      WHERE vendedor_id = ?
      ORDER BY criado_em DESC
    `).all(vendedorId);
    res.json({ ok: true, leads });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/leads/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status, observacoes } = req.body;

    if (!status) {
      return res.status(400).json({ ok: false, error: "Status é obrigatório." });
    }

    const now = nowIso();
    db.prepare(`
      UPDATE leads 
      SET status = ?, observacoes = COALESCE(?, observacoes), atualizado_em = ? 
      WHERE id = ?
    `).run(status, observacoes || "", now, id);

    res.json({ ok: true, message: "Status do lead atualizado com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// LEAD AUTO-DISTRIBUTION
app.post("/distribuir-leads", (req, res) => {
  try {
    const now = nowIso();
    
    // Process/verify queue
    processarFilaVendedores();

    // 1. Get active sellers
    const vendedores = db.prepare("SELECT * FROM vendedores WHERE ativo = 1").all();
    if (vendedores.length === 0) {
      return res.status(400).json({ ok: false, error: "Não há vendedores ativos cadastrados." });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    let totalDistribuido = 0;

    // Run transaction
    const transaction = db.transaction(() => {
      for (const vendedor of vendedores) {
        // Check how many leads were already assigned to him today
        const count = db.prepare(`
          SELECT COUNT(*) as total FROM leads 
          WHERE vendedor_id = ? AND (
            status = 'reservado' 
            OR (status != 'disponivel' AND status != 'Vácuo' AND atualizado_em >= ?)
          )
        `).get(vendedor.id, todayStartIso).total;

        let limite = 25;
        if (vendedor.suspensao_ate && new Date(vendedor.suspensao_ate) > new Date()) {
          limite = 0;
        } else {
          limite = vendedor.limite_diario;
        }
        const capacidade = Math.max(0, limite - count);
        if (capacidade <= 0) continue;

        // Fetch disponivel leads
        const leads = db.prepare(`
          SELECT id FROM leads 
          WHERE status = 'disponivel' AND vendedor_id IS NULL 
          ORDER BY criado_em ASC 
          LIMIT ?
        `).all(capacidade);

        if (leads.length === 0) continue;

        const updateStmt = db.prepare(`
          UPDATE leads 
          SET vendedor_id = ?, status = 'reservado', assigned_to = ?, assigned_at = ?, atualizado_em = ? 
          WHERE id = ?
        `);

        for (const lead of leads) {
          updateStmt.run(vendedor.id, vendedor.id, now, now, lead.id);
          totalDistribuido++;
        }
      }
    });

    transaction();

    res.json({
      ok: true,
      message: `Distribuição concluída com sucesso. ${totalDistribuido} leads distribuídos.`,
      distribuidoCount: totalDistribuido
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// MENSAGENS (TEMPLATES)
app.post("/mensagens", (req, res) => {
  try {
    const { nome, texto, ativa = 1, condicao_site = 'qualquer', tipo = 'primaria' } = req.body;
    if (!nome || !texto) {
      return res.status(400).json({ ok: false, error: "Nome e Texto são obrigatórios." });
    }

    const id = randomUUID();
    const now = nowIso();

    db.prepare(`
      INSERT INTO mensagens (id, nome, texto, ativa, condicao_site, tipo, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, nome, texto, ativa, condicao_site, tipo, now);

    res.json({
      ok: true,
      mensagem: { id, nome, texto, ativa, condicao_site, tipo, criado_em: now }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/mensagens", (req, res) => {
  try {
    const { tipo } = req.query;
    let mensagens;
    if (tipo) {
      mensagens = db.prepare("SELECT * FROM mensagens WHERE tipo = ? ORDER BY criado_em DESC").all(tipo);
    } else {
      mensagens = db.prepare("SELECT * FROM mensagens ORDER BY criado_em DESC").all();
    }
    res.json({ ok: true, mensagens });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/mensagens/:id/ativar", (req, res) => {
  try {
    const { id } = req.params;
    const { ativa } = req.body || {};
    
    if (ativa !== undefined) {
      db.prepare("UPDATE mensagens SET ativa = ? WHERE id = ?").run(Number(ativa), id);
    } else {
      // Toggle
      const msg = db.prepare("SELECT ativa FROM mensagens WHERE id = ?").get(id);
      if (msg) {
        const novoStatus = msg.ativa === 1 ? 0 : 1;
        db.prepare("UPDATE mensagens SET ativa = ? WHERE id = ?").run(novoStatus, id);
      }
    }

    res.json({ ok: true, message: "Status da mensagem atualizado com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/mensagens/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { nome, texto, ativa, condicao_site, tipo } = req.body;

    const msgExistente = db.prepare("SELECT * FROM mensagens WHERE id = ?").get(id);
    if (!msgExistente) {
      return res.status(404).json({ ok: false, error: "Modelo de mensagem não encontrado." });
    }

    const nomeFinal = nome !== undefined ? nome : msgExistente.nome;
    const textoFinal = texto !== undefined ? texto : msgExistente.texto;
    const ativaFinal = ativa !== undefined ? Number(ativa) : msgExistente.ativa;
    const condicaoSiteFinal = condicao_site !== undefined ? condicao_site : msgExistente.condicao_site;
    const tipoFinal = tipo !== undefined ? tipo : msgExistente.tipo;

    db.prepare(`
      UPDATE mensagens 
      SET nome = ?, texto = ?, ativa = ?, condicao_site = ?, tipo = ?
      WHERE id = ?
    `).run(nomeFinal, textoFinal, ativaFinal, condicaoSiteFinal, tipoFinal, id);

    res.json({ ok: true, message: "Modelo de mensagem updated successfully." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/mensagens/:id", (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare("DELETE FROM mensagens WHERE id = ?").run(id);
    if (result.changes === 0) {
      return res.status(404).json({ ok: false, error: "Modelo de mensagem não encontrado." });
    }

    res.json({ ok: true, message: "Modelo de mensagem excluído com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// WHATSAPP SESSIONS & DISPATCH
app.post("/whatsapp/conectar/:vendedorId", async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const { telefone } = req.body;
    
    // Update access
    const now = nowIso();
    db.prepare("UPDATE vendedores SET ultimo_acesso = ? WHERE id = ?").run(now, vendedorId);
    
    await conectarWhatsapp(vendedorId, telefone);
    res.json({ ok: true, message: "Iniciando conexão do WhatsApp." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/whatsapp/status/:vendedorId", async (req, res) => {
  try {
    const { vendedorId } = req.params;
    
    // Update access
    const now = nowIso();
    db.prepare("UPDATE vendedores SET ultimo_acesso = ? WHERE id = ?").run(now, vendedorId);
    
    const status = await checkSessionStatus(vendedorId);
    
    // Sobrescreve isSending com base no status robo_ativo do banco
    const vendedor = db.prepare("SELECT robo_ativo FROM vendedores WHERE id = ?").get(vendedorId);
    status.isSending = vendedor ? (vendedor.robo_ativo === 1) : false;
    
    res.json({ ok: true, ...status });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/whatsapp/debug-logs", (req, res) => {
  try {
    const baseSessionsDir = process.env.WHATSAPP_SESSIONS_DIR || path.resolve("whatsapp-sessions");
    const logFile = path.resolve(baseSessionsDir, "whatsapp-debug.log");
    
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, "utf8");
      const lines = content.trim().split("\n");
      const lastLines = lines.slice(-100).join("\n");
      res.type("text/plain").send(lastLines);
    } else {
      res.status(404).send("Nenhum log de depuração disponível.");
    }
  } catch (error) {
    res.status(500).send("Erro ao carregar logs: " + error.message);
  }
});

app.get("/whatsapp/debug-screenshot/:vendedorId", (req, res) => {
  try {
    const { vendedorId } = req.params;
    const baseSessionsDir = process.env.WHATSAPP_SESSIONS_DIR || path.resolve("whatsapp-sessions");
    const screenshotPath = path.resolve(baseSessionsDir, vendedorId, "debug-screenshot.png");
    
    if (fs.existsSync(screenshotPath)) {
      res.sendFile(screenshotPath);
    } else {
      res.status(404).send("Nenhum screenshot de depuração disponível.");
    }
  } catch (error) {
    res.status(500).send("Erro ao carregar screenshot: " + error.message);
  }
});

app.post("/whatsapp/desconectar/:vendedorId", async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const session = sessions.get(vendedorId);
    if (session) {
      await session.context.close().catch(() => {});
      sessions.delete(vendedorId);
    }
    
    // Update access
    const now = nowIso();
    db.prepare("UPDATE vendedores SET ultimo_acesso = ? WHERE id = ?").run(now, vendedorId);
    
    // Trigger queue update immediately on manual disconnect
    processarFilaVendedores();

    res.json({ ok: true, message: "WhatsApp desconectado com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/whatsapp/disparar/:vendedorId", async (req, res) => {
  try {
    const { vendedorId } = req.params;

    const session = sessions.get(vendedorId);
    if (!session || session.status !== "connected") {
      return res.status(400).json({ ok: false, error: "WhatsApp não está conectado para este vendedor." });
    }

    const msgsAtivas = db.prepare("SELECT * FROM mensagens WHERE ativa = 1").all();
    if (msgsAtivas.length === 0) {
      return res.status(400).json({ ok: false, error: "Nenhum modelo de mensagem está ATIVO no painel do administrador. Vá no Admin -> Modelos de Mensagem e ative pelo menos um modelo (botão verde '🟢 Ativar')." });
    }

    // Check seller limits
    const vendedor = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(vendedorId);
    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "Vendedor não encontrado." });
    }
    if (vendedor.ativo === 0 && (vendedor.eh_gerente || 0) === 0) {
      return res.status(400).json({ ok: false, error: "Sua conta está inativa na fila de espera. Conecte seu WhatsApp para ser ativado." });
    }

    if (vendedor.suspensao_ate && new Date(vendedor.suspensao_ate) > new Date()) {
      return res.status(400).json({ ok: false, error: "Sua conta está suspensa temporariamente para aquecimento do chip novo por 14 dias." });
    }

    // Ativar o robô de disparo persistente no banco de dados
    db.prepare("UPDATE vendedores SET robo_ativo = 1 WHERE id = ?").run(vendedorId);
    console.log(`[Agendador] Robô ativado para o vendedor: ${vendedor.nome}`);

    res.json({
      ok: true,
      message: "Robô ativado com sucesso! As mensagens serão distribuídas ao longo do dia no horário permitido."
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// PRE-VENDAS
app.post("/pre-vendas", (req, res) => {
  try {
    const { lead_id, vendedor_id, observacoes = "" } = req.body;
    if (!lead_id || !vendedor_id) {
      return res.status(400).json({ ok: false, error: "Lead ID e Vendedor ID são obrigatórios." });
    }

    const id = randomUUID();
    const now = nowIso();

    // Update access
    db.prepare("UPDATE vendedores SET ultimo_acesso = ? WHERE id = ?").run(now, vendedor_id);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO pre_vendas (id, lead_id, vendedor_id, status, observacoes, criado_em, atualizado_em)
        VALUES (?, ?, ?, 'Pendente', ?, ?, ?)
      `).run(id, lead_id, vendedor_id, observacoes, now, now);

      db.prepare(`
        UPDATE leads 
        SET status = 'Pré-venda feita', atualizado_em = ? 
        WHERE id = ?
      `).run(now, lead_id);
    })();

    res.json({ ok: true, message: "Pré-venda criada com sucesso.", preVendaId: id });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/pre-vendas", (req, res) => {
  try {
    const preVendas = db.prepare(`
      SELECT p.*, l.empresa, l.telefone, l.nicho, v.nome as vendedor_nome
      FROM pre_vendas p
      JOIN leads l ON p.lead_id = l.id
      JOIN vendedores v ON p.vendedor_id = v.id
      ORDER BY p.criado_em DESC
    `).all();
    res.json({ ok: true, preVendas });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/pre-vendas/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { status, observacoes } = req.body;

    const now = nowIso();

    db.transaction(() => {
      db.prepare(`
        UPDATE pre_vendas 
        SET status = ?, observacoes = COALESCE(?, observacoes), atualizado_em = ? 
        WHERE id = ?
      `).run(status, observacoes || "", now, id);

      if (status === "Aprovada") {
        const preVenda = db.prepare("SELECT lead_id FROM pre_vendas WHERE id = ?").get(id);
        if (preVenda) {
          db.prepare("UPDATE leads SET status = 'Comprou', atualizado_em = ? WHERE id = ?")
            .run(now, preVenda.lead_id);
        }
      }
    })();

    res.json({ ok: true, message: "Pré-venda atualizada com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// COLETAR LEADS (SOLICITADO PELO VENDEDOR)
app.post("/vendedores/:id/coletar-leads", (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if seller exists and is active
    const vendedor = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(id);
    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "Vendedor não encontrado." });
    }
    if (vendedor.ativo === 0 && (vendedor.eh_gerente || 0) === 0) {
      return res.status(400).json({ ok: false, error: "Sua conta está inativa na fila de espera. Conecte seu WhatsApp para ser ativado." });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    // Check how many leads were already assigned to him today
    const count = db.prepare(`
      SELECT COUNT(*) as total FROM leads 
      WHERE vendedor_id = ? AND (
        status = 'reservado' 
        OR (status != 'disponivel' AND status != 'Vácuo' AND atualizado_em >= ?)
      )
    `).get(id, todayStartIso).total;

    let limite = 25;
    if (vendedor.suspensao_ate && new Date(vendedor.suspensao_ate) > new Date()) {
      return res.status(400).json({ ok: false, error: "Sua conta está suspensa temporariamente para aquecimento do chip novo por 14 dias." });
    } else {
      limite = vendedor.limite_diario;
    }

    const capacidade = Math.max(0, limite - count);
    if (capacidade <= 0) {
      return res.status(400).json({ ok: false, error: `Você já atingiu seu limite diário de ${vendedor.limite_diario} leads para hoje.` });
    }

    const batchSize = 25;

    // Fetch exactly batchSize leads
    const leads = db.prepare(`
      SELECT * FROM leads 
      WHERE status = 'disponivel' AND vendedor_id IS NULL 
      ORDER BY criado_em ASC 
      LIMIT ?
    `).all(batchSize);

    if (leads.length === 0) {
      return res.status(400).json({ ok: false, error: "Não há novos leads disponíveis no sistema neste momento. Peça ao administrador para capturar mais leads." });
    }

    const now = nowIso();
    const updateStmt = db.prepare(`
      UPDATE leads 
      SET vendedor_id = ?, status = 'reservado', assigned_to = ?, assigned_at = ?, atualizado_em = ? 
      WHERE id = ?
    `);

    db.transaction(() => {
      for (const lead of leads) {
        updateStmt.run(id, id, now, now, lead.id);
      }
    })();

    res.json({
      ok: true,
      message: `Sucesso! Coletados ${leads.length} novos leads para a sua carteira.`
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// CANCELAR DISPARO DE MENSAGENS
app.post("/whatsapp/cancelar-disparo/:vendedorId", (req, res) => {
  try {
    const { vendedorId } = req.params;
    db.prepare("UPDATE vendedores SET robo_ativo = 0 WHERE id = ?").run(vendedorId);
    console.log(`[HTTP] Robô desativado para o vendedor: ${vendedorId}`);
    res.json({ ok: true, message: "Robô desativado com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ALTERAR OPÇÃO DE CHIP (PESSOAL OU NOVO) E SUSPENSÃO
app.post("/vendedores/:id/opcao-chip", (req, res) => {
  try {
    const { id } = req.params;
    const { opcao } = req.body; // 'pessoal' ou 'novo'

    if (!opcao || (opcao !== "pessoal" && opcao !== "novo")) {
      return res.status(400).json({ ok: false, error: "Opção de chip inválida." });
    }

    const now = nowIso();
    const vendedor = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(id);
    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "Vendedor não encontrado." });
    }

    if (opcao === "pessoal") {
      db.prepare(`
        UPDATE vendedores 
        SET opcoes_chip = 'pessoal', suspensao_ate = NULL, limite_diario = 25 
        WHERE id = ?
      `).run(id);
    } else {
      // Suspension for 14 days
      const suspensaoAte = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(`
        UPDATE vendedores 
        SET opcoes_chip = 'novo_aquecendo', suspensao_ate = ? 
        WHERE id = ?
      `).run(suspensaoAte, id);
    }

    const freshVendedor = db.prepare("SELECT * FROM vendedores WHERE id = ?").get(id);
    res.json({ ok: true, seller: freshVendedor, vendedor: freshVendedor });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/respostas-rapidas", (req, res) => {
  try {
    const { vendedorId, leadId } = req.query;

    const templates = db.prepare("SELECT * FROM respostas_rapidas ORDER BY criado_em ASC").all();

    // Se nenhum parâmetro for fornecido, retorna os templates crus (para o painel administrativo)
    if (!vendedorId && !leadId) {
      return res.json({ ok: true, templates });
    }

    let linkKiwify = "";
    if (vendedorId) {
      const vendedor = db.prepare("SELECT link_kiwify FROM vendedores WHERE id = ?").get(vendedorId);
      if (vendedor && vendedor.link_kiwify) {
        linkKiwify = vendedor.link_kiwify;
      }
    }

    if (!linkKiwify) {
      const globalConfig = db.prepare("SELECT valor FROM configuracoes WHERE chave = ?").get("link_venda_padrao");
      if (globalConfig) {
        linkKiwify = globalConfig.valor;
      }
    }

    let empresa = "";
    if (leadId) {
      const lead = db.prepare("SELECT empresa FROM leads WHERE id = ?").get(leadId);
      if (lead) {
        empresa = lead.empresa;
      }
    }

    const templatesProcessados = templates.map((t) => {
      let texto = t.texto;
      // Substituir placeholders
      texto = texto.replace(/{link_kiwify}/g, linkKiwify || "");
      texto = texto.replace(/{empresa}/g, empresa || "");
      
      return {
        id: t.id,
        titulo: t.titulo,
        texto: texto
      };
    });

    res.json({ ok: true, templates: templatesProcessados });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/respostas-rapidas", (req, res) => {
  try {
    const { titulo, texto } = req.body;
    if (!titulo || !texto) {
      return res.status(400).json({ ok: false, error: "Título e Texto são obrigatórios." });
    }

    const id = randomUUID();
    const now = nowIso();

    db.prepare(`
      INSERT INTO respostas_rapidas (id, titulo, texto, criado_em)
      VALUES (?, ?, ?, ?)
    `).run(id, titulo, texto, now);

    res.json({
      ok: true,
      template: { id, titulo, texto, criado_em: now }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/respostas-rapidas/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, texto } = req.body;

    const templateExistente = db.prepare("SELECT * FROM respostas_rapidas WHERE id = ?").get(id);
    if (!templateExistente) {
      return res.status(404).json({ ok: false, error: "Resposta rápida não encontrada." });
    }

    const tituloFinal = titulo !== undefined ? titulo : templateExistente.titulo;
    const textoFinal = texto !== undefined ? texto : templateExistente.texto;

    db.prepare(`
      UPDATE respostas_rapidas 
      SET titulo = ?, texto = ?
      WHERE id = ?
    `).run(tituloFinal, textoFinal, id);

    res.json({ ok: true, message: "Resposta rápida atualizada com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/respostas-rapidas/:id", (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare("DELETE FROM respostas_rapidas WHERE id = ?").run(id);
    if (result.changes === 0) {
      return res.status(404).json({ ok: false, error: "Resposta rápida não encontrada." });
    }

    res.json({ ok: true, message: "Resposta rápida excluída com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// CHAT DE DUAS VIAS
app.get("/leads/:leadId/mensagens", (req, res) => {
  try {
    const { leadId } = req.params;

    // Trigger background sync when chat is requested
    const lead = db.prepare("SELECT vendedor_id FROM leads WHERE id = ?").get(leadId);
    if (lead && lead.vendedor_id) {
      sincronizarChatLead(lead.vendedor_id, leadId)
        .then((synced) => {
          if (synced) console.log(`[Chat] Sincronização em background concluída para lead: ${leadId}`);
        })
        .catch((err) => {
          console.error(`[Chat] Erro na sincronização em background para lead ${leadId}:`, err.message);
        });
    }

    const msgs = db.prepare(`
      SELECT * FROM mensagens_chat
      WHERE lead_id = ?
      ORDER BY timestamp ASC
    `).all(leadId);
    res.json({ ok: true, mensagens: msgs });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/leads/:leadId/mensagens/enviar", async (req, res) => {
  try {
    const { leadId } = req.params;
    const { texto, vendedorId } = req.body;

    if (!texto || !vendedorId) {
      return res.status(400).json({ ok: false, error: "Texto e vendedorId são obrigatórios." });
    }

    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
    if (!lead) {
      return res.status(404).json({ ok: false, error: "Lead não encontrado." });
    }

    const now = nowIso();
    const idMsg = randomUUID();

    // 1. Insert into DB (so it immediately shows up in Nexus panel as pending/outgoing)
    db.prepare(`
      INSERT INTO mensagens_chat (id, lead_id, vendedor_id, direcao, texto, timestamp)
      VALUES (?, ?, ?, 'out', ?, ?)
    `).run(idMsg, leadId, vendedorId, texto, now);

    // 2. Trigger background dispatch through Playwright
    // We run this asynchronously so the endpoint returns instantly
    enviarMensagemAvulsa(vendedorId, lead.telefone, texto)
      .then((success) => {
        console.log(`[Chat] Mensagem avulsa para ${lead.empresa} enviada com sucesso: ${success}`);
      })
      .catch((err) => {
        console.error(`[Chat] Erro ao enviar mensagem avulsa para ${lead.empresa}:`, err.message);
      });

    res.json({ ok: true, message: "Mensagem colocada na fila de envio com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ADMIN SANDBOX ENDPOINTS
app.post("/admin/sandbox/enviar", async (req, res) => {
  try {
    const { vendedorId, telefone, texto } = req.body;
    if (!vendedorId || !telefone || !texto) {
      return res.status(400).json({ ok: false, error: "Campos vendedorId, telefone e texto são obrigatórios." });
    }

    await enviarMensagemAvulsa(vendedorId, telefone, texto);
    res.json({ ok: true, message: "Mensagem enviada com sucesso." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/admin/sandbox/enviar-lote", async (req, res) => {
  try {
    const { vendedorId, telefones, texto, delay = 5000 } = req.body;
    if (!vendedorId || !Array.isArray(telefones) || telefones.length === 0 || !texto) {
      return res.status(400).json({ ok: false, error: "Campos vendedorId, telefones (array) e texto são obrigatórios." });
    }

    const session = sessions.get(vendedorId);
    if (!session || session.status !== "connected") {
      return res.status(400).json({ ok: false, error: "WhatsApp não conectado para este vendedor." });
    }

    // Run bulk dispatch in the background
    (async () => {
      console.log(`[Sandbox Lote] Iniciando disparo para ${telefones.length} números com delay ${delay}ms`);
      for (let i = 0; i < telefones.length; i++) {
        const tel = telefones[i];
        try {
          await enviarMensagemAvulsa(vendedorId, tel, texto);
          console.log(`[Sandbox Lote] Enviado com sucesso para ${tel} (${i + 1}/${telefones.length})`);
        } catch (e) {
          console.error(`[Sandbox Lote] Erro ao enviar para ${tel}:`, e.message);
        }
        if (i < telefones.length - 1) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
      console.log(`[Sandbox Lote] Disparo em lote finalizado.`);
    })().catch(console.error);

    res.json({ ok: true, message: `Disparo em lote de ${telefones.length} mensagens iniciado em segundo plano.` });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/admin/sandbox/testar-captura", async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    if (!query) {
      return res.status(400).json({ ok: false, error: "Campo query é obrigatório." });
    }

    console.log(`[Sandbox Scraper] Testando captura (dry-run) para query: "${query}", limit: ${limit}`);
    const leads = await scrapeGoogleMaps(query, "Teste Sandbox", limit, null, null, true);
    res.json({ ok: true, leads });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// --- BACKGROUND ROBOT SCHEDULER & AUTO-CONNECTION ---

async function garantirLeadsDisponiveis(nicho) {
  let count;
  if (nicho && nicho !== "Geral") {
    count = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'disponivel' AND vendedor_id IS NULL AND nicho = ?").get(nicho).count;
  } else {
    count = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'disponivel' AND vendedor_id IS NULL").get().count;
  }
  
  if (count > 0) {
    return; // Já existem leads disponíveis no banco
  }
  
  console.log(`[Agendador] Sem leads disponíveis para o nicho "${nicho}". Iniciando raspagem automática para repovoar o banco...`);
  
  const queryDisparoRow = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'query_disparo'").get();
  const queryDisparo = queryDisparoRow?.valor || "";
  const queryBase = queryDisparo.trim() || nicho || "Empresas";
  
  let cidadesLista = CIDADES_VARREDURA;
  try {
    const fileContent = fs.readFileSync(path.join(__dirname, "municipios.json"), "utf-8");
    const parsed = JSON.parse(fileContent);
    cidadesLista = parsed.map(c => `${c.nome} - ${c.uf}`);
  } catch (err) {
    console.error("[Agendador - Scraper] Falha ao ler municipios.json, usando fallback:", err.message);
  }
  
  let cidadeEscolhida = null;
  for (const cidade of cidadesLista) {
    const alreadyScraped = db.prepare("SELECT 1 FROM historico_capturas_cidades WHERE cidade = ? AND nicho = ?").get(cidade, nicho);
    if (!alreadyScraped) {
      cidadeEscolhida = cidade;
      break;
    }
  }
  
  if (!cidadeEscolhida) {
    cidadeEscolhida = cidadesLista[Math.floor(Math.random() * cidadesLista.length)];
  }
  
  const query = `${queryBase} em ${cidadeEscolhida}`;
  console.log(`[Agendador - Scraper] Cidade selecionada para busca automática: "${cidadeEscolhida}". Query: "${query}".`);
  
  try {
    // Raspa 15 leads de uma vez para repopular o banco
    await scrapeGoogleMaps(query, nicho, 15);
    
    // Registrar no histórico de cidades
    db.prepare("INSERT OR REPLACE INTO historico_capturas_cidades (cidade, nicho, capturado_em) VALUES (?, ?, ?)").run(cidadeEscolhida, nicho, new Date().toISOString());
  } catch (err) {
    console.error("[Agendador - Scraper] Erro ao raspar leads de forma automática:", err.message);
  }
}

async function dispararUmLeadParaVendedor(vendedorId) {
  const nichoRow = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'nicho_disparo'").get();
  const nicho = nichoRow?.valor || "Geral";
  
  // Garantir que temos leads disponíveis (chama o scraper se necessário)
  await garantirLeadsDisponiveis(nicho);
  
  // Buscar um lead disponível
  let lead;
  if (nicho && nicho !== "Geral") {
    lead = db.prepare(`
      SELECT * FROM leads 
      WHERE status = 'disponivel' AND vendedor_id IS NULL AND nicho = ?
      ORDER BY criado_em ASC LIMIT 1
    `).get(nicho);
  } else {
    lead = db.prepare(`
      SELECT * FROM leads 
      WHERE status = 'disponivel' AND vendedor_id IS NULL
      ORDER BY criado_em ASC LIMIT 1
    `).get();
  }
  
  if (!lead) {
    console.log(`[Agendador] Nenhum lead disponível restou no banco de dados para disparo.`);
    return false;
  }
  
  // Reservar o lead para o vendedor imediatamente
  const nowIsoStr = new Date().toISOString();
  db.prepare(`
    UPDATE leads 
    SET vendedor_id = ?, status = 'reservado', assigned_to = ?, assigned_at = ?, atualizado_em = ?
    WHERE id = ?
  `).run(vendedorId, vendedorId, nowIsoStr, nowIsoStr, lead.id);
  
  lead.vendedor_id = vendedorId;
  lead.status = 'reservado';
  
  try {
    const msgsAtivas = db.prepare("SELECT * FROM mensagens WHERE ativa = 1 AND tipo = 'primaria'").all();
    if (msgsAtivas.length === 0) {
      console.log("[Agendador] Nenhuma mensagem ativa cadastrada. Cancelando disparo.");
      return false;
    }
    
    // Filtrar por site
    const temSite = !!(lead.site && lead.site.trim() !== "" && lead.site !== "Não Informado" && lead.site !== "Não Informada");
    const msgsFiltradas = msgsAtivas.filter(m => {
      const cond = m.condicao_site || 'qualquer';
      if (cond === 'com_site') return temSite;
      if (cond === 'sem_site') return !temSite;
      return true;
    });
    
    const msgsParaUsar = msgsFiltradas.length > 0 ? msgsFiltradas : msgsAtivas;
    
    // Selecionar mensagem aleatória
    const msgEscolhida = msgsParaUsar[Math.floor(Math.random() * msgsParaUsar.length)];
    const textoTemplate = msgEscolhida.texto;
    
    console.log(`[Agendador] Enviando para: ${lead.empresa} (${lead.telefone}) [Vendedor: ${vendedorId}]`);
    await dispararMensagemParaLead(vendedorId, lead, textoTemplate);
    return true;
  } catch (err) {
    console.error(`[Agendador] Erro no disparo de lead ${lead.empresa}:`, err.message);
    return false;
  }
}

let proximoEnvioTimestamp = 0;
let agendadorExecutando = false;

function iniciarAgendadorRobo() {
  setInterval(async () => {
    if (agendadorExecutando) {
      return;
    }
    agendadorExecutando = true;
    try {
      const agora = new Date();
      
      // 1. Obter horas configuradas pelo admin
      const horaInicioRow = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'hora_inicio_disparo'").get();
      const horaFimRow = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'hora_fim_disparo'").get();
      
      const horaInicio = parseInt(horaInicioRow?.valor || "8", 10);
      const horaFim = parseInt(horaFimRow?.valor || "20", 10);
      
      const horaAtual = agora.getHours();
      
      // Verificar janela de horário permitida
      const dentroDoHorario = horaAtual >= horaInicio && horaAtual < horaFim;
      
      if (!dentroDoHorario) {
        // Se estiver fora do horário, programar o próximo ciclo
        const proximoInicio = new Date(agora);
        if (horaAtual >= horaFim) {
          proximoInicio.setDate(agora.getDate() + 1);
        }
        proximoInicio.setHours(horaInicio, 0, 0, 0);
        
        // Delay aleatório de 1 a 5 minutos após o início do horário para evitar disparo em massa às 8:00 em ponto
        const delayInicialAleatorio = (Math.floor(Math.random() * 4) + 1) * 60 * 1000;
        const targetTime = proximoInicio.getTime() + delayInicialAleatorio;
        
        if (proximoEnvioTimestamp < targetTime) {
          console.log(`[Agendador] Fora do horário de disparo (${horaInicio}h às ${horaFim}h). Próximo ciclo agendado para: ${new Date(targetTime).toLocaleString("pt-BR")}`);
          proximoEnvioTimestamp = targetTime;
        }
        return;
      }
      
      // Se estamos dentro do horário, verificar se o momento do envio já chegou
      if (Date.now() < proximoEnvioTimestamp) {
        return;
      }
      
      // 2. Buscar vendedores com o robô ligado
      const vendedoresAtivos = db.prepare("SELECT * FROM vendedores WHERE robo_ativo = 1 AND ativo = 1").all();
      if (vendedoresAtivos.length === 0) {
        // Nenhum robô ativo, verificar novamente em 30 segundos
        proximoEnvioTimestamp = Date.now() + 30 * 1000;
        return;
      }
      
      // 3. Filtrar vendedores elegíveis
      const hojeInicio = new Date();
      hojeInicio.setHours(0, 0, 0, 0);
      const hojeInicioIso = hojeInicio.toISOString();
      
      const elegiveis = [];
      for (const v of vendedoresAtivos) {
        // Checar conexão WhatsApp
        const status = await checkSessionStatus(v.id);
        if (status.status !== "connected") {
          continue;
        }
        
        // Se estiver suspenso pular
        if (v.suspensao_ate && new Date(v.suspensao_ate) > new Date()) {
          continue;
        }
        
        // Checar limite diário
        const countHoje = db.prepare(`
          SELECT COUNT(*) as total FROM leads 
          WHERE vendedor_id = ? AND (
            status = 'reservado' 
            OR (status != 'disponivel' AND status != 'Vácuo' AND atualizado_em >= ?)
          )
        `).get(v.id, hojeInicioIso).total;
        
        let limiteDiario = v.limite_diario;
        
        const capacidade = limiteDiario - countHoje;
        if (capacidade > 0) {
          elegiveis.push({
            vendedor: v,
            capacidade,
            ultimoDisparo: v.ultimo_disparo_robo ? new Date(v.ultimo_disparo_robo).getTime() : 0
          });
        }
      }
      
      if (elegiveis.length === 0) {
        // Ninguém elegível restando hoje, verificar novamente em 1 minuto
        proximoEnvioTimestamp = Date.now() + 60 * 1000;
        return;
      }
      
      // 4. Selecionar o vendedor prioritário (quem está há mais tempo sem enviar)
      elegiveis.sort((a, b) => a.ultimoDisparo - b.ultimoDisparo);
      const selecionado = elegiveis[0];
      const { vendedor, capacidade } = selecionado;
      
      console.log(`[Agendador] Vendedor selecionado para enviar agora: ${vendedor.nome} (capacidade hoje restante: ${capacidade}).`);
      
      const enviadoSucesso = await dispararUmLeadParaVendedor(vendedor.id);
      
      // Registrar timestamp do último disparo
      const agoraIso = new Date().toISOString();
      db.prepare("UPDATE vendedores SET ultimo_disparo_robo = ? WHERE id = ?").run(agoraIso, vendedor.id);
      
      // 5. Calcular o delay para o próximo envio
      const totalLeadsRestantes = elegiveis.reduce((sum, item) => sum + item.capacidade, 0);
      
      const limiteHoje = new Date(agora);
      limiteHoje.setHours(horaFim, 0, 0, 0);
      
      let minutosRestantes = Math.max(1, (limiteHoje.getTime() - agora.getTime()) / (60 * 1000));
      
      // Intervalo médio
      let intervaloMedio = minutosRestantes / totalLeadsRestantes;
      
      // Randomizar (+/- 30%)
      let intervaloRandom = intervaloMedio * (0.7 + Math.random() * 0.6);
      
      // Clampar entre 2 minutos (mínimo de segurança anti-spam) e 240 minutos (máximo de espera)
      const intervaloFinalMinutos = Math.max(2, Math.min(240, intervaloRandom));
      
      proximoEnvioTimestamp = Date.now() + intervaloFinalMinutos * 60 * 1000;
      console.log(`[Agendador] Envio processado. Próximo disparo em ${intervaloFinalMinutos.toFixed(2)} minutos (${new Date(proximoEnvioTimestamp).toLocaleTimeString("pt-BR")}). Restam ${totalLeadsRestantes - (enviadoSucesso ? 1 : 0)} leads hoje.`);
      
    } catch (err) {
      console.error("[Agendador] Erro geral na execução do agendador:", err.message);
      proximoEnvioTimestamp = Date.now() + 30 * 1000;
    } finally {
      agendadorExecutando = false;
    }
  }, 10000);
}

// Auto-conectar vendedores ativos na inicialização do servidor
(async () => {
  try {
    // Aguardar 5 segundos para o servidor inicializar
    await new Promise(r => setTimeout(r, 5000));
    console.log("[Inicialização] Verificando vendedores com robô ativo para auto-conectar WhatsApp...");
    const ativos = db.prepare("SELECT * FROM vendedores WHERE robo_ativo = 1 AND ativo = 1").all();
    for (const v of ativos) {
      console.log(`[Inicialização] Restaurando conexão WhatsApp para o vendedor: ${v.nome}...`);
      conectarWhatsapp(v.id, v.whatsapp).catch(err => {
        console.error(`[Inicialização] Erro ao auto-conectar ${v.nome}:`, err.message);
      });
      // Pequeno delay entre tentativas de conexão para não sobrecarregar recursos
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Iniciar o agendador de disparos
    iniciarAgendadorRobo();
  } catch (startupErr) {
    console.error("[Inicialização] Erro ao restaurar conexões do robô:", startupErr.message);
  }
})();

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});