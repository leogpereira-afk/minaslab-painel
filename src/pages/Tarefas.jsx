// Tarefas: o quadro "Prazo" e a "Lista", como no Bitrix24. Criar, delegar, compartilhar e conversar na própria tarefa.
// Quem pode o quê é decidido no servidor (ml-tarefas); esta página só mostra o que a pessoa enxerga.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Flame, LayoutGrid, List, MessageSquare, Plus, RefreshCw, Search } from "lucide-react";
import { clsx } from "clsx";
import { PageTitle } from "../components/ui.jsx";
import QuadroPrazo from "../components/tarefas/QuadroPrazo.jsx";
import ListaTarefas from "../components/tarefas/ListaTarefas.jsx";
import FormularioTarefa from "../components/tarefas/FormularioTarefa.jsx";
import DetalheTarefa from "../components/tarefas/DetalheTarefa.jsx";
import { PAPEIS_FILTRO, resumoDasTarefas } from "../lib/tarefas.js";
import { ehDirecao } from "../lib/sessao.js";
import { tarefasListar, tarefasUsuarios } from "../services/tarefas.js";

const SITUACOES = [{ id: "abertas", rotulo: "Em andamento" }, { id: "concluidas", rotulo: "Concluídas" }, { id: "todas", rotulo: "Todas" }];

export default function Tarefas() {
  const [params, setParams] = useSearchParams();
  const [visao, setVisao] = useState(() => { try { return localStorage.getItem("tarefas_visao") === "lista" ? "lista" : "prazo"; } catch { return "prazo"; } });
  const [papel, setPapel] = useState("todas");
  const [situacao, setSituacao] = useState("abertas");
  const [escopo, setEscopo] = useState("minhas");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [lista, setLista] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [eu, setEu] = useState("");
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [criando, setCriando] = useState(null); // null | { pai?: {id,titulo} }
  const [agora, setAgora] = useState(() => new Date());
  const aberta = params.get("abrir");
  const direcao = ehDirecao();

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setAtualizando(true);
    try {
      const r = await tarefasListar({ papel: escopo === "todas" ? "todas" : papel, status: situacao, escopo, busca: buscaAplicada });
      setLista(r);
      setEu(r.eu);
      setErro("");
      setAgora(new Date());
    } catch (ex) {
      if (!silencioso) setErro(ex.message);
    } finally {
      if (!silencioso) setAtualizando(false);
    }
  }, [papel, situacao, escopo, buscaAplicada]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) void carregar(true); }, 30000);
    return () => clearInterval(t);
  }, [carregar]);
  useEffect(() => {
    let vivo = true;
    tarefasUsuarios().then((r) => { if (vivo) { setUsuarios(r.usuarios); setEu((v) => v || r.eu); } }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => { const t = setTimeout(() => setBuscaAplicada(busca.trim()), 300); return () => clearTimeout(t); }, [busca]);
  useEffect(() => { try { localStorage.setItem("tarefas_visao", visao); } catch { /* sem armazenamento local segue sem lembrar */ } }, [visao]);

  const tarefas = useMemo(() => lista?.tarefas || [], [lista]);
  const nomes = useMemo(() => ({ ...Object.fromEntries(usuarios.map((u) => [u.usuario, u.nome])), ...(lista?.nomes || {}) }), [usuarios, lista]);
  const resumo = useMemo(() => resumoDasTarefas(tarefas, agora), [tarefas, agora]);

  const abrir = useCallback((id) => { const p = new URLSearchParams(params); p.set("abrir", id); setParams(p, { replace: false }); }, [params, setParams]);
  const fecharDetalhe = useCallback(() => { const p = new URLSearchParams(params); p.delete("abrir"); setParams(p, { replace: true }); }, [params, setParams]);

  const criada = (id) => { setCriando(null); void carregar(true); abrir(id); };

  return (
    <div className="space-y-4">
      <PageTitle titulo="Tarefas" descricao="Crie, passe para outra pessoa, compartilhe e converse dentro da tarefa. Quem participa recebe aviso no sino." />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => setCriando({})}><Plus size={16} />Criar</button>
        {escopo === "minhas" && (
          <select className="select h-10 min-h-0 w-auto text-sm" aria-label="Minha função na tarefa" value={papel} onChange={(e) => setPapel(e.target.value)}>
            {PAPEIS_FILTRO.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        )}
        <select className="select h-10 min-h-0 w-auto text-sm" aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
          {SITUACOES.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
        </select>
        {direcao && (
          <select className="select h-10 min-h-0 w-auto text-sm" aria-label="Quais tarefas ver" value={escopo} onChange={(e) => setEscopo(e.target.value)}>
            <option value="minhas">Só as minhas</option>
            <option value="todas">Todas da empresa (direção)</option>
          </select>
        )}
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input className="input h-10 min-h-0 pl-9 text-sm" placeholder="Pesquisar tarefa" aria-label="Pesquisar tarefa" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="ml-auto inline-flex rounded-xl border bg-white p-1" style={{ borderColor: "var(--hairline)" }} role="group" aria-label="Visão">
          {[["prazo", "Prazo", LayoutGrid], ["lista", "Lista", List]].map(([id, rotulo, Icone]) => (
            <button key={id} type="button" aria-pressed={visao === id} onClick={() => setVisao(id)} className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-sm font-medium", visao === id ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100")}><Icone size={14} aria-hidden="true" />{rotulo}</button>
          ))}
        </div>
        <button type="button" className="btn-ghost h-10 w-10 p-0" onClick={() => carregar()} disabled={atualizando} aria-label="Atualizar" title="Atualizar"><RefreshCw size={16} className={atualizando ? "animate-spin" : ""} /></button>
      </div>

      <div className="flex flex-wrap gap-2 text-sm" aria-label="Resumo">
        <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold", resumo.atrasadas ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500")}><Flame size={14} aria-hidden="true" />Atrasadas {resumo.atrasadas}</span>
        <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold", resumo.hoje ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}>Vencem hoje {resumo.hoje}</span>
        <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold", resumo.naoLidas ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-500")}><MessageSquare size={14} aria-hidden="true" />Com novidade {resumo.naoLidas}</span>
      </div>

      {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {!lista && !erro && <p className="rounded-2xl border bg-white p-8 text-center text-slate-500">Carregando as tarefas...</p>}
      {lista && (visao === "prazo" && situacao === "abertas"
        ? <QuadroPrazo tarefas={tarefas} nomes={nomes} agora={agora} aoAbrir={abrir} aoCriar={() => setCriando({})} />
        : <ListaTarefas tarefas={tarefas} nomes={nomes} agora={agora} aoAbrir={abrir} aoCriar={() => setCriando({})} />)}
      {lista && visao === "prazo" && situacao !== "abertas" && <p className="text-xs text-slate-500">O quadro por prazo mostra só as tarefas em andamento; aqui está a lista.</p>}

      {criando && <FormularioTarefa usuarios={usuarios} eu={eu} pai={criando.pai} aoFechar={() => setCriando(null)} aoCriada={criada} />}
      {aberta && (
        <DetalheTarefa
          key={aberta}
          id={aberta}
          usuarios={usuarios}
          agora={agora}
          aoFechar={fecharDetalhe}
          aoMudou={() => carregar(true)}
          aoAbrirOutra={abrir}
          aoCriarSubtarefa={(pai) => setCriando({ pai })}
        />
      )}
    </div>
  );
}
