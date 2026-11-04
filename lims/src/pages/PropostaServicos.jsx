// Propostas → etapa 2: serviços, parâmetros e quantidade de amostras.
// Reconstruída a partir dos campos que o GerenciaLab mostra nas janelas
// "Todos Parâmetros" e "Amostras da proposta" (a etapa não foi aberta lá para
// não criar proposta de verdade na base).

import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { brl } from "../lib/formato.js";
import { PARAMETROS, SERVICOS, parametro, servico, numeroProposta, precoUnitario, totalItem, totalProposta, adicionarItem } from "../lib/propostas.js";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";

const CAB = ["Parâmetro", "Abreviação", "Grupo", "LQ", "LD", "Incerteza", "Unidade", "Método", "Acreditado", "Valor R$"];
const linhaParam = (x) => [x.nome, x.abrev, x.grupo, x.lq, x.ld, x.inc, x.un, x.metodo, x.acred ? <span className="lbl ok">Sim</span> : <span className="lbl default">Não</span>, brl(x.preco)];

export default function PropostaServicos({ param }) {
  const { dados, mudar } = useDados();
  const avisar = useAviso();
  const p = dados.propostas.find((x) => x.id === Number(param));
  const [sid, setSid] = useState(1);
  const [qtd, setQtd] = useState(1);
  const [marcados, setMarcados] = useState(() => new Set(servico(1).params));
  const [todos, setTodos] = useState(false);
  if (!p) return <NaoAchou />;
  const s = servico(sid);
  const cliente = dados.clientes.find((c) => c.id === p.clienteId);
  const trocar = (fn) => mudar((d) => { d.propostas = d.propostas.map((x) => (x.id === p.id ? fn(x) : x)); return d; });

  const adicionar = () => {
    try { const np = adicionarItem(p, sid, qtd, marcados); trocar(() => np); avisar("Serviço adicionado à proposta.", "ok"); }
    catch (e) { avisar(e.message, "err"); }
  };
  const salvar = () => {
    if (!p.itens.length) { avisar("Adicione ao menos um serviço antes de salvar.", "err"); return; }
    trocar((x) => { const { novo, ...resto } = x; return novo && x.status === "Aguardando" ? { ...resto, status: "Salvo" } : resto; });
    avisar(`Proposta ${numeroProposta(p)} salva.`, "ok");
    setTimeout(() => navegar("proposta", p.id), 0);
  };

  return (
    <>
      <Caixa cabecalho={`Proposta nº ${numeroProposta(p)} · ${cliente?.razao || ""}`}>
        <div className="frm">
          <div className="fg s5"><label htmlFor="sServ">Serviços / Matriz</label>
            <select id="sServ" value={sid} onChange={(e) => { const n = Number(e.target.value); setSid(n); setMarcados(new Set(servico(n).params)); }}>{opcoes(SERVICOS.map((x) => [x.id, `${x.nome} — ${x.matriz}`]))}</select></div>
          <div className="fg s3"><label htmlFor="sLA">Legislação Aplicável</label><input id="sLA" value={s.la} readOnly /></div>
          <div className="fg s2"><label htmlFor="sQtd">Quantidade de amostras</label><input id="sQtd" type="number" min="1" value={qtd} onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))} /></div>
          <div className="fg s2" style={{ justifyContent: "flex-end" }}><button type="button" className="btn btn-default" onClick={() => setTodos(true)}>Todos Parâmetros</button></div>
        </div>
        <div className="tw" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th className="chk"><input type="checkbox" aria-label="Marcar todos" checked={marcados.size === s.params.length} onChange={(e) => setMarcados(e.target.checked ? new Set(s.params) : new Set())} /></th>{CAB.map((t) => <th key={t}>{t}</th>)}</tr></thead>
            <tbody>{s.params.map((c) => { const x = parametro(c); return (
              <tr key={c}><td className="chk"><input type="checkbox" aria-label={`Incluir ${x.nome}`} checked={marcados.has(c)} onChange={(e) => { const n = new Set(marcados); e.target.checked ? n.add(c) : n.delete(c); setMarcados(n); }} /></td>{linhaParam(x).map((v, i) => <td key={i}>{v}</td>)}</tr>
            ); })}</tbody>
          </table>
        </div>
        <div className="tot"><span>Valor por amostra: <b>{brl([...marcados].reduce((a, c) => a + parametro(c).preco, 0))}</b></span><button type="button" className="btn btn-primary" onClick={adicionar}>Adicionar à proposta</button></div>
      </Caixa>

      <Caixa cabecalho="Amostras da proposta">
        <div className="tw">
          <table>
            <thead><tr>{["Serviço / Matriz", "Legislação", "Parâmetros", "Qtd. amostras", "Valor unitário", "Total", ""].map((t, i) => <th key={i}>{t}</th>)}</tr></thead>
            <tbody>{p.itens.length ? p.itens.map((it, i) => { const sv = servico(it.sid); return (
              <tr key={i}>
                <td>{sv.nome} — {sv.matriz}</td><td>{sv.la}</td>
                <td title={it.params.map((c) => parametro(c).nome).join(", ")}>{it.params.length}: {it.params.map((c) => parametro(c).abrev).join(", ")}</td>
                <td><input className="campo-num" type="number" min="1" aria-label="Quantidade de amostras" value={it.qtd} onChange={(e) => trocar((x) => ({ ...x, itens: x.itens.map((y, j) => (j === i ? { ...y, qtd: Math.max(1, Number(e.target.value) || 1) } : y)) }))} /></td>
                <td>{brl(precoUnitario(it))}</td><td>{brl(totalItem(it))}</td>
                <td><button type="button" className="btn btn-danger btn-sm" onClick={() => trocar((x) => ({ ...x, itens: x.itens.filter((_, j) => j !== i) }))}>Remover</button></td>
              </tr>
            ); }) : <tr><td colSpan={7} className="vazio">Nenhum serviço adicionado. Escolha o serviço acima e clique em Adicionar à proposta.</td></tr>}</tbody>
          </table>
        </div>
        <div className="tot">
          <label htmlFor="sOut">Outros custos (coleta, frete) R$</label>
          <input id="sOut" className="campo-num" type="number" min="0" step="10" value={Number(p.outros) || 0} onChange={(e) => trocar((x) => ({ ...x, outros: Math.max(0, Number(e.target.value) || 0) }))} />
          <span>Total da proposta: <b>{brl(totalProposta(p))}</b></span>
        </div>
        {p.exib === "Não Exibir Valores" && <p className="suave" style={{ textAlign: "right", margin: "6px 0 0" }}>Exibição de preços: Não Exibir Valores. Os valores não aparecem no documento enviado ao cliente.</p>}
        <div className="acoes" style={{ justifyContent: "space-between", marginTop: 18 }}><a className="btn btn-default" href={link("criar-proposta", p.id)}>Voltar</a><button type="button" className="btn btn-success" onClick={salvar}>Salvar proposta</button></div>
      </Caixa>

      {todos && (
        <Modal titulo="Todos Parâmetros" largo onFechar={() => setTodos(false)}>
          <div className="tw"><table><thead><tr>{CAB.map((t) => <th key={t}>{t}</th>)}</tr></thead><tbody>{PARAMETROS.map((x) => <tr key={x.cod}>{linhaParam(x).map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody></table></div>
        </Modal>
      )}
    </>
  );
}
