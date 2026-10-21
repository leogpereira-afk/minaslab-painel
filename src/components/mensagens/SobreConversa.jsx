// Painel "Sobre o grupo" (ou "Sobre a conversa"): foto, nome, participantes, som, descrição e sair. Abre ao lado do chat.
import { useRef, useState } from "react";
import { Bell, BellOff, Camera, Crown, LogOut, Pencil, UserMinus, UserPlus, X } from "lucide-react";
import Avatar from "../tarefas/Avatar.jsx";
import SeletorPessoas from "../tarefas/SeletorPessoas.jsx";
import EditorFoto from "../acessos/EditorFoto.jsx";
import FotoGrupo from "./FotoGrupo.jsx";
import { conversaDescricao, conversaFotoGrupo, conversaFotoGrupoRemover, conversaMembros, conversaRenomear, conversaSair } from "../../services/mensagens.js";
import { diaLocal } from "../../lib/tarefas.js";

const ate = (lista, n) => ({ vistos: lista.slice(0, n), resto: Math.max(0, lista.length - n) });

export default function SobreConversa({ dados, usuarios, eu, aoFechar, aoMudou, aoSair, aoSilenciar }) {
  const { conversa, membros, nomes, pode } = dados;
  const grupo = conversa.tipo === "grupo";
  const nomeDe = (u) => nomes[u] || usuarios.find((x) => x.usuario === u)?.nome || u;
  const [editandoNome, setEditandoNome] = useState(false);
  const [nome, setNome] = useState(conversa.nome || "");
  const [descricao, setDescricao] = useState(conversa.descricao || "");
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [novos, setNovos] = useState([]);
  const [fotoAberta, setFotoAberta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const secaoPessoas = useRef(null);

  const rodar = async (fn, depois) => {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try { await fn(); await aoMudou(); depois?.(); } catch (ex) { setErro(ex.message); } finally { setOcupado(false); }
  };
  const salvarNome = () => { const n = nome.trim(); if (!n || n === conversa.nome) { setEditandoNome(false); return; } void rodar(() => conversaRenomear(conversa.id, n), () => setEditandoNome(false)); };
  const salvarDescricao = () => void rodar(() => conversaDescricao(conversa.id, descricao), () => setEditandoDescricao(false));
  const adicionar = () => { if (novos.length) void rodar(() => conversaMembros(conversa.id, novos, []), () => { setNovos([]); setAdicionando(false); }); };
  const retirar = (u) => { if (window.confirm(`Retirar ${nomeDe(u)} do grupo?`)) void rodar(() => conversaMembros(conversa.id, [], [u])); };
  const sair = async () => {
    if (!window.confirm("Sair deste grupo? Você deixa de receber as mensagens.")) return;
    setOcupado(true); setErro("");
    try { await conversaSair(conversa.id); aoSair(); } catch (ex) { setErro(ex.message); setOcupado(false); }
  };
  const { vistos, resto } = ate(membros, 5);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-slate-50" aria-label={grupo ? "Sobre o grupo" : "Sobre a conversa"}>
      <header className="flex items-center gap-3 border-b bg-white px-3 py-2.5" style={{ borderColor: "var(--hairline)" }}>
        <button type="button" className="btn-ghost h-9 w-9 shrink-0 p-0" onClick={aoFechar} aria-label="Fechar painel"><X size={18} /></button>
        <h2 className="font-display text-base font-semibold text-slate-900">{grupo ? "Sobre o grupo" : "Sobre a conversa"}</h2>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <section className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <div className="relative mx-auto w-fit">
            {grupo ? <FotoGrupo foto={conversa.foto} tamanho={104} /> : <Avatar usuario={conversa.outro} nome={conversa.titulo} tamanho={104} />}
            {grupo && pode.gerir && <button type="button" onClick={() => setFotoAberta(true)} className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border bg-white text-slate-600 shadow hover:text-brand-700" style={{ borderColor: "var(--hairline)" }} aria-label="Mudar a foto do grupo" title="Mudar a foto"><Camera size={15} /></button>}
          </div>
          {editandoNome ? (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); salvarNome(); }}>
              <input className="input h-10 min-h-0 flex-1 text-sm" value={nome} maxLength={80} autoFocus aria-label="Nome do grupo" onChange={(e) => setNome(e.target.value)} />
              <button type="submit" className="btn-primary h-10" disabled={ocupado || !nome.trim()}>Salvar</button>
            </form>
          ) : (
            <p className="mt-3 flex items-center justify-center gap-1.5 font-display text-lg font-semibold text-slate-900">
              <span className="min-w-0 [overflow-wrap:anywhere]">{conversa.titulo}</span>
              {grupo && pode.gerir && <button type="button" className="rounded p-1 text-slate-400 hover:text-brand-700" aria-label="Mudar o nome do grupo" onClick={() => { setNome(conversa.nome || ""); setEditandoNome(true); }}><Pencil size={13} /></button>}
            </p>
          )}
          {grupo && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="flex -space-x-2">{vistos.map((m) => <Avatar key={m.usuario} usuario={m.usuario} nome={nomeDe(m.usuario)} tamanho={30} className="ring-2 ring-white" />)}</span>
              {resto > 0 && <span className="text-xs text-slate-500">+{resto}</span>}
              {pode.gerir && <button type="button" className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100" onClick={() => { setAdicionando(true); secaoPessoas.current?.scrollIntoView({ block: "nearest" }); }}><UserPlus size={13} aria-hidden="true" />Adicionar</button>}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <button type="button" role="switch" aria-checked={!conversa.silenciado} onClick={aoSilenciar} className="flex w-full items-center gap-3 text-left text-sm">
            {conversa.silenciado ? <BellOff size={17} className="text-slate-400" aria-hidden="true" /> : <Bell size={17} className="text-sky-600" aria-hidden="true" />}
            <span className="flex-1 font-medium text-slate-800">Som das mensagens</span>
            <span className={`relative h-6 w-11 rounded-full transition ${conversa.silenciado ? "bg-slate-300" : "bg-sky-500"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${conversa.silenciado ? "left-0.5" : "left-[22px]"}`} /></span>
          </button>
        </section>

        {grupo && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descrição</h3>{pode.gerir && !editandoDescricao && <button type="button" className="text-xs font-medium text-sky-700 underline" onClick={() => { setDescricao(conversa.descricao || ""); setEditandoDescricao(true); }}>{conversa.descricao ? "Editar" : "Adicionar"}</button>}</div>
            {editandoDescricao ? (
              <div className="space-y-2">
                <textarea className="input min-h-[80px] text-sm" rows={3} maxLength={500} value={descricao} autoFocus aria-label="Descrição do grupo" onChange={(e) => setDescricao(e.target.value)} />
                <div className="flex gap-2"><button type="button" className="btn-primary h-9" onClick={salvarDescricao} disabled={ocupado}>Salvar</button><button type="button" className="btn-outline h-9" onClick={() => setEditandoDescricao(false)}>Cancelar</button></div>
              </div>
            ) : <p className={`whitespace-pre-wrap text-sm [overflow-wrap:anywhere] ${conversa.descricao ? "text-slate-700" : "text-slate-400"}`}>{conversa.descricao || "Sem descrição."}</p>}
            {conversa.criadoEm && <p className="mt-3 text-xs text-slate-500">Criado em {diaLocal(conversa.criadoEm).split("-").reverse().join("/")}</p>}
          </section>
        )}

        {grupo && (
          <section ref={secaoPessoas} className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{membros.length} participantes</h3>
            {pode.gerir && adicionando && (
              <div className="mb-3 space-y-2 rounded-xl bg-slate-50 p-2">
                <SeletorPessoas usuarios={usuarios} valor={novos} onChange={setNovos} ocultar={membros.map((m) => m.usuario)} vazio="Escolha quem entra" />
                <div className="flex gap-2"><button type="button" className="btn-primary h-9" onClick={adicionar} disabled={ocupado || !novos.length}>Adicionar ao grupo</button><button type="button" className="btn-outline h-9" onClick={() => { setAdicionando(false); setNovos([]); }}>Cancelar</button></div>
              </div>
            )}
            <ul className="divide-y" style={{ borderColor: "var(--hairline)" }}>
              {membros.map((m) => (
                <li key={m.usuario} className="flex items-center gap-3 py-2">
                  <Avatar usuario={m.usuario} nome={nomeDe(m.usuario)} tamanho={32} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{nomeDe(m.usuario)}{m.usuario === eu && <span className="text-slate-400"> (você)</span>}</span>
                  {m.papel === "admin" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"><Crown size={11} aria-hidden="true" />Administrador</span>}
                  {pode.gerir && m.usuario !== eu && <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Retirar ${nomeDe(m.usuario)}`} onClick={() => retirar(m.usuario)} disabled={ocupado}><UserMinus size={16} /></button>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {pode.sair && <button type="button" className="flex w-full items-center gap-2 rounded-2xl bg-white p-4 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50" onClick={sair} disabled={ocupado}><LogOut size={16} aria-hidden="true" />Sair do grupo</button>}
      </div>

      {fotoAberta && (
        <EditorFoto
          titulo="Foto do grupo"
          atual={conversa.foto}
          legenda="Aparece na lista de conversas e no topo do grupo."
          aoFechar={() => setFotoAberta(false)}
          aoSalvar={async (base64) => { await conversaFotoGrupo(conversa.id, base64); await aoMudou(); }}
          aoRemover={async () => { await conversaFotoGrupoRemover(conversa.id); await aoMudou(); }}
        >
          <FotoGrupo foto={conversa.foto} tamanho={160} />
        </EditorFoto>
      )}
    </aside>
  );
}
