import db from "./db.js";
import { conectarWhatsapp, checkSessionStatus, sessions } from "./whatsapp.js";
import fs from "fs";
import path from "path";

async function runTest() {
  console.log("=== INICIANDO TESTE PARRUDO DE CONCURRENCIA ===");
  console.log("Objetivo: Testar 10 funcionarios (vendedores) conectando simultaneamente por numero de telefone.");

  const vendedoras = [];
  const testIds = [];

  // 1. Criar 10 vendedores temporarios no banco
  for (let i = 1; i <= 10; i++) {
    const id = `test_vendedor_concorrente_${i}`;
    const nome = `Funcionario Teste ${i}`;
    const email = `test_vendedor_${i}@crm.com`;
    const senha = "password123";
    const whatsapp = `55119999900${i.toString().padStart(2, '0')}`;
    testIds.push(id);

    // Limpar se ja existir
    db.prepare("DELETE FROM vendedores WHERE id = ?").run(id);

    db.prepare(`
      INSERT INTO vendedores (id, nome, email, senha, whatsapp, limite_diario, ativo, criado_em)
      VALUES (?, ?, ?, ?, ?, 25, 1, ?)
    `).run(id, nome, email, senha, whatsapp, new Date().toISOString());

    vendedoras.push({ id, nome, whatsapp });
  }

  console.log(`\n[OK] 10 vendedores temporarios criados no banco de dados.`);
  console.log("Iniciando sessoes do WhatsApp em paralelo (intervalo de 3.5s entre disparos)...");

  // 2. Conectar os 10 em paralelo com delay progressivo
  const startPromises = vendedoras.map((v, index) => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          console.log(`[🚀 Lancando] ${v.nome} (${v.whatsapp}) - ID: ${v.id}`);
          await conectarWhatsapp(v.id, v.whatsapp);
          resolve();
        } catch (err) {
          console.error(`[Erro Lancamento] ${v.nome}:`, err.message);
          resolve();
        }
      }, index * 3500);
    });
  });

  await Promise.all(startPromises);
  console.log("\nTodos os 10 navegadores foram inicializados no WhatsApp Web. Monitorando geracao de codigos...");

  // 3. Monitorar os status e codigos gerados por ate 180 segundos
  const startTime = Date.now();
  const maxDuration = 180000; // 180 segundos
  const codigosEncontrados = new Map();

  while (Date.now() - startTime < maxDuration) {
    let todosFinalizados = true;

    console.log(`\n--- Status Atual (${Math.round((Date.now() - startTime) / 1000)}s decorridos) ---`);

    for (const v of vendedoras) {
      const status = await checkSessionStatus(v.id);
      
      if (status.phoneCode) {
        codigosEncontrados.set(v.id, status.phoneCode);
        console.log(`🟢 ${v.nome}: Codigo Gerado: ${status.phoneCode} (${status.status})`);
      } else {
        console.log(`Aguardando ${v.nome} | Status: ${status.status}`);
        todosFinalizados = false;
      }
    }

    if (codigosEncontrados.size === 10) {
      console.log("\n🎉 Sucesso total! Todos os 10 vendedores obtiveram seus codigos de pareamento!");
      break;
    }

    await new Promise(r => setTimeout(r, 4000));
  }

  console.log("\n=== RESULTADO DOS CODIGOS DE CONEXAO ===");
  vendedoras.forEach(v => {
    const code = codigosEncontrados.get(v.id) || "NAO GERADO (TIMEOUT/ERRO)";
    console.log(`👤 ${v.nome} (${v.whatsapp}) -> Codigo: ${code}`);
  });

  // 4. Limpar sessoes, processos e deletar dados temporarios
  console.log("\nEncerrando navegadores e limpando sessoes...");
  for (const id of testIds) {
    const session = sessions.get(id);
    if (session) {
      if (session.context) {
        await session.context.close().catch(() => {});
      }
      sessions.delete(id);
    }

    // Remover do banco
    db.prepare("DELETE FROM vendedores WHERE id = ?").run(id);

    // Remover pasta de sessao para nao ocupar espaco
    const sessionDir = path.resolve(`whatsapp-sessions/${id}`);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (err) {
        // Ignorar erro se pasta estiver trancada temporariamente
      }
    }
  }

  console.log("\n=== TESTE CONCLUIDO E LIMPEZA EFETUADA ===");
  process.exit(0);
}

runTest().catch(err => {
  console.error("Erro fatal no teste:", err);
  process.exit(1);
});
