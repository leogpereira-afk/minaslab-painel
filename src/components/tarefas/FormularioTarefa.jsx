// Criar tarefa: formulário rápido (nome, descrição, responsável, prazo, lista de verificação)
// e "formulário detalhado" (participantes, observadores, marcadores) — como no Bitrix24.
import { useMemo, useState } from "react";
import { Bell, Flame, ListChecks, Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "../ui.jsx";
import SeletorPessoas from "./SeletorPessoas.jsx";
import { LEMBRETES, atalhosDePrazo, deInputLocal, lembreteDoSelect } from "../../lib/tarefas.js";
import { tarefaCriar } from "../../services/tarefas.js";

export default function FormularioTarefa({ usuarios, eu, pai, aoFechar, aoCriada }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState(eu);
  const [prazo, setPrazo] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [lembrete, setLembrete] = useState("");
  const [checklist, setChecklist] = useState([]);
  const [novoItem, setNovoItem] = useState("");
  const [detalhado, setDetalhado] = useState(false);
  const [participantes, setParticipantes] = useState([]);
  const [observadores, setObservadores] = useState([]);
  const [marcadores, setMarcadores] = useState([]);
  const [novoMarcador, setNovoMarcador] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const atalhos = useMemo(() => atalhosDePrazo(new Date()), []);

  const adicionarItem = () => { const t = novoItem.trim(); if (!t) return; setChecklist((l) => [...l, t]); setNovoItem(""); };
  const adicionarMarcador = () => { const t = novoMarcador.trim().replace(/^#/, ""); if (t && !marcadores.includes(t) && marcadores.length < 10) setMarcadores((l) => [...l, t]); setNovoMarcador(""); };

  const criar = async (e) => {
    e.preventDefault();
    if (salvando) return;
    if (!titulo.trim()) { setErro("Dê um nome para a tarefa."); return; }
    setSalvando(true);
    setErro("");
    try {
      const pendente = novoItem.trim();
      const itens = pendente ? [...checklist, pendente] : checklist;
      const r = await tarefaCriar({
        titulo, descricao, responsavel, prazo: deInputLocal(prazo), lembrete: prazo ? lembreteDoSelect(lembrete) : null, urgente, participantes, observadores, marcadores,
        checklist: itens.map((texto) => ({ texto })), tarefa_pai_id: pai?.id || null,
      });
      aoCriada(r.id);
    } catch (ex) {
      setErro(ex.message);
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={pai ? "Nova subtarefa" : "Nova tarefa"} aberto aoFechar={aoFechar} largura={detalhado ? "max-w-2xl" : "max-w-xl"}>
      <form onSubmit={criar} className="space-y-4">
        {pai && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Subtarefa de <b>{pai.titulo}</b></p>}
        <div className="flex items-start gap-2">
          <input className="input flex-1 font-display text-lg font-semibold" placeholder="Nome da tarefa" aria-label="Nome da tarefa" value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          <button type="button" onClick={() => setUrgente((v) => !v)} aria-pressed={urgente} title={urgente ? "Tarefa urgente" : "Marcar como urgente"} className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition", urgente ? "border-orange-300 bg-orange-50 text-orange-600" : "text-slate-400 hover:text-orange-500")} style={urgente ? undefined : { borderColor: "var(--hairline)" }}>
            <Flame size={20} aria-hidden="true" />
          </button>
        </div>
        <textarea className="input min-h-[84px] py-2" rows={detalhado ? 5 : 3} placeholder="Descrição" aria-label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

        <div className="grid gap-3 sm:grid-cols-[120px_1fr] sm:items-start">
          <span className="pt-1 text-sm text-slate-500">Responsável</span>
          <SeletorPessoas usuarios={usuarios} valor={responsavel} onChange={setResponsavel} unico />
          <span className="pt-2 text-sm text-slate-500">Prazo</span>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <input type="datetime-local" className="input h-10 min-h-0 w-auto text-sm" aria-label="Prazo" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              {prazo && <button type="button" className="text-xs text-slate-500 underline" onClick={() => setPrazo("")}>Sem prazo</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {atalhos.map((a) => (
                <button key={a.id} type="button" onClick={() => setPrazo(a.valor)} className={clsx("rounded-full border px-2.5 py-0.5 text-xs", prazo === a.valor ? "border-brand-400 bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50")} style={prazo === a.valor ? undefined : { borderColor: "var(--hairline)" }}>{a.rotulo}</button>
              ))}
            </div>
            {prazo && (
              <label className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <Bell size={14} aria-hidden="true" />Lembrete
                <select className="input h-9 min-h-0 w-auto text-sm" aria-label="Lembrete" value={lembrete} onChange={(e) => setLembrete(e.target.value)}>
                  {LEMBRETES.map((l) => <option key={String(l.valor)} value={l.valor ?? ""}>{l.rotulo}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><ListChecks size={15} aria-hidden="true" />Lista de verificação</p>
          <ul className="space-y-1">
            {checklist.map((t, i) => (
              <li key={`${t}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{t}</span>
                <button type="button" className="text-slate-400 hover:text-red-600" aria-label={`Remover ${t}`} onClick={() => setChecklist((l) => l.filter((_, k) => k !== i))}><X size={14} /></button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex gap-2">
            <input className="input h-9 min-h-0 flex-1 text-sm" placeholder="Adicionar item e apertar Enter" aria-label="Novo item da lista de verificação" value={novoItem} maxLength={300} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarItem(); } }} />
            <button type="button" className="btn-outline h-9 min-h-0" onClick={adicionarItem} disabled={!novoItem.trim()}><Plus size={14} />Item</button>
          </div>
        </div>

        {detalhado && (
          <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
            <div className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-start">
              <span className="pt-1 text-sm text-slate-500">Participantes</span>
              <SeletorPessoas usuarios={usuarios} valor={participantes} onChange={setParticipantes} ocultar={[responsavel, eu, ...observadores]} vazio="Quem vai ajudar na tarefa" />
              <span className="pt-1 text-sm text-slate-500">Observadores</span>
              <SeletorPessoas usuarios={usuarios} valor={observadores} onChange={setObservadores} ocultar={[responsavel, eu, ...participantes]} vazio="Quem só acompanha" />
              <span className="pt-1.5 text-sm text-slate-500">Marcadores</span>
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {marcadores.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">#{m}<button type="button" aria-label={`Remover marcador ${m}`} onClick={() => setMarcadores((l) => l.filter((x) => x !== m))}><X size={11} /></button></span>
                  ))}
                </div>
                <input className="input h-9 min-h-0 text-sm" placeholder="Novo marcador e Enter" aria-label="Novo marcador" value={novoMarcador} maxLength={30} onChange={(e) => setNovoMarcador(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarMarcador(); } }} />
              </div>
            </div>
          </div>
        )}

        {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Criando..." : "Criar"}</button>
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          </div>
          <button type="button" className="text-sm text-slate-500 underline" onClick={() => setDetalhado((v) => !v)}>{detalhado ? "Formulário simples" : "Formulário detalhado"}</button>
        </div>
      </form>
    </Modal>
  );
}
