// Propostas → etapa 2: serviços e amostras a partir do catálogo de
// Configurações (Pacote de Serviços → matriz, legislação, parâmetros e
// Tabela de preço). O item guarda uma cópia dos parâmetros e preços do
// momento: mudar o catálogo depois não altera proposta já feita.

import { useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { brl } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { numeroProposta, precoUnitario, totalItem, totalProposta, itemDoPacote } from "../lib/propostas.js";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";

const CAB = ["Parâmetro", "Abreviação", "LQ", "Unidade", "Método", "Acreditado", "Valor R$"];

export default function PropostaServicos({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const p = dados.propostas.find((x) => x.id === param);
  const pacotes = useMemo(() => dados.pacotes.filter(estaAtivo), [dados.pacotes]);
  const [pid, setPid] = useState(() => pacotes[0]?.id || "");
  const pacote = pacotes.find((x) => x.id === pid);
  const [qtd, setQtd] = useState(1);
  const [marcados, setMarcados] = useState(() => new Set(pacotes[0]?.parametros || []));
  const [ocupado, setOcupado] = useState(false);
  const [todos, setTodos] = useState(false);
  if (!p) return <NaoAchou />;
  const cliente = dados.clientes.find((c) => c.id === p.clienteId);
  // Pré-visualização do que vai entrar (mesma regra que grava).
  let previa = null;
  try { previa = pacote ? itemDoPacote(pacote, dados, qtd, new Set(pacote.parametros || [])) : null; } catch { previa = null; }
  const gravar = async (np, msg) => {
    setOcupado(true);
    try { await salvar("propostas", np); if (msg) avisar(msg, "ok"); return true; }
    catch (e) { avisar(e.message, "err"); return false; } finally { setOcupado(false); }
  };
  const adicionar = () => {
    try { gravar({ ...p, itens: [...p.itens, itemDoPacote(pacote, dados, qtd, marcados)] }, "Serviço adicionado à proposta."); }
    catch (e) { avisar(e.message, "err"); }
  };
  const salvarProposta = async () => {
    if (!p.itens.length) { avisar("Adicione ao menos um serviço antes de salvar.", "err"); return; }
    const { novo, ...resto } = p;
    if (await gravar(novo && p.status === "Aguardando" ? { ...resto, status: "Salvo" } : resto, `Proposta ${numeroProposta(p)} salva.`)) navegar("proposta", p.id);
  };
  const semPreco = previa?.params.filter((x) => !x.preco).length || 0;

  return (
    <>
      <Caixa cabecalho={`Proposta nº ${numeroProposta(p)} · ${cliente?.razao || ""}`}>
        {!pacotes.length ? (
          <p className="aviso alerta">Nenhum Pacote de Serviços cadastrado. Cadastre em <a href={link("service-package")}>Configurações → Pacote de Serviços</a> (com matriz, legislação, parâmetros e tabela de preço) e volte aqui.</p>
        ) : (
          <>
            <div className="frm">
              <div className="fg s5"><label htmlFor="sPac">Pacote de serviços</label>
                <select id="sPac" value={pid} onChange={(e) => { const x = pacotes.find((k) => k.id === e.target.value); setPid(e.target.value); setMarcados(new Set(x?.parametros || [])); }}>{opcoes(pacotes.map((x) => [x.id, x.descricao]))}</select></div>
              <div className="fg s3"><label htmlFor="sLA">Legislação Aplicável</label><input id="sLA" value={previa?.legislacao || "—"} readOnly /></div>
              <div className="fg s2"><label htmlFor="sQtd">Quantidade de amostras</label><input id="sQtd" type="number" min="1" value={qtd} onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))} /></div>
              <div className="fg s2" style={{ justifyContent: "flex-end" }}><button type="button" className="btn btn-default" onClick={() => setTodos(true)}>Todos Parâmetros</button></div>
            </div>
            <p className="suave" style={{ margin: "10px 0 0" }}>Matriz: {previa?.matriz || "—"} · Tabela de preço: {previa?.tabela || "sem tabela"}{semPreco ? ` · ${semPreco} parâmetro(s) sem preço na tabela` : ""}</p>
            <div className="tw" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th className="chk"><input type="checkbox" aria-label="Marcar todos" checked={!!previa && marcados.size === previa.params.length} onChange={(e) => setMarcados(e.target.checked ? new Set(pacote.parametros) : new Set())} /></th>{CAB.map((t) => <th key={t}>{t}</th>)}</tr></thead>
                <tbody>{previa?.params.length ? previa.params.map((x) => (
                  <tr key={x.id}>
                    <td className="chk"><input type="checkbox" aria-label={`Incluir ${x.nome}`} checked={marcados.has(x.id)} onChange={(e) => { const n = new Set(marcados); e.target.checked ? n.add(x.id) : n.delete(x.id); setMarcados(n); }} /></td>
                    <td>{x.nome}</td><td>{x.abrev}</td><td>{x.lq}</td><td>{x.un}</td><td>{x.metodo}</td><td>{x.acred ? <span className="lbl ok">Sim</span> : <span className="lbl default">Não</span>}</td><td>{x.preco ? brl(x.preco) : <span className="lbl warn">sem preço</span>}</td>
                  </tr>
                )) : <tr><td colSpan={8} className="vazio">Este pacote não tem parâmetros. Edite-o em Configurações → Pacote de Serviços.</td></tr>}</tbody>
              </table>
            </div>
            <div className="tot"><span>Valor por amostra: <b>{brl((previa?.params || []).filter((x) => marcados.has(x.id)).reduce((a, x) => a + x.preco, 0))}</b></span><button type="button" className="btn btn-primary" disabled={ocupado || !previa} onClick={adicionar}>Adicionar à proposta</button></div>
          </>
        )}
      </Caixa>

      <Caixa cabecalho="Amostras da proposta">
        <div className="tw">
          <table>
            <thead><tr>{["Serviço / Matriz", "Legislação", "Parâmetros", "Qtd. amostras", "Valor unitário", "Total", ""].map((t, i) => <th key={i}>{t}</th>)}</tr></thead>
            <tbody>{p.itens.length ? p.itens.map((it, i) => (
              <tr key={i}>
                <td>{it.descricao}{it.matriz ? ` — ${it.matriz}` : ""}</td><td>{it.legislacao}</td>
                <td title={it.params.map((x) => x.nome).join(", ")}>{it.params.length}: {it.params.map((x) => x.abrev || x.nome).join(", ")}</td>
                <td><input className="campo-num" type="number" min="1" aria-label="Quantidade de amostras" defaultValue={it.qtd} onBlur={(e) => { const q = Math.max(1, Number(e.target.value) || 1); if (q !== it.qtd) gravar({ ...p, itens: p.itens.map((y, j) => (j === i ? { ...y, qtd: q } : y)) }); }} /></td>
                <td>{brl(precoUnitario(it))}</td><td>{brl(totalItem(it))}</td>
                <td><button type="button" className="btn btn-danger btn-sm" disabled={ocupado} onClick={() => gravar({ ...p, itens: p.itens.filter((_, j) => j !== i) }, "Serviço removido.")}>Remover</button></td>
              </tr>
            )) : <tr><td colSpan={7} className="vazio">Nenhum serviço adicionado. Escolha o pacote acima e clique em Adicionar à proposta.</td></tr>}</tbody>
          </table>
        </div>
        <div className="tot">
          <label htmlFor="sOut">Outros custos (coleta, frete) R$</label>
          <input id="sOut" className="campo-num" type="number" min="0" step="10" defaultValue={Number(p.outros) || 0} onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== (Number(p.outros) || 0)) gravar({ ...p, outros: v }); }} />
          <span>Total da proposta: <b>{brl(totalProposta(p))}</b></span>
        </div>
        {p.exib === "Não Exibir Valores" && <p className="suave" style={{ textAlign: "right", margin: "6px 0 0" }}>Exibição de preços: Não Exibir Valores. Os valores não aparecem no documento enviado ao cliente.</p>}
        <div className="acoes" style={{ justifyContent: "space-between", marginTop: 18 }}><a className="btn btn-default" href={link("criar-proposta", p.id)}>Voltar</a><button type="button" className="btn btn-success" disabled={ocupado} onClick={salvarProposta}>{ocupado ? "Gravando…" : "Salvar proposta"}</button></div>
      </Caixa>

      {todos && (
        <Modal titulo="Todos Parâmetros" largo onFechar={() => setTodos(false)}>
          <div className="tw"><table><thead><tr><th>Parâmetro</th><th>Abreviação</th><th>Grupo</th><th>LQ</th><th>LD</th><th>Incerteza</th><th>Unidade</th><th>Método</th><th>Acreditado</th></tr></thead>
            <tbody>{dados.parametros.filter(estaAtivo).map((x) => (
              <tr key={x.id}><td>{x.parametro}</td><td>{x.abreviacao}</td><td>{dados.grupos_servico.find((g) => g.id === x.grupo)?.nome || ""}</td><td>{x.lq}</td><td>{x.ld}</td><td>{x.incerteza}</td>
                <td>{dados.unidades.find((u) => u.id === x.unidade)?.sigla || ""}</td><td>{dados.metodos.find((m) => m.id === x.metodo)?.nome || ""}</td><td>{x.acreditado || "Não"}</td></tr>
            ))}</tbody></table></div>
        </Modal>
      )}
    </>
  );
}
