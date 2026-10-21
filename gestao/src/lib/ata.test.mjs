import test from "node:test";
import assert from "node:assert/strict";
import { pautaDaApresentacao, itemDoSlide, preencherAtaXml, pautaXml, nomeArquivoAta, nomeCurto, dataBR } from "./ata.js";
import { slidesDoModelo } from "./modelosApresentacao.js";

const ctx = {
  mes: "2026-08",
  valores: { mes: "Agosto de 2026", mesAnterior: "Julho de 2026", ano: "2026", pesoEquipe: 40, pesoLideranca: 60 },
  indicadores: { t: { enviadas: 96, aprovadas: 27, recusadas: 1 }, ant: { enviadas: 99, aprovadas: 50, recusadas: 0 }, rotulo: "Agosto", rotuloAnt: "Julho" },
  setores: { meses: ["2026-07", "2026-08"], porMes: { "2026-07": { total: 390, porSetor: {} }, "2026-08": { total: 487, porSetor: { Microbiologia: { amostras: 300, ensaios: 900 }, "Físico-química": { amostras: 200, ensaios: 1 } } } } },
  podio: [{ id: "a", nome: "PESSOA UM" }, { id: "b", nome: "PESSOA DOIS" }],
  ata: [{ id: "1", tipo: "compromisso", texto: "Revisar o freezer", dono: "Fulana", prazo: "2026-08-30" }],
  anterior: [],
};

test("indicadores viram o texto da ata (mês anterior primeiro, como no modelo)", () => {
  const it = itemDoSlide({ layout: "indicadores", titulo: "Indicadores comerciais · {mes}" }, ctx);
  assert.equal(it.titulo, "Indicadores comerciais · Agosto de 2026");
  assert.equal(it.corpo, [
    "# Julho:", "- 390 amostras analisadas", "- 99 propostas emitidas", "- 50 propostas aprovadas", "- nenhuma proposta rejeitada",
    "# Agosto:", "- 487 amostras analisadas", "- 96 propostas emitidas", "- 27 propostas aprovadas", "- 1 proposta rejeitada",
  ].join("\n"));
});

test("pauta da reunião mensal: um item por slide, sem capa/agenda, com encerramento", () => {
  const p = pautaDaApresentacao(slidesDoModelo("mensal"), ctx);
  const titulos = p.map((x) => x.titulo);
  assert.ok(!titulos.includes("Reunião mensal de resultados"));
  assert.ok(!titulos.includes("Agenda do dia"));
  assert.ok(titulos.includes("Abertura e calendário"));
  assert.equal(titulos.at(-1), "Encerramento");
  assert.ok(p.find((x) => x.titulo === "Ranking do mês · Agosto de 2026").corpo.includes("1º lugar: PESSOA UM"));
  assert.ok(p.find((x) => x.titulo === "Próximos passos").corpo.includes("Revisar o freezer (responsável: Fulana; prazo: 30/08/2026)"));
  // nada fica com marcador sem trocar
  assert.ok(!p.some((x) => /\{\w+\}/.test(x.titulo + x.corpo)));
  // slide escondido não entra
  const sl = slidesDoModelo("mensal").map((s) => (s.layout === "aviso" ? { ...s, oculto: true } : s));
  assert.ok(!pautaDaApresentacao(sl, ctx).some((x) => x.titulo === "Horas extras"));
});

test("pauta no Word: numerada, título em negrito, marcadores com a lista do modelo", () => {
  const x = pautaXml([{ titulo: "Compras", corpo: "Até o dia 19.\n- item A & B" }, { titulo: "Encerramento", corpo: "Fim.", semNumero: true }]);
  assert.match(x, /<w:b\/>.*1\. Compras/);
  assert.match(x, /<w:br\/><w:t xml:space="preserve">Até o dia 19\./);
  assert.match(x, /<w:numId w:val="25"\/>.*item A &amp; B/);
  assert.match(x, />Encerramento</);
  assert.ok(!x.includes("2. Encerramento"));
});

const MODELO = `<w:document><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>{{DATA}}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>{{LOCAL}}{{INICIO}}{{FIM}}{{SOLICITANTE}}{{CARGO}}{{ASSUNTO}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`
  + `<w:tbl><w:tr w:rsidR="1"><w:trPr><w:cantSplit/></w:trPr><w:tc><w:p><w:r><w:t>Participantes</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>{{P1}}</w:t></w:r></w:p></w:tc></w:tr>`
  + `<w:tr w:rsidR="2"><w:trPr><w:cantSplit/></w:trPr><w:tc><w:p/></w:tc><w:tc><w:p><w:r><w:t>{{PN}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`
  + `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>{{PAUTA}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:tbl><w:tr><w:tc><w:p><w:r><w:t>{{OBS}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;

test("preenche o modelo: campos, uma linha por participante, pauta e observações", () => {
  const x = preencherAtaXml(MODELO, { data: "2026-08-14", local: "Minaslab", inicio: "08:00", fim: "09:00", solicitante: "Gestora <teste>", cargo: "Gerente", assunto: "Reunião", participantes: ["Ana", "Bia", "Caio"], pauta: [{ titulo: "Abertura", corpo: "Texto" }], obs: "Sem mais." });
  assert.ok(!/\{\{\w+\}\}/.test(x));
  assert.match(x, /14\/08\/2026/);
  assert.match(x, /Gestora &lt;teste&gt;/);
  assert.equal((x.match(/<w:tr /g) || []).length, 3); // 1ª + 2 continuações
  assert.equal((x.match(/w:rsidR="1"/g) || []).length, 1);
  assert.ok(x.indexOf(">Ana<") < x.indexOf(">Bia<") && x.indexOf(">Bia<") < x.indexOf(">Caio<"));
  assert.match(x, /1\. Abertura/);
  assert.match(x, /Sem mais\./);
  assert.ok((x.match(/<w:p\/>/g) || []).length >= 11);
});

test("sem participantes: 8 linhas em branco para escrever à mão", () => {
  const x = preencherAtaXml(MODELO, { participantes: [], pauta: [] });
  assert.equal((x.match(/<w:tr /g) || []).length, 8);
});

test("nomes e arquivo", () => {
  assert.equal(nomeArquivoAta({ tipo: "geral", data: "2026-08-14" }), "ATA DE REUNIÃO - EQUIPE GERAL 14.08.2026.docx");
  assert.equal(nomeArquivoAta({ tipo: "comercial", data: "2026-10-05" }), "ATA DE REUNIÃO - COMERCIAL 05.10.2026.docx");
  assert.equal(nomeCurto({ nome: "MARIA DA SILVA SOUZA" }), "Maria da");
  assert.equal(nomeCurto({ nome: "JOSÉ ROBERTO DIAS", apelido: "" }), "José Roberto");
  assert.equal(nomeCurto({ nome: "X", apelido: "Duda" }), "Duda");
  assert.equal(dataBR("2026-01-02"), "02/01/2026");
});

test("modelos novos: reunião do comercial e integração sem marcador sobrando na ata", () => {
  const c = { ...ctx, valores: { ...ctx.valores, mesSeguinte: "Setembro de 2026" } };
  for (const id of ["comercial", "integracao"]) {
    const p = pautaDaApresentacao(slidesDoModelo(id), c);
    assert.ok(p.length > 5, id);
    assert.ok(!p.some((x) => /\{\w+\}/.test(x.titulo + x.corpo)), id);
  }
  assert.ok(pautaDaApresentacao(slidesDoModelo("integracao"), c).some((x) => x.titulo === "Penalidades" && x.corpo.includes("Demissão por justa causa")));
});
