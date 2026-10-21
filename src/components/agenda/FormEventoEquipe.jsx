// Marcar ou editar um evento da equipe: treinamento, reunião, evento, férias ou ausência (esta com responsável).
import { useMemo, useState } from "react";
import { Modal, Segmented } from "../ui.jsx";
import SeletorPessoas from "../tarefas/SeletorPessoas.jsx";
import { TIPOS_AGENDA, conferirForm, ehAusencia, formDoEvento, formVazio, tipoDaAgenda } from "../../lib/agendaEquipe.js";
import { agendaAtualizar, agendaCriar } from "../../services/agenda.js";

export default function FormEventoEquipe({ dia, usuarios, eu, direcao, evento, tipoInicial = "treinamento", aoFechar, aoSalvo }) {
  const editando = !!evento;
  const [f, setF] = useState(() => (evento ? formDoEvento(evento) : formVazio(tipoInicial, dia, eu)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const aus = ehAusencia(f.tipo);
  const problema = useMemo(() => conferirForm(f), [f]);
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));
  const mudarTipo = (tipo) => setF((x) => ({ ...formVazio(tipo, x.diaInicio, eu), diaInicio: x.diaInicio, diaFim: x.diaFim < x.diaInicio ? x.diaInicio : x.diaFim, titulo: x.titulo, descricao: x.descricao }));
  const nomeDe = (u) => usuarios.find((p) => p.usuario === u)?.nome || u;

  const salvar = async (e) => {
    e.preventDefault();
    if (salvando || problema) return;
    setSalvando(true); setErro("");
    try {
      if (editando) await agendaAtualizar(evento.id, f); else await agendaCriar(f);
      aoSalvo(editando ? "Evento atualizado." : "Evento marcado.");
    } catch (ex) { setErro(ex.message); setSalvando(false); }
  };

  return (
    <Modal titulo={editando ? `Editar ${tipoDaAgenda(f.tipo).rotulo.toLowerCase()}` : "Marcar na agenda da equipe"} aberto aoFechar={aoFechar} largura="max-w-xl">
      <form onSubmit={salvar} className="space-y-4" aria-busy={salvando}>
        {!editando && (
          <div role="group" aria-label="Tipo">
            <span className="label">O que marcar</span>
            <Segmented opcoes={TIPOS_AGENDA.map((t) => ({ valor: t.id, rotulo: t.rotulo }))} valor={f.tipo} onChange={mudarTipo} />
          </div>
        )}

        {aus ? (
          <>
            <div>
              <span className="label">{f.tipo === "ferias" ? "Quem vai de férias" : "Quem vai ficar ausente"}</span>
              {direcao
                ? <SeletorPessoas usuarios={usuarios} valor={f.ausentes} onChange={(v) => setF((x) => ({ ...x, ausentes: v, responsaveis: x.responsaveis.filter((u) => !v.includes(u)) }))} vazio="Escolha a pessoa" />
                : <p className="text-sm text-slate-700">{nomeDe(eu)} <span className="text-slate-400">(você)</span></p>}
            </div>
            <div>
              <span className="label">Responsável durante a ausência</span>
              <SeletorPessoas usuarios={usuarios} valor={f.responsaveis} onChange={(v) => setF((x) => ({ ...x, responsaveis: v }))} ocultar={f.ausentes} vazio="Quem responde no lugar" />
              <p className="mt-1 text-xs text-slate-500">Essa pessoa recebe um aviso e aparece junto com a ausência no calendário.</p>
            </div>
            <div>
              <label className="label" htmlFor="ag-titulo">Observação (opcional)</label>
              <input id="ag-titulo" className="input" value={f.titulo} maxLength={120} onChange={set("titulo")} placeholder={f.tipo === "ferias" ? "Ex.: férias de 15 dias" : "Ex.: consulta médica"} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="ag-titulo">Nome</label>
              <input id="ag-titulo" className="input" value={f.titulo} maxLength={120} onChange={set("titulo")} autoFocus placeholder={f.tipo === "treinamento" ? "Ex.: Treinamento de biossegurança" : "Ex.: Reunião de resultados"} />
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:min-w-0">
          <div><label className="label" htmlFor="ag-ini">{aus ? "Primeiro dia" : "Dia"}</label><input id="ag-ini" type="date" className="input" value={f.diaInicio} onChange={(e) => setF((x) => ({ ...x, diaInicio: e.target.value, diaFim: !x.diaFim || x.diaFim < e.target.value ? e.target.value : x.diaFim }))} required /></div>
          <div><label className="label" htmlFor="ag-fim">{aus ? "Último dia" : "Até o dia (se durar mais de um)"}</label><input id="ag-fim" type="date" className="input" value={f.diaFim} min={f.diaInicio} onChange={set("diaFim")} required /></div>
          {!aus && <>
            <div><label className="label" htmlFor="ag-hi">Hora de início</label><input id="ag-hi" type="time" className="input" value={f.horaInicio} onChange={set("horaInicio")} /></div>
            <div><label className="label" htmlFor="ag-hf">Hora final</label><input id="ag-hf" type="time" className="input" value={f.horaFim} onChange={set("horaFim")} /></div>
          </>}
        </div>
        {!aus && <p className="-mt-2 text-xs text-slate-500">Sem hora, o evento vale o dia inteiro.</p>}

        {!aus && (
          <>
            <div><label className="label" htmlFor="ag-local">Local</label><input id="ag-local" className="input" value={f.local} maxLength={120} onChange={set("local")} placeholder="Sala, endereço ou link" /></div>
            <div>
              <span className="label">Quem participa</span>
              <Segmented opcoes={[{ valor: "todos", rotulo: "Todos da equipe" }, { valor: "pessoas", rotulo: "Escolher pessoas" }]} valor={f.paraTodos ? "todos" : "pessoas"} onChange={(v) => setF((x) => ({ ...x, paraTodos: v === "todos" }))} />
              {!f.paraTodos && <div className="mt-2"><SeletorPessoas usuarios={usuarios} valor={f.participantes} onChange={(v) => setF((x) => ({ ...x, participantes: v }))} ocultar={[eu]} vazio="Só você, por enquanto" /></div>}
              <p className="mt-1 text-xs text-slate-500">{f.paraTodos ? "Aparece no calendário de todos e cada um recebe um aviso." : "Só quem você escolher vê e recebe o aviso."}</p>
            </div>
          </>
        )}

        <div><label className="label" htmlFor="ag-desc">Descrição (opcional)</label><textarea id="ag-desc" className="input" rows={2} maxLength={1000} value={f.descricao} onChange={set("descricao")} /></div>

        {(erro || (problema && f.titulo !== "")) && <p role="alert" className="rounded-xl bg-bad-50 p-3 text-sm text-bad-800 break-words">{erro || problema}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !!problema}>{salvando ? "Salvando..." : editando ? "Salvar alterações" : "Marcar"}</button>
        </div>
      </form>
    </Modal>
  );
}
