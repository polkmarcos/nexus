import { scrapeTargetSite } from "./site_scraper.js";

const url = process.argv[2] || "https://example.com";

console.log(`Testando scrapeTargetSite com a URL: ${url}`);

scrapeTargetSite(url)
  .then(data => {
    console.log("\n=== RESULTADO DO DEEP CRAWL ===");
    console.log("Título:", data.title);
    console.log("Subtítulo:", data.subtitle);
    console.log("Telefone:", data.phone);
    console.log("E-mail:", data.email);
    console.log("Endereço:", data.address);
    console.log("Redes Sociais:");
    console.log("- Instagram:", data.instagram);
    console.log("- Facebook:", data.facebook);
    console.log("Estrutura das Páginas:");
    console.log("- Sobre Nós (Texto):", data.paginas.sobre.texto ? `${data.paginas.sobre.texto.substring(0, 200)}...` : "(vazio)");
    console.log("- Contato:", data.paginas.contato);
    console.log("- Produtos/Serviços (Total):", data.paginas.produtos.itens.length);
    if (data.paginas.produtos.itens.length > 0) {
      console.log("Itens Extraídos:");
      data.paginas.produtos.itens.forEach((p, idx) => {
        console.log(`  [${idx + 1}] ${p.name} - ${p.price}`);
        console.log(`      Desc: ${p.desc}`);
        console.log(`      Img: ${p.image}`);
      });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("=== FALHA NO TESTE ===");
    console.error(err);
    process.exit(1);
  });
