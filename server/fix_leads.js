import db from "./db.js";

console.log("Renomeando leads com nome 'Resultados'...");

const leads = db.prepare("SELECT id FROM leads WHERE empresa = 'Resultados'").all();
console.log(`Encontrados ${leads.length} leads para renomear.`);

let index = 1;
db.transaction(() => {
  for (const lead of leads) {
    const nome = `Padaria Exemplo ${index}`;
    db.prepare("UPDATE leads SET empresa = ? WHERE id = ?").run(nome, lead.id);
    console.log(`Lead ID ${lead.id} renomeado para: ${nome}`);
    index++;
  }
})();

console.log("Concluído!");
