import { useMemo, useState } from "react";
import { Printer, Save } from "lucide-react";
import { rhFolhaSalvar } from "../../services/dados.js";
import { formatarBanco } from "../../lib/rh/bancoHoras.js";
import { Card, Empty } from "../ui.jsx";

const nomesMes = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const rotulo = c => { const [a,m] = String(c).split("-"); return nomesMes[Number(m)-1] ? `${nomesMes[Number(m)-1]} de ${a}` : c; };
const dataBR = s => { const p=String(s||"").split("-"); return p.length===3 ? `${p[2]}/${p[1]}` : "—"; };
const hora = (...vs) => vs.find(v => v != null && String(v).trim()) || "—";

export default function FolhaMensal({ pessoas = [], pontoDia = [], competencia, editavel }) {
  const [pessoaId, setPessoaId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const pessoa = pessoas.find(p => p.id === pessoaId);
  const linhas = useMemo(() => pontoDia.filter(d => d.pessoaId === pessoaId && String(d.data || "").startsWith(competencia)).sort((a,b)=>String(a.data).localeCompare(String(b.data))), [pontoDia,pessoaId,competencia]);
  const total = linhas.reduce((n,d)=>n + Number(d.trabalhadoMin ?? d.trackedMin ?? 0), 0);

  async function fechar() {
    if (!pessoa) return setMensagem("Selecione um funcionário.");
    try {
      const folha = await rhFolhaSalvar({
        pessoaId: pessoa.id, empresa: pessoa.empresa || "", competencia,
        status: "FECHADA",
        dadosSnapshot: { pessoa, competencia, linhas, totalMinutos: total, geradoEm: new Date().toISOString() },
      });
      setMensagem(`Folha de ${rotulo(competencia)} fechada e preservada.`);
      return folha;
    } catch (e) { setMensagem(e.message); }
  }

  return <Card>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="font-display text-base font-semibold text-slate-900">Folha de Ponto Mensal</h2><p className="text-xs text-slate-500">Dados reais de ml-ponto/rh_ponto_dia · {rotulo(competencia)}</p></div>
      <div className="flex flex-wrap gap-2">
        <select className="select" value={pessoaId} onChange={e=>setPessoaId(e.target.value)}>
          <option value="">Selecione o funcionário</option>
          {pessoas.filter(p=>p.ativo!==false).sort((a,b)=>String(a.nome).localeCompare(String(b.nome))).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <button type="button" className="btn-outline" onClick={()=>window.print()}><Printer size={15}/> Imprimir / PDF</button>
        {editavel && <button type="button" className="btn-primary" onClick={fechar}><Save size={15}/> Fechar competência</button>}
      </div>
    </div>
    {mensagem && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{mensagem}</p>}
    {!pessoa ? <Empty>Selecione um funcionário para visualizar a folha.</Empty> : <>
      <div className="mb-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-4">
        <span><strong>Funcionário:</strong> {pessoa.nome}</span><span><strong>Matrícula:</strong> {pessoa.matricula || "—"}</span><span><strong>Empresa:</strong> {pessoa.empresa || "Não informada"}</span><span><strong>Saldo apurado:</strong> {formatarBanco(total)}</span>
      </div>
      {linhas.length===0 ? <Empty>Nenhuma marcação encontrada nesta competência.</Empty> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Data</th><th className="p-2">Entrada</th><th className="p-2">Início almoço</th><th className="p-2">Fim almoço</th><th className="p-2">Saída</th><th className="p-2">Horas</th><th className="p-2">Ocorrência</th></tr></thead><tbody>{linhas.map(d=><tr key={d.id||d.data} className="border-b"><td className="p-2">{dataBR(d.data)}</td><td className="p-2">{hora(d.entrada,d.primeiraEntrada)}</td><td className="p-2">{hora(d.inicioAlmoco,d.inicioIntervalo)}</td><td className="p-2">{hora(d.fimAlmoco,d.fimIntervalo)}</td><td className="p-2">{hora(d.saida,d.ultimaSaida)}</td><td className="p-2">{formatarBanco(Number(d.trabalhadoMin ?? d.trackedMin ?? 0))}</td><td className="p-2">{d.ausencia?.tipo || d.ocorrencia || "—"}</td></tr>)}</tbody></table></div>}
      <div className="mt-5 hidden border-t pt-8 text-center text-sm print:block">ASSINATURA DO COLABORADOR: ________________________________________________</div>
    </>}
  </Card>;
}
