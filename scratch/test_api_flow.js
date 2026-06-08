import db from "../server/db.js";

function generateCPF() {
  const num = () => Math.floor(Math.random() * 9);
  const n = Array.from({length: 9}, num);
  
  let d1 = n.reduce((acc, val, idx) => acc + val * (10 - idx), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  n.push(d1);
  
  let d2 = n.reduce((acc, val, idx) => acc + val * (11 - idx), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  n.push(d2);
  
  return n.join("");
}

async function testAPI() {
  console.log("--- INICIANDO TESTE DE ROTAS DA API ---");
  const baseUrl = "http://localhost:3001";
  
  // Limpar antigos dados para garantir teste reprodutível usando e-mails
  db.prepare("DELETE FROM pre_vendas WHERE vendedor_id IN (SELECT id FROM vendedores WHERE email IN ('gerente_api@teste.com', 'indicado_api@teste.com'))").run();
  db.prepare("DELETE FROM leads WHERE vendedor_id IN (SELECT id FROM vendedores WHERE email IN ('gerente_api@teste.com', 'indicado_api@teste.com'))").run();
  db.prepare("DELETE FROM vendedores WHERE email IN ('gerente_api@teste.com', 'indicado_api@teste.com')").run();
  
  try {
    const cpfGerente = generateCPF();
    const cpfIndicado = generateCPF();

    // 1. Criar um vendedor gerente
    console.log("Cadastrando gerente via API com CPF:", cpfGerente);
    const resGerente = await fetch(`${baseUrl}/vendedores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Gerente API",
        email: "gerente_api@teste.com",
        senha: "password123",
        whatsapp: "5511999999000",
        cpf: cpfGerente,
        link_kiwify: "http://kiwify.example.com",
        limite_diario: 25
      })
    });
    
    const dataGerente = await resGerente.json();
    if (!resGerente.ok || !dataGerente.ok) {
      throw new Error(`Falha ao cadastrar gerente: ${JSON.stringify(dataGerente)}`);
    }
    const realManagerId = dataGerente.vendedor.id;
    console.log(`✅ Gerente cadastrado! ID real: ${realManagerId}`);

    // 2. Tentar ativar gerente antes de qualificado
    console.log("Tentando ativar modo gerente sem preencher os requisitos...");
    const resAtivacaoInvalida = await fetch(`${baseUrl}/vendedores/${realManagerId}/ativar-gerente`, {
      method: "POST"
    });
    const dataAtivacaoInvalida = await resAtivacaoInvalida.json();
    console.log(`Resposta da ativação inválida: (Status ${resAtivacaoInvalida.status})`, dataAtivacaoInvalida);
    if (resAtivacaoInvalida.status === 400 && !dataAtivacaoInvalida.ok) {
      console.log("✅ Rejeição correta com status 400!");
    } else {
      throw new Error("Deveria ter rejeitado por falta de requisitos.");
    }

    // 3. Forçar qualificação adicionando lead e pré-venda aprovada
    console.log("Forçando qualificação adicionando 100 leads e pré-venda aprovada...");
    db.prepare("DELETE FROM leads WHERE vendedor_id = ?").run(realManagerId);
    
    // Inserir 100 leads enviados
    const insertLead = db.prepare(`
      INSERT INTO leads (id, empresa, nicho, vendedor_id, status, criado_em, atualizado_em)
      VALUES (?, ?, 'Pizzaria', ?, 'Mensagem enviada', ?, ?)
    `);
    
    db.transaction(() => {
      for (let i = 0; i < 100; i++) {
        insertLead.run(`lead-api-${i}`, `Lead API ${i}`, realManagerId, new Date().toISOString(), new Date().toISOString());
      }
    })();

    const leadId = "test-lead-api";
    db.prepare(`
      INSERT INTO leads (id, empresa, nicho, vendedor_id, status, criado_em, atualizado_em)
      VALUES (?, 'Lead API', 'Pizzaria', ?, 'Comprou', ?, ?)
    `).run(leadId, realManagerId, new Date().toISOString(), new Date().toISOString());

    db.prepare(`
      INSERT INTO pre_vendas (id, lead_id, vendedor_id, status, criado_em, atualizado_em)
      VALUES ('pv-api-01', ?, ?, 'Aprovada', ?, ?)
    `).run(leadId, realManagerId, new Date().toISOString(), new Date().toISOString());

    // Tentar ativar agora que está qualificado
    console.log("Tentando ativar modo gerente após qualificação...");
    const resAtivacaoValida = await fetch(`${baseUrl}/vendedores/${realManagerId}/ativar-gerente`, {
      method: "POST"
    });
    const dataAtivacaoValida = await resAtivacaoValida.json();
    if (resAtivacaoValida.ok && dataAtivacaoValida.ok) {
      console.log("✅ Modo gerente ativado com sucesso via API!", dataAtivacaoValida.message);
    } else {
      throw new Error(`Deveria ter ativado com sucesso: ${JSON.stringify(dataAtivacaoValida)}`);
    }

    // 4. Cadastrar vendedor indicado passando o ID do gerente
    console.log("Cadastrando vendedor indicado usando o gerente com CPF:", cpfIndicado);
    const resIndicado = await fetch(`${baseUrl}/vendedores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Indicado API",
        email: "indicado_api@teste.com",
        senha: "password123",
        whatsapp: "5511999999111",
        cpf: cpfIndicado,
        link_kiwify: "http://kiwify.example.com",
        indicado_por_id: realManagerId
      })
    });
    const dataIndicado = await resIndicado.json();
    if (resIndicado.ok && dataIndicado.ok) {
      console.log(`✅ Indicado cadastrado com indicado_por_id vinculado! ID real: ${dataIndicado.vendedor.id}`);
    } else {
      throw new Error(`Falha ao cadastrar indicado: ${JSON.stringify(dataIndicado)}`);
    }
    const realReferredId = dataIndicado.vendedor.id;

    // 5. Adicionar uma venda aprovada para o indicado para gerar comissão passiva de gerente
    console.log("Criando venda aprovada para o indicado...");
    const leadId2 = "test-lead-api2";
    db.prepare("DELETE FROM leads WHERE id = ?").run(leadId2);
    db.prepare(`
      INSERT INTO leads (id, empresa, nicho, vendedor_id, status, criado_em, atualizado_em)
      VALUES (?, 'Lead API 2', 'Pizzaria', ?, 'Comprou', ?, ?)
    `).run(leadId2, realReferredId, new Date().toISOString(), new Date().toISOString());

    db.prepare(`
      INSERT INTO pre_vendas (id, lead_id, vendedor_id, status, criado_em, atualizado_em)
      VALUES ('pv-api-02', ?, ?, 'Aprovada', ?, ?)
    `).run(leadId2, realReferredId, new Date().toISOString(), new Date().toISOString());

    // 6. Consultar as estatísticas do gerente para verificar se a comissão passiva foi calculada e retornada
    console.log("Buscando estatísticas do painel do gerente...");
    const resStats = await fetch(`${baseUrl}/vendedores/${realManagerId}/dashboard-stats`);
    const dataStats = await resStats.json();
    if (resStats.ok && dataStats.ok) {
      const { stats } = dataStats;
      console.log("Estatísticas do Gerente:", {
        eh_gerente: stats.eh_gerente,
        leads_enviados: stats.leads_enviados,
        indicados_count: stats.indicados_count,
        indicados_sales_count: stats.indicados_sales_count,
        comissao_gerente_acumulada: stats.comissao_gerente_acumulada
      });
      
      if (stats.eh_gerente === 1 && stats.indicados_count === 1 && stats.indicados_sales_count === 1 && stats.comissao_gerente_acumulada === 100) {
        console.log("✅ Assertivas do painel do gerente passaram com sucesso!");
      } else {
        throw new Error(`Dados estatísticos incorretos: ${JSON.stringify(stats)}`);
      }
    } else {
      throw new Error(`Erro ao carregar estatísticas: ${JSON.stringify(dataStats)}`);
    }

    // Limpar dados do banco
    db.prepare("DELETE FROM pre_vendas WHERE vendedor_id IN (?, ?)").run(realManagerId, realReferredId);
    db.prepare("DELETE FROM leads WHERE vendedor_id IN (?, ?) OR id IN (?, ?)").run(realManagerId, realReferredId, leadId, leadId2);
    db.prepare("DELETE FROM vendedores WHERE id IN (?, ?)").run(realManagerId, realReferredId);
    console.log("✅ Limpeza de dados pós-teste API realizada.");
    console.log("✅ FLUXO DE API COMPLETO COM SUCESSO!");

  } catch (error) {
    console.error("❌ Falha no teste de API:", error);
    process.exit(1);
  }
}

testAPI();
