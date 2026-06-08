import fs from "fs";

const content = fs.readFileSync("../src/App.jsx", "utf-8");
const lines = content.split("\n");

console.log("=== Buscando Cadastro Vendedor / Senha ===");
let inComponent = false;
let startLine = 0;
let endLine = 0;

lines.forEach((line, idx) => {
  if (line.includes("function CadastroVendedor") || line.includes("function RegistrarVendedor")) {
    inComponent = true;
    startLine = idx + 1;
    console.log(`Encontrada função na linha ${idx + 1}: ${line.trim()}`);
  }
  if (inComponent && line.includes("return") && endLine === 0) {
    // just track component range
  }
  if (inComponent && line.trim() === "}" && idx + 1 > startLine + 10) {
    inComponent = false;
    endLine = idx + 1;
    console.log(`Fim do componente na linha ${idx + 1}`);
  }
});

// Let's search for "cadastro-vendedor" in App.jsx
lines.forEach((line, idx) => {
  if (line.includes("cadastro-vendedor")) {
    console.log(`Rota/Página de cadastro na linha ${idx + 1}: ${line.trim()}`);
  }
});
