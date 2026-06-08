import db from "./db.js";

console.log("=== VENDEDORES ===");
const vendedores = db.prepare("SELECT * FROM vendedores").all();
console.log(vendedores);

console.log("=== LEADS ===");
const leads = db.prepare("SELECT id, empresa, status, vendedor_id, criado_em, atualizado_em FROM leads").all();
console.log(leads);

console.log("=== PRE-VENDAS ===");
const prevendas = db.prepare("SELECT * FROM pre_vendas").all();
console.log(prevendas);
