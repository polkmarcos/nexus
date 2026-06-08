import fs from "fs";
import https from "https";

const url = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?ordenar=nome";
const targetPath = "c:\\Users\\marcthay23\\Documents\\crm-vendedores\\server\\municipios.json";

console.log("Iniciando requisição à API de Localidades do IBGE...");

https.get(url, (res) => {
  let body = "";

  res.on("data", (chunk) => {
    body += chunk;
  });

  res.on("end", () => {
    try {
      const data = JSON.parse(body);
      console.log(`Dados recebidos. Total de itens brutos: ${data.length}`);

      const municipios = data.map((item) => {
        let uf = "N/A";
        if (item.microrregiao && item.microrregiao.mesorregiao && item.microrregiao.mesorregiao.UF) {
          uf = item.microrregiao.mesorregiao.UF.sigla;
        } else if (item["regiao-imediata"] && item["regiao-imediata"]["regiao-intermediaria"] && item["regiao-imediata"]["regiao-intermediaria"].UF) {
          uf = item["regiao-imediata"]["regiao-intermediaria"].UF.sigla;
        }
        return {
          ibgeCod: item.id,
          nome: item.nome,
          uf: uf
        };
      });

      console.log(`Processados ${municipios.length} municípios.`);

      fs.writeFileSync(targetPath, JSON.stringify(municipios, null, 2), "utf-8");
      console.log(`Municípios salvos com sucesso em ${targetPath}`);
    } catch (error) {
      console.error("Erro ao parsear dados do IBGE:", error.message);
    }
  });
}).on("error", (error) => {
  console.error("Erro na requisição HTTPS:", error.message);
});
