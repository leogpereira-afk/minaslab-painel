// Motor das telas de cadastro de Configurações: lista estilo GerenciaLab
// (coluna Ação com Editar, ID sequencial, botão "Adicionar ...") e janela de
// adicionar/editar desenhada a partir de lib/cadastros.js. Editar e excluir
// pedem o motivo (cadastro Motivos de Alteração), que vai para a Auditoria LOG.

import { useEffect, useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { CADASTROS, SIM_NAO, erroFormulario, estaAtivo, padroes, validadeCalibracao } from "../lib/cadastros.js";
import { dataBR, isoDia, semAcento } from "../lib/formato.js";
import { Grade } from "./Grade.jsx";
import { Caixa, Modal, opcoes, useAviso } from "./ui.jsx";

const rotuloDe = (reg, rotulo) => (typeof rotulo === "function" ? rotulo(reg) : reg?.[rotulo]) ?? "";
const Etiqueta = ({ v }) => <span className={`lbl ${v === "Ativo" || v === "Sim" ? "ok" : v === "Inativo" || v === "Não" ? "off" : "default"}`}>{v}</span>;

// Texto de um campo para a lista (e para a pesquisa).
export function textoCampo(f, reg, dados) {
  const v = reg[f.c];
  if (f.t === "ref") return v ? rotuloDe(dados[f.ref.colecao].find((x) => x.id === v), f.ref.rotulo) || "(removido)" : f.ref.vazio || "";
  if (f.t === "refmulti") return Array.isArray(v) && v.length ? `${v.length} selecionado(s)` : "";
  if (f.t === "date") return dataBR(v);
  if (f.t === "senha") return reg[`${f.c}Definida`] ? "••••••" : "";
  if (f.t === "precos") return v ? `${Object.values(v).filter((x) => x !== "" && x != null).length} preço(s)` : "";
  if (f.t === "limites") return Array.isArray(v) ? `${v.length} limite(s)` : "";
  return v ?? "";
}

const CALCULADAS = {
  _validade: { t: "Validade", v: (r) => validadeCalibracao(r), h: (r) => {
    const val = validadeCalibracao(r);
    if (!val) return "";
    const dias = Math.round((new Date(`${val}T00:00:00`) - new Date(`${isoDia(0)}T00:00:00`)) / 864e5);
    return <span className={`lbl ${dias < 0 ? "crit" : dias <= 30 ? "warn" : "ok"}`}>{dataBR(val)}{dias < 0 ? " · vencida" : dias <= 30 ? ` · ${dias} d` : ""}</span>;
  } },
  _limites: { t: "Limites", v: (r) => (r.limites || []).length },
  _qtdPrecos: { t: "Preços", v: (r) => Object.values(r.precos || {}).filter((x) => x !== "" && x != null).length },
  _qtdParametros: { t: "Parâmetros", v: (r) => (r.parametros || []).length },
};

/* ---------------- campos ---------------- */

function opcoesRef(f, valor, dados) {
  const lista = dados[f.ref.colecao].filter((x) => estaAtivo(x) || x.id === valor[f.c]);
  const fp = f.ref.filtroPor;
  const filtrada = fp && valor[fp[0]] ? lista.filter((x) => x[fp[1]] === valor[fp[0]] || x.id === valor[f.c]) : lista;
  return [...filtrada].sort((a, b) => String(rotuloDe(a, f.ref.rotulo)).localeCompare(String(rotuloDe(b, f.ref.rotulo)), "pt-BR"));
}

function CampoRefMulti({ f, valor, set, dados }) {
  const [q, setQ] = useState("");
  const marcados = new Set(valor[f.c] || []);
  const lista = opcoesRef(f, { ...valor, [f.c]: null }, dados).filter((x) => semAcento(rotuloDe(x, f.ref.rotulo)).includes(semAcento(q)));
  const alternar = (id) => { const n = new Set(marcados); n.has(id) ? n.delete(id) : n.add(id); set([...n]); };
  return (
    <div className="multi">
      <div className="acoes" style={{ alignItems: "center", marginBottom: 6 }}>
        <input type="search" placeholder="Filtrar" aria-label={`Filtrar ${f.r}`} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} />
        <button type="button" className="btn btn-default btn-sm" onClick={() => set([...new Set([...marcados, ...lista.map((x) => x.id)])])}>Marcar todos</button>
        <button type="button" className="btn btn-default btn-sm" onClick={() => set([])}>Desmarcar todos</button>
        <span className="suave">{marcados.size} selecionado(s)</span>
      </div>
      <div className="multi-lista">
        {lista.length ? lista.map((x) => (
          <label key={x.id}><input type="checkbox" checked={marcados.has(x.id)} onChange={() => alternar(x.id)} /> {rotuloDe(x, f.ref.rotulo)}</label>
        )) : <span className="suave">{f.ref.filtroPor && !valor[f.ref.filtroPor[0]] ? "Escolha o grupo primeiro." : "Nenhum cadastro disponível."}</span>}
      </div>
    </div>
  );
}

function CampoPrecos({ f, valor, set, dados }) {
  const precos = valor[f.c] || {};
  const params = dados.parametros.filter(estaAtivo);
  const grupos = dados.grupos_servico;
  if (!params.length) return <p className="suave" style={{ margin: 0 }}>Cadastre os parâmetros em Configuração Serviços → Especificação Serviços.</p>;
  return (
    <div className="tw" style={{ maxHeight: 360, overflowY: "auto" }}>
      <table>
        <thead><tr><th>Grupo</th><th>Parâmetro</th><th>Método</th><th>Valor (R$)</th></tr></thead>
        <tbody>{params.map((p) => (
          <tr key={p.id}>
            <td>{grupos.find((g) => g.id === p.grupo)?.nome || ""}</td><td>{p.parametro}</td><td>{dados.metodos.find((m) => m.id === p.metodo)?.nome || ""}</td>
            <td><input className="campo-num" type="number" min="0" step="0.01" aria-label={`Preço de ${p.parametro}`} value={precos[p.id] ?? ""} onChange={(e) => set({ ...precos, [p.id]: e.target.value === "" ? "" : Number(e.target.value) })} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function CampoLimites({ f, valor, set, dados }) {
  const lim = valor[f.c] || [];
  const params = dados.parametros.filter(estaAtivo);
  const muda = (i, k, v) => set(lim.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div>
      <div className="tw">
        <table>
          <thead><tr><th>Parâmetro</th><th>Mínimo</th><th>Máximo</th><th>Texto do limite (VMP)</th><th /></tr></thead>
          <tbody>{lim.length ? lim.map((l, i) => (
            <tr key={i}>
              <td><select aria-label="Parâmetro" value={l.parametro || ""} onChange={(e) => muda(i, "parametro", e.target.value)}>{opcoes([["", "Selecione"], ...params.map((p) => [p.id, p.parametro])])}</select></td>
              <td><input className="campo-num" type="number" step="any" aria-label="Mínimo" value={l.minimo ?? ""} onChange={(e) => muda(i, "minimo", e.target.value === "" ? "" : Number(e.target.value))} /></td>
              <td><input className="campo-num" type="number" step="any" aria-label="Máximo" value={l.maximo ?? ""} onChange={(e) => muda(i, "maximo", e.target.value === "" ? "" : Number(e.target.value))} /></td>
              <td><input aria-label="Texto do limite" placeholder="Ex.: 6,0 a 9,0 · Ausência em 100 mL" value={l.texto || ""} onChange={(e) => muda(i, "texto", e.target.value)} /></td>
              <td><button type="button" className="btn btn-danger btn-sm" onClick={() => set(lim.filter((_, j) => j !== i))}>Remover</button></td>
            </tr>
          )) : <tr><td colSpan={5} className="vazio">Nenhum limite. Adicione um por parâmetro.</td></tr>}</tbody>
        </table>
      </div>
      <button type="button" className="btn btn-default btn-sm" style={{ marginTop: 8 }} disabled={!params.length} onClick={() => set([...lim, { parametro: "", minimo: "", maximo: "", texto: "" }])}>Adicionar limite</button>
      {!params.length && <span className="suave" style={{ marginLeft: 8 }}>Cadastre os parâmetros primeiro.</span>}
    </div>
  );
}

function CampoConta({ f, valor, set }) {
  const { contas } = useDados();
  const [lista, setLista] = useState(null);
  useEffect(() => { contas().then(setLista).catch(() => setLista([])); }, [contas]);
  return (
    <select id={`f-${f.c}`} value={valor[f.c] || ""} onChange={(e) => set(e.target.value)}>
      {opcoes([["", lista ? "Sem conta no painel" : "Carregando…"], ...(lista || []).filter((c) => c.ativo || c.usuario === valor[f.c]).map((c) => [c.usuario, `${c.nome || c.usuario} (${c.usuario})`])])}
    </select>
  );
}

export function Campo({ f, valor, setValor, dados, campos = [] }) {
  const set = (v) => setValor((x) => ({ ...x, [f.c]: v }));
  const id = `f-${f.c}`;
  const v = valor[f.c];
  let ctrl;
  if (f.t === "textarea") ctrl = <textarea id={id} rows={f.linhas || 3} value={v || ""} onChange={(e) => set(e.target.value)} />;
  else if (f.t === "select") ctrl = <select id={id} value={v ?? ""} onChange={(e) => set(e.target.value)}>{opcoes([...(f.op.includes(v) || v == null || v === "" ? [] : [v]), ...(f.padrao === undefined ? [["", "Selecione"]] : []), ...f.op])}</select>;
  else if (f.t === "simnao") ctrl = <select id={id} value={v ?? ""} onChange={(e) => set(e.target.value)}>{opcoes(SIM_NAO)}</select>;
  else if (f.t === "ativo") ctrl = <select id={id} value={v ?? ""} onChange={(e) => set(e.target.value)}>{opcoes(["Ativo", "Inativo"])}</select>;
  else if (f.t === "ref") ctrl = (
    <select id={id} value={v || ""} onChange={(e) => {
      const novo = e.target.value;
      // Trocar o campo que filtra outro (ex.: Grupo) limpa o que dependia dele (Matriz, parâmetros).
      setValor((x) => {
        const n = { ...x, [f.c]: novo };
        for (const outro of campos) if (outro.ref?.filtroPor?.[0] === f.c) n[outro.c] = outro.t === "refmulti" ? [] : "";
        return n;
      });
    }}>
      {opcoes([["", f.ref.vazio || "Selecione"], ...opcoesRef(f, valor, dados).map((x) => [x.id, rotuloDe(x, f.ref.rotulo)])])}
    </select>
  );
  else if (f.t === "refmulti") ctrl = <CampoRefMulti f={f} valor={valor} set={set} dados={dados} />;
  else if (f.t === "precos") ctrl = <CampoPrecos f={f} valor={valor} set={set} dados={dados} />;
  else if (f.t === "limites") ctrl = <CampoLimites f={f} valor={valor} set={set} dados={dados} />;
  else if (f.t === "conta") ctrl = <CampoConta f={f} valor={valor} set={set} />;
  else if (f.t === "senha") ctrl = <input id={id} type="password" autoComplete="new-password" placeholder={valor[`${f.c}Definida`] ? "Gravada. Deixe em branco para manter." : ""} value={v || ""} onChange={(e) => set(e.target.value)} />;
  else ctrl = <input id={id} type={f.t === "number" ? "number" : f.t === "date" ? "date" : f.t === "color" ? "color" : f.t === "email" ? "email" : "text"} step={f.t === "number" ? "any" : undefined} value={v ?? ""} onChange={(e) => set(f.t === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />;
  const grupo = ["refmulti", "precos", "limites"].includes(f.t);
  return (
    <div className={`fg ${f.larg || "s6"}`}>
      {grupo ? <span className="rot">{f.r}{f.obrig ? " *" : ""}</span> : <label htmlFor={id}>{f.r}{f.obrig ? " *" : ""}</label>}
      {ctrl}
      {f.dica && <span className="suave">{f.dica}</span>}
    </div>
  );
}

/* ---------------- janela ---------------- */

function MotivoSelect({ valor, set, obrigatorio }) {
  const { dados } = useDados();
  const motivos = dados.motivos_alteracao.filter(estaAtivo).map((m) => m.identificacao);
  return (
    <div className="fg">
      <label htmlFor="f-motivo">Motivo da {obrigatorio ? "exclusão" : "alteração"}{obrigatorio ? " *" : ""}</label>
      <input id="f-motivo" list="lista-motivos" value={valor} onChange={(e) => set(e.target.value)} placeholder={motivos.length ? "Escolha ou escreva o motivo" : "Escreva o motivo"} />
      <datalist id="lista-motivos">{motivos.map((m) => <option key={m} value={m} />)}</datalist>
    </div>
  );
}

function Historico({ colecao, id }) {
  const { auditoria } = useDados();
  const [itens, setItens] = useState(null);
  useEffect(() => { auditoria({ colecao, registroId: id, limite: 50 }).then(setItens).catch(() => setItens([])); }, [auditoria, colecao, id]);
  if (!itens) return <p className="suave" style={{ margin: 0 }}>Carregando histórico…</p>;
  return (
    <div className="tw" style={{ maxHeight: 260, overflowY: "auto" }}>
      <table><thead><tr><th>Data</th><th>Usuário</th><th>O que mudou</th></tr></thead>
        <tbody>{itens.length ? itens.map((a) => <tr key={a.id}><td>{new Date(a.em).toLocaleString("pt-BR")}</td><td>{a.usuario}</td><td className="quebra">{a.acao}</td></tr>) : <tr><td colSpan={3} className="vazio">Sem registros.</td></tr>}</tbody>
      </table>
    </div>
  );
}

function JanelaCadastro({ secao, registro, onFechar }) {
  const { dados, salvar, apagar } = useDados();
  const avisar = useAviso();
  const novo = !registro;
  const [valor, setValor] = useState(() => (registro ? { ...registro } : padroes(secao.campos)));
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [historico, setHistorico] = useState(false);
  const gravar = async () => {
    const erro = erroFormulario(secao.campos, valor, dados[secao.colecao]);
    if (erro) { avisar(erro[1], "err"); document.getElementById(`f-${erro[0]}`)?.focus(); return false; }
    setOcupado(true);
    try {
      await salvar(secao.colecao, valor, { motivo, numerar: novo });
      avisar(novo ? `${secao.janela} adicionado.` : `${secao.janela} atualizado.`, "ok");
    } catch (e) { avisar(e.message, "err"); return false; } finally { setOcupado(false); }
  };
  if (excluir) {
    return (
      <Modal titulo={`Excluir ${secao.janela.toLowerCase()}`} onFechar={() => setExcluir(false)} rotuloOk="Excluir" ocupado={ocupado} aoConfirmar={async () => {
        if (!motivo.trim()) { avisar("Informe o motivo da exclusão.", "err"); return false; }
        setOcupado(true);
        try { await apagar(secao.colecao, registro.id, motivo.trim()); avisar("Excluído. O registro continua na Auditoria LOG.", "ok"); onFechar(); }
        catch (e) { avisar(e.message, "err"); return false; } finally { setOcupado(false); }
      }}>
        <p style={{ margin: 0 }}>O cadastro deixa de aparecer nas listas. O histórico fica guardado na Auditoria LOG.</p>
        <MotivoSelect valor={motivo} set={setMotivo} obrigatorio />
      </Modal>
    );
  }
  return (
    <Modal titulo={`${novo ? "Adicionar" : "Editar"} ${secao.janela.toLowerCase()}`} largo={secao.largo} onFechar={onFechar} rotuloOk={novo ? "Adicionar" : "Atualizar"} ocupado={ocupado} aoConfirmar={gravar}
      extra={!novo && <><button type="button" className="btn btn-danger" onClick={() => setExcluir(true)}>Excluir</button><button type="button" className="btn btn-default" onClick={() => setHistorico((h) => !h)}>{historico ? "Ocultar histórico" : "Histórico"}</button></>}>
      <form className="frm" onSubmit={(e) => { e.preventDefault(); gravar().then((ok) => ok !== false && onFechar()); }} noValidate>
        {secao.campos.map((f) => <Campo key={f.c} f={f} valor={valor} setValor={setValor} dados={dados} campos={secao.campos} />)}
        {!novo && <div className="s12"><MotivoSelect valor={motivo} set={setMotivo} /></div>}
        <button type="submit" hidden>Gravar</button>
      </form>
      {!novo && registro.cod && <p className="suave" style={{ margin: 0 }}>ID {registro.cod} · criado por {registro.criadoPor} em {new Date(registro.criadoEm).toLocaleString("pt-BR")} · última alteração por {registro.atualizadoPor} em {new Date(registro.atualizadoEm).toLocaleString("pt-BR")}</p>}
      {historico && <Historico colecao={secao.colecao} id={registro.id} />}
    </Modal>
  );
}

/* ---------------- tela ---------------- */

function SecaoCadastro({ secao, titulo }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [janela, setJanela] = useState(null);
  const [carregandoPadrao, setCarregandoPadrao] = useState(false);
  const lista = dados[secao.colecao];
  const colunas = useMemo(() => [
    { t: "Ação", v: () => "", h: (r) => <button type="button" className="btn btn-default btn-sm" onClick={(e) => { e.stopPropagation(); setJanela({ registro: r }); }}>Editar</button> },
    { t: "ID", v: (r) => Number(r.cod) || 0 },
    ...secao.colunas.map((c) => {
      if (CALCULADAS[c]) return CALCULADAS[c];
      const f = secao.campos.find((x) => x.c === c);
      const texto = (r) => textoCampo(f, r, dados);
      return { t: f.r, v: f.t === "number" ? (r) => Number(r[c]) || 0 : texto, fv: texto, h: ["simnao", "ativo"].includes(f.t) ? (r) => (r[c] ? <Etiqueta v={r[c]} /> : "") : undefined };
    }),
  ], [secao, dados]);
  const carregarPadroes = async () => {
    setCarregandoPadrao(true);
    try { for (const p of secao.padroes) await salvar(secao.colecao, p, { numerar: true }); avisar("Cadastros padrão incluídos.", "ok"); }
    catch (e) { avisar(e.message, "err"); } finally { setCarregandoPadrao(false); }
  };
  return (
    <Caixa titulo={titulo}>
      {secao.padroes && !lista.length && (
        <p className="aviso alerta" style={{ marginBottom: 12 }}>Nenhum cadastro ainda. <button type="button" className="btn btn-default btn-sm" disabled={carregandoPadrao} onClick={carregarPadroes}>{carregandoPadrao ? "Incluindo…" : `Incluir os padrões (${secao.padroes.map((p) => p.nome).join(", ")})`}</button></p>
      )}
      <Grade id={secao.colecao} linhas={lista} colunas={colunas} ordemInicial={[1, "asc"]} aoAbrir={(r) => setJanela({ registro: r })}
        botoes={[{ rotulo: secao.botao, acao: () => setJanela({ registro: null }) }]} />
      {janela && <JanelaCadastro secao={secao} registro={janela.registro} onFechar={() => setJanela(null)} />}
    </Caixa>
  );
}

export default function TelaCadastro({ tela }) {
  const def = CADASTROS[tela];
  return (
    <>
      {def.subtitulo && <p className="suave" style={{ margin: "-6px 0 12px" }}>{def.subtitulo}</p>}
      {def.secoes.map((s, i) => <SecaoCadastro key={s.colecao} secao={s} titulo={s.titulo || (i === 0 ? def.titulo : "")} />)}
    </>
  );
}
