// Propostas → Visualizar Proposta, no layout do documento do GerenciaLab:
// 1. Cliente/Solicitante · 2. Dados da negociação · 3. Pontos de coleta e
// ensaios (por amostra, com parâmetros, LQ e VMP) · Outros custos · Legenda ·
// cláusulas 4 a 12 do modelo da MinasLab. Botões Voltar, Análise crítica,
// Editar, Aceitar e Imprimir.

import { useEffect, useState } from "react";
import { useDados, configSistema } from "../lib/dados.jsx";
import { link } from "../lib/rota.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { enderecosDoCliente } from "../lib/clientes.js";
import { emailsDoSolicitante } from "../lib/solicitantes.js";
import { limiteDe } from "../lib/laboratorio.js";
import { numeroProposta, precoUnitario, totalItem, totalOutros, exibicao, aceitarProposta, podeEditar } from "../lib/propostas.js";
import { INTRO_PADRAO, LEGENDA_PADRAO, OBSERVACOES_PADRAO, CLAUSULAS_PADRAO, clausulas } from "../lib/modeloProposta.js";
import { textoLimite } from "./Laboratorio.jsx";
import { Modal, RotuloProposta, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";

const linhaEnd = (e) => (e ? [e.end && `${e.end}, nº ${e.num || "s/n"}`, e.comp, e.bairro, e.cidade && `${e.cidade}/${e.uf || ""}`, e.cep].filter(Boolean).join(" - ") : "");
const respostas = (tipo) => (tipo === "Sim/Não/Não se aplica" ? ["Sim", "Não", "Não se aplica"] : tipo === "Texto" ? null : ["Sim", "Não"]);

export default function PropostaVer({ param }) {
  const { dados, salvar, eu } = useDados();
  const avisar = useAviso();
  const p = dados.propostas.find((x) => x.id === param);
  const [aceite, setAceite] = useState(null);
  const [critica, setCritica] = useState(null);
  // "Documentos → Baixar Proposta em PDF" abre aqui e chama a impressão (Salvar como PDF).
  useEffect(() => {
    let id = null;
    try { id = sessionStorage.getItem("lims:imprimir"); if (id === param) sessionStorage.removeItem("lims:imprimir"); } catch { /* sem armazenamento */ }
    if (id === param) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); }
    return undefined;
  }, [param]);
  if (!p) return <NaoAchou />;
  const c = dados.clientes.find((x) => x.id === p.clienteId) || {};
  const sol = dados.solicitantes.find((s) => s.id === p.solicitanteId);
  const ex = exibicao(p);
  const cfg = configSistema(dados);
  const ends = enderecosDoCliente(c);
  const endPrincipal = ends.find((e) => e.tipo === "Principal" && e.padrao === "Sim") || ends.find((e) => e.tipo === "Principal") || ends[0];
  const respEmail = (tipo, email) => { const e = ends.find((x) => x.tipo === tipo && x.email === email) || ends.find((x) => x.tipo === tipo); return { resp: e?.responsavel || c.resp, email: email || e?.email || c.email }; };
  const emP = respEmail("Principal", p.emailCliProp), emN = respEmail("Nota Fiscal", p.emailCliNF), emR = respEmail("Resultados", p.emailCliRes);
  const comercial = dados.funcionarios.find((f) => f.nome === p.resp);
  const modelo = dados.modelos.find((m) => m.tipo === "Proposta" && estaAtivo(m) && m.titulo === p.modelo && String(m.conteudo || "").trim());
  const blocos = clausulas(modelo?.conteudo || CLAUSULAS_PADRAO);
  const perguntas = dados.analise_critica_itens.filter(estaAtivo).sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  const salvarCritica = async () => {
    const falta = perguntas.filter((q) => q.obrigatoria !== "Não" && !String(critica[q.id] ?? "").trim());
    if (falta.length) { avisar(`Responda: ${falta.map((q) => q.pergunta).join("; ")}`, "err"); return false; }
    const reprovada = perguntas.some((q) => respostas(q.resposta) && critica[q.id] === "Não");
    try {
      await salvar("propostas", { ...p, analiseCritica: { respostas: critica, em: new Date().toISOString(), por: eu?.nome || eu?.usuario || "" }, status: p.status === "Aceito" ? p.status : reprovada ? "A-C pendente" : "A-C Aprovado" }, { motivo: "Análise crítica" });
      avisar(reprovada ? "Análise crítica com pendência." : "Análise crítica aprovada.", "ok");
    } catch (e) { avisar(e.message, "err"); return false; }
  };

  return (
    <>
      <div className="doc-acoes nao-imprimir">
        <h2 className="box-title" style={{ margin: 0 }}>Visualizar Proposta <b>{numeroProposta(p)}</b> <RotuloProposta status={p.status} /></h2>
        <div className="acoes">
          <a className="btn btn-default" href={link("proposedlist")}>Voltar</a>
          <button type="button" className="btn btn-default" onClick={() => setCritica({ ...(p.analiseCritica?.respostas || {}) })}>Análise crítica</button>
          {podeEditar(p) && <a className="btn btn-default" href={link("criar-proposta", p.id)}>Editar Proposta</a>}
          <button type="button" className="btn btn-default" onClick={() => window.print()}>Imprimir / PDF</button>
          {p.status !== "Aceito" && <button type="button" className="btn btn-success" onClick={() => setAceite({ data: isoDia(0), nome: c.resp || "", obs: "" })}>Aceitar proposta</button>}
        </div>
      </div>
      <article className="doc prop-doc">
        <div className="doc-topo">
          <img src={logoMinasLab} alt="MinasLab, Laboratório de Controle de Qualidade" width="170" height="51" />
          <div style={{ textAlign: "right" }}><b>{(cfg.tituloProposta || "PROPOSTA COMERCIAL").toUpperCase()}</b><br />Nº {numeroProposta(p)}<br /><span className="suave">Identificação {p.ident}</span></div>
        </div>

        <h5>1. CLIENTE/SOLICITANTE</h5>
        <table className="doc-tab"><thead><tr><th style={{ textAlign: "center" }}>Dados do cliente</th></tr></thead><tbody>
          <tr><td><b>Razão Social:</b> {c.razao} - <b>{c.pessoa === "PF" ? "CPF" : "CNPJ"}:</b> {c.doc}{(endPrincipal?.tel || c.tel) && <> - <b>Telefone:</b> {endPrincipal?.tel || c.tel}</>}</td></tr>
          <tr><td><b>Endereço:</b> {linhaEnd(endPrincipal)}</td></tr>
          <tr><td><b>Email Principal:</b><br /><b>Responsável:</b> {emP.resp} <b>E-mail:</b> {emP.email}</td></tr>
          <tr><td><b>Email Nota Fiscal:</b><br /><b>Responsável:</b> {emN.resp} <b>E-mail:</b> {emN.email}</td></tr>
          <tr><td><b>Email Resultado:</b><br /><b>Responsável:</b> {emR.resp} <b>E-mail:</b> {emR.email}</td></tr>
          <tr><td><b>Unidade: {p.unidade && p.unidade !== "Não tem unidade" ? p.unidade : "Não consta"}</b></td></tr>
        </tbody></table>
        {sol && (
          <table className="doc-tab"><thead><tr><th style={{ textAlign: "center" }}>Dados do solicitante</th></tr></thead><tbody>
            <tr><td><b>Razão Social:</b> {sol.razao || sol.nome}{sol.doc && <> - <b>CNPJ:</b> {sol.doc}</>}{sol.tel && <> - <b>Telefone:</b> {sol.tel}</>}</td></tr>
            <tr><td><b>Responsável:</b> {sol.nome} <b>E-mail:</b> {p.emailSolProp || emailsDoSolicitante(sol)[0] || ""}</td></tr>
          </tbody></table>
        )}

        <h5>2. DADOS DA NEGOCIAÇÃO</h5>
        <table className="doc-tab"><thead><tr><th colSpan={2} style={{ textAlign: "center" }}>Dados da Proposta</th></tr></thead><tbody>
          <tr><td><b>Data da Proposta Comercial:</b> {dataBR(p.criacao)}</td><td><b>Condições de pagamento:</b> {p.condicoes || "A combinar"}{p.ciclo === "Parcelado" ? ` (${p.parcelas}x)` : ""}</td></tr>
          <tr><td><b>Prazo de validade:</b> {dataBR(p.validade)}</td><td><b>Responsável pela Coleta:</b> {p.respColeta === "Cliente" ? "Cliente" : "Minaslab Laboratório"}</td></tr>
          <tr><td><b>Comercial:</b> {p.resp}</td><td><b>E-mail Comercial:</b> {comercial?.email || cfg.emailComercial || ""}</td></tr>
          {ex.valores && <tr><td colSpan={2}><b>Total da proposta:</b> {brl(ex.total)}</td></tr>}
        </tbody></table>
        <p><b>Prezado(a) cliente,</b></p>
        {INTRO_PADRAO.split("\n").map((l, i) => <p key={i}>{l}</p>)}
        {p.instrucaoColeta && <p><b>Instrução de coleta:</b> {p.instrucaoColeta}</p>}

        <h5>3. DESCRIÇÃO DOS PONTOS DE COLETA E ENSAIOS</h5>
        {(p.itens || []).map((it, i) => (
          <div key={it.iid || i} className="prop-ponto">
            <table className="doc-tab">
              <thead><tr><th colSpan={5} style={{ textAlign: "center" }}>Ponto de Amostragem: {it.ident || `Amostra ${i + 1}`}{it.entradaSaida && it.entradaSaida !== "-" ? ` (${it.entradaSaida})` : ""}</th></tr></thead>
              <tbody>
                <tr><td colSpan={2}><b>Endereço de Coleta:</b> {it.enderecoColeta || (p.respColeta === "Cliente" ? "Coleta pelo cliente" : linhaEnd(endPrincipal))}</td><td><b>Grupo:</b> {it.grupo || "—"}</td><td colSpan={2}><b>Matriz:</b> {it.matriz || it.descricao}</td></tr>
                <tr><td><b>Prazo da amostra</b><br />{it.prazo ? `${it.prazo} dias` : "—"}</td><td><b>Período</b><br />{it.periodicidade || "Único"}{it.repetir ? ` (a cada ${it.repetir})` : ""}</td>
                  <td><b>Valor Unitário Amostra:</b><br />{ex.valores ? brl(precoUnitario(it)) : "—"}</td><td><b>Quantidade</b><br />{it.qtd}</td><td><b>Valor Total Amostra</b><br />{ex.valores ? brl(totalItem(it)) : "—"}</td></tr>
                <tr><td colSpan={5}><b>Descrição da amostra</b> {it.descricao}{it.legislacao ? ` · ${it.legislacao}` : ""}{it.legislacao2?.length ? ` · Comparativa: ${it.legislacao2.join(", ")}` : ""}</td></tr>
              </tbody>
            </table>
            <table className="doc-tab">
              <thead><tr><th>Parâmetros</th><th>Unidade de Medida</th><th>Metodologia</th><th>L.Q.</th><th>VMP</th>{ex.porParametro && <th>Valor</th>}</tr></thead>
              <tbody>{it.params.map((x) => (
                <tr key={x.id}><td>{x.nome}<sup>{x.acred ? (/in ?situ|in loco/i.test(x.nome) ? "3" : "1") : "2"}</sup>{x.subcontratado ? " *" : ""}</td><td>{x.un}</td><td>{x.metodo}</td><td>{x.lq}</td><td>{textoLimite(limiteDe(dados, { legislacao: x.criterio || it.legislacao }, x.id)) || "-"}</td>{ex.porParametro && <td>{brl(x.preco)}</td>}</tr>
              ))}</tbody>
            </table>
          </div>
        ))}
        {ex.outros && totalOutros(p) > 0 && (
          <table className="doc-tab"><thead><tr><th colSpan={4} style={{ textAlign: "center" }}>Outros custos</th></tr><tr><th>Serviço</th><th>Especificação</th><th>Valor Unitário</th><th>Valor Total</th></tr></thead>
            <tbody>{(Array.isArray(p.outrosItens) ? p.outrosItens : [{ servico: "Outros custos", espec: "", valor: p.outros, qtd: 1 }]).map((o, i) => <tr key={i}><td>{o.servico}</td><td>{o.espec}</td><td>{brl(o.valor)}</td><td>{brl((Number(o.valor) || 0) * (Number(o.qtd) || 1))}</td></tr>)}</tbody></table>
        )}
        <p><b>Legenda:</b> {LEGENDA_PADRAO}</p>
        {(p.itens || []).some((it) => it.params.some((x) => x.subcontratado)) && <p>* Ensaio realizado por laboratório subcontratado: {[...new Set(p.itens.flatMap((it) => it.params.map((x) => x.subcontratado)).filter(Boolean))].join(", ")}.</p>}
        <p><b>Observações Importantes:</b><br />{OBSERVACOES_PADRAO}</p>
        {p.obs && <p style={{ whiteSpace: "pre-wrap" }}><b>Observações:</b> {p.obs}</p>}

        {blocos.map((b, i) => (
          <div key={i}>{b.titulo && <h5>{b.titulo}</h5>}{b.texto.map((t, k) => <p key={k}>{t}</p>)}</div>
        ))}
        <p>Atenciosamente</p>
        <p><b>{p.resp}</b>{comercial?.email ? <><br />{comercial.email}</> : null}</p>

        {p.aceite && <><h5>ACEITE</h5><p>Proposta aceita por <b>{p.aceite.nome}</b> em {dataBR(p.aceite.data)}.{p.aceite.obs ? ` ${p.aceite.obs}` : ""}</p></>}
        {p.revs?.length > 0 && <>
          <h5>HISTÓRICO DE REVISÕES</h5>
          <table className="doc-tab"><thead><tr><th>Versão</th><th>Data</th><th>Por</th><th>Motivo da revisão</th></tr></thead>
            <tbody>{p.revs.map((r, i) => <tr key={i}><td>{r.ver}</td><td>{dataBR(r.em)}</td><td>{r.por}</td><td>{r.motivo}</td></tr>)}</tbody></table>
        </>}
      </article>
      {aceite && (
        <Modal titulo="Aceitar proposta" onFechar={() => setAceite(null)} rotuloOk="Aceitar" aoConfirmar={async () => {
          try { await salvar("propostas", aceitarProposta(p, aceite), { motivo: `Aceite de ${aceite.nome}` }); avisar("Proposta aceita.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="mAcD">Data do aceite</label><input id="mAcD" type="date" value={aceite.data} onChange={(e) => setAceite({ ...aceite, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="mAcN">Aceito por</label><input id="mAcN" value={aceite.nome} onChange={(e) => setAceite({ ...aceite, nome: e.target.value })} /></div>
          <div className="fg"><label htmlFor="mAcO">Observação</label><textarea id="mAcO" rows={2} value={aceite.obs} onChange={(e) => setAceite({ ...aceite, obs: e.target.value })} /></div>
        </Modal>
      )}
      {critica && (
        <Modal titulo="Análise crítica" largo onFechar={() => setCritica(null)} rotuloOk={perguntas.length ? "Salvar análise crítica" : undefined} aoConfirmar={salvarCritica}>
          {!perguntas.length ? <p style={{ margin: 0 }}>Nenhuma pergunta cadastrada. Cadastre em <a href={link("configuracao-proposta-analise-critica")}>Configurações → Proposta Análises Críticas</a> (ISO/IEC 17025 7.1).</p> : perguntas.map((q) => (
            <div className="fg" key={q.id} style={{ marginBottom: 10 }}><label htmlFor={`ac-${q.id}`}>{q.pergunta}{q.obrigatoria !== "Não" ? " *" : ""}</label>
              {respostas(q.resposta) ? <select id={`ac-${q.id}`} value={critica[q.id] || ""} onChange={(e) => setCritica({ ...critica, [q.id]: e.target.value })}>{opcoes([["", "Selecione"], ...respostas(q.resposta)])}</select>
                : <input id={`ac-${q.id}`} value={critica[q.id] || ""} onChange={(e) => setCritica({ ...critica, [q.id]: e.target.value })} />}</div>
          ))}
          {p.analiseCritica && <p className="suave" style={{ margin: 0 }}>Última análise: {new Date(p.analiseCritica.em).toLocaleString("pt-BR")} por {p.analiseCritica.por}.</p>}
        </Modal>
      )}
    </>
  );
}
