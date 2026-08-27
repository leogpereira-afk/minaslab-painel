// Testes do escritor de .xlsx. Sem navegador: so planilhaBytes, que devolve
// os bytes. O que se testa aqui e o que quebra o arquivo de vez (escape de
// XML, deslocamento do zip) e o que MENTE no relatorio (celula vazia virando
// zero, dinheiro virando texto).
import test from "node:test";
import assert from "node:assert/strict";
import { planilhaBytes, nomeArquivo } from "./planilha.js";

const COLUNAS = [
  { chave: "orgao", rotulo: "Orgao" },
  { chave: "objeto", rotulo: "Objeto" },
  { chave: "valor", rotulo: "Valor estimado", tipo: "dinheiro" },
  { chave: "amostras", rotulo: "Amostras", tipo: "numero" },
  { chave: "data", rotulo: "Data da sessao", tipo: "data" },
];

// A 2a linha e a que interessa: valor SEM registro e data em branco convivendo
// com uma quantidade que e zero DE VERDADE.
const LINHAS = [
  { orgao: "Silva & Cia", objeto: "analise <fisico-quimica>", valor: 1234.5, amostras: 12, data: "2026-08-27" },
  { orgao: "Prefeitura", objeto: 'aspas "duplas"', valor: null, amostras: 0, data: "" },
];

// As entradas do zip vao "stored", entao o XML esta literal nos bytes. latin1
// mapeia byte a byte — e o que permite procurar uma sequencia EXATA sem
// tropecar no lixo binario dos cabecalhos (utf-8 comeria bytes invalidos).
function folhaDe(bytes) {
  const bruto = Buffer.from(bytes).toString("latin1");
  const ini = bruto.indexOf("<worksheet ");
  const fim = bruto.indexOf("</worksheet>");
  assert.ok(ini > -1 && fim > ini, "nao achei a folha dentro do zip");
  return bruto.slice(ini, fim + "</worksheet>".length);
}

function celulaDe(folha, ref) {
  const m = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`).exec(folha);
  return m ? m[0] : null;
}

test("os bytes sao um zip de verdade (assinatura PK)", () => {
  const bytes = planilhaBytes({ colunas: COLUNAS, linhas: LINHAS });
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes[0], 0x50); // "P"
  assert.equal(bytes[1], 0x4b); // "K"
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);
});

test("o zip fecha certo: EOCD, 6 partes e o diretorio no lugar", () => {
  // Deslocamento errado no diretorio central e o defeito que passa despercebido:
  // o arquivo "existe", tem tamanho, e o Excel diz so "arquivo danificado".
  const bytes = planilhaBytes({ colunas: COLUNAS, linhas: LINHAS });
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50);
  assert.equal(dv.getUint16(eocd + 10, true), 6);
  const inicioCentral = dv.getUint32(eocd + 16, true);
  assert.equal(dv.getUint32(inicioCentral, true), 0x02014b50);
  assert.equal(dv.getUint32(eocd + 12, true), eocd - inicioCentral);
});

test("escapa & < > e aspas — um '&' cru corrompe o arquivo inteiro", () => {
  const folha = folhaDe(planilhaBytes({ colunas: COLUNAS, linhas: LINHAS }));
  assert.ok(folha.includes("Silva &amp; Cia"));
  assert.ok(!folha.includes("Silva & Cia"));
  assert.ok(folha.includes("&lt;fisico-quimica&gt;"));
  assert.ok(!folha.includes("<fisico-quimica>"));
  assert.ok(folha.includes("aspas &quot;duplas&quot;"));
});

test("celula sem registro fica VAZIA, e zero registrado continua zero", () => {
  const folha = folhaDe(planilhaBytes({ colunas: COLUNAS, linhas: LINHAS }));
  // Linha 3 = 2a linha de dados (a 1 e o cabecalho).
  assert.equal(celulaDe(folha, "C3"), '<c r="C3"/>'); // dinheiro null
  assert.equal(celulaDe(folha, "E3"), '<c r="E3"/>'); // data em branco
  // O outro lado da regra: 0 informado e um dado e nao pode sumir.
  assert.equal(celulaDe(folha, "D3"), '<c r="D3"><v>0</v></c>');
});

test("numero vai como numero e texto como texto", () => {
  const folha = folhaDe(planilhaBytes({ colunas: COLUNAS, linhas: LINHAS }));
  // Sem t="inlineStr" e com <v>: e celula numerica, soma no Excel.
  assert.equal(celulaDe(folha, "C2"), '<c r="C2" s="2"><v>1234.5</v></c>');
  assert.equal(celulaDe(folha, "D2"), '<c r="D2"><v>12</v></c>');
  assert.ok(celulaDe(folha, "A2").includes('t="inlineStr"'));
});

test("data vira texto dd/mm/aaaa, nunca numero de serie", () => {
  const folha = folhaDe(planilhaBytes({ colunas: COLUNAS, linhas: LINHAS }));
  const celula = celulaDe(folha, "E2");
  assert.ok(celula.includes('t="inlineStr"'));
  assert.ok(celula.includes("27/08/2026"));
});

test("com titulo, o cabecalho desce uma linha", () => {
  const folha = folhaDe(
    planilhaBytes({ colunas: COLUNAS, linhas: LINHAS, titulo: "Licitacoes em andamento" })
  );
  assert.ok(folha.includes('<row r="1">'));
  assert.ok(folha.includes("Licitacoes em andamento"));
  assert.equal(celulaDe(folha, "C4"), '<c r="C4"/>'); // a linha vazia desceu junto
});

test("planilha sem colunas reclama em vez de gerar arquivo vazio", () => {
  assert.throws(() => planilhaBytes({ colunas: [], linhas: LINHAS }), /sem colunas/);
});

test("nome do arquivo: sem acento, com o dia local", () => {
  assert.match(nomeArquivo("Licitações"), /^licitacoes-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.match(nomeArquivo("Marketing"), /^marketing-\d{4}-\d{2}-\d{2}\.xlsx$/);
});
