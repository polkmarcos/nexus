import fs from "fs";

function run() {
  const jsonStr = fs.readFileSync("maps_state.json", "utf8");
  
  // Encontrar todas as posições de "Barbearia O Senador"
  let pos = jsonStr.indexOf("Barbearia O Senador");
  if (pos === -1) {
    console.log("Não encontrou 'Barbearia O Senador'");
    return;
  }
  
  console.log(`Encontrou 'Barbearia O Senador' na posição ${pos}`);
  
  // Mostrar 1000 caracteres antes e depois
  const start = Math.max(0, pos - 200);
  const end = Math.min(jsonStr.length, pos + 2000);
  const chunk = jsonStr.substring(start, end);
  
  console.log("--- TRECHO ---");
  console.log(chunk);
  console.log("--------------");
  
  // Vamos ver se o telefone real "954848840" ou "95484-8840" ou "1195484" ou "Henrique Eroles" está no trecho
  console.log("Contém 'Henrique Eroles' no trecho?", chunk.includes("Henrique Eroles"));
  console.log("Contém '8840' (fim do telefone)?", chunk.includes("8840"));
}

run();
