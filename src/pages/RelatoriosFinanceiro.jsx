import ReguaAnual from "../components/financeiro/ReguaAnual.jsx";
import ComparativoMensal from "../components/financeiro/ComparativoMensal.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from 'react-router-dom';
import { Download, FileText, RefreshCw, ArrowUpRight } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finMovimentosListar, finRecebimentosListar, finDespesasListar } from "../services/financeiro.js";
import { montarRelatorioFinanceiro, periodoValido, variacaoFinanceira, moedaRelatorio as moeda, dataRelatorio as dataBR, notasRelatorio, celulaCsvFinanceiro as csv } from '../lib/relatorioFinanceiro.js';
import '../components/financeiro/relatoriosFinanceiro.css';

const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const inicioAno = () => `${new Date().getFullYear()}-01-01`;
function baixarCsv(nome, cabecalho, linhas) {
  const conteudo = `\uFEFF${cabecalho.map(csv).join(";")}\r\n${linhas.map((l) => l.map(csv).join(";")).join("\r\n")}`;
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function Variacao({ atual, anterior, registros, emAberto }) {
  if (emAberto) return <span>Período em aberto · comparação ao fechar o intervalo</span>;
  const v = variacaoFinanceira(atual, anterior, registros);
  if (!v) return <span>Sem registros na base anterior</span>;
  return <span>{v.valor > 0 ? '+' : ''}{moeda(v.valor)}{v.percentual == null ? ' · percentual sem base' : ` (${v.percentual > 0 ? '+' : ''}${v.percentual.toFixed(1).replace('.', ',')}%)`} frente à janela anterior</span>;
}

export default function RelatoriosFinanceiro() {
  const [op, setOp] = useState({ empresas: [], contas: [] });
  const [empresa, setEmpresa] = useState("");
  const [conta, setConta] = useState("");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [de, setDe] = useState(inicioAno());
  const [ate, setAte] = useState(hoje());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const [gerando, setGerando] = useState('');
  const [erroPdf, setErroPdf] = useState('');
  useEffect(() => {
    let ativo = true;
    setLoading(true); setErro(''); setDados(null);
    Promise.all([financeiroOpcoes(), finMovimentosListar(empresa), finRecebimentosListar(empresa), finDespesasListar(empresa)])
      .then(([o, m, r, d]) => { if (ativo) { setOp(o || { empresas: [], contas: [] }); setDados({ empresa, movimentos: m || [], recebimentos: r || [], despesas: d || [], consultadoEm: new Date() }); } })
      .catch(e => { if (ativo) setErro(e.message || 'Não foi possível carregar os relatórios.'); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [empresa, versao]);
  const empresas = useMemo(() => new Map((op.empresas || []).map(x => [x.id, x.nome])), [op.empresas]);
  const contas = useMemo(() => (op.contas || []).filter(x => !empresa || x.empresa_id === empresa), [op.contas, empresa]);
  const contasMap = useMemo(() => new Map((op.contas || []).map(x => [x.id, x])), [op.contas]);
  const valido = periodoValido(de, ate), disponivel = !loading && !erro && dados?.empresa === empresa;
  const r = useMemo(() => disponivel && valido ? montarRelatorioFinanceiro({ ...dados, empresa, conta, de, ate, hoje: hoje() }) : null, [dados, disponivel, valido, empresa, conta, de, ate]);
  const movimentosFiltrados = r?.bancos || [], recebimentosFiltrados = r?.receber || [], despesasFiltradas = r?.pagar || [];
  const empresaNome = empresa ? empresas.get(empresa) || 'Empresa selecionada' : 'Todas as empresas';
  const contaNome = conta ? contasMap.get(conta)?.nome || 'Conta selecionada' : 'Todas as contas';
  async function exportarPdf(tipo) {
    if (!r || gerando) return;
    setGerando(tipo); setErroPdf('');
    try {
      const { gerarPdfFinanceiro } = await import('../lib/pdfFinanceiro.js');
      const doc = gerarPdfFinanceiro({ relatorio: r, tipo, empresa: empresaNome, conta: contaNome, empresas: op.empresas, contas: op.contas, consultadoEm: dados.consultadoEm });
      doc.save(`minaslab-financeiro-${tipo}-${de}-${ate}.pdf`);
    } catch (e) { setErroPdf(e.message || 'Não foi possível gerar o PDF. Tente novamente.'); }
    finally { setGerando(''); }
  }
  function exportarBancos() {
    const linhas = movimentosFiltrados.map((m) => { const c = contasMap.get(m.conta_bancaria_id) || {}; return [dataBR(m.data_movimento), empresas.get(m.empresa_id) || m.empresa?.nome || "", c.banco || "", c.nome || "", c.agencia || "", c.conta || "", m.tipo, Number(m.valor || 0).toFixed(2).replace(".", ","), m.descricao || "", m.documento || "", m.origem || "", m.conciliado ? "SIM" : "NÃO", m.fitid || m.id_omie || ""]; });
    const sufixo = conta ? (contasMap.get(conta)?.nome || "conta") : "todas-contas";
    baixarCsv(`financeiro-extrato-${sufixo}-${de}-${ate}.csv`, ["Data", "Empresa", "Banco", "Conta", "Agência", "Número da conta", "Tipo", "Valor", "Descrição", "Documento", "Origem", "Conciliado", "Identificador"], linhas);
  }
  function exportarRecebimentos() {
    baixarCsv(`financeiro-recebimentos-${de}-${ate}.csv`, ["Empresa", "Cliente", "CPF/CNPJ", "Descrição", "Valor previsto", "Valor recebido", "Valor pendente", "Vencimento", "Pagamento", "Status", "Categoria", "Conta", "Forma de pagamento", "NF", "Origem", "ID Omie"], recebimentosFiltrados.map((r) => [r.empresa?.nome || empresas.get(r.empresa_id) || "", r.cliente || "", r.cnpj_cpf || "", r.descricao || "", Number(r.valor_previsto || 0).toFixed(2).replace(".", ","), Number(r.valor_recebido || 0).toFixed(2).replace(".", ","), Number(r.valor_pendente || 0).toFixed(2).replace(".", ","), dataBR(r.data_vencimento), dataBR(r.data_pagamento), r.status || "", r.categoria?.nome || r.categoria_texto || "", r.conta_bancaria?.nome || r.conta_bancaria_texto || "", r.forma_pagamento || "", r.numero_nf || "", r.origem || "", r.id_omie || ""]));
  }
  function exportarDespesas() {
    baixarCsv(`financeiro-despesas-${de}-${ate}.csv`, ["Empresa", "Fornecedor", "Documento", "Descrição", "Valor original", "Valor pago", "Valor pendente", "Vencimento", "Pagamento", "Status", "Categoria", "Centro de custo", "Conta", "Forma de pagamento", "Origem", "ID Omie"], despesasFiltradas.map((d) => [d.empresa?.nome || empresas.get(d.empresa_id) || "", d.fornecedor || "", d.documento || "", d.descricao || "", Number(d.valor_original || 0).toFixed(2).replace(".", ","), Number(d.valor_pago || 0).toFixed(2).replace(".", ","), Number(d.valor_pendente || 0).toFixed(2).replace(".", ","), dataBR(d.data_vencimento), dataBR(d.data_pagamento), d.status || "", d.categoria?.nome || d.categoria_texto || "", d.centro?.nome || d.centro_custo || "", d.conta_bancaria?.nome || d.conta_bancaria_texto || "", d.forma_pagamento || "", d.origem || "", d.id_omie || ""]));
  }

  return <div className="fin-relatorios space-y-5">
    <div className="fin-relatorios-titulo">
      <PageTitle titulo="Relatórios Financeiros" descricao="Entenda o período, compare os números e leve a análise para sua reunião."/>
      <button type="button" className="btn-primary" disabled={!r || !!gerando} onClick={() => exportarPdf('executivo')}><FileText size={17}/>{gerando === 'executivo' ? 'Preparando PDF…' : 'Baixar análise em PDF'}</button>
    </div>
    {erro && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{erro} <button className="underline" onClick={() => setVersao(v => v + 1)}>Tentar novamente</button></div>}
    {erroPdf && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{erroPdf}</div>}
    <section className="fin-relatorios-filtros grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4" aria-label="Filtros dos relatórios">
      <label><span className="label">Empresa</span><select className="input" value={empresa} onChange={e => { setEmpresa(e.target.value); setConta(''); }}><option value="">Todas / Consolidado</option>{(op.empresas || []).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <label><span className="label">Banco / conta</span><select className="input" value={conta} onChange={e => setConta(e.target.value)}><option value="">Todas as contas</option>{contas.map(x => <option key={x.id} value={x.id}>{[x.banco, x.nome].filter(Boolean).join(' · ')}</option>)}</select></label>
      <label><span className="label">De</span><input className="input" type="date" min="1900-01-01" max="2200-12-31" value={de} onChange={e => { setDe(e.target.value); const a=Number(e.target.value.slice(0,4)); if(a>=1900&&a<=2200)setAno(a); }}/></label>
      <label><span className="label">Até</span><input className="input" type="date" min="1900-01-01" max="2200-12-31" value={ate} onChange={e => setAte(e.target.value)}/></label>
      <div className="fin-relatorios-contexto md:col-span-4"><span>{disponivel ? `Base consultada em ${dados.consultadoEm.toLocaleString('pt-BR')}` : loading ? 'Consultando a base completa…' : 'Base indisponível'}</span><button type="button" className="btn-outline" disabled={loading} onClick={() => setVersao(v => v + 1)}><RefreshCw size={15}/>{loading ? 'Atualizando…' : 'Atualizar dados'}</button></div>
    </section>
    {!valido && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">Informe as duas datas, com início anterior ou igual ao fim, entre 1900 e 2200.</p>}
    <ReguaAnual ano={ano} setAno={setAno} movimentos={disponivel ? dados.movimentos : []} conta={conta} de={de} ate={ate} onPeriodo={p => { setDe(p.de); setAte(p.ate); }} loading={!disponivel}/>
    {loading && <p role="status" className="rounded-2xl border bg-white p-6 text-slate-600">Preparando indicadores e relatórios…</p>}
    {r && <>
      <section className="fin-relatorios-bloco" aria-label="Resumo bancário">
        <div className="fin-relatorios-subtitulo"><div><h2>O que movimentou no período</h2><p>{dataBR(de)} a {dataBR(ate)} · {empresaNome} · {contaNome}</p></div><span className="fin-relatorios-tag">{r.banco.registros} movimentos</span></div>
        <div className="fin-relatorios-kpis">
          {[['Entradas no banco', 'entradas'], ['Saídas do banco', 'saidas'], ['Movimento líquido', 'liquido']].map(([nome, campo]) => <article key={campo} className={`fin-relatorios-kpi fin-relatorios-${campo}`}><h3>{nome}</h3><strong>{moeda(r.banco[campo])}</strong><small><Variacao atual={r.banco[campo]} anterior={r.bancoAnterior[campo]} registros={r.bancoAnterior.validos} emAberto={r.periodoEmAberto}/></small></article>)}
        </div>
        <p className="fin-relatorios-nota">Comparação com {dataBR(r.anterior.de)} a {dataBR(r.anterior.ate)}, mesma quantidade de dias. Os valores incluem transferências. Movimento líquido não é lucro nem saldo disponível.</p>
      </section>
      <section className="fin-relatorios-bloco" aria-label="Compromissos do período">
        <div className="fin-relatorios-subtitulo"><div><h2>O que ainda precisa de atenção</h2><p>Títulos com vencimento no período. Valores pendentes e vencidos na situação atual da base.</p></div><Link className="fin-relatorios-link" to="/financas/conferencia">Conferir a base <ArrowUpRight size={15}/></Link></div>
        <div className="fin-relatorios-pendencias">
          {[['A receber', r.receberResumo, 'contas-a-receber'], ['A pagar', r.pagarResumo, 'contas-a-pagar']].map(([titulo, resumo, url]) => <article key={titulo}><h3>{titulo}</h3><strong>{moeda(resumo.pendente)}</strong><p>Desse valor, <b>{moeda(resumo.vencido)}</b> está vencido em {dataBR(r.hoje)}.</p><span>{resumo.registros} títulos · {resumo.cancelados} cancelados fora dos totais</span><Link to={`/financas/${url}`} className="fin-relatorios-link">Abrir módulo <ArrowUpRight size={14}/></Link></article>)}
        </div>
        <p className="fin-relatorios-nota">Sem vencimento, usamos a data de lançamento. Este recorte não é a dívida total fora do período nem uma fotografia histórica das pendências.</p>
      </section>
      <div className="fin-relatorios-analises">
        <ComparativoMensal movimentos={movimentosFiltrados}/>
        <section className="fin-relatorios-bloco fin-relatorios-categorias">
          <h2>Onde estão as despesas</h2><p className="fin-relatorios-nota">Valor original dos títulos por vencimento, sem cancelados. Não equivale aos pagamentos do período.</p>
          <strong className="fin-relatorios-total">{moeda(r.pagarResumo.total)}</strong>
          {!r.categorias.length ? <p>Sem despesas nesse recorte.</p> : <>
            {r.categorias.slice(0, 5).map(c => <div className="fin-relatorios-categoria" key={c.nome}><div><b>{c.nome}</b><span>{moeda(c.total)}</span></div><div className="fin-relatorios-barra"><span style={{width: `${Math.max(0, Math.min(100, c.participacao || 0))}%`}}/></div><small>{c.participacao == null ? 'Sem base percentual' : `${c.participacao.toFixed(1).replace('.', ',')}% do total`} · {c.registros} títulos</small></div>)}
            <details className="fin-relatorios-detalhes"><summary>Ver todas as {r.categorias.length} categorias</summary><div className="overflow-auto"><table><caption>Despesas por categoria no período selecionado</caption><thead><tr><th>Categoria</th><th>Original</th><th>Pendente</th></tr></thead><tbody>{r.categorias.map(c => <tr key={c.nome}><td>{c.nome}</td><td>{moeda(c.total)}</td><td>{moeda(c.pendente)}</td></tr>)}</tbody></table></div></details>
          </>}
        </section>
      </div>
      <section className="fin-relatorios-bloco" aria-label="Downloads de relatórios">
        <div className="fin-relatorios-subtitulo"><div><h2>Relatórios para salvar e compartilhar</h2><p>Todos os registros do filtro selecionado. PDF para leitura; planilha para trabalhar nos dados.</p></div></div>
        <div className="fin-relatorios-exports">{[['bancos', 'Extrato bancário', r.bancos.length, exportarBancos], ['receber', 'Contas a receber', r.receber.length, exportarRecebimentos], ['pagar', 'Contas a pagar', r.pagar.length, exportarDespesas]].map(([tipo, titulo, total, exportar]) => <article key={tipo}><h3>{titulo}</h3><p>{total} registros · {tipo === 'bancos' ? 'Data do movimento' : 'Vencimento ou lançamento'}</p><div><button type="button" className="btn-outline" disabled={!!gerando} onClick={() => exportarPdf(tipo)}><FileText size={15}/>{gerando === tipo ? 'Preparando…' : 'PDF'}<span className="sr-only"> de {titulo}</span></button><button type="button" className="btn-outline" onClick={exportar}><Download size={15}/>Planilha<span className="sr-only"> de {titulo}</span></button></div></article>)}</div>
      </section>
      <details className="fin-relatorios-bloco fin-relatorios-detalhes"><summary>Como ler os números e o que conferir {r.banco.naoConciliados > 0 && `· ${r.banco.naoConciliados} movimentos sem conciliação`}</summary><ul className="mt-4 space-y-3 text-sm text-slate-600">{notasRelatorio(r).map(n => <li key={n}>{n}</li>)}</ul><p className="mt-3 text-sm">Os arquivos refletem a base consultada acima. Exportar não altera os registros financeiros.</p></details>
    </>}
  </div>;
}
