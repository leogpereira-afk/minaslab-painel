// Ata de reunião no modelo FM-LAB-001 da MinasLab.
//  1) pautaDaApresentacao: transforma os slides da reunião em itens de pauta
//     (texto editável, mesma convenção dos slides: "- " = marcador,
//     "# " = subtítulo em negrito, o resto é texto corrido);
//  2) preencherAtaXml: preenche o document.xml do modelo Word
//     (public/modelos/ata-reuniao.docx), mantendo cabeçalho, tabelas e fontes.
// Regras puras, sem navegador, com testes.

import { linhas, blocos, pares, preencher } from "./modelosApresentacao.js";
import { mesLongo, mesCurto, dataCurta } from "./format.js";

export const TIPOS_ATA = {
  geral: { nome: "Equipe geral (todo o laboratório)", curto: "Equipe geral", assunto: "Reunião Geral com a Equipe", arquivo: "EQUIPE GERAL" },
  comercial: { nome: "Só o Comercial", curto: "Comercial", assunto: "Reunião do Setor Comercial", arquivo: "COMERCIAL" },
  laboratorio: { nome: "Só o Laboratório", curto: "Laboratório", assunto: "Reunião do Laboratório", arquivo: "LABORATORIO" },
};

export const ENCERRAMENTO = "A reunião foi encerrada com agradecimento a todos pelo comprometimento com a qualidade, organização e resultados da MinasLab.";

const T = (t, ctx) => preencher(t, ctx?.valores || {}).trim();
const semMarca = (l) => l.replace(/^[-•]\s*/, "");
const junta = (...partes) => partes.flat().filter((x) => x != null && String(x).trim() !== "").join("\n");
const num = (v) => (v == null || v === "" ? null : Number(v));
const qtd = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Texto com "# subtítulo" e linhas soltas vira: subtítulo mantido, linhas como marcadores. */
function listaDe(texto, ctx) {
  return linhas(T(texto, ctx)).map((l) => (l.startsWith("# ") ? l : `- ${semMarca(l)}`));
}

/** Um item de pauta por slide visível (capa, agenda e encerramento ficam de fora). */
export function itemDoSlide(s, ctx = {}) {
  const titulo = T(s.titulo, ctx).replace(/\s*&\s*/g, " e ");
  const dest = T(s.destaque, ctx);
  switch (s.layout) {
    case "capa": case "agenda": case "encerramento": return null;
    case "topicos": return { titulo, corpo: junta(listaDe(s.texto, ctx), dest) };
    case "colunas": {
      const bs = blocos(T(s.itens, ctx));
      return { titulo, corpo: junta(bs.map((b) => `- ${[b.titulo, b.linhas.map(semMarca).join("; ")].filter(Boolean).join(": ")}`), dest) };
    }
    case "numero": return { titulo, corpo: junta([T(s.numero, ctx), T(s.rotulo, ctx)].filter(Boolean).join(" – "), listaDe(s.texto, ctx), dest) };
    case "fluxo": return { titulo, corpo: junta(pares(T(s.itens, ctx)).map((p) => `- ${p.titulo.replace(/!$/, "")}${p.texto ? `: ${p.texto.replace(/!$/, "")}` : ""}`), dest) };
    case "tabela": {
      const ls = linhas(T(s.itens, ctx)).map((l) => l.split("|").map((c) => c.trim()));
      return { titulo, corpo: junta(ls.slice(1).map((r) => `- ${r[0]}${r.length > 1 ? `: ${r.slice(1).filter(Boolean).join(" – ")}` : ""}`), dest) };
    }
    case "grafico": return { titulo, corpo: junta(T(s.texto, ctx), linhas(T(s.itens, ctx)).map((l) => `- ${l.split("|").map((c) => c.trim()).join(": ")}`), dest) };
    case "imagem": return { titulo, corpo: T(s.texto, ctx) };
    case "imagemLado": return { titulo, corpo: junta(T(s.texto, ctx), T(s.destaque, ctx)) };
    case "video": return { titulo, corpo: junta(`Vídeo apresentado${s.video ? ` (${s.video})` : ""}.`, T(s.texto, ctx)) };
    case "aviso": return { titulo, corpo: junta(T(s.texto, ctx), dest) };
    case "frase": return { titulo, corpo: junta(T(s.frase, ctx), T(s.texto, ctx)) };
    case "escala": return { titulo, corpo: junta("Foi apresentada a escala do mês, com o responsável de cada dia e as tarefas:", linhas(T(s.texto, ctx)).map((l) => `- ${l}`), dest) };
    case "indicadores": {
      const ind = ctx.indicadores;
      if (!ind) return { titulo, corpo: "" };
      const st = ctx.setores;
      const amAt = num(s.amostras) ?? st?.porMes?.[ctx.mes]?.total ?? null;
      const amAn = num(s.amostrasAnterior) ?? (Array.isArray(st?.meses) ? st.porMes?.[st.meses[0]]?.total : null) ?? null;
      const bloco = (rot, t, am) => [`# ${rot}:`, am != null ? `- ${qtd(am, "amostra analisada", "amostras analisadas")}` : null, `- ${qtd(t.enviadas, "proposta emitida", "propostas emitidas")}`, `- ${qtd(t.aprovadas, "proposta aprovada", "propostas aprovadas")}`, `- ${t.recusadas ? qtd(t.recusadas, "proposta rejeitada", "propostas rejeitadas") : "nenhuma proposta rejeitada"}`].filter(Boolean);
      return { titulo, corpo: junta(bloco(ind.rotuloAnt, ind.ant, amAn), bloco(ind.rotulo, ind.t, amAt), T(s.texto, ctx)) };
    }
    case "setores": {
      const st = ctx.setores;
      if (!st?.porMes || !Array.isArray(st.meses)) return { titulo, corpo: T(s.texto, ctx) };
      const [mAn, mAt] = st.meses;
      const at = st.porMes[mAt] || { total: 0, porSetor: {} };
      const an = st.porMes[mAn] || { total: 0 };
      const rot = { Microbiologia: "Microbiologia", "Físico-química": "Físico-química", Campo: "Campo (in situ)", Parceiros: "Laboratórios parceiros" };
      return {
        titulo,
        corpo: junta(
          `Amostras recebidas em ${mesLongo(mAt).toLowerCase()}: ${at.total} (em ${mesLongo(mAn).toLowerCase()}: ${an.total}).`,
          Object.keys(rot).filter((k) => at.porSetor?.[k]?.amostras).map((k) => `- ${rot[k]}: ${qtd(at.porSetor[k].amostras, "amostra", "amostras")} e ${qtd(at.porSetor[k].ensaios, "ensaio", "ensaios")}`),
          T(s.texto, ctx),
        ),
      };
    }
    case "tendencia": {
      const ser = ctx.serie || [];
      return { titulo, corpo: junta("Foi apresentada a evolução das propostas nos últimos meses:", ser.map((x) => `- ${mesCurto(x.mes)}/${x.mes.slice(2, 4)}: ${qtd(x.enviadas, "proposta enviada", "propostas enviadas")}, ${x.aprovadas} aprovada${x.aprovadas === 1 ? "" : "s"}`), T(s.texto, ctx)) };
    }
    case "ranking": {
      const top = ctx.podio || [];
      return { titulo, corpo: top.length ? junta(`Foram apresentados os ${top.length === 1 ? "colaborador" : `${top.length} colaboradores`} com melhor desempenho no mês:`, top.map((x, i) => `- ${i + 1}º lugar: ${x.nome}`)) : "Foram apresentados os colaboradores com melhor desempenho no mês." };
    }
    case "destaque": {
      const nome = (s.nome || "").trim() || ctx.podio?.[0]?.nome || "";
      return { titulo, corpo: junta(nome ? `Foi reconhecido como destaque do mês de ${String(ctx.valores?.mes || "").toLowerCase()}: ${nome}.` : "Foi reconhecido o colaborador destaque do mês.", linhas(T(s.itens, ctx)).map((l) => `- ${l}`)) };
    }
    case "labPrazos": {
      const d = ctx.lab;
      if (!d?.os) return { titulo, corpo: T(s.texto, ctx) };
      const m = d.porMes?.[ctx.mes] || { recebidas: 0, concluidas: 0 };
      return {
        titulo,
        corpo: junta(
          `No dia da reunião havia ${qtd(d.os.andamento, "ordem de serviço em andamento", "ordens de serviço em andamento")}, ${d.os.atrasadas ? `${d.os.atrasadas} com prazo vencido` : "nenhuma com prazo vencido"} e ${d.os.vencendo} vencendo nos próximos 3 dias.`,
          `- Em ${mesLongo(ctx.mes).toLowerCase()}: ${qtd(m.recebidas, "OS recebida", "OS recebidas")} e ${qtd(m.concluidas, "concluída", "concluídas")}`,
          T(s.texto, ctx),
        ),
      };
    }
    case "labNcs": {
      const r = ctx.ncs;
      if (!r) return { titulo, corpo: T(s.texto, ctx) };
      return {
        titulo,
        corpo: junta(
          r.total ? `Foram registradas ${qtd(r.total, "não conformidade", "não conformidades")} no mês, ${r.retrabalho ? `${r.retrabalho} com retrabalho` : "nenhuma com retrabalho"}; ${r.abertas} ainda em aberto.` : `Nenhuma não conformidade registrada no mês${r.abertas ? `; ${r.abertas} ainda em aberto de meses anteriores` : ""}.`,
          r.porTipo.map((x) => `- ${x.nome}: ${x.n}`),
          T(s.texto, ctx),
        ),
      };
    }
    case "labProdutividade": {
      const r = ctx.produtividade;
      if (!r?.pessoas?.length) return { titulo, corpo: T(s.texto, ctx) };
      return {
        titulo,
        corpo: junta(
          `No mês foram realizados ${r.ensaios} ensaios e emitidos ${r.laudos} laudos ou relatórios${r.pctRetrabalho != null ? `; ${String(r.pctRetrabalho).replace(".", ",")}% dos ensaios foram repetidos` : ""}.`,
          T(s.texto, ctx),
        ),
      };
    }
    case "quiz": {
      const certa = linhas(T(s.itens, ctx)).find((l) => l.startsWith("*"));
      return { titulo, corpo: junta(T(s.texto, ctx), certa ? `- Resposta: ${certa.replace(/^\*\s*/, "")}` : null, dest) };
    }
    case "combinados": {
      const its = ctx.anterior || [];
      return its.length ? { titulo, corpo: junta("Foram revisados os combinados da reunião anterior:", its.map((x) => `- ${x.texto}${x.dono ? ` (${x.dono})` : ""}: ${x.feito ? "concluído" : "pendente"}`)) } : null;
    }
    case "compromissos": {
      const its = ctx.ata || [];
      return its.length ? {
        titulo,
        corpo: its.map((x) => {
          const det = [x.dono && `responsável: ${x.dono}`, x.prazo && `prazo: ${dataCurta(x.prazo)}`].filter(Boolean);
          return `- ${x.tipo === "decisao" ? "Decisão: " : ""}${x.texto}${det.length ? ` (${det.join("; ")})` : ""}`;
        }).join("\n"),
      } : null;
    }
    default: return { titulo, corpo: junta(T(s.texto, ctx), dest) };
  }
}

/** Pauta inteira: um item por slide visível + encerramento. */
export function pautaDaApresentacao(slides, ctx = {}) {
  const itens = (slides || []).filter((s) => !s.oculto).map((s) => itemDoSlide(s, ctx)).filter((x) => x && x.titulo);
  return [...itens, { titulo: "Encerramento", corpo: ENCERRAMENTO, semNumero: true }];
}

// ------------------------------------------------------------------ Word
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const R = '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/>';
const run = (t, { negrito = false, quebra = false } = {}) => `<w:r><w:rPr>${negrito ? "<w:b/><w:bCs/>" : ""}${R}</w:rPr>${quebra ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const pPadrao = `<w:pPr><w:rPr>${R}</w:rPr></w:pPr>`;
const pMarcador = `<w:pPr><w:pStyle w:val="PargrafodaLista"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="25"/></w:numPr><w:rPr>${R}</w:rPr></w:pPr>`;

/** Linha "# x" vira negrito; "- x" vira marcador; o resto, texto corrido. */
function linhaParaRun(l, quebra) {
  return l.startsWith("# ") ? run(l.slice(2), { negrito: true, quebra }) : run(l, { quebra });
}

/** Parágrafos do Word para a pauta (igual ao modelo: título em negrito e o texto logo abaixo). */
export function pautaXml(pauta) {
  const out = [];
  let n = 0;
  for (const it of pauta || []) {
    const ls = String(it.corpo || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const titulo = it.semNumero ? it.titulo : `${++n}. ${it.titulo}`;
    let atual = [run(titulo, { negrito: true })];
    for (const l of ls) {
      if (l.startsWith("- ")) {
        if (atual) { out.push(`<w:p>${pPadrao}${atual.join("")}</w:p>`); atual = null; }
        out.push(`<w:p>${pMarcador}${run(l.slice(2))}</w:p>`);
      } else if (atual) {
        atual.push(linhaParaRun(l, true));
      } else {
        out.push(`<w:p>${pPadrao}${linhaParaRun(l, false)}</w:p>`);
      }
    }
    if (atual) out.push(`<w:p>${pPadrao}${atual.join("")}</w:p>`);
  }
  return out.join("") || `<w:p>${pPadrao}</w:p>`;
}

/** Linha da tabela (<w:tr>) que contém o marcador. */
function linhaCom(xml, marcador) {
  const i = xml.indexOf(marcador);
  if (i < 0) throw new Error(`Modelo da ata sem o campo ${marcador}.`);
  const a = Math.max(xml.lastIndexOf("<w:tr>", i), xml.lastIndexOf("<w:tr ", i));
  const b = xml.indexOf("</w:tr>", i) + "</w:tr>".length;
  return [a, b];
}

/** Parágrafo (<w:p>…</w:p>) que contém o marcador. */
function paragrafoCom(xml, marcador) {
  const i = xml.indexOf(marcador);
  if (i < 0) throw new Error(`Modelo da ata sem o campo ${marcador}.`);
  const a = Math.max(xml.lastIndexOf("<w:p>", i), xml.lastIndexOf("<w:p ", i));
  const b = xml.indexOf("</w:p>", i) + "</w:p>".length;
  return [a, b];
}

export const dataBR = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? iso.split("-").reverse().join("/") : String(iso || ""));

/**
 * Preenche o document.xml do modelo. ata = { data (AAAA-MM-DD), local, inicio,
 * fim, solicitante, cargo, assunto, participantes: [nome], pauta: [{titulo, corpo}], obs }.
 */
export function preencherAtaXml(xml, ata) {
  let x = xml;
  const simples = { DATA: dataBR(ata.data), LOCAL: ata.local, INICIO: ata.inicio, FIM: ata.fim, SOLICITANTE: ata.solicitante, CARGO: ata.cargo, ASSUNTO: ata.assunto };
  for (const [k, v] of Object.entries(simples)) x = x.split(`{{${k}}}`).join(esc(v || ""));

  // Participantes: a 1ª linha abre as células mescladas ("Participantes" e
  // "Assinaturas"); as demais continuam a mescla. Assinatura fica em branco.
  const nomes = (ata.participantes || []).map((s) => String(s).trim()).filter(Boolean);
  const lista = nomes.length ? nomes : Array(8).fill("");
  const [a1, b1] = linhaCom(x, "{{P1}}");
  const [aN, bN] = linhaCom(x, "{{PN}}");
  const l1 = x.slice(a1, b1);
  const lN = x.slice(aN, bN);
  const linhas_ = lista.map((nome, i) => (i === 0 ? l1.replace("{{P1}}", esc(nome)) : lN.replace("{{PN}}", esc(nome))));
  x = x.slice(0, a1) + linhas_.join("") + x.slice(bN);

  const [ap, bp] = paragrafoCom(x, "{{PAUTA}}");
  x = x.slice(0, ap) + pautaXml(ata.pauta) + x.slice(bp);

  const obs = String(ata.obs || "").split("\n").map((l) => l.trim());
  const usadas = obs.filter(Boolean).length ? obs : [];
  const pObs = usadas.map((l) => `<w:p><w:pPr><w:ind w:left="360"/></w:pPr>${l ? run(l) : ""}</w:p>`);
  while (pObs.length < 12) pObs.push("<w:p/>");
  const [ao, bo] = paragrafoCom(x, "{{OBS}}");
  x = x.slice(0, ao) + pObs.join("") + x.slice(bo);
  return x;
}

/** Nome do arquivo no padrão das atas: "ATA DE REUNIÃO - EQUIPE GERAL 14.08.2026.docx". */
export function nomeArquivoAta(ata) {
  const d = dataBR(ata.data).replace(/\//g, ".");
  return `ATA DE REUNIÃO - ${TIPOS_ATA[ata.tipo]?.arquivo || "EQUIPE GERAL"} ${d}.docx`.replace(/[\\/:*?"<>|]/g, "");
}

/** Nome curto para a lista de presença: apelido ou os dois primeiros nomes, sem caixa alta. */
export function nomeCurto(p) {
  const t = String(p?.apelido || "").trim() || String(p?.nome || "").trim().split(/\s+/).slice(0, 2).join(" ");
  return t.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
}
