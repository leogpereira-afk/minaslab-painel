// Propostas → "Adicionar serviços a proposta", fiel ao GerenciaLab:
//  - Responsável pela coleta (Cliente / MinasLab) e Instrução de Coleta.
//  - Grade de amostras (ID, Grupo, Matriz, Identificação, Legislação, Qtde,
//    Total da amostra, Entrada/Saída, Desconto %, Prazo) com os parâmetros de
//    cada amostra abaixo (Mostrar/Esconder).
//  - Menus Amostras, Parâmetros e SubContratado, e Adicionar endereço.
// Cada mudança grava na hora (como no GerenciaLab). O item guarda uma cópia
// dos parâmetros e preços do momento: mudar o catálogo não altera a proposta.

import { Fragment, useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { brl } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { enderecosDoCliente } from "../lib/clientes.js";
import { numeroProposta, precoUnitario, somaParametros, totalItem, totalOutros, totalProposta, itemDoPacote, itemManual, parametroDoCatalogo } from "../lib/propostas.js";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";

const PERIODICIDADE = ["Único", "Diariamente", "Semanal", "Mensal"];
const AGENDAR = ["Livre - segunda á sexta", "Livre - segunda á sábado", "Livre - todos os dias"];
const novoId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const comIds = (it) => ({ ...it, iid: it.iid || novoId() });

// Botão com submenu (mesmo desenho das grades).
function Menu({ rotulo, itens }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="colunas-sel" onMouseLeave={() => setAberto(false)}>
      <button type="button" className="dbtn" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{rotulo} ▾</button>
      {aberto && <div className="menu-pop" role="menu">{itens.map(([r, fn]) => <button key={r} type="button" role="menuitem" onClick={() => { setAberto(false); fn(); }}>{r}</button>)}</div>}
    </div>
  );
}

function JanelaAmostra({ inicial, onFechar, aoSalvar }) {
  const { dados } = useDados();
  const avisar = useAviso();
  const pacotes = dados.pacotes.filter(estaAtivo);
  const [f, setF] = useState(() => ({ pacote: "", legislacao: "", legislacao2: [], grupo: "", matriz: "", parametros: [], tabela: "", subcontratado: "", periodicidade: "Único", repetir: "", agendar: AGENDAR[0], qtd: 1, ...inicial }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pac = pacotes.find((x) => x.id === f.pacote);
  const matrizes = dados.matrizes.filter((m) => estaAtivo(m) && (!f.grupo || m.grupo === f.grupo));
  const params = dados.parametros.filter((x) => estaAtivo(x) && (!f.grupo || x.grupo === f.grupo));
  const escolherPacote = (id) => {
    const k = pacotes.find((x) => x.id === id);
    setF((x) => ({ ...x, pacote: id, ...(k ? { legislacao: k.legislacao || "", legislacao2: k.legislacao2 ? [k.legislacao2] : [], grupo: k.grupo || "", matriz: k.matriz || "", parametros: [...(k.parametros || [])], tabela: dados.tabelas_preco.find((t) => t.id === k.tabelaPreco)?.nome || "" } : {}) }));
  };
  const [busca, setBusca] = useState("");
  const visiveis = params.filter((x) => !busca || x.parametro.toLowerCase().includes(busca.toLowerCase()));
  return (
    <Modal titulo={inicial.iid ? "Alterar Amostra" : "Adicionar Amostra"} largo onFechar={onFechar} rotuloOk="Salvar" aoConfirmar={() => {
      try {
        const base = pac && !inicial.iid ? itemDoPacote(pac, dados, f.qtd, new Set(f.parametros)) : itemManual(dados, { ...f, subcontratado: dados.subcontratados.find((s) => s.id === f.subcontratado)?.empresa || "" });
        return aoSalvar({ ...base, ...(f.subcontratado ? { params: base.params.map((x) => ({ ...x, subcontratado: dados.subcontratados.find((s) => s.id === f.subcontratado)?.empresa || x.subcontratado })) } : {}), qtd: Math.max(1, Number(f.qtd) || 1), periodicidade: f.periodicidade, repetir: f.repetir, agendar: f.agendar, form: f });
      } catch (e) { avisar(e.message, "err"); return false; }
    }}>
      <div className="frm">
        {!inicial.iid && <div className="fg s12"><label htmlFor="amPac">Pacote</label><select id="amPac" value={f.pacote} onChange={(e) => escolherPacote(e.target.value)}>{opcoes([["", "Sem pacote"], ...pacotes.map((k) => [k.id, k.descricao])])}</select></div>}
        <div className="fg s6"><label htmlFor="amLA">Legislações Aplicáveis Principal</label><select id="amLA" value={f.legislacao} onChange={(e) => set("legislacao", e.target.value)}>{opcoes([["", "Selecione a legislação"], ...dados.legislacoes.map((l) => [l.id, l.nome])])}</select></div>
        <div className="fg s6"><label htmlFor="amLA2">Legislações Aplicáveis Comparativa</label><select id="amLA2" multiple size={3} value={f.legislacao2} onChange={(e) => set("legislacao2", [...e.target.selectedOptions].map((o) => o.value))}>{opcoes(dados.legislacoes.map((l) => [l.id, l.nome]))}</select></div>
        <div className="fg s4"><label htmlFor="amGr">Selecione o grupo serviços</label><select id="amGr" value={f.grupo} onChange={(e) => setF((x) => ({ ...x, grupo: e.target.value, matriz: "", parametros: [] }))}>{opcoes([["", "Selecione o grupo de serviços"], ...dados.grupos_servico.filter(estaAtivo).map((g) => [g.id, g.nome])])}</select></div>
        <div className="fg s4"><label htmlFor="amMat">Selecione a matriz</label><select id="amMat" value={f.matriz} onChange={(e) => set("matriz", e.target.value)}>{opcoes([["", f.grupo ? "Selecione a matriz" : "Selecione primeiro o grupo"], ...matrizes.map((m) => [m.id, m.nome])])}</select></div>
        <div className="fg s4"><label htmlFor="amTab">Tabela de preço</label><select id="amTab" value={f.tabela} onChange={(e) => set("tabela", e.target.value)}>{opcoes([["", "Sem tabela de preço"], ...dados.tabelas_preco.filter(estaAtivo).map((t) => t.nome)])}</select></div>
        <div className="fg s12"><label htmlFor="amBusca">Especificação ({f.parametros.length} marcados)</label>
          <input id="amBusca" placeholder="Digite sua busca" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="multi-lista" style={{ marginTop: 6 }}>{f.grupo ? visiveis.slice(0, 400).map((x) => <label key={x.id}><input type="checkbox" checked={f.parametros.includes(x.id)} onChange={(e) => set("parametros", e.target.checked ? [...f.parametros, x.id] : f.parametros.filter((y) => y !== x.id))} /> {x.parametro}</label>) : <span className="suave">Selecione o grupo de serviços.</span>}</div></div>
        <div className="fg s4"><label htmlFor="amSub">Selecione Subcontratado</label><select id="amSub" value={f.subcontratado} onChange={(e) => set("subcontratado", e.target.value)}>{opcoes([["", "Sem Subcontratado"], ...dados.subcontratados.map((s) => [s.id, `${s.empresa}${s.descricao ? ` ${s.descricao}` : ""}`])])}</select></div>
        <div className="fg s2"><label htmlFor="amQtd">Qtde</label><input id="amQtd" type="number" min="1" value={f.qtd} onChange={(e) => set("qtd", e.target.value)} /></div>
        <div className="fg s2"><label htmlFor="amPer">Periodicidade da Amostra</label><select id="amPer" value={f.periodicidade} onChange={(e) => set("periodicidade", e.target.value)}>{opcoes(PERIODICIDADE)}</select></div>
        {f.periodicidade !== "Único" && <><div className="fg s2"><label htmlFor="amRep">Repetir a cada</label><input id="amRep" type="number" min="1" value={f.repetir} onChange={(e) => set("repetir", e.target.value)} /></div>
          <div className="fg s2"><label htmlFor="amAg">agendar toda</label><select id="amAg" value={f.agendar} onChange={(e) => set("agendar", e.target.value)}>{opcoes(AGENDAR)}</select></div></>}
      </div>
    </Modal>
  );
}

export default function PropostaServicos({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const p0 = dados.propostas.find((x) => x.id === param);
  const p = useMemo(() => (p0 ? { ...p0, itens: (p0.itens || []).map(comIds) } : null), [p0]);
  const [aberto, setAberto] = useState(() => new Set());
  const [selItem, setSelItem] = useState(null);
  const [selPar, setSelPar] = useState(() => new Set());
  const [janela, setJanela] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  if (!p) return <NaoAchou />;
  const cliente = dados.clientes.find((c) => c.id === p.clienteId);
  const item = p.itens.find((i) => i.iid === selItem);
  const gravar = async (np, msg) => {
    setOcupado(true);
    try { await salvar("propostas", np); if (msg) avisar(msg, "ok"); return true; }
    catch (e) { avisar(e.message, "err"); return false; } finally { setOcupado(false); }
  };
  const mudarItem = (iid, fn, msg) => gravar({ ...p, itens: p.itens.map((i) => (i.iid === iid ? fn(i) : i)) }, msg);
  const exigirItem = (fn) => () => (item ? fn(item) : avisar("Selecione uma amostra (clique na linha).", "err"));
  const exigirPar = (fn) => () => (item && selPar.size ? fn(item) : avisar("Marque os parâmetros da amostra.", "err"));
  const finalizar = async () => {
    if (!p.itens.length) { avisar("Adicione ao menos uma amostra.", "err"); return; }
    const { novo: _novo, ...resto } = p;
    if (await gravar(resto)) navegar("proposta", p.id);
  };
  const enderecos = cliente ? enderecosDoCliente(cliente).filter((e) => e.status !== "Inativo") : [];

  return (
    <>
      <div className="box">
        <h2 className="box-title">Adicionar serviços a proposta <b>{numeroProposta(p)}</b></h2>
        <div className="duas-caixas">
          <fieldset className="quadro"><legend>Responsável pela coleta</legend>
            <div className="radios" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              {[["Cliente", "Coleta por Cliente"], ["MinasLab", "Coleta por Minaslab Laboratório"]].map(([v, r]) => <label key={v}><input type="radio" name="respColeta" checked={(p.respColeta || "MinasLab") === v} onChange={() => gravar({ ...p, respColeta: v })} /> {r}</label>)}
            </div>
          </fieldset>
          <fieldset className="quadro"><legend>Instrução de Coleta</legend>
            <textarea aria-label="Instrução de Coleta" rows={3} defaultValue={p.instrucaoColeta || ""} onBlur={(e) => { if (e.target.value !== (p.instrucaoColeta || "")) gravar({ ...p, instrucaoColeta: e.target.value }); }} />
          </fieldset>
        </div>

        <div className="dt-top"><div className="dt-btns">
          <button type="button" className="dbtn" onClick={() => setAberto(aberto.size ? new Set() : new Set(p.itens.map((i) => i.iid)))}>{aberto.size ? "Esconder" : "Mostrar todos"}</button>
          <Menu rotulo="Amostras" itens={[
            ["Adicionar Amostra", () => setJanela({ tipo: "amostra", inicial: {} })],
            ["Alterar Amostra", exigirItem((i) => setJanela({ tipo: "amostra", inicial: { iid: i.iid, qtd: i.qtd, periodicidade: i.periodicidade || "Único", repetir: i.repetir || "", agendar: i.agendar || AGENDAR[0], ...(i.form || {}), parametros: i.params.map((x) => x.id) } }))],
            ["Excluir Amostra", exigirItem((i) => setJanela({ tipo: "excluir", item: i }))],
            ["Copiar Amostra", exigirItem((i) => gravar({ ...p, itens: [...p.itens, { ...structuredClone(i), iid: novoId() }] }, "Amostra copiada."))],
            ["Amostra de Saida", exigirItem((i) => mudarItem(i.iid, (x) => ({ ...x, entradaSaida: x.entradaSaida === "Saída" ? "Entrada" : "Saída" })))],
            ["Alterar Prazo da amostra", exigirItem((i) => setJanela({ tipo: "prazo", item: i, prazo: i.prazo || "" }))],
          ]} />
          <Menu rotulo="Parâmetros" itens={[
            ["Adicionar Parâmetro", exigirItem((i) => setJanela({ tipo: "addPar", item: i, ids: [], busca: "" }))],
            ["Alterar Parâmetro", exigirPar((i) => { const x = i.params.find((y) => selPar.has(y.id)); setJanela({ tipo: "altPar", item: i, par: { ...x } }); })],
            ["Excluir Parâmetro", exigirPar((i) => (i.params.length - selPar.size < 1 ? avisar("A amostra precisa de ao menos um parâmetro.", "err") : mudarItem(i.iid, (x) => ({ ...x, params: x.params.filter((y) => !selPar.has(y.id)) }), "Parâmetro(s) excluído(s).").then(() => setSelPar(new Set()))))],
            ["Composta", exigirPar((i) => mudarItem(i.iid, (x) => ({ ...x, params: x.params.map((y) => (selPar.has(y.id) ? { ...y, composta: "Sim" } : y)) }), "Marcado como composta."))],
            ["Remover Composta", exigirPar((i) => mudarItem(i.iid, (x) => ({ ...x, params: x.params.map((y) => (selPar.has(y.id) ? { ...y, composta: "" } : y)) })))],
            ["Critério de comparação", exigirPar((i) => setJanela({ tipo: "criterio", item: i, valor: "" }))],
          ]} />
          <Menu rotulo="SubContratado" itens={[
            ["Adicionar Subcontratado", exigirPar((i) => setJanela({ tipo: "sub", item: i, valor: dados.subcontratados[0]?.empresa || "" }))],
            ["Remover Subcontratado", exigirPar((i) => mudarItem(i.iid, (x) => ({ ...x, params: x.params.map((y) => (selPar.has(y.id) ? { ...y, subcontratado: "" } : y)) }), "Subcontratado removido."))],
          ]} />
          <button type="button" className="dbtn" onClick={exigirItem((i) => setJanela({ tipo: "endereco", item: i, valor: i.enderecoColeta || "" }))}>Adicionar endereço</button>
        </div></div>

        <div className="tw"><table>
          <thead><tr>{["#", "ID", "Grupo", "Matriz", "Identificação", "Legislação", "Qtde", "Total da amostra", "Entrada/Saida", "Desconto %", "Prazo ( dias )"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
          <tbody>{p.itens.length ? p.itens.map((i, n) => {
            const ab = aberto.has(i.iid);
            return (
              <Fragment key={i.iid}>
                <tr className={`clicavel${selItem === i.iid ? " sel" : ""}`} onClick={() => { setSelItem(i.iid); setSelPar(new Set()); }}>
                  <td><button type="button" className="btn btn-default btn-sm" onClick={(e) => { e.stopPropagation(); const s = new Set(aberto); ab ? s.delete(i.iid) : s.add(i.iid); setAberto(s); }}>{ab ? "Esconder" : "Mostrar"}</button></td>
                  <td>{n + 1}</td><td>{i.grupo || "—"}</td><td>{i.matriz || i.descricao}</td>
                  <td><input aria-label="Identificação" defaultValue={i.ident || ""} onClick={(e) => e.stopPropagation()} onBlur={(e) => { if (e.target.value !== (i.ident || "")) mudarItem(i.iid, (x) => ({ ...x, ident: e.target.value })); }} /></td>
                  <td className="quebra">{i.legislacao || "—"}{i.legislacao2?.length ? <div className="suave">Comparativa: {i.legislacao2.join(", ")}</div> : null}{i.enderecoColeta ? <div className="suave">Coleta: {i.enderecoColeta}</div> : null}</td>
                  <td><input className="campo-num" type="number" min="1" aria-label="Qtde" defaultValue={i.qtd} onClick={(e) => e.stopPropagation()} onBlur={(e) => { const q = Math.max(1, Number(e.target.value) || 1); if (q !== Number(i.qtd)) mudarItem(i.iid, (x) => ({ ...x, qtd: q })); }} /></td>
                  <td><input className="campo-num" type="number" min="0" step="0.01" aria-label="Total da amostra" key={`${i.iid}-${precoUnitario({ ...i, desconto: 0 })}`} defaultValue={precoUnitario({ ...i, desconto: 0 })} onClick={(e) => e.stopPropagation()} onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== precoUnitario({ ...i, desconto: 0 })) mudarItem(i.iid, (x) => ({ ...x, precoAmostra: v === somaParametros(x) ? null : v })); }} /></td>
                  <td>{i.entradaSaida || "-"}</td>
                  <td><input className="campo-num" type="number" min="0" max="100" aria-label="Desconto %" defaultValue={i.desconto || 0} onClick={(e) => e.stopPropagation()} onBlur={(e) => { const d = Number(e.target.value) || 0; if (d !== Number(i.desconto || 0)) mudarItem(i.iid, (x) => ({ ...x, desconto: d })); }} /></td>
                  <td>{i.prazo || "—"}</td>
                </tr>
                {ab && (
                  <tr className="sub-linha"><td colSpan={11}>
                    <div className="sub-titulo-tab">Parâmetros Amostra ID {n + 1} · {brl(totalItem(i))} ({i.qtd} × {brl(precoUnitario(i))})</div>
                    <table className="sub-tab">
                      <thead><tr><th className="chk" />{["ID", "Parâmetro ID", "Parâmetro", "LQ", "Unidade", "Preço", "Subcontrato", "Composta"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
                      <tbody>{i.params.map((x, k) => (
                        <tr key={x.id}>
                          <td className="chk"><input type="checkbox" aria-label={`Marcar ${x.nome}`} checked={selItem === i.iid && selPar.has(x.id)} onChange={(e) => { if (selItem !== i.iid) { setSelItem(i.iid); setSelPar(new Set(e.target.checked ? [x.id] : [])); return; } const s = new Set(selPar); e.target.checked ? s.add(x.id) : s.delete(x.id); setSelPar(s); }} /></td>
                          <td>{k + 1}</td><td>{dados.parametros.find((y) => y.id === x.id)?.cod || ""}</td><td>{x.nome}{x.acred ? " ¹" : ""}{x.criterio ? <div className="suave">Comparar com: {x.criterio}</div> : null}</td><td>{x.lq}</td><td>{x.un}</td>
                          <td><input className="campo-num" type="number" min="0" step="0.01" aria-label={`Preço ${x.nome}`} defaultValue={x.preco} onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== Number(x.preco)) mudarItem(i.iid, (it) => ({ ...it, params: it.params.map((y) => (y.id === x.id ? { ...y, preco: v } : y)) })); }} /></td>
                          <td>{x.subcontratado || "-"}</td><td>{x.composta || "-"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </td></tr>
                )}
              </Fragment>
            );
          }) : <tr><td colSpan={11} className="vazio">Nenhuma amostra. Use Amostras → Adicionar Amostra.</td></tr>}</tbody>
        </table></div>
      </div>

      <Caixa titulo="Outros custos">
        <OutrosCustos p={p} gravar={gravar} />
        <div className="tot" style={{ marginTop: 12 }}><span>Amostras: <b>{brl(p.itens.reduce((s, i) => s + totalItem(i), 0))}</b> · Outros custos: <b>{brl(totalOutros(p))}</b> · Total da proposta: <b>{brl(totalProposta(p))}</b></span></div>
        <div className="acoes" style={{ marginTop: 12 }}>
          <a className="btn btn-default" href={link("criar-proposta", p.id)}>Voltar</a>
          <button type="button" className="btn btn-primary" disabled={ocupado} onClick={finalizar}>Visualizar proposta</button>
        </div>
      </Caixa>

      {janela?.tipo === "amostra" && <JanelaAmostra inicial={janela.inicial} onFechar={() => setJanela(null)} aoSalvar={(novo) => {
        if (janela.inicial.iid) return mudarItem(janela.inicial.iid, (x) => ({ ...x, ...novo, params: novo.params.map((n) => { const o = x.params.find((y) => y.id === n.id); return o ? { ...n, preco: o.preco, composta: o.composta, criterio: o.criterio, subcontratado: n.subcontratado || o.subcontratado } : n; }), iid: x.iid, ident: x.ident, desconto: x.desconto, entradaSaida: x.entradaSaida, precoAmostra: x.precoAmostra, enderecoColeta: x.enderecoColeta, prazo: x.prazo || novo.prazo }), "Amostra alterada.");
        return gravar({ ...p, itens: [...p.itens, { ...novo, iid: novoId() }] }, "Amostra adicionada.");
      }} />}
      {janela?.tipo === "excluir" && <Modal titulo="Excluir Amostra" onFechar={() => setJanela(null)} rotuloOk="Excluir" aoConfirmar={() => gravar({ ...p, itens: p.itens.filter((i) => i.iid !== janela.item.iid) }, "Amostra excluída.").then(() => setSelItem(null))}><p style={{ margin: 0 }}>Excluir a amostra <b>{janela.item.matriz || janela.item.descricao}</b>{janela.item.ident ? ` (${janela.item.ident})` : ""}?</p></Modal>}
      {janela?.tipo === "prazo" && <Modal titulo="Alterar Prazo finalização amostra" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={() => mudarItem(janela.item.iid, (x) => ({ ...x, prazo: Number(janela.prazo) || "" }), "Prazo alterado.")}>
        <div className="fg"><label htmlFor="prz">Prazo ( dias )</label><input id="prz" type="number" min="0" value={janela.prazo} onChange={(e) => setJanela({ ...janela, prazo: e.target.value })} /></div></Modal>}
      {janela?.tipo === "addPar" && <Modal titulo="Adicionar Parâmetro" largo onFechar={() => setJanela(null)} rotuloOk="Adicionar" aoConfirmar={() => {
        const novos = janela.ids.filter((id) => !janela.item.params.some((x) => x.id === id)).map((id) => parametroDoCatalogo(dados, id, janela.item.tabela)).filter(Boolean);
        if (!novos.length) { avisar("Marque ao menos um parâmetro.", "err"); return false; }
        return mudarItem(janela.item.iid, (x) => ({ ...x, params: [...x.params, ...novos] }), `${novos.length} parâmetro(s) adicionado(s).`);
      }}>
        <div className="fg"><label htmlFor="apB">Parâmetro</label><input id="apB" placeholder="Digite sua busca" value={janela.busca} onChange={(e) => setJanela({ ...janela, busca: e.target.value })} /></div>
        <div className="multi-lista">{dados.parametros.filter((x) => estaAtivo(x) && !janela.item.params.some((y) => y.id === x.id) && (!janela.busca || x.parametro.toLowerCase().includes(janela.busca.toLowerCase()))).slice(0, 300).map((x) => <label key={x.id}><input type="checkbox" checked={janela.ids.includes(x.id)} onChange={(e) => setJanela({ ...janela, ids: e.target.checked ? [...janela.ids, x.id] : janela.ids.filter((y) => y !== x.id) })} /> {x.parametro}</label>)}</div>
      </Modal>}
      {janela?.tipo === "altPar" && <Modal titulo="Alterar Parâmetro" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={() => mudarItem(janela.item.iid, (x) => ({ ...x, params: x.params.map((y) => (selPar.has(y.id) ? { ...y, preco: Number(janela.par.preco) || 0, lq: janela.par.lq, un: janela.par.un, metodo: janela.par.metodo } : y)) }), "Parâmetro alterado.")}>
        <p style={{ marginTop: 0 }}>{[...selPar].length > 1 ? `${selPar.size} parâmetros marcados` : janela.par.nome}</p>
        <div className="fg"><label htmlFor="apP">Preço</label><input id="apP" type="number" min="0" step="0.01" value={janela.par.preco} onChange={(e) => setJanela({ ...janela, par: { ...janela.par, preco: e.target.value } })} /></div>
        <div className="fg"><label htmlFor="apL">LQ</label><input id="apL" value={janela.par.lq || ""} onChange={(e) => setJanela({ ...janela, par: { ...janela.par, lq: e.target.value } })} /></div>
        <div className="fg"><label htmlFor="apU">Unidade</label><input id="apU" value={janela.par.un || ""} onChange={(e) => setJanela({ ...janela, par: { ...janela.par, un: e.target.value } })} /></div>
        <div className="fg"><label htmlFor="apM">Método</label><input id="apM" value={janela.par.metodo || ""} onChange={(e) => setJanela({ ...janela, par: { ...janela.par, metodo: e.target.value } })} /></div>
      </Modal>}
      {janela?.tipo === "criterio" && <Modal titulo="Critério de comparação" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={() => mudarItem(janela.item.iid, (x) => ({ ...x, params: x.params.map((y) => (selPar.has(y.id) ? { ...y, criterio: janela.valor } : y)) }), "Critério salvo.")}>
        <div className="fg"><label htmlFor="crt">Comparar os parâmetros marcados com</label><select id="crt" value={janela.valor} onChange={(e) => setJanela({ ...janela, valor: e.target.value })}>{opcoes([["", "Legislação principal da amostra"], ...[janela.item.legislacao, ...(janela.item.legislacao2 || [])].filter(Boolean)])}</select></div></Modal>}
      {janela?.tipo === "sub" && <Modal titulo="Adicionar Subcontratado" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={() => mudarItem(janela.item.iid, (x) => ({ ...x, params: x.params.map((y) => (selPar.has(y.id) ? { ...y, subcontratado: janela.valor } : y)) }), "Subcontratado definido.")}>
        <div className="fg"><label htmlFor="sbc">Subcontratado</label><select id="sbc" value={janela.valor} onChange={(e) => setJanela({ ...janela, valor: e.target.value })}>{opcoes(dados.subcontratados.map((s) => s.empresa))}</select></div></Modal>}
      {janela?.tipo === "endereco" && <Modal titulo="Endereço de coleta" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={() => mudarItem(janela.item.iid, (x) => ({ ...x, enderecoColeta: janela.valor.trim() }), "Endereço de coleta salvo.")}>
        {enderecos.length > 0 && <div className="fg"><label htmlFor="endS">Endereços do cliente</label><select id="endS" value="" onChange={(e) => setJanela({ ...janela, valor: e.target.value })}>{opcoes([["", "Escolha um endereço cadastrado"], ...enderecos.map((e) => { const t = [e.end && `${e.end}${e.num ? `, ${e.num}` : ""}`, e.bairro, e.cidade && `${e.cidade}/${e.uf}`].filter(Boolean).join(" - "); return [t, `${e.tipo}: ${t}`]; })])}</select></div>}
        <div className="fg"><label htmlFor="endT">Endereço de Coleta</label><input id="endT" value={janela.valor} onChange={(e) => setJanela({ ...janela, valor: e.target.value })} /></div>
        <p className="suave" style={{ margin: 0 }}>Para cadastrar um endereço novo no cliente, use a aba Endereços na ficha do cliente.</p>
      </Modal>}
    </>
  );
}

function OutrosCustos({ p, gravar }) {
  const avisar = useAviso();
  const lista = Array.isArray(p.outrosItens) ? p.outrosItens : Number(p.outros) > 0 ? [{ servico: "Outros custos", espec: "", valor: Number(p.outros), qtd: 1 }] : [];
  const [novo, setNovo] = useState({ servico: "", espec: "", valor: "", qtd: 1 });
  const salvarLista = (l) => gravar({ ...p, outrosItens: l, outros: l.reduce((s, o) => s + (Number(o.valor) || 0) * (Number(o.qtd) || 1), 0) });
  return (
    <>
      <div className="tw"><table>
        <thead><tr><th>Serviço</th><th>Especificação</th><th>Valor Unitário</th><th>Qtde</th><th>Valor Total</th><th /></tr></thead>
        <tbody>
          {lista.map((o, i) => <tr key={i}><td>{o.servico}</td><td>{o.espec}</td><td>{brl(o.valor)}</td><td>{o.qtd || 1}</td><td>{brl((Number(o.valor) || 0) * (Number(o.qtd) || 1))}</td><td><button type="button" className="btn btn-danger btn-sm" onClick={() => salvarLista(lista.filter((_, j) => j !== i))}>Remover</button></td></tr>)}
          <tr>
            <td><input aria-label="Serviço" placeholder="Ex.: Taxa de deslocamento" value={novo.servico} onChange={(e) => setNovo({ ...novo, servico: e.target.value })} /></td>
            <td><input aria-label="Especificação" value={novo.espec} onChange={(e) => setNovo({ ...novo, espec: e.target.value })} /></td>
            <td><input className="campo-num" type="number" min="0" step="0.01" aria-label="Valor Unitário" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} /></td>
            <td><input className="campo-num" type="number" min="1" aria-label="Qtde outros" value={novo.qtd} onChange={(e) => setNovo({ ...novo, qtd: e.target.value })} /></td>
            <td />
            <td><button type="button" className="btn btn-default btn-sm" onClick={() => { if (!novo.servico.trim() || !(Number(novo.valor) > 0)) { avisar("Informe o serviço e o valor.", "err"); return; } salvarLista([...lista, { ...novo, servico: novo.servico.trim(), valor: Number(novo.valor), qtd: Number(novo.qtd) || 1 }]); setNovo({ servico: "", espec: "", valor: "", qtd: 1 }); }}>Adicionar</button></td>
          </tr>
        </tbody>
      </table></div>
    </>
  );
}
