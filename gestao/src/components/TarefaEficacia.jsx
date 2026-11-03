// Tarefa no painel para a avaliação da eficácia (30 dias depois do treinamento):
// quem recebe vê em Tarefas do painel, é avisado no sino e lembrado 1 dia antes.
import { useEffect, useState } from "react";
import { usuariosTarefas, criarTarefa, concluirTarefa } from "../services/tarefasPainel.js";
import { tarefaEficacia, todosAvaliados } from "../lib/formulariosTreinamento.js";

/** Contas do painel para escolher o responsável (e quem sou eu). */
export function useUsuariosTarefas() {
  const [st, setSt] = useState({ usuarios: [], eu: "", erro: "" });
  useEffect(() => {
    let vivo = true;
    usuariosTarefas().then((r) => vivo && setSt({ usuarios: r.usuarios || [], eu: r.eu || "", erro: "" })).catch((e) => vivo && setSt((x) => ({ ...x, erro: e.message })));
    return () => { vivo = false; };
  }, []);
  return st;
}

/** Caixa "criar tarefa" + responsável. */
export function OpcaoTarefa({ ativo, aoAtivar, responsavel, aoResponsavel, usuarios, erro }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <label className="peq" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={ativo} onChange={(e) => aoAtivar(e.target.checked)} /> Criar tarefa no painel para a avaliação da eficácia, para
      </label>
      <select className="entrada" style={{ maxWidth: 240, minHeight: 34 }} value={responsavel} disabled={!ativo || !usuarios.length} onChange={(e) => aoResponsavel(e.target.value)} aria-label="Responsável pela avaliação da eficácia">
        {!usuarios.length && <option value="">(eu)</option>}
        {usuarios.map((u) => <option key={u.usuario} value={u.usuario}>{u.nome}</option>)}
      </select>
      {erro && <span className="peq" style={{ color: "var(--alerta-tx)" }}>Não consegui ler as contas do painel: a tarefa vai para você.</span>}
    </div>
  );
}

const linkGestao = () => `${window.location.origin}${window.location.pathname}#/treinamentos`;

/** Cria a tarefa e grava o vínculo na aplicação. Devolve a aplicação atualizada. */
export async function criarTarefaDaAplicacao(reg, responsavel, gravar) {
  const r = await criarTarefa(tarefaEficacia(reg, { responsavel, link: linkGestao() }));
  return gravar("treinamentos", { ...reg, tarefaEficacia: { id: r.id, responsavel: responsavel || "" } });
}

/** Conclui a tarefa quando todos os participantes já foram avaliados (falha não atrapalha). */
export async function concluirSeTodosAvaliados(reg) {
  if (!reg?.tarefaEficacia?.id || !todosAvaliados(reg)) return false;
  try { await concluirTarefa(reg.tarefaEficacia.id); return true; } catch { return false; }
}
