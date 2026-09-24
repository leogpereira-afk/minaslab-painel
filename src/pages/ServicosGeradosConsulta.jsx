import { useEffect, useMemo, useState } from "react";
import { servicosGeradosListar } from "../services/servicosGerados.js";

const moeda = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function ServicosGeradosConsulta() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  useEffect(() => {
    let ativo = true;
    servicosGeradosListar().then(r => { if (ativo) setDados(r.itens || []); }).catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, []);
  const itens = useMemo(() => (dados || []).filter(s =>
    [s.os_numero, s.cliente, s.numero_nf, s.cnpj_cpf, ...(s.grupo_itens || []).map(x => x.os_numero)]
      .some(v => String(v || "").toLowerCase().includes(busca.toLowerCase()))), [dados, busca]);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / 50));
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h1 className="text-xl font-bold text-blue-900">Serviços Gerados</h1>
    <p className="mt-1 text-sm text-slate-600">Consulta de OS, faturamento e pagamentos.</p>
    <label className="mt-5 block max-w-lg text-sm font-semibold text-slate-700">Buscar OS, cliente, NF ou CNPJ
      <input className="input mt-1 w-full" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} />
    </label>
    {erro && <p role="alert" className="mt-4 text-red-700">{erro}</p>}
    {!dados && !erro && <p className="mt-4">Carregando serviços…</p>}
    {dados && <><p className="my-3 text-sm text-slate-600">{itens.length} resultado(s)</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b bg-slate-50 text-slate-600"><tr><th className="p-3">OS</th><th>Cliente</th><th>NF</th><th>Faturamento</th><th>Pagamento</th><th>Vencimento</th><th className="text-right">Valor</th></tr></thead>
      <tbody>{itens.slice((pagina - 1) * 50, pagina * 50).map(s => <tr className="border-b align-top" key={s.id}><td className="p-3">{s.os_numero}{s.grupo_itens?.length > 1 && <span className="block text-xs text-slate-500">{s.grupo_itens.map(x => x.os_numero).join(", ")}</span>}</td><td>{s.cliente}</td><td>{s.numero_nf || "—"}</td><td>{s.status_faturamento || "—"}</td><td>{s.status_pagamento || "—"}</td><td>{s.data_vencimento ? new Date(`${s.data_vencimento}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td><td className="text-right">{moeda(s.valor_faturar)}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex items-center justify-end gap-3 text-sm"><button type="button" className="btn-outline" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>{pagina} / {totalPaginas}</span><button type="button" className="btn-outline" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}>Próxima</button></div>
    </>}
  </section>;
}
