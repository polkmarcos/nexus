import db from "./db.js";
import { randomUUID } from "crypto";

const variacoes = [
  {
    nome: "Variação 1",
    texto: "Oi, é da {empresa}, tudo bem, sabe eu estava vendo aqui e notei que vocês podem aumentar as vendas com um site próprio otimizado, criei uma demonstração, posso te mandar?"
  },
  {
    nome: "Variação 2",
    texto: "Opa, é da {empresa}, tudo joia, então eu estava dando uma olhada e vi que dá pra puxar muito mais pedido no delivery com um site próprio otimizado, fiz uma demo aqui, posso te enviar?"
  },
  {
    nome: "Variação 3",
    texto: "Oi tudo bem, é da {empresa}, sabe que eu estava vendo o perfil de vocês e notei que um site próprio bem otimizado ia ajudar demais a aumentar as vendas, montei uma demonstração, posso mandar?"
  },
  {
    nome: "Variação 4",
    texto: "E aí, é da {empresa}, beleza, tava reparando aqui que vocês conseguem bombar mais as vendas tendo um site próprio otimizado pro celular, preparei uma demo rápida, posso te mandar o link?"
  },
  {
    nome: "Variação 5",
    texto: "Oi, é da pizzaria {empresa}, tudo certo, sabe eu estava dando uma espiada e notei que vocês conseguem escalar as vendas com um site próprio otimizado, montei uma demonstração de exemplo, posso te mostrar?"
  },
  {
    nome: "Variação 6",
    texto: "Opa, é com o pessoal da {empresa}, tudo bem, tava vendo as opções na região e notei que vocês podiam lucrar bem mais nas vendas com um site próprio otimizado, desenhei uma demo de teste, posso te passar?"
  },
  {
    nome: "Variação 7",
    texto: "Oi, tudo joia, é da {empresa}, tava analisando aqui e notei que dá pra aumentar muito as vendas do delivery com um site próprio otimizado, fiz um rascunho de demonstração, posso enviar?"
  },
  {
    nome: "Variação 8",
    texto: "Opa tudo bom, é da {empresa}, tava olhando o negócio de vocês e notei que vocês podem alavancar as vendas com um site próprio otimizado, criei uma demonstração, posso te mandar?"
  },
  {
    nome: "Variação 9",
    texto: "Oi é da equipe da {empresa}, tudo bem, tava vendo aqui e notei que dá pra aumentar bastante as vendas de vocês com um site próprio otimizado, fiz uma demonstração prática, posso mandar o link?"
  },
  {
    nome: "Variação 10",
    texto: "E aí beleza, é da {empresa}, tudo certo, tava passando por aqui e notei que vocês conseguem otimizar e aumentar as vendas com um site próprio bem rápido, montei uma demo de exemplo com o nome de vocês, posso enviar?"
  }
];

function run() {
  try {
    // Desativar todas as mensagens atuais
    db.prepare("UPDATE mensagens SET ativa = 0").run();
    console.log("Mensagens antigas desativadas.");

    // Inserir as novas variações
    const insertStmt = db.prepare(`
      INSERT INTO mensagens (id, nome, texto, ativa, criado_em)
      VALUES (?, ?, ?, 1, ?)
    `);

    const now = new Date().toISOString();
    for (const v of variacoes) {
      const id = randomUUID();
      insertStmt.run(id, v.nome, v.texto, now);
      console.log(`Inserida: ${v.nome}`);
    }

    console.log("Todas as 10 variações foram inseridas e ativadas com sucesso!");
  } catch (err) {
    console.error("Erro ao inserir variações:", err.message);
  }
}

run();
