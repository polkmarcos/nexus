import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, "crm-vendedores.db");

// Ensure parent directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS vendedores (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    whatsapp TEXT,
    limite_diario INTEGER DEFAULT 25,
    ativo INTEGER DEFAULT 1,
    ultimo_acesso TEXT,
    fila_timestamp TEXT,
    cpf TEXT,
    link_kiwify TEXT,
    indicado_por_id TEXT,
    eh_gerente INTEGER DEFAULT 0,
    criado_em TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    empresa TEXT NOT NULL,
    telefone TEXT,
    cidade TEXT,
    estado TEXT,
    nicho TEXT NOT NULL,
    status TEXT DEFAULT 'disponivel',
    vendedor_id TEXT,
    assigned_to TEXT,
    assigned_at TEXT,
    origem TEXT,
    query_origem TEXT,
    endereco TEXT,
    site TEXT,
    ultima_mensagem TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id)
  );

  CREATE TABLE IF NOT EXISTS mensagens (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    texto TEXT NOT NULL,
    ativa INTEGER DEFAULT 1,
    condicao_site TEXT DEFAULT 'qualquer',
    criado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pre_vendas (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    vendedor_id TEXT NOT NULL,
    status TEXT DEFAULT 'Pendente',
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id)
  );

  CREATE TABLE IF NOT EXISTS mensagens_chat (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    vendedor_id TEXT NOT NULL,
    direcao TEXT NOT NULL,
    texto TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    timestamp_wa TEXT,
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id)
  );

  CREATE TABLE IF NOT EXISTS respostas_rapidas (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    texto TEXT NOT NULL,
    criado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS historico_capturas_cidades (
    cidade TEXT NOT NULL,
    nicho TEXT NOT NULL,
    capturado_em TEXT NOT NULL,
    PRIMARY KEY (cidade, nicho)
  );

  CREATE TABLE IF NOT EXISTS recuperacao_senha (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    codigo TEXT NOT NULL,
    token TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    usado INTEGER DEFAULT 0
  );
`);

// Safe migrations for existing databases

// Clean up duplicate leads (keeping the first one) before creating unique index
try {
  const duplicates = db.prepare(`
    SELECT id FROM leads 
    WHERE telefone IS NOT NULL AND telefone != '' AND id NOT IN (
      SELECT MIN(id) 
      FROM leads 
      WHERE telefone IS NOT NULL AND telefone != ''
      GROUP BY telefone
    )
  `).all();
  
  if (duplicates.length > 0) {
    console.log(`[Database Migration] Encontrados ${duplicates.length} leads duplicados. Limpando...`);
    const deleteChat = db.prepare("DELETE FROM mensagens_chat WHERE lead_id = ?");
    const deletePreVendas = db.prepare("DELETE FROM pre_vendas WHERE lead_id = ?");
    const deleteLead = db.prepare("DELETE FROM leads WHERE id = ?");
    
    db.transaction(() => {
      for (const d of duplicates) {
        deleteChat.run(d.id);
        deletePreVendas.run(d.id);
        deleteLead.run(d.id);
      }
    })();
    console.log("[Database Migration] Limpeza de leads duplicados concluída!");
  }
} catch (e) {
  console.error("Erro ao limpar leads duplicados:", e.message);
}

// Create unique index on leads(telefone)
try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_telefone ON leads (telefone) WHERE telefone IS NOT NULL AND telefone != '';");
} catch (e) {
  console.error("Erro ao criar índice único:", e.message);
}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN ultimo_acesso TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN fila_timestamp TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN cpf TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN link_kiwify TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN opcoes_chip TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN suspensao_ate TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN indicado_por_id TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN eh_gerente INTEGER DEFAULT 0;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN pix TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN robo_ativo INTEGER DEFAULT 0;");
} catch (_) {}

try {
  db.exec("ALTER TABLE vendedores ADD COLUMN ultimo_disparo_robo TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE leads ADD COLUMN assigned_to TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE leads ADD COLUMN assigned_at TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE mensagens ADD COLUMN condicao_site TEXT DEFAULT 'qualquer';");
} catch (_) {}



try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);
} catch (_) {}

// Insert default configuration values
try {
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('limite_vendedores_ativos', '100')
  `).run();
  db.prepare(`
    INSERT OR REPLACE INTO configuracoes (chave, valor)
    VALUES ('senha_administrador', 'marcos2010')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('comissao_venda', '50.00')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('preco_produto', '150.00')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('link_afiliacao_kiwify', 'https://dashboard.kiwify.com.br/affiliate/join/exemplo')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('query_disparo', 'hamburguerias em São Paulo')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('nicho_disparo', 'hamburguerias')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('limite_disparo', '20')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('mensagem_resposta_robo', 'Obrigado pelo retorno! Percebi que vocês têm um atendimento automático. Gostaria de falar diretamente com o responsável para apresentar uma solução que pode aumentar muito as vendas de vocês. Qual o melhor horário para conversar?')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('mensagem_resposta_humano', 'Olá! Que ótimo que você viu nossa mensagem! 😊 Tenho uma proposta especial que pode fazer uma grande diferença no seu negócio. Posso te mostrar rapidinho como funciona?')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('whatsapp_suporte', '')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('smtp_host', '')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('smtp_port', '')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('smtp_user', '')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('smtp_pass', '')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('smtp_from', '')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('link_venda_padrao', '')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('hora_inicio_disparo', '8')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor)
    VALUES ('hora_fim_disparo', '20')
  `).run();
} catch (e) {
  console.error("Erro ao inserir configs padrão:", e.message);
}

// Seed default quick-reply templates (respostas_rapidas)
try {
  const count = db.prepare("SELECT COUNT(*) as count FROM respostas_rapidas").get().count;
  if (count === 0) {
    const templates = [
      {
        titulo: "Link de Pagamento",
        texto: "Excelente! Para adquirir o seu site e colocar seu delivery no ar com a demonstração personalizada, acesse o link de pagamento seguro: {link_kiwify}"
      },
      {
        titulo: "Quanto Custa",
        texto: "A criação e configuração do seu site próprio completo, otimizado e personalizado para delivery custa apenas R$ 150,00 pagamento único (sem mensalidades)."
      },
      {
        titulo: "Como Funciona",
        texto: "O pagamento é realizado de forma segura via Pix ou Cartão de Crédito através da nossa plataforma parceira. Assim que aprovado, nosso time configura tudo e seu site fica online em até 24 horas."
      },
      {
        titulo: "Benefícios do Site",
        texto: "Tendo seu site próprio otimizado, você não paga taxas abusivas para apps de delivery, recebe os pedidos organizados no seu WhatsApp e passa muito mais profissionalismo para os seus clientes!"
      },
      {
        titulo: "Demonstração Pronta",
        texto: "Fiz um rascunho de demonstração de como o seu site pode ficar, totalmente adaptado para celulares. Gostaria de dar uma olhada rápida?"
      }
    ];
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO respostas_rapidas (id, titulo, texto, criado_em)
      VALUES (?, ?, ?, ?)
    `);
    
    db.transaction(() => {
      for (const t of templates) {
        insert.run(randomUUID(), t.titulo, t.texto, now);
      }
    })();
    console.log("Templates de respostas rápidas inseridos com sucesso!");
  }
} catch (e) {
  console.error("Erro ao inserir respostas rápidas padrão:", e.message);
}

// Migrate legacy lead statuses
try {
  const resNovo = db.prepare("UPDATE leads SET status = 'disponivel' WHERE status = 'Novo'").run();
  if (resNovo.changes > 0) {
    console.log(`[Database Migration] Migrados ${resNovo.changes} leads de 'Novo' para 'disponivel'.`);
  }
} catch (e) {
  console.error("Erro ao migrar status 'Novo':", e.message);
}

try {
  const resDist = db.prepare("UPDATE leads SET status = 'reservado' WHERE status = 'Distribuído'").run();
  if (resDist.changes > 0) {
    console.log(`[Database Migration] Migrados ${resDist.changes} leads de 'Distribuído' para 'reservado'.`);
  }
} catch (e) {
  console.error("Erro ao migrar status 'Distribuído':", e.message);
}

// Retrofit history of scraped cities from existing leads
try {
  const count = db.prepare("SELECT COUNT(*) as count FROM historico_capturas_cidades").get().count;
  if (count === 0) {
    const leads = db.prepare(`
      SELECT DISTINCT cidade, estado, nicho 
      FROM leads 
      WHERE cidade IS NOT NULL 
        AND cidade != 'Não Informada' 
        AND cidade != 'Não Informado'
        AND estado IS NOT NULL
        AND estado != 'Não Informado'
    `).all();

    if (leads.length > 0) {
      console.log(`[Database Migration] Retroalimentando historico_capturas_cidades com ${leads.length} registros de leads existentes...`);
      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT OR IGNORE INTO historico_capturas_cidades (cidade, nicho, capturado_em)
        VALUES (?, ?, ?)
      `);
      db.transaction(() => {
        for (const l of leads) {
          const cidadeFormatada = `${l.cidade} - ${l.estado}`;
          insert.run(cidadeFormatada, l.nicho, now);
        }
      })();
      console.log("[Database Migration] Retroalimentação de cidades concluída com sucesso!");
    }
  }
} catch (e) {
  console.error("Erro ao retroalimentar historico_capturas_cidades:", e.message);
}

export default db;