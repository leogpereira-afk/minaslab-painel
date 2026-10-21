// Participantes do grupo: ver, adicionar/retirar (administrador), mudar o nome (administrador) e sair.
import { useState } from "react";
import { Crown, LogOut, Pencil, UserMinus } from "lucide-react";
import { Modal } from "../ui.jsx";
import Avatar from "../tarefas/Avatar.jsx";
import SeletorPessoas from "../tarefas/SeletorPessoas.jsx";
import { conversaMembros, conversaRenomear, conversaSair } from "../../services/mensagens.js";

export default function ParticipantesGrupo({ dados, usuarios, eu, aoFechar, aoMudou, aoSair }) {
  const { conversa, membros, nomes, pode } = dados;
  const nomeDe = (u) => nomes[u] || usuarios.find((x) => x.usuario === u)?.nome || u;
  const [nome, setNome] = useState(conversa.nome || conversa.titulo);
  const [novos, setNovos] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const rodar = async (fn, depois) => {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try { await fn(); await aoMudou(); depois?.(); } catch (ex) { setErro(ex.message); } finally { setOcupado(false); }
  };
  const salvarNome = (e) => { e.preventDefault(); if (nome.trim() && nome.trim() !== conversa.nome) void rodar(() => conversaRenomear(conversa.id, nome)); };
  const adicionar = () => { if (novos.length) void rodar(() => conversaMembros(conversa.id, novos, []), () => setNovos([])); };
  const retirar = (u) => { if (window.confirm(`Retirar ${nomeDe(u)} do grupo?`)) void rodar(() => conversaMembros(conversa.id, [], [u])); };
  const sair = async () => {
    if (!window.confirm("Sair deste grupo? Você deixa de receber as mensagens.")) return;
    setOcupado(true); setErro("");
    try { await conversaSair(conversa.id); aoSair(); } catch (ex) { setErro(ex.message); setOcupado(false); }
  };

  return (
    <Modal titulo="Participantes" aberto aoFechar={aoFechar} largura="max-w-md">
      <div className="space-y-4">
        {pode.gerir ? (
          <form onSubmit={salvarNome} className="flex items-end gap-2">
            <label className="min-w-0 flex-1"><span className="mb-1 block text-sm font-medium text-slate-700">Nome do grupo</span><input className="input" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} /></label>
            <button type="submit" className="btn-outline h-11 shrink-0" disabled={ocupado || !nome.trim() || nome.trim() === conversa.nome}><Pencil size={14} />Salvar</button>
          </form>
        ) : <p className="font-display text-base font-semibold text-slate-900">{conversa.titulo}</p>}

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

        {pode.gerir && (
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">Adicionar pessoas</span>
            <SeletorPessoas usuarios={usuarios} valor={novos} onChange={setNovos} ocultar={membros.map((m) => m.usuario)} vazio="Escolha quem entra" />
            {novos.length > 0 && <button type="button" className="btn-primary" onClick={adicionar} disabled={ocupado}>Adicionar ao grupo</button>}
          </div>
        )}
        {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {pode.sair && <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline" onClick={sair} disabled={ocupado}><LogOut size={15} aria-hidden="true" />Sair do grupo</button>}
      </div>
    </Modal>
  );
}
