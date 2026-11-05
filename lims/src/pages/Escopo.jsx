// Configurações → Escopo de acreditação (Cgcre CRL 1943) e a conferência do
// cadastro de parâmetros contra ele. O relatório de ensaio só marca "*" no
// que está no escopo (método + matriz) e marcado como acreditado.

import { useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { conferirParametros } from "../lib/escopo.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, useAviso } from "../components/ui.jsx";
import ESCOPO_CRL1943 from "../lib/escopoCRL1943.json";

export function EscopoAcreditacao() {
  const { dados, salvarLote } = useDados();
  const avisar = useAviso();
  const [aba, setAba] = useState("Escopo");
  const [sel, setSel] = useState(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const escopo = dados.escopo_acreditacao;
  const nomeMetodo = (id) => dados.metodos.find((m) => m.id === id)?.nome || "";
  const conf = useMemo(() => conferirParametros(escopo.length ? escopo : ESCOPO_CRL1943, dados.parametros, nomeMetodo), [escopo, dados.parametros, dados.metodos]);
  const nomeGrupo = (id) => dados.grupos_servico.find((g) => g.id === id)?.nome || "";
  const carregar = async () => {
    setOcupado(true);
    try { await salvarLote("escopo_acreditacao", ESCOPO_CRL1943, { motivo: "Escopo CRL 1943 (Cgcre, revisão de 25/08/2025)" }); avisar(`${ESCOPO_CRL1943.length} itens do escopo gravados.`, "ok"); }
    catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  const marcar = async (valor) => {
    const alvo = conf.filter((r) => sel.has(r.id) && r.p.acreditado !== valor).map((r) => ({ ...r.p, acreditado: valor }));
    if (!alvo.length) { avisar("Nada a mudar nos selecionados.", "err"); return false; }
    setOcupado(true);
    try {
      for (let i = 0; i < alvo.length; i += 200) await salvarLote("parametros", alvo.slice(i, i + 200), { motivo: `Conferência do escopo CRL 1943: acreditado = ${valor}` });
      setSel(new Set()); avisar(`${alvo.length} parâmetro(s) atualizado(s).`, "ok");
    } catch (e) { avisar(e.message, "err"); return false; } finally { setOcupado(false); }
  };
  const contagem = conf.reduce((t, r) => ({ ...t, [r.situacao.startsWith("Edição") ? "Edição do método diferente do escopo" : r.situacao]: (t[r.situacao.startsWith("Edição") ? "Edição do método diferente do escopo" : r.situacao] || 0) + 1 }), {});
  const colEscopo = [
    { t: "Item", v: (e) => Number(e.cod) || 0 }, { t: "Classe", v: (e) => e.classe, filtro: "lista" }, { t: "Área", v: (e) => e.area, filtro: "lista" },
    { t: "Ensaio", v: (e) => e.ensaio, filtro: true }, { t: "Norma / procedimento", v: (e) => e.metodo, filtro: true }, { t: "LQ / Faixa", v: (e) => e.faixa || "" },
    { t: "Matrizes", v: (e) => (e.matrizes || []).join(", "), filtro: true }, { t: "Campo", v: (e) => (e.campo ? "Sim" : "Não"), filtro: "lista" },
  ];
  const colConf = [
    { t: "Situação", v: (r) => r.situacao, h: (r) => <span className={`lbl ${r.situacao === "Conforme o escopo" ? "ok" : r.situacao.startsWith("Marcado") ? "crit" : "warn"}`}>{r.situacao}</span>, filtro: "lista" },
    { t: "ID", v: (r) => Number(r.p.cod) || 0, filtro: true }, { t: "Parâmetro", v: (r) => r.p.parametro || "", filtro: true }, { t: "Grupo", v: (r) => nomeGrupo(r.p.grupo), filtro: "lista" },
    { t: "Método no cadastro", v: (r) => r.metodo, filtro: true }, { t: "Acreditado", v: (r) => r.p.acreditado || "Não", filtro: "lista" },
    { t: "In loco", v: (r) => r.p.inloco || "Não", filtro: "lista" }, { t: "LQ no cadastro", v: (r) => r.p.lq || "" },
    { t: "Item do escopo", v: (r) => (r.item ? `${r.item.cod} · ${r.item.ensaio}` : "—") }, { t: "LQ do escopo", v: (r) => r.item?.faixa || "" },
  ];
  const situacoes = [...new Set(conf.map((r) => r.situacao))];
  return (
    <Caixa titulo="Escopo de acreditação">
      <p style={{ marginTop: -4 }}><b>CRL 1943</b> · MINASLABBRASIL LTDA / MINASLAB · ABNT NBR ISO/IEC 17025 · Ensaio · Instalação permanente · revisão de 25/08/2025 (NIT-DICLA-016).</p>
      {escopo.length > 0 && ESCOPO_CRL1943.some((e) => { const g = escopo.find((x) => x.id === e.id); return !g || ["ensaio", "metodo", "faixa", "campo", "classe"].some((k) => JSON.stringify(g[k] ?? null) !== JSON.stringify(e[k] ?? null)) || JSON.stringify(g.matrizes) !== JSON.stringify(e.matrizes); }) && <p className="aviso alerta">O escopo gravado difere da versão conferida com o PDF. <button type="button" className="btn btn-primary btn-sm" disabled={ocupado} onClick={carregar}>Atualizar escopo gravado</button></p>}
      {!escopo.length && <p className="aviso alerta">O escopo ainda não está gravado no sistema; a conferência abaixo usa a cópia do PDF. <button type="button" className="btn btn-primary btn-sm" disabled={ocupado} onClick={carregar}>Gravar escopo CRL 1943 ({ESCOPO_CRL1943.length} itens)</button></p>}
      <div className="abas" role="tablist">{["Escopo", "Conferência dos parâmetros"].map((t) => <button key={t} type="button" role="tab" aria-selected={aba === t} className={aba === t ? "on" : ""} onClick={() => { setAba(t); setSel(new Set()); }}>{t}</button>)}</div>
      <div style={{ marginTop: 14 }}>
        {aba === "Escopo" && <Grade id="escopo" exportar="escopo-crl1943" linhas={escopo.length ? escopo : ESCOPO_CRL1943} colunas={colEscopo} filtrosColuna ordemInicial={[0, "asc"]} porPaginaInicial={100} botoes={[]} />}
        {aba === "Conferência dos parâmetros" && <>
          <div className="kpis">{Object.entries(contagem).map(([t, n]) => <div key={t} className={`kpi ${t === "Conforme o escopo" ? "bom" : t.startsWith("Marcado") ? "ruim" : ""}`}><span>{t}</span><b>{n}</b></div>)}</div>
          <p className="suave">"Marcado acreditado, método fora do escopo": o relatório já não marca esses ensaios como acreditados; ajuste o cadastro (ou o método) para ficar coerente. "Método do escopo, mas não marcado": confira se é o mesmo ensaio do escopo antes de marcar.</p>
          <Grade id="escopo-conf" exportar="conferencia-escopo" linhas={conf} colunas={colConf} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[2, "asc"]} porPaginaInicial={100}
            opcoesFiltro={{ 0: situacoes }}
            botoes={[
              { rotulo: "Selecionar todos", acao: () => setSel(new Set(conf.map((r) => r.id))) },
              { rotulo: "Deselecionar todos", acao: () => setSel(new Set()) },
              { rotulo: "Marcar como acreditado", acao: () => (sel.size ? setConfirmar("Sim") : avisar("Selecione os parâmetros.", "err")) },
              { rotulo: "Marcar como não acreditado", acao: () => (sel.size ? setConfirmar("Não") : avisar("Selecione os parâmetros.", "err")) },
            ]} />
        </>}
      </div>
      {confirmar && (
        <Modal titulo={confirmar === "Sim" ? "Marcar como acreditado" : "Marcar como não acreditado"} onFechar={() => setConfirmar(null)} rotuloOk="Confirmar" aoConfirmar={() => marcar(confirmar)}>
          <p style={{ margin: 0 }}>{sel.size} parâmetro(s) selecionado(s). A mudança fica na Auditoria LOG com o motivo "Conferência do escopo CRL 1943".</p>
        </Modal>
      )}
    </Caixa>
  );
}
