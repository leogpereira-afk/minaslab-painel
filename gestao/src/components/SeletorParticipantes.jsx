// Escolha de quem recebe o compromisso na Agenda do painel (contas com login).
import { useEffect, useState } from "react";
import { usuariosPainel } from "../services/agendaPainel.js";
import { nomeCurto } from "../lib/agendaPainel.js";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function SeletorParticipantes({ valor, aoMudar }) {
  const [lista, setLista] = useState(null);
  const [eu, setEu] = useState("");
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    let vivo = true;
    usuariosPainel().then((r) => { if (vivo) { setLista(r.usuarios || []); setEu(r.eu || ""); } }).catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, []);
  const sel = new Set(valor.participantes || []);
  const alternar = (u) => { const s = new Set(sel); s.has(u) ? s.delete(u) : s.add(u); aoMudar({ ...valor, participantes: [...s] }); };
  const outros = (lista || []).filter((u) => u.usuario !== eu);
  const visiveis = outros.filter((u) => !busca || norm(u.nome).includes(norm(busca)) || norm(u.usuario).includes(norm(busca)));
  return (
    <div className="campo">
      <label>Participantes (recebem na Agenda do painel e aviso no sino)</label>
      {erro && <div className="aviso ruim peq">Não consegui carregar as pessoas do painel: {erro}</div>}
      {!lista && !erro && <div className="suave peq">Carregando pessoas…</div>}
      {lista && (
        <div style={{ border: "1px solid var(--linha, #dfe5e8)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label className="peq" style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}>
              <input type="checkbox" checked={!!valor.paraTodos} onChange={(e) => aoMudar({ ...valor, paraTodos: e.target.checked })} /> Toda a equipe
            </label>
            {!valor.paraTodos && <>
              <input className="entrada" style={{ flex: "1 1 160px", maxWidth: 260 }} placeholder="Buscar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <button type="button" className="btn claro mini" onClick={() => aoMudar({ ...valor, participantes: outros.map((u) => u.usuario) })}>Marcar todos</button>
              {sel.size > 0 && <button type="button" className="btn claro mini" onClick={() => aoMudar({ ...valor, participantes: [] })}>Limpar</button>}
            </>}
          </div>
          {!valor.paraTodos && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 4, maxHeight: 190, overflow: "auto" }}>
              {visiveis.map((u) => (
                <label key={u.usuario} className="peq" style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 6px", borderRadius: 8, background: sel.has(u.usuario) ? "var(--marca-claro, #e6f4f1)" : "transparent" }}>
                  <input type="checkbox" checked={sel.has(u.usuario)} onChange={() => alternar(u.usuario)} /> {nomeCurto(u.nome) || u.usuario}
                </label>
              ))}
              {visiveis.length === 0 && <span className="suave peq">Ninguém com esse nome.</span>}
            </div>
          )}
          <div className="suave peq">
            {valor.paraTodos ? "Todos com login no painel vão ver." : sel.size ? `${sel.size} pessoa(s) escolhida(s).` : "Ninguém escolhido: fica só na Gestão."} Só aparece para quem tem login no painel (crie em Acessos).
          </div>
        </div>
      )}
    </div>
  );
}

/** Nomes curtos dos escolhidos (para mostrar no detalhe do compromisso). */
export function NomesParticipantes({ painel }) {
  const [lista, setLista] = useState(null);
  useEffect(() => { let vivo = true; usuariosPainel().then((r) => vivo && setLista(r.usuarios || [])).catch(() => vivo && setLista([])); return () => { vivo = false; }; }, []);
  if (!painel) return null;
  if (painel.paraTodos) return <>Toda a equipe</>;
  const nome = (u) => nomeCurto(lista?.find((x) => x.usuario === u)?.nome) || u;
  return <>{(painel.participantes || []).map(nome).join(", ")}</>;
}
