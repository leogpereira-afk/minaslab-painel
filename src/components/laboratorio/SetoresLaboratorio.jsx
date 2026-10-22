// Direção define quem é do Administrativo e quem é do Laboratório. É isso que
// libera (ou bloqueia) a edição de cada coluna nas Entradas de amostras — o
// servidor confere a cada gravação. Uma pessoa pode estar nos dois.

import { useEffect, useState } from "react";
import { Modal } from "../ui.jsx";
import { setoresLer, setoresSalvar } from "../../services/laboratorio.js";

export default function SetoresLaboratorio({ aberto, aoFechar, aoSalvo }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [adm, setAdm] = useState([]);
  const [lab, setLab] = useState([]);

  useEffect(() => {
    if (!aberto) return;
    setErro(""); setDados(null);
    setoresLer().then((r) => { setDados(r); setAdm(r.administrativo || []); setLab(r.laboratorio || []); }).catch((e) => setErro(e.message));
  }, [aberto]);

  const alternar = (lista, set, u) => set(lista.includes(u) ? lista.filter((x) => x !== u) : [...lista, u]);
  async function salvar() {
    setSalvando(true); setErro("");
    try { await setoresSalvar(adm, lab); aoSalvo?.(); aoFechar(); }
    catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  }
  // Todos os usuários ativos (a direção também aparece: marcá-la só registra o setor; ela já edita tudo).
  const contas = dados?.contas || [];

  return (
    <Modal titulo="Setores do laboratório" aberto={aberto} aoFechar={aoFechar} largura="max-w-2xl">
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">
          <b className="text-sky-800">Administrativo</b> lança OS, nº das amostras, recebimento, quem recebeu, tipo, imediato, interno/provedor, quem retirou e cancelamento.{" "}
          <b className="text-teal-800">Laboratório</b> lança retiradas, finalizações MB/FQ, liberação e descarte. Observação: os dois.
          A direção edita tudo. Quem não estiver marcado só consulta.
        </p>
        {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{erro}</div>}
        {!dados && !erro && <p className="text-slate-500">Carregando contas…</p>}
        {dados && (
          <div className="max-h-[55vh] overflow-auto rounded-xl border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase text-slate-500">
                <tr><th className="px-3 py-2">Pessoa</th><th className="px-3 py-2 text-center text-sky-800">Administrativo</th><th className="px-3 py-2 text-center text-teal-800">Laboratório</th></tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.usuario} className="border-t">
                    <td className="px-3 py-2"><b>{c.nome}</b> <span className="text-slate-400">({c.usuario})</span>{c.papel === "direcao" && <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">direção</span>}</td>
                    <td className="px-3 py-2 text-center"><input type="checkbox" className="h-4 w-4 accent-sky-600" checked={adm.includes(c.usuario)} onChange={() => alternar(adm, setAdm, c.usuario)} aria-label={`${c.nome} no Administrativo`} /></td>
                    <td className="px-3 py-2 text-center"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={lab.includes(c.usuario)} onChange={() => alternar(lab, setLab, c.usuario)} aria-label={`${c.nome} no Laboratório`} /></td>
                  </tr>
                ))}
                {!contas.length && <tr><td colSpan="3" className="p-4 text-center text-slate-500">Nenhum usuário ativo.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t pt-3">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!dados || salvando} onClick={salvar}>{salvando ? "Gravando…" : "Gravar setores"}</button>
        </div>
      </div>
    </Modal>
  );
}
