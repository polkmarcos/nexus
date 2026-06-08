import db from "./db.js";

console.log("Iniciando teste de distribuição...");

const vendedores = db.prepare("SELECT * FROM vendedores WHERE ativo = 1").all();
console.log("Vendedores ativos encontrados:", vendedores.length);

const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayStartIso = todayStart.toISOString();
console.log("todayStartIso:", todayStartIso);

for (const vendedor of vendedores) {
  console.log(`\nVerificando vendedor: ${vendedor.nome} (${vendedor.id})`);
  
  const count = db.prepare(`
    SELECT COUNT(*) as total FROM leads 
    WHERE vendedor_id = ? AND atualizado_em >= ?
  `).get(vendedor.id, todayStartIso).total;
  
  console.log(`Leads já atribuídos hoje: ${count}`);
  
  const capacidade = Math.max(0, vendedor.limite_diario - count);
  console.log(`Capacidade disponível: ${capacidade}`);
  
  const leads = db.prepare(`
    SELECT id FROM leads 
    WHERE status = 'Novo' AND vendedor_id IS NULL 
    ORDER BY criado_em ASC 
    LIMIT ?
  `).all(capacidade);
  
  console.log(`Leads 'Novo' disponíveis encontrados: ${leads.length}`);
}
