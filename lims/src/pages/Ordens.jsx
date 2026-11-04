// Menu Ordem serviços, fiel ao GerenciaLab:
//  - Ordem serviços: lista por amostra (OS, código de barras, referência,
//    status da OS e da amostra, prioridade, datas, campos 1–6) com filtros.
//  - Criar Ordem de serviço (avulsa, a partir do saldo do contrato).
//  - Ficha da OS: amostras editáveis; mudar status pede motivo (Auditoria LOG).
//  - Etiquetas com código de barras (Code 128) para imprimir.
//  - Rastreabilidade: cliente → proposta → contrato → OS → amostra → parâmetro.

import { useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { dataBR } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { numeroContrato, saldoServicos } from "../lib/contratos.js";
import { STATUS_AMOSTRA, PRIORIDADES, COR_STATUS_OS, numeroOS, referenciaAmostra, statusDaOS, code128 } from "../lib/ordens.js";
import { gerarOS } from "../lib/gerarOS.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";

const quandoBR = (s) => (s ? (String(s).length > 10 ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : dataBR(s)) : "");
export const RotuloOS = ({ s }) => <span className={`lbl ${COR_STATUS_OS[s] || "default"}`}>{s}</span>;

/* ---------- Criar Ordem de serviço (avulsa) ---------- */

function CriarOS({ onFechar, sessao }) {
  const ctx = useDados();
  const { dados } = ctx;
  const avisar = useAviso();
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [prioridade, setPrioridade] = useState("Padrão");
  const [qtds, setQtds] = useState({});
  const contratos = dados.contratos.filter((c) => c.status === "Ativo" && (!clienteId || c.clienteId === clienteId));
  const contrato = dados.contratos.find((c) => c.id === contratoId);
  const saldo = contrato ? saldoServicos(contrato).filter((s) => s.status !== "Inativo") : [];
  const criar = async () => {
    if (!contrato) { avisar("Selecione o contrato.", "err"); return false; }
    const servicos = Object.entries(qtds).map(([sid, qtd]) => ({ sid, qtd: Number(qtd) || 0 })).filter((s) => s.qtd > 0);
    const s = Object.fromEntries(saldo.map((x) => [x.sid, x.saldo]));
    if (servicos.some((x) => x.qtd > (s[x.sid] ?? 0))) { avisar("A quantidade passa do saldo contratado do serviço.", "err"); return false; }
    try { const os = await gerarOS(ctx, { contrato, servicos, descricao, prioridade, por: sessao.nome || sessao.usuario }); avisar(`${numeroOS(os)} criada.`, "ok"); navegar("ordem", os.id); }
    catch (e) { avisar(e.message, "err"); return false; }
  };
  return (
    <Modal titulo="Criar Ordem de serviço" largo onFechar={onFechar} rotuloOk="Criar Ordem de Serviço" aoConfirmar={criar}>
      <div className="frm">
        <div className="fg s12"><label htmlFor="oDesc">Descrição Ordem de serviço</label><input id="oDesc" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        <div className="fg s5"><label htmlFor="oCli">Selecione o Cliente</label><select id="oCli" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setContratoId(""); setQtds({}); }}>{opcoes([["", "Todos os clientes"], ...dados.clientes.filter((c) => dados.contratos.some((k) => k.clienteId === c.id)).map((c) => [c.id, c.razao])])}</select></div>
        <div className="fg s4"><label htmlFor="oCt">Selecione o Contrato</label><select id="oCt" value={contratoId} onChange={(e) => { setContratoId(e.target.value); setQtds({}); }}>{opcoes([["", "Selecione"], ...contratos.map((c) => [c.id, `${numeroContrato(c)} · ${dados.clientes.find((x) => x.id === c.clienteId)?.razao || ""}`])])}</select></div>
        <div className="fg s3"><label htmlFor="oPri">Prioridade</label><select id="oPri" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>{opcoes(PRIORIDADES)}</select></div>
      </div>
      {contrato && (
        <div className="tw"><table>
          <thead><tr><th>Serviço / Matriz</th><th>Saldo</th><th>Quantidade de amostras</th></tr></thead>
          <tbody>{saldo.length ? saldo.map((s) => (
            <tr key={s.sid}><td>{s.descricao}{s.matriz ? ` — ${s.matriz}` : ""}</td><td>{s.saldo}</td>
              <td><input className="campo-num" type="number" min="0" max={s.saldo} disabled={s.saldo <= 0} aria-label={`Quantidade de ${s.descricao}`} value={qtds[s.sid] ?? ""} onChange={(e) => setQtds((q) => ({ ...q, [s.sid]: e.target.value }))} /></td></tr>
          )) : <tr><td colSpan={3} className="vazio">O contrato não tem serviços com saldo.</td></tr>}</tbody>
        </table></div>
      )}
      {!dados.contratos.length && <p className="aviso alerta" style={{ margin: 0 }}>Nenhum contrato ainda. A OS nasce de um contrato: gere em Contratos → Contratos Pendentes.</p>}
    </Modal>
  );
}

/* ---------- Visualizar análises da amostra ---------- */

function VerAmostra({ a, onFechar }) {
  return (
    <Modal titulo={`Visualização: ${referenciaAmostra(a)} · ${a.barra}`} largo onFechar={onFechar}>
      <p style={{ margin: 0 }}><b>{a.servico}</b>{a.matriz ? ` — ${a.matriz}` : ""} · {a.legislacao} · <RotuloOS s={a.status} /></p>
      <div className="tw"><table>
        <thead><tr>{["Análise", "Resultado", "Unidade de Medida", "Parecer", "LQ", "Método de Análise", "Etapa"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{a.analises.map((x) => <tr key={x.pid}><td>{x.nome}{x.acred ? " *" : ""}</td><td>{x.resultado || "—"}</td><td>{x.un}</td><td>{x.parecer || ""}</td><td>{x.lq}</td><td>{x.metodo}</td><td>{x.etapa}</td></tr>)}</tbody>
      </table></div>
      <p className="suave" style={{ margin: 0 }}>* Ensaio acreditado. Os resultados entram pelo menu Laboratório.</p>
    </Modal>
  );
}

/* ---------- Lista ---------- */

const COLUNAS_OPCIONAIS = ["Região", "Local", "Res. Amostra", "Centro Serviço", "Campo 1", "Campo 2", "Campo 3", "Campo 4", "Campo 5", "Campo 6"];

export function ListaOS({ sessao }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [chave, setChave] = useState(0);
  const [janela, setJanela] = useState(null);
  const [ocultas, setOcultas] = useState(() => new Set(COLUNAS_OPCIONAIS.slice(4)));
  const osDe = useMemo(() => Object.fromEntries(dados.ordens.map((o) => [o.id, o])), [dados.ordens]);
  const statusOS = useMemo(() => {
    const por = {};
    for (const a of dados.amostras) (por[a.osId] ||= []).push(a);
    return Object.fromEntries(Object.entries(por).map(([k, v]) => [k, statusDaOS(v)]));
  }, [dados.amostras]);
  const cli = (r) => dados.clientes.find((c) => c.id === r.clienteId)?.razao || "";
  const sol = (r) => dados.solicitantes.find((s) => s.id === osDe[r.osId]?.solicitanteId)?.nome || "";
  const todas = [
    { t: "Ordem ID", v: (r) => Number(osDe[r.osId]?.cod) || 0, filtro: true },
    { t: "Contrato", v: (r) => osDe[r.osId]?.contrato || "", filtro: true },
    { t: "Ordem Serviço", v: (r) => r.os || "", filtro: true },
    { t: "Status O.S", v: (r) => statusOS[r.osId] || "", h: (r) => <RotuloOS s={statusOS[r.osId]} />, filtro: "lista" },
    { t: "Código Barra", v: (r) => r.barra, filtro: true },
    { t: "Referência", v: (r) => referenciaAmostra(r), filtro: true },
    { t: "Status Amostra", v: (r) => r.status, filtro: "lista" },
    { t: "Prioridade", v: (r) => r.prioridade || "Padrão", h: (r) => (r.prioridade && r.prioridade !== "Padrão" ? <span className="lbl crit">{r.prioridade}</span> : "Padrão"), filtro: "lista" },
    { t: "Solicitante", v: sol, filtro: true },
    { t: "Cliente", v: cli, filtro: true },
    { t: "identificação", v: (r) => r.identificacao || "", filtro: true },
    { t: "Data da Coleta", v: (r) => r.dataColeta || "", h: (r) => quandoBR(r.dataColeta), fv: (r) => quandoBR(r.dataColeta), filtro: true },
    { t: "Data da Entrada", v: (r) => r.dataEntrada || "", h: (r) => quandoBR(r.dataEntrada), fv: (r) => quandoBR(r.dataEntrada), filtro: true },
    { t: "Data de Entrega", v: (r) => r.dataEntrega || "", h: (r) => quandoBR(r.dataEntrega), fv: (r) => quandoBR(r.dataEntrega), filtro: true },
    { t: "Data de assinatura", v: (r) => r.dataAssinatura || "", h: (r) => quandoBR(r.dataAssinatura), fv: (r) => quandoBR(r.dataAssinatura), filtro: true },
    { t: "Região", v: (r) => dados.grupos_regionais.find((g) => g.id === r.regiao)?.nome || "", filtro: true },
    { t: "Local", v: (r) => r.local || "", filtro: true },
    { t: "Res. Amostra", v: (r) => r.respAmostra || "", filtro: true },
    { t: "Centro Serviço", v: (r) => osDe[r.osId]?.centro || "", filtro: true },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: `Campo ${i + 1}`, v: (r) => r.campos?.[i] || "", filtro: true })),
  ];
  const colunas = todas.filter((c) => !ocultas.has(c.t));
  const iStatus = colunas.findIndex((c) => c.t === "Status O.S"), iAm = colunas.findIndex((c) => c.t === "Status Amostra"), iPri = colunas.findIndex((c) => c.t === "Prioridade");
  const selecionadas = dados.amostras.filter((a) => sel.has(a.id));
  const uma = selecionadas.length === 1 ? selecionadas[0] : null;
  const exigirUma = (fn) => () => (uma ? fn(uma) : avisar("Selecione uma amostra.", "err"));
  const exigir = (fn) => () => (selecionadas.length ? fn() : avisar("Selecione ao menos uma amostra.", "err"));
  return (
    <Caixa titulo="Ordem serviços">
      <Grade key={`${chave}-${ocultas.size}`} id="os" exportar="ordens-servico" linhas={dados.amostras} colunas={colunas} filtrosColuna multipla
        opcoesFiltro={{ [iStatus]: STATUS_AMOSTRA, [iAm]: STATUS_AMOSTRA, [iPri]: PRIORIDADES }}
        selecao={sel} aoSelecionar={setSel} aoAbrir={(r) => navegar("ordem", r.osId)}
        botoes={[
          { rotulo: "Criar Ordem de serviço", acao: () => setJanela("criar") },
          { rotulo: "Visualizar Colunas", acao: () => setJanela("colunas") },
          { rotulo: "Documentos", acao: exigirUma((a) => navegar("ordem", a.osId)) },
          { rotulo: "Coleta", acao: exigir(async () => {
            try {
              const prontas = selecionadas.filter((a) => ["Aguardando coleta", "Aguardando agendamento"].includes(a.status));
              if (!prontas.length) { avisar("As amostras selecionadas não estão aguardando coleta.", "err"); return; }
              for (const a of prontas) await salvar("amostras", { ...a, status: "Em coleta" }, { motivo: "Saiu para coleta" });
              avisar(`${prontas.length} amostra(s) em coleta. O registro da coleta fica no menu Coletas.`, "ok");
            } catch (e) { avisar(e.message, "err"); }
          }) },
          { rotulo: "Visualizar", acao: exigirUma((a) => setJanela({ ver: a })) },
          { rotulo: "Inspeção técnica", acao: () => navegar("technical-inspection") },
          { rotulo: "Gerar Etiqueta", acao: exigir(() => navegar("etiquetas", [...new Set(selecionadas.map((a) => a.id))].join("."))) },
          { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChave((k) => k + 1); } },
        ]} />
      {janela === "criar" && <CriarOS sessao={sessao} onFechar={() => setJanela(null)} />}
      {janela?.ver && <VerAmostra a={janela.ver} onFechar={() => setJanela(null)} />}
      {janela === "colunas" && (
        <Modal titulo="Visualizar Colunas" onFechar={() => setJanela(null)}>
          <div className="multi-lista">{COLUNAS_OPCIONAIS.map((t) => <label key={t}><input type="checkbox" checked={!ocultas.has(t)} onChange={(e) => setOcultas((o) => { const n = new Set(o); e.target.checked ? n.delete(t) : n.add(t); return n; })} /> {t}</label>)}</div>
        </Modal>
      )}
    </Caixa>
  );
}

/* ---------- Ficha da OS ---------- */

export function FichaOS({ param }) {
  const { dados, salvar, salvarLote } = useDados();
  const avisar = useAviso();
  const os = dados.ordens.find((o) => o.id === param);
  const originais = dados.amostras.filter((a) => a.osId === param).sort((a, b) => a.num - b.num);
  const [edit, setEdit] = useState(() => Object.fromEntries(originais.map((a) => [a.id, { ...a }])));
  const [mudar, setMudar] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [arq, setArq] = useState(null);
  if (!os) return <NaoAchou />;
  const cliente = dados.clientes.find((c) => c.id === os.clienteId) || {};
  const contrato = dados.contratos.find((c) => c.id === os.contratoId);
  const set = (id, k, v) => setEdit((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const alteradas = originais.filter((a) => JSON.stringify(edit[a.id]) !== JSON.stringify(a));
  const gravar = async () => {
    if (!alteradas.length) { avisar("Nada para salvar."); return; }
    setOcupado(true);
    try { const r = await salvarLote("amostras", alteradas.map((a) => edit[a.id])); setEdit((x) => ({ ...x, ...Object.fromEntries(r.map((a) => [a.id, { ...a }])) })); avisar(`${alteradas.length} amostra(s) salva(s).`, "ok"); }
    catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  const motivos = dados.motivos_alteracao.filter(estaAtivo).map((m) => m.identificacao);
  const regioes = dados.grupos_regionais;
  return (
    <>
      <div className="box">
        <div className="box-head-row">
          <h2 className="box-title">{numeroOS(os)} <RotuloOS s={statusDaOS(originais)} /></h2>
          <div className="acoes"><a className="btn btn-default" href={link("service-order")}>Voltar</a><a className="btn btn-default" href={link("etiquetas", originais.map((a) => a.id).join("."))}>Gerar Etiqueta</a><button type="button" className="btn btn-success" disabled={ocupado || !alteradas.length} onClick={gravar}>{ocupado ? "Salvando…" : `Salvar${alteradas.length ? ` (${alteradas.length})` : ""}`}</button></div>
        </div>
        <dl className="detail">
          <div><dt>Cliente</dt><dd><a href={link("cliente", cliente.id)}>{cliente.razao}</a></dd></div>
          <div><dt>Contrato</dt><dd>{contrato ? <a href={link("contract", contrato.id)}>{os.contrato}</a> : os.contrato}</dd></div>
          <div><dt>Descrição</dt><dd>{os.descricao || "—"}</dd></div><div><dt>Origem</dt><dd>{os.origem}</dd></div>
          <div><dt>Prioridade</dt><dd>{os.prioridade}</dd></div><div><dt>Data prevista da coleta</dt><dd>{quandoBR(os.dataColeta) || "—"}</dd></div>
          <div><dt>Criada</dt><dd>{quandoBR(os.criadoEm)} por {os.criadoPor}</dd></div><div><dt>Centro de serviço</dt><dd>{os.centro || "—"}</dd></div>
        </dl>
      </div>
      <Caixa titulo={`Amostras (${originais.length})`}>
        <div className="tw"><table>
          <thead><tr>{["Referência", "Código Barra", "Serviço / Matriz", "Status", "Identificação", "Local", "Região", "Data da Coleta", "Campo 1", "Campo 2", ""].map((t, i) => <th key={i}>{t}</th>)}</tr></thead>
          <tbody>{originais.map((a) => { const e = edit[a.id] || a; return (
            <tr key={a.id}>
              <td>{referenciaAmostra(a)}</td><td className="mono">{a.barra}</td><td>{a.servico}{a.matriz ? ` — ${a.matriz}` : ""}</td>
              <td><RotuloOS s={a.status} /></td>
              <td><input aria-label="Identificação" value={e.identificacao || ""} onChange={(x) => set(a.id, "identificacao", x.target.value)} /></td>
              <td><input aria-label="Local" value={e.local || ""} onChange={(x) => set(a.id, "local", x.target.value)} /></td>
              <td><select aria-label="Região" value={e.regiao || ""} onChange={(x) => set(a.id, "regiao", x.target.value)}>{opcoes([["", "—"], ...regioes.map((g) => [g.id, g.nome])])}</select></td>
              <td><input aria-label="Data da coleta" type="datetime-local" value={(e.dataColeta || "").slice(0, 16)} onChange={(x) => set(a.id, "dataColeta", x.target.value)} /></td>
              <td><input aria-label="Campo 1" value={e.campos?.[0] || ""} onChange={(x) => set(a.id, "campos", Object.assign([...(e.campos || [])], { 0: x.target.value }))} /></td>
              <td><input aria-label="Campo 2" value={e.campos?.[1] || ""} onChange={(x) => set(a.id, "campos", Object.assign([...(e.campos || [])], { 1: x.target.value }))} /></td>
              <td><button type="button" className="btn btn-default btn-sm" onClick={() => setMudar({ a, status: a.status, motivo: "" })}>Alterar status</button></td>
            </tr>
          ); })}</tbody>
        </table></div>
      </Caixa>
      <Caixa titulo="Anexo de arquivos Ordem serviço">
        <div className="tw"><table><thead><tr><th>ID</th><th>Arquivo</th><th>Tamanho</th><th>Data</th></tr></thead>
          <tbody>{(os.docs || []).length ? os.docs.map((d, i) => <tr key={i}><td>{i + 1}</td><td>{d.nome}</td><td>{d.kb} KB</td><td>{dataBR(d.em)}</td></tr>) : <tr><td colSpan={4} className="vazio">Nenhum arquivo.</td></tr>}</tbody></table></div>
        <div className="acoes" style={{ marginTop: 10, alignItems: "center" }}>
          <input type="file" aria-label="Arquivo" onChange={(e) => setArq(e.target.files?.[0] || null)} />
          <button type="button" className="btn btn-default" disabled={!arq} onClick={async () => { try { await salvar("ordens", { ...os, docs: [...(os.docs || []), { nome: arq.name, kb: Math.max(1, Math.round(arq.size / 1024)), em: new Date().toISOString().slice(0, 10) }] }); setArq(null); avisar("Arquivo registrado.", "ok"); } catch (e) { avisar(e.message, "err"); } }}>Anexar</button>
          <span className="suave">Por enquanto fica registrado o nome do arquivo; a guarda do arquivo entra numa próxima etapa.</span>
        </div>
      </Caixa>
      {mudar && (
        <Modal titulo={`Alterar status · ${referenciaAmostra(mudar.a)}`} onFechar={() => setMudar(null)} rotuloOk="Alterar" aoConfirmar={async () => {
          if (!mudar.motivo.trim()) { avisar("Informe o motivo da alteração.", "err"); return false; }
          try { const r = await salvar("amostras", { ...(edit[mudar.a.id] || mudar.a), status: mudar.status }, { motivo: mudar.motivo.trim() }); setEdit((x) => ({ ...x, [r.id]: { ...r } })); avisar("Status alterado.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="mSt">Novo status</label><select id="mSt" value={mudar.status} onChange={(e) => setMudar({ ...mudar, status: e.target.value })}>{opcoes(STATUS_AMOSTRA)}</select></div>
          <div className="fg"><label htmlFor="mMot">Motivo *</label><input id="mMot" list="mot-os" value={mudar.motivo} onChange={(e) => setMudar({ ...mudar, motivo: e.target.value })} /><datalist id="mot-os">{motivos.map((m) => <option key={m} value={m} />)}</datalist></div>
          <p className="suave" style={{ margin: 0 }}>O sistema leva a amostra pelas etapas sozinho (coleta, inspeção, laboratório, revisão). Use esta alteração para correções; ela fica na Auditoria LOG.</p>
        </Modal>
      )}
    </>
  );
}

/* ---------- Etiquetas ---------- */

export function CodigoBarras({ texto, altura = 40 }) {
  const larguras = code128(texto);
  const total = larguras.reduce((s, x) => s + x, 0) + 20;
  let x = 10;
  return (
    <svg viewBox={`0 0 ${total} ${altura}`} width="100%" height={altura} preserveAspectRatio="none" role="img" aria-label={`Código de barras ${texto}`}>
      <rect x="0" y="0" width={total} height={altura} fill="#fff" />
      {larguras.map((w, i) => { const r = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height={altura} fill="#000" /> : null; x += w; return r; })}
    </svg>
  );
}

export function Etiquetas({ param }) {
  const { dados } = useDados();
  const ids = String(param || "").split(".").filter(Boolean);
  const amostras = ids.map((id) => dados.amostras.find((a) => a.id === id)).filter(Boolean);
  const [colunas, setColunas] = useState(2);
  const [dupla, setDupla] = useState(false);
  if (!amostras.length) return <NaoAchou />;
  const cli = (a) => dados.clientes.find((c) => c.id === a.clienteId)?.razao || "";
  const lista = dupla ? amostras.flatMap((a) => [a, a]) : amostras;
  return (
    <>
      <div className="box nao-imprimir">
        <div className="box-head-row"><h2 className="box-title">Etiqueta · {amostras.length} amostra(s)</h2>
          <div className="acoes" style={{ alignItems: "center" }}>
            <label className="radios">Formato <select aria-label="Formato" value={colunas} onChange={(e) => setColunas(Number(e.target.value))}>{opcoes([[1, "1 por linha"], [2, "2 por linha"], [3, "3 por linha"]])}</select></label>
            <label className="radios"><input type="checkbox" checked={dupla} onChange={(e) => setDupla(e.target.checked)} /> Dupla etiqueta</label>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir</button>
            <button type="button" className="btn btn-default" onClick={() => window.history.back()}>Voltar</button>
          </div>
        </div>
      </div>
      <div className="etiquetas" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {lista.map((a, i) => (
          <div className="etiqueta" key={`${a.id}-${i}`}>
            <div className="et-topo"><img src={logoMinasLab} alt="MinasLab" width="70" height="21" /><b>{referenciaAmostra(a)}</b></div>
            <CodigoBarras texto={a.barra} />
            <div className="et-barra">{a.barra}</div>
            <div className="et-info">{a.os} · {a.servico}{a.matriz ? ` — ${a.matriz}` : ""}</div>
            <div className="et-info">{cli(a)}{a.identificacao ? ` · ${a.identificacao}` : ""}</div>
            <div className="et-info">Coleta: {quandoBR(a.dataColeta) || "____/____/______"}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Rastreabilidade ---------- */

export function Rastreabilidade() {
  const { dados } = useDados();
  const osDe = useMemo(() => Object.fromEntries(dados.ordens.map((o) => [o.id, o])), [dados.ordens]);
  const linhas = useMemo(() => dados.amostras.flatMap((a) => a.analises.map((x, i) => ({ id: `${a.id}:${i}`, a, x }))), [dados.amostras]);
  const contrato = (r) => dados.contratos.find((c) => c.id === r.a.contratoId);
  const colunas = [
    { t: "ID", v: (r) => Number(r.a.cod) || 0 },
    { t: "Lote análise", v: (r) => r.x.lote || "", filtro: true },
    { t: "Cliente", v: (r) => dados.clientes.find((c) => c.id === r.a.clienteId)?.razao || "", filtro: true },
    { t: "Proposta", v: (r) => contrato(r)?.proposta || "", filtro: true },
    { t: "Contrato", v: (r) => osDe[r.a.osId]?.contrato || "", filtro: true },
    { t: "Ordem serviço", v: (r) => r.a.os || "", filtro: true },
    { t: "Amostra", v: (r) => `${referenciaAmostra(r.a)} · ${r.a.barra}`, filtro: true },
    { t: "Parâmetro", v: (r) => r.x.nome, filtro: true },
    { t: "Etapa", v: (r) => r.x.etapa, filtro: true },
  ];
  return (
    <Caixa titulo="Rastreabilidade">
      <p className="suave" style={{ marginTop: -6 }}>Cada linha é um parâmetro de uma amostra, com toda a cadeia até o cliente. Dois cliques abrem a OS.</p>
      <Grade id="rastro" exportar="rastreabilidade" linhas={linhas} colunas={colunas} filtrosColuna ordemInicial={[0, "desc"]} aoAbrir={(r) => navegar("ordem", r.a.osId)} botoes={[]} />
    </Caixa>
  );
}
