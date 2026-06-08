import db from "../server/db.js";

function testDatabase() {
  console.log("--- INICIANDO TESTE DO BANCO DE DADOS ---");
  
  // 1. Verificar colunas na tabela vendedores
  const info = db.pragma("table_info(vendedores)");
  console.log("Colunas da tabela 'vendedores':", info.map(c => `${c.name} (${c.type})`));
  
  const colRef = info.find(c => c.name === "indicado_por_id");
  const colGer = info.find(c => c.name === "eh_gerente");
  
  if (colRef && colGer) {
    console.log("✅ Colunas 'indicado_por_id' e 'eh_gerente' existem!");
  } else {
    console.error("❌ Colunas ausentes no banco de dados.");
    process.exit(1);
  }

  // 2. Simular o fluxo de gerente/indicação de forma limpa
  try {
    const managerId = "test-manager-123";
    const referredId = "test-referred-456";
    
    // Limpar resíduos antigos se houver
    db.prepare("DELETE FROM pre_vendas WHERE vendedor_id IN (?, ?)").run(managerId, referredId);
    db.prepare("DELETE FROM vendedores WHERE id IN (?, ?)").run(managerId, referredId);
    
    console.log("Criando gerente de teste...");
    db.prepare(`
      INSERT INTO vendedores (id, nome, email, senha, whatsapp, cpf, link_kiwify, eh_gerente, criado_em)
      VALUES (?, 'Gerente Teste', 'gerente@teste.com', '123456', '5511999999999', '111.111.111-11', 'link-kiwify-1', 1, ?)
    `).run(managerId, new Date().toISOString());

    console.log("Criando vendedor indicado de teste...");
    db.prepare(`
      INSERT INTO vendedores (id, nome, email, senha, whatsapp, cpf, link_kiwify, indicado_por_id, eh_gerente, criado_em)
      VALUES (?, 'Indicado Teste', 'indicado@teste.com', '123456', '5511988888888', '222.222.222-22', 'link-kiwify-2', ?, 0, ?)
    `).run(referredId, managerId, new Date().toISOString());

    console.log("Vendedores de teste inseridos!");
    
    // Contar indicados
    const countIndicados = db.prepare("SELECT COUNT(*) as total FROM vendedores WHERE indicado_por_id = ?").get(managerId).total;
    console.log(`Quantidade de indicados do gerente: ${countIndicados} (esperado: 1)`);
    
    // Criar uma pré-venda aprovada para o indicado
    // 1. Criar um lead de teste para vincular
    const leadId = "test-lead-789";
    db.prepare("DELETE FROM leads WHERE id = ?").run(leadId);
    db.prepare(`
      INSERT INTO leads (id, empresa, nicho, vendedor_id, status, criado_em, atualizado_em)
      VALUES (?, 'Empresa Teste', 'Pizzaria', ?, 'Comprou', ?, ?)
    `).run(leadId, referredId, new Date().toISOString(), new Date().toISOString());

    console.log("Criando pré-venda aprovada para o indicado...");
    db.prepare(`
      INSERT INTO pre_vendas (id, lead_id, vendedor_id, status, criado_em, atualizado_em)
      VALUES ('pv-test-01', ?, ?, 'Aprovada', ?, ?)
    `).run(leadId, referredId, new Date().toISOString(), new Date().toISOString());

    // Calcular comissões passivas
    const salesCount = db.prepare(`
      SELECT COUNT(*) as total 
      FROM pre_vendas p
      JOIN vendedores v ON p.vendedor_id = v.id
      WHERE v.indicado_por_id = ? AND p.status = 'Aprovada'
    `).get(managerId).total;

    console.log(`Vendas aprovadas dos indicados: ${salesCount} (esperado: 1)`);
    console.log(`Comissão de gerência calculada: R$ ${salesCount * 100},00 (esperado: R$ 100,00)`);
    
    // Limpar dados de teste
    db.prepare("DELETE FROM pre_vendas WHERE vendedor_id IN (?, ?)").run(managerId, referredId);
    db.prepare("DELETE FROM leads WHERE id = ?").run(leadId);
    db.prepare("DELETE FROM vendedores WHERE id IN (?, ?)").run(managerId, referredId);
    
    console.log("✅ Limpeza concluída e teste de banco finalizado com SUCESSO!");
  } catch (error) {
    console.error("❌ Falha no teste do fluxo do banco de dados:", error);
    process.exit(1);
  }
}

testDatabase();
