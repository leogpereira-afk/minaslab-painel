import { useCallback, useEffect, useState } from "react";
import { Clock3, Plus } from "lucide-react";
import { rhBancoListar, rhBancoRegistrar } from "../../services/dados.js";
import { formatarBanco } from "../../lib/rh/bancoHoras.js";
import { Card, Empty } from "../ui.jsx";

const TIPOS = ["Horas pagas", "Horas compensadas", "Crédito manual", "Débito manual", "Correção/Ajuste", "Outro"];
const hoje = () => new Date().toISOString().slice(0, 10);
const competenciaAtual = () => hoje().slice(0, 7);

export default function BancoHorasFuncionario({ pessoa, editavel }) {
  const [dados, setDados] = useState({ movimentos: [], saldoMinutos: null });
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ tipo: "Horas pagas", competencia: competenciaAtual(), dataMovimento: hoje(), horas: "", motivo: "", observacao: "" });
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!pessoa?.id) return;
    try { setDados(await rhBancoListar({ pessoaId: pessoa.id })); } catch (e) { setErro(e.message); }
  }, [pessoa?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e) {
    e.preventDefault();
    const partes = String(form.horas || "").split(":").map(Number);
    const minutos = partes.length === 2 && partes.every(Number.isFinite) ? partes[0] * 60 + partes[1] : Number(form.horas) * 60;
    if (!Number.isFinite(minutos) || minutos <= 0 || !form.motivo.trim()) return setErro("Informe horas válidas e o motivo obrigatório.");
    const debito = ["Horas pagas", "Horas compensadas", "Débito manual"].includes(form.tipo);
    try {
      await rhBancoRegistrar({
        pessoaId: pessoa.id, empresa: pessoa.empresa || "", competencia: form.competencia, dataMovimento: form.dataMovimento,
        tipo: form.tipo, creditoMinutos: debito ? 0 : minutos, debitoMinutos: debito ? minutos : 0,
        motivo: form.motivo, observacao: form.observacao, origem: "MANUAL",
      });
      setForm({ ...form, horas: "", motivo: "", observacao: "" }); setAberto(false); setErro(""); await carregar();
    } catch (e) { setErro(e.message); }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-display text-base font-semibold text-slate-900">Banco de horas</h2><p className="text-xs text-slate-500">Saldo auditável acumulado entre competências.</p></div>
        <div className="flex items-center gap-2"><span className={`chip ${(dados.saldoMinutos || 0) < 0 ? "chip-bad" : "chip-ok"}`}><Clock3 size={14} /> {formatarBanco(dados.saldoMinutos || 0)}</span>{editavel && <button type="button" className="btn-outline py-1 text-xs" onClick={() => setAberto(!aberto)}><Plus size={14}/> Registrar movimentação</button>}</div>
      </div>
      {erro && <p className="mb-3 rounded-lg bg-bad-50 p-2 text-xs text-bad-700">{erro}</p>}
      {aberto && editavel && <form className="mb-4 grid gap-3 rounded-xl border p-3 md:grid-cols-6" onSubmit={salvar}>
        <select className="select md:col-span-2" value={form.tipo} onChange={e => setForm({...form,tipo:e.target.value})}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select>
        <input className="input" type="month" value={form.competencia} onChange={e=>setForm({...form,competencia:e.target.value})} required />
        <input className="input" type="date" value={form.dataMovimento} onChange={e=>setForm({...form,dataMovimento:e.target.value})} required />
        <input className="input" placeholder="Horas (ex.: 10:00)" value={form.horas} onChange={e=>setForm({...form,horas:e.target.value})} required />
        <input className="input md:col-span-5" placeholder="Motivo obrigatório" value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})} required />
        <input className="input md:col-span-5" placeholder="Observação opcional" value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})} />
        <button className="btn-primary" type="submit">Confirmar</button>
      </form>}
      {dados.movimentos.length === 0 ? <Empty>Nenhuma movimentação registrada.</Empty> : <ul className="divide-y" style={{borderColor:"var(--fio-lista)"}}>{dados.movimentos.map(m=><li key={m.id} className="flex flex-wrap items-center gap-3 py-2 text-sm"><span className="tnum w-24">{m.data_movimento}</span><span className="chip">{m.tipo}</span><span className="flex-1 text-slate-700">{m.motivo}</span><strong className={m.debito_minutos ? "text-bad-700" : "text-ok-700"}>{formatarBanco((m.credito_minutos||0)-(m.debito_minutos||0))}</strong></li>)}</ul>}
    </Card>
  );
}
