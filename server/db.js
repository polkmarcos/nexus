import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

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
`);

// Safe migrations for existing databases
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
  db.exec("ALTER TABLE leads ADD COLUMN assigned_to TEXT;");
} catch (_) {}

try {
  db.exec("ALTER TABLE leads ADD COLUMN assigned_at TEXT;");
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
} catch (e) {
  console.error("Erro ao inserir configs padrão:", e.message);
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

export default db;