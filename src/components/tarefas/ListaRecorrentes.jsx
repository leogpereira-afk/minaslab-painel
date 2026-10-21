// Repetições de tarefas: ver, pausar/retomar e apagar. As tarefas já criadas ficam; só param de nascer novas.
import { useCallback, useEffect, useState } from "react";
import { Pause, Play, Repeat, Trash2 } from "lucide-react";
import { Modal } from "../ui.jsx";
import { resumoRecorrencia, rotuloPrazo } from "../../lib/tarefas.js";
import { tarefaRecorrenciaAtivar, tarefaRecorrenciaExcluir, tarefaRecorrencias } from "../../services/tarefas.js";

export default function ListaRecorrentes({ aoFechar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupada, setOcupada] = useState("");

  const carregar = useCallback(async () => {
    try { setDados(await tarefaRecorrencias()); setErro(""); } catch (ex) { setErro(ex.message); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const agir = async (id, fazer) => {
    setOcupada(id);
    try { await fazer(); await carregar(); } catch (ex) { setErro(ex.message); } finally { setOcupada(""); }
  };
  const apagar = (r) => {
    if (!window.confirm(`Apagar a repetição "${r.titulo}"? As tarefas já criadas continuam; só param de nascer novas.`)) return;
    void agir(r.id, () => tarefaRecorrenciaExcluir(r.id));
  };
  const nomes = dados?.nomes || {};

  return (
    <Modal titulo="Repetições" aberto aoFechar={aoFechar} largura="max-w-2xl">
      <div className="space-y-3">
        {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {!dados && !erro && <p className="py-6 text-center text-sm text-slate-500">Carregando...</p>}
        {dados && !dados.regras.length && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Nenhuma tarefa se repete ainda. Ao criar uma tarefa, escolha em <b>Repetir</b> como ela volta.</p>
        )}
        <ul className="space-y-2">
          {(dados?.regras || []).map((r) => (
            <li key={r.id} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
              <Repeat size={16} className={r.ativa ? "mt-0.5 text-brand-700" : "mt-0.5 text-slate-400"} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold [overflow-wrap:anywhere]">{r.titulo}</p>
                <p className="text-sm text-slate-600">{resumoRecorrencia(r)} · para {nomes[r.responsavel] || r.responsavel}</p>
                <p className="text-xs text-slate-500">{r.ativa ? (r.proximaEm ? `Próxima: ${rotuloPrazo(r.proximaEm)}` : "Sem próxima data") : "Pausada"}</p>
              </div>
              {r.pode && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="btn-ghost h-9 w-9 p-0" disabled={ocupada === r.id} aria-label={r.ativa ? `Pausar ${r.titulo}` : `Retomar ${r.titulo}`} title={r.ativa ? "Pausar" : "Retomar"} onClick={() => agir(r.id, () => tarefaRecorrenciaAtivar(r.id, !r.ativa))}>{r.ativa ? <Pause size={16} /> : <Play size={16} />}</button>
                  <button type="button" className="btn-ghost h-9 w-9 p-0 text-red-600" disabled={ocupada === r.id} aria-label={`Apagar ${r.titulo}`} title="Apagar" onClick={() => apagar(r)}><Trash2 size={16} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
