// Um evento da equipe aberto: quando, onde, quem participa, quem fica responsável. Quem pode, edita ou cancela.
import { useState } from "react";
import { CalendarClock, MapPin, Pencil, Trash2, UserCheck, Users } from "lucide-react";
import { Modal } from "../ui.jsx";
import Avatar from "../tarefas/Avatar.jsx";
import { ehAusencia, periodoTexto, tipoDaAgenda } from "../../lib/agendaEquipe.js";
import { agendaCancelar } from "../../services/agenda.js";

function Pessoas({ usuarios, nomes }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {usuarios.map((u) => (
        <li key={u} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2.5 text-sm text-slate-700"><Avatar usuario={u} nome={nomes[u]} tamanho={24} />{nomes[u] || u}</li>
      ))}
    </ul>
  );
}

export default function DetalheEventoEquipe({ evento: e, nomes, aoFechar, aoEditar, aoMudou }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const aus = ehAusencia(e.tipo);
  const cancelar = async () => {
    if (ocupado || !window.confirm(`Cancelar "${e.titulo}"? Quem participa recebe um aviso.`)) return;
    setOcupado(true); setErro("");
    try { await agendaCancelar(e.id); aoMudou("Evento cancelado."); } catch (ex) { setErro(ex.message); setOcupado(false); }
  };
  return (
    <Modal titulo={tipoDaAgenda(e.tipo).rotulo} aberto aoFechar={aoFechar} largura="max-w-lg">
      <div className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-slate-900 [overflow-wrap:anywhere]">{e.titulo}</h3>
        <p className="flex items-start gap-2 text-sm text-slate-700"><CalendarClock size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />{periodoTexto(e)}</p>
        {e.local && <p className="flex items-start gap-2 text-sm text-slate-700"><MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /><span className="[overflow-wrap:anywhere]">{e.local}</span></p>}
        {aus ? (
          <>
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{e.tipo === "ferias" ? "De férias" : "Ausente"}</p><Pessoas usuarios={e.ausentes} nomes={nomes} /></div>
            <div><p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><UserCheck size={13} aria-hidden="true" />Responsável no período</p><Pessoas usuarios={e.responsaveis} nomes={nomes} /></div>
          </>
        ) : (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Users size={13} aria-hidden="true" />Quem participa</p>
            {e.paraTodos ? <p className="text-sm text-slate-700">Todos da equipe</p> : <Pessoas usuarios={[e.criador, ...e.participantes.filter((u) => u !== e.criador)]} nomes={nomes} />}
          </div>
        )}
        {e.descricao && <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700 [overflow-wrap:anywhere]">{e.descricao}</p>}
        <p className="text-xs text-slate-500">Marcado por {nomes[e.criador] || e.criador}</p>
        {erro && <p role="alert" className="rounded-xl bg-bad-50 p-3 text-sm text-bad-800">{erro}</p>}
        {e.pode.editar && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline" onClick={() => aoEditar(e)} disabled={ocupado}><Pencil size={14} />Editar</button>
            <button type="button" className="btn-outline text-bad-700" onClick={cancelar} disabled={ocupado}><Trash2 size={14} />Cancelar evento</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
