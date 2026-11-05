// Documentos da Ordem de serviço (menu "Documentos" da lista, como no
// GerenciaLab): plano de amostragem, embalagens, fichas de análise MB/FQ por
// OS ou por amostra e análises subcontratadas MB/FQ. Tudo para imprimir/PDF.
// Rota: #/doc-os/<tipo>.<id da amostra>.<id>...

import { useDados, configSistema } from "../lib/dados.jsx";
import { referenciaAmostra, numeroOS } from "../lib/ordens.js";
import { dataBR } from "../lib/formato.js";
import { NaoAchou } from "./Clientes.jsx";
import { CodigoBarras } from "./Ordens.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";
import { Documento, Bloco } from "../components/Documento.jsx";
import { acreditadoNoEscopo } from "../lib/escopo.js";

export const DOCUMENTOS_OS = [
  ["plano", "Plano de amostragem"],
  ["embalagens", "Embalagens"],
  ["mb-os", "Ficha de análise MB - O.S"],
  ["fq-os", "Ficha de análise FQ - O.S"],
  ["sub-mb-os", "Análise Subcontratado MB - O.S"],
  ["sub-fq-os", "Análises Subcontratado FQ - O.S"],
  ["mb-am", "Ficha de análise MB - Amostra"],
  ["fq-am", "Ficha de análise FQ - Amostra"],
  ["am", "Ficha de análise"],
];

const quandoBR = (s) => (s ? (String(s).length > 10 ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : dataBR(s)) : "");

// MB = setor Microbiológico; FQ = o resto. Sem setor no cadastro do
// parâmetro, reconhece pelo nome (coliformes, Salmonella, bactérias…).
const NOMES_MICRO = /colifor|escherichia|e\.\s?coli|salmonel|bact[eé]ri|enteroco|estafiloco|staphylo|listeria|pseudomonas|clostr[ií]d|bolor|levedur|fung|coagulase|heterotr[oó]f|mes[oó]fil|psicrotr[oó]f|bacillus|vibrio|shigella|campylobacter|cianobact|ovos? de helminto|protozo|giardia|cryptospor|legionell|ufc|nmp/i;
export function ehMicro(dados, pid, nome = "") {
  const p = dados.parametros.find((x) => x.id === pid) || {};
  const s = dados.setores.find((x) => x.id === p.setor);
  if (s) return /micro|^mb$/i.test(`${s.nome || ""} ${s.sigla || ""}`.trim());
  return NOMES_MICRO.test(`${p.parametro || nome} ${p.descricao || ""}`);
}

function Topo({ titulo, os, cfg }) {
  return (
    <div className="doc-topo"><img src={logoMinasLab} alt="MinasLab" width="120" height="36" />
      <div><b>{titulo}</b><br /><span className="suave">{cfg.empresa || "MinasLab"}{cfg.cnpj ? ` · CNPJ ${cfg.cnpj}` : ""}</span></div>
      <div style={{ textAlign: "right" }}>{os ? <b>{numeroOS(os)}</b> : null}<br /><span className="suave">Emitido em {new Date().toLocaleDateString("pt-BR")}</span></div></div>
  );
}

export function DocumentoOS({ param }) {
  const { dados } = useDados();
  const [tipo, ...ids] = String(param || "").split(".").filter(Boolean);
  const def = DOCUMENTOS_OS.find(([k]) => k === tipo);
  const amostras = ids.map((id) => dados.amostras.find((a) => a.id === id)).filter(Boolean);
  if (!def || !amostras.length) return <NaoAchou />;
  const cfg = configSistema(dados);
  const par = (pid) => dados.parametros.find((x) => x.id === pid) || {};
  const sub = (pid) => dados.subcontratados.find((s) => s.id === par(pid).subcontratado);
  const filtro = tipo === "am" ? () => true : tipo.includes("mb") ? (x) => ehMicro(dados, x.pid, x.nome) : tipo.includes("fq") ? (x) => !ehMicro(dados, x.pid, x.nome) : () => true;
  const soSub = tipo.startsWith("sub-");
  const analisesDe = (a) => a.analises.filter((x) => a.status !== "Cancelado" && filtro(x) && (!soSub || sub(x.pid)));
  const porOS = {};
  for (const a of amostras) (porOS[a.osId] ||= []).push(a);
  const cli = (a) => dados.clientes.find((c) => c.id === a.clienteId) || {};
  const cab = (os, a) => (
    <dl className="detail">
      <div><dt>Cliente</dt><dd>{cli(a).razao}</dd></div><div><dt>Ordem de serviço</dt><dd>{os ? numeroOS(os) : a.os}</dd></div>
      <div><dt>Contrato</dt><dd>{os?.contrato || ""}</dd></div><div><dt>Data da coleta</dt><dd>{quandoBR(a.dataColeta || os?.dataColeta) || "—"}</dd></div>
    </dl>
  );
  const vazio = <p className="suave">Nenhum parâmetro {soSub ? "subcontratado " : ""}{tipo.includes("mb") ? "microbiológico" : tipo.includes("fq") ? "físico-químico" : ""} nas amostras selecionadas.</p>;
  const assinaturas = <table className="doc-tab"><thead><tr><th>Analista</th><th>Data</th><th>Revisor</th><th>Data</th></tr></thead><tbody><tr><td style={{ height: 34 }} /><td /><td /><td /></tr></tbody></table>;

  let corpo;
  if (tipo === "plano") {
    corpo = Object.values(porOS).map((l) => { const os = dados.ordens.find((o) => o.id === l[0].osId); return (
      <div className="doc" key={l[0].osId}><Topo titulo="Plano de amostragem" os={os} cfg={cfg} />{cab(os, l[0])}
        <table className="doc-tab"><thead><tr><th>Amostra</th><th>Código</th><th>Identificação / ponto</th><th>Matriz</th><th>Legislação</th><th>Parâmetros</th><th>Data prevista</th></tr></thead>
          <tbody>{l.map((a) => <tr key={a.id}><td>{referenciaAmostra(a)}</td><td>{a.barra}</td><td>{a.identificacao || ""}</td><td>{a.matriz || a.servico}</td><td>{a.legislacao}</td><td>{a.analises.map((x) => x.nome).join(", ")}</td><td>{quandoBR(a.dataColeta)}</td></tr>)}</tbody></table>
        <table className="doc-tab"><thead><tr><th>Responsável pela amostragem</th><th>Assinatura</th></tr></thead><tbody><tr><td style={{ height: 30 }} /><td /></tr></tbody></table>
      </div>); });
  } else if (tipo === "embalagens") {
    corpo = Object.values(porOS).map((l) => {
      const os = dados.ordens.find((o) => o.id === l[0].osId);
      const soma = new Map();
      for (const a of l) for (const x of a.analises) { const p = par(x.pid); const k = `${p.embalagem || "Não informado"}|${p.preservante || ""}`; const e = soma.get(k) || { emb: p.embalagem || "Não informado", pres: dados.preservantes.find((q) => q.id === p.preservante)?.nome || "", qtd: p.quantidade || "", params: new Set(), amostras: new Set() }; e.params.add(x.nome); e.amostras.add(a.id); soma.set(k, e); }
      return (
        <div className="doc" key={l[0].osId}><Topo titulo="Embalagens" os={os} cfg={cfg} />{cab(os, l[0])}
          <table className="doc-tab"><thead><tr><th>Frasco / embalagem</th><th>Preservante</th><th>Volume</th><th>Qtde de frascos</th><th>Parâmetros</th></tr></thead>
            <tbody>{[...soma.values()].map((e, i) => <tr key={i}><td>{e.emb}</td><td>{e.pres}</td><td>{e.qtd}</td><td>{e.amostras.size}</td><td>{[...e.params].join(", ")}</td></tr>)}</tbody></table>
        </div>);
    });
  } else {
    // Ficha de análise no padrão MinasLab: por OS (todas as amostras) ou por amostra.
    const grupos = tipo.endsWith("-am") || tipo === "am" ? amostras.map((a) => [a]) : Object.values(porOS);
    const subtitulo = soSub ? `Análise Subcontratada ${tipo.includes("mb") ? "Microbiológica" : "Físico Química"}` : tipo.includes("mb") ? "Análise Microbiológico" : tipo.includes("fq") ? "Análise Físico Química" : "";
    const prazoConclusao = (a) => { const dias = Math.max(0, ...a.analises.map((x) => Number(par(x.pid).prazoDias) || 0)); const base = a.dataEntrada || a.dataColeta; if (!dias || !base) return ""; const d = new Date(String(base).length > 10 ? base : `${base}T12:00`); d.setDate(d.getDate() + dias); return d.toISOString(); };
    const ac = (x, a) => (x.inloco || /in\s*situ/i.test(x.nome) ? "³" : acreditadoNoEscopo(dados.escopo_acreditacao, { parametro: par(x.pid).id ? par(x.pid) : { acreditado: x.acred ? "Sim" : "Não", nome: x.nome }, metodoTexto: x.metodo, matriz: a.matriz || a.servico }) ? "¹" : "²");
    corpo = grupos.map((l) => {
      const blocos = l.map((a) => ({ a, an: analisesDe(a) })).filter((b) => b.an.length);
      return (
        <Documento key={l.map((a) => a.id).join("-")} dados={dados} titulo="Ficha de análise" subtitulo={subtitulo}>
          {blocos.length ? blocos.map(({ a, an }) => (
            <div key={a.id}>
              <Bloco titulo={`Ordem de Serviço ${a.os} / Amostra ${referenciaAmostra(a)}`} pares={[["Nº da Amostra", referenciaAmostra(a)], ["Identificação", a.identificacao || a.matriz || ""], ["Prazo de Validade", ""], ["Data e hora da Coleta", quandoBR(a.dataColeta)], ["Data de Recebimento", quandoBR(a.dataEntrada)], ["Prazo de Conclusão", quandoBR(prazoConclusao(a))]]} />
              <table style={{ marginBottom: 14 }}><thead><tr><th>Ensaio</th><th>Método de Análise</th><th>Unidade</th>{soSub ? <th>Laboratório</th> : null}<th style={{ width: "12%" }}>Valor</th><th style={{ width: "12%" }}>Analista</th><th style={{ width: "9%" }}>Data</th></tr></thead>
                <tbody>{an.map((x) => <tr key={x.pid}><td className="esq">{x.nome}<sup>{ac(x, a)}</sup></td><td className="esq">{x.metodo}</td><td className="esq">{x.un}</td>{soSub ? <td className="esq">{sub(x.pid)?.empresa || ""}</td> : null}<td>{x.resultado || ""}</td><td>{x.analista || ""}</td><td>{x.termino ? quandoBR(String(x.termino).slice(0, 10)) : ""}</td></tr>)}</tbody></table>
            </div>
          )) : vazio}
        </Documento>
      );
    });
  }
  return (
    <>
      <div className="box nao-imprimir"><div className="box-head-row"><h2 className="box-title">{def[1]} · {amostras.length} amostra(s)</h2>
        <div className="acoes"><button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir / PDF</button><button type="button" className="btn btn-default" onClick={() => window.history.back()}>Voltar</button></div></div></div>
      {corpo}
    </>
  );
}
