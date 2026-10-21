// Começar conversa: com uma pessoa (individual) ou criar um grupo com nome e participantes.
import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "../ui.jsx";
import Avatar from "../tarefas/Avatar.jsx";
import SeletorPessoas from "../tarefas/SeletorPessoas.jsx";
import { conversaAbrirDireta, conversaCriarGrupo } from "../../services/mensagens.js";

const normalizar = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function NovaConversa({ usuarios, eu, inicial = "pessoa", aoFechar, aoAbrir }) {
  const [aba, setAba] = useState(inicial);
  const [busca, setBusca] = useState("");
  const [nome, setNome] = useState("");
  const [membros, setMembros] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const outros = useMemo(() => usuarios.filter((u) => u.usuario !== eu), [usuarios, eu]);
  const lista = useMemo(() => { const q = normalizar(busca); return outros.filter((u) => !q || normalizar(u.nome).includes(q)); }, [outros, busca]);

  const comPessoa = async (u) => {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try { const r = await conversaAbrirDireta(u); aoAbrir(r.id); } catch (ex) { setErro(ex.message); setOcupado(false); }
  };
  const criarGrupo = async (e) => {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true); setErro("");
    try { const r = await conversaCriarGrupo(nome, membros); aoAbrir(r.id); } catch (ex) { setErro(ex.message); setOcupado(false); }
  };

  return (
    <Modal titulo="Nova conversa" aberto aoFechar={aoFechar} largura="max-w-md">
      <div className="mb-3 inline-flex rounded-xl border bg-white p-1" style={{ borderColor: "var(--hairline)" }} role="group" aria-label="Tipo de conversa">
        {[["pessoa", "Uma pessoa"], ["grupo", "Grupo"]].map(([id, rotulo]) => (
          <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)} className={clsx("rounded-lg px-4 py-1.5 font-display text-sm font-medium", aba === id ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100")}>{rotulo}</button>
        ))}
      </div>
      {aba === "pessoa" ? (
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input autoFocus className="input h-10 min-h-0 pl-9 text-sm" placeholder="Pesquisar pessoa" aria-label="Pesquisar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <ul className="max-h-72 overflow-auto">
            {lista.length === 0 && <li className="px-2 py-4 text-center text-sm text-slate-500">Ninguém encontrado.</li>}
            {lista.map((u) => (
              <li key={u.usuario}>
                <button type="button" disabled={ocupado} onClick={() => comPessoa(u.usuario)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-60">
                  <Avatar usuario={u.usuario} nome={u.nome} tamanho={34} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{u.nome}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <form onSubmit={criarGrupo} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nome do grupo</span>
            <input autoFocus className="input" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: RH e Departamento Pessoal" />
          </label>
          <div>
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Users size={15} aria-hidden="true" />Participantes</span>
            <SeletorPessoas usuarios={outros} valor={membros} onChange={setMembros} vazio="Escolha quem entra no grupo" />
          </div>
          {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={ocupado || !nome.trim() || membros.length === 0}>{ocupado ? "Criando..." : "Criar grupo"}</button>
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          </div>
        </form>
      )}
      {aba === "pessoa" && erro && <div role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    </Modal>
  );
}
