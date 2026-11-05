// Aba "Folha de Pagamento" do RH: a conferência do mês, no lugar da planilha
// Funcionarios.xlsx. As contas moram em lib/rh/folhaPagamento.js (com teste); a
// leitura dos relatórios da contabilidade em lib/rh/folhaContabil.js.
// Só a direção vê (as coleções rh_* são da direção no servidor).
//
// A TABELA SÓ MOSTRA (pedido da Ana, 05/11/2026): tudo o que se digita — pagar a
// hora extra, km da ajuda de custo, bônus, comissão, ajustes, empresa que paga —
// fica na janela da pessoa, aberta ao clicar na linha. Os relatórios importados
// também ALIMENTAM a ficha (cadastro na folha, empresa, salário de mês cheio).
import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { ChevronRight, Download, FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, Empty, Modal } from "../ui.jsx";
import { listar, salvar, rhBancoListar } from "../../services/dados.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import { ymdLocal } from "../../lib/format.js";
import { lerRelatorioFolha } from "../../lib/rh/folhaContabil.js";
import { linhasDoPdf } from "../../lib/rh/folhaPdf.js";
import { COLECAO_FOLHA, CONSUMO_PADRAO, EMPRESAS, camposDaFichaPeloHolerite, distribuirRelatorio, idDaLinha, idDoMes, linhaDaFolha, moeda, totaisDaFolha } from "../../lib/rh/folhaPagamento.js";
import { COLECAO_COMISSOES } from "../../lib/recibosComissao.js";
import { coletoresSemFicha } from "../../lib/rh/coletasComissao.js";
import { coletasComissionadas } from "../../services/coletasComissao.js";
import { marcosDaFicha } from "./uteis.js";

const n2 = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const horas = (min) => {
  if (min === null || min === undefined) return "—";
  const s = min < 0 ? "−" : "+", a = Math.abs(Math.round(min));
  return `${s}${String(Math.floor(a / 60)).padStart(2, "0")}h${String(a % 60).padStart(2, "0")}`;
};
const hhmm = (min) => `${Math.floor(Math.max(0, min) / 60)}:${String(Math.round(Math.max(0, min)) % 60).padStart(2, "0")}`;
/** "10:30" → 630; "10" → 600; "10,5" → 630; vazio → null. */
const lerHoras = (txt) => {
  const s = String(txt ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,4}):([0-5]\d)$/);
  if (m) return +m[1] * 60 + +m[2];
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 60) : NaN;
};
const lerValor = (txt) => {
  const s = String(txt ?? "").trim();
  if (!s) return null;
  const n = Number(/,\d{1,2}$/.test(s) || s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : NaN;
};
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const rotuloMes = (c) => { const [a, m] = c.split("-").map(Number); return `${NOMES_MES[m - 1]}/${a}`; };
function meses() {
  const out = [], d = new Date();
  d.setDate(1);
  for (let i = 0; i < 13; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() - 1); }
  return out;
}
const SITUACAO = {
  confere: ["Confere", "bg-emerald-50 text-emerald-800"],
  divergencia: ["Divergência", "bg-amber-100 text-amber-900"],
  leitura: ["Conferir leitura", "bg-amber-100 text-amber-900"],
  aguardando: ["Aguardando", "bg-slate-100 text-slate-600"],
  nao_se_aplica: ["não se aplica", "text-slate-500"],
};
const vazio = () => <span className="text-slate-400">—</span>;
const valorOuVazio = (v) => (v ? n2(v) : vazio());

export default function AbaFolhaPagamento({ pessoas = [], editavel, setAviso }) {
  const opcoesMes = useMemo(meses, []);
  const [competencia, setCompetencia] = useState(opcoesMes[1]);
  const [registros, setRegistros] = useState(null);
  const [pontoDia, setPontoDia] = useState([]);
  const [comissoes, setComissoes] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [erro, setErro] = useState("");
  const [fichasEditadas, setFichasEditadas] = useState({});
  const [importando, setImportando] = useState(false);
  const [aberta, setAberta] = useState(null); // pessoaId da janela aberta
  const [gasolinaTexto, setGasolinaTexto] = useState("");
  // Coletas do CRM (composta / viagem, COLETADAS no mês). Falha aqui não derruba a folha: avisa.
  const [coletas, setColetas] = useState([]);
  const [coletasErro, setColetasErro] = useState("");
  useEffect(() => {
    let vivo = true;
    setColetas([]); setColetasErro("");
    coletasComissionadas(competencia)
      .then((c) => { if (vivo) setColetas(c); })
      .catch((ex) => { if (vivo) setColetasErro(ex.message); });
    return () => { vivo = false; };
  }, [competencia]);

  const carregar = useCallback(async () => {
    try {
      const [r, p, c, b] = await Promise.all([listar(COLECAO_FOLHA), listar("rh_ponto_dia"), listar(COLECAO_COMISSOES), rhBancoListar({})]);
      setRegistros(r); setPontoDia(p); setComissoes(c); setMovimentos(b.movimentos || []); setErro("");
    } catch (ex) { setErro(ex.message); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const fichas = useMemo(() => pessoas.map((p) => ({ ...p, ...(fichasEditadas[p.id] || {}) })), [pessoas, fichasEditadas]);
  const regPorId = useMemo(() => new Map((registros || []).map((r) => [r.id, r])), [registros]);
  const mes = regPorId.get(idDoMes(competencia)) || null;
  const gasolinaAnterior = useMemo(() => (registros || []).filter((r) => r.tipo === "mes" && r.gasolina && r.competencia < competencia).sort((a, b) => b.competencia.localeCompare(a.competencia))[0]?.gasolina ?? "", [registros, competencia]);
  const gasolina = mes?.gasolina ?? gasolinaAnterior;
  useEffect(() => { setGasolinaTexto(gasolina ? String(gasolina).replace(".", ",") : ""); }, [gasolina, competencia]);

  const contexto = useMemo(() => ({ competencia, mes: { gasolina }, pontoDia, movimentos, comissoes, fichas, coletas }), [competencia, gasolina, pontoDia, movimentos, comissoes, fichas, coletas]);
  const semFichaColetas = useMemo(() => coletoresSemFicha(coletas, fichas), [coletas, fichas]);
  const linhas = useMemo(() => {
    if (!registros) return [];
    const doMes = (f) => regPorId.get(idDaLinha(competencia, f.id));
    return fichas
      .filter((f) => f.ativo !== false || doMes(f))
      .map((f) => linhaDaFolha({ ...contexto, ficha: f, registro: doMes(f) || {} }))
      .sort((a, b) => a.paga.localeCompare(b.paga) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [registros, regPorId, fichas, competencia, contexto]);
  const t = useMemo(() => totaisDaFolha(linhas), [linhas]);

  async function gravarRegistro(registro) {
    const r = await salvar(COLECAO_FOLHA, registro);
    setRegistros((lista) => [...(lista || []).filter((x) => x.id !== r.id), r]);
    return r;
  }
  /* Ficha do RH: grava e carimba no histórico o que mudou (cargo, setor, salário),
     do mesmo jeito da aba Pessoas. Falha no histórico não derruba a ficha. */
  async function gravarFicha(antes, campos) {
    const gravada = await salvar("rh_pessoas", { ...antes, ...campos });
    setFichasEditadas((m) => ({ ...m, [gravada.id]: gravada }));
    for (const marco of marcosDaFicha(antes, gravada, ymdLocal(new Date()))) {
      try { await salvar("rh_historico", marco); } catch { /* o aviso da tela de Pessoas cobre a ficha; aqui segue */ }
    }
    return gravada;
  }
  const registroDe = (pessoaId) => regPorId.get(idDaLinha(competencia, pessoaId)) || { id: idDaLinha(competencia, pessoaId), tipo: "pessoa", competencia, pessoaId, pessoaNome: fichas.find((f) => f.id === pessoaId)?.nome || "" };
  const registroDoMes = (comp) => regPorId.get(idDoMes(comp)) || { id: idDoMes(comp), tipo: "mes", competencia: comp, importacoes: [] };

  async function salvarGasolina() {
    const v = Number(String(gasolinaTexto).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || String(v) === String(mes?.gasolina)) return;
    try { await gravarRegistro({ ...registroDoMes(competencia), gasolina: v }); }
    catch (ex) { setAviso?.({ tipo: "erro", texto: ex.message }); }
  }

  async function importar(arquivos) {
    if (!arquivos?.length) return;
    setImportando(true);
    const resumo = [];
    const fichaMudou = [];
    let compFinal = competencia;
    const fichasAtuais = new Map(fichas.map((f) => [f.id, f]));
    try {
      for (const arquivo of arquivos) {
        const rel = lerRelatorioFolha(await linhasDoPdf(arquivo));
        if (!rel.tipo) { resumo.push(`${arquivo.name}: não é Relação de Eventos nem Relação de Líquidos (este não precisa ser importado).`); continue; }
        const comp = rel.competencia || competencia;
        compFinal = comp;
        const codigo = rel.empresa.codigo || "0000";
        const { porPessoa, naoEncontrados } = distribuirRelatorio(rel, fichas);
        const agora = new Date().toISOString();
        for (const [pessoaId, h] of Object.entries(porPessoa)) {
          const id = idDaLinha(comp, pessoaId);
          const reg = regPorId.get(id) || { id, tipo: "pessoa", competencia: comp, pessoaId, pessoaNome: fichasAtuais.get(pessoaId)?.nome || h.nome };
          const atual = reg.holerites?.[codigo];
          // Líquidos depois de Eventos não apaga o detalhe: só confere o líquido.
          const novo = rel.tipo === "liquidos" && atual?.tipoRelatorio === "eventos"
            ? { ...atual, liquidoRelacao: h.liquido, confere: atual.confere !== false && Math.abs((atual.liquido ?? h.liquido) - h.liquido) < 0.05 }
            : { ...h, arquivo: arquivo.name, importadoEm: agora };
          await gravarRegistro({ ...reg, holerites: { ...(reg.holerites || {}), [codigo]: novo } });
          // ALIMENTA A FICHA: cadastro na folha, empresa que paga e salário de mês cheio.
          const ficha = fichasAtuais.get(pessoaId);
          const { campos, mudancas } = camposDaFichaPeloHolerite(ficha, novo, codigo);
          if (ficha && Object.keys(campos).length) {
            try {
              const g = await gravarFicha(ficha, campos);
              fichasAtuais.set(pessoaId, g);
              fichaMudou.push(`${ficha.nome}: ${mudancas.join(", ")}`);
            } catch (ex) { fichaMudou.push(`${ficha.nome}: não consegui atualizar a ficha (${ex.message})`); }
          }
        }
        const m = registroDoMes(comp);
        await gravarRegistro({ ...m, importacoes: [...(m.importacoes || []), { arquivo: arquivo.name, tipo: rel.tipo, empresa: rel.empresa.nome, codigo, pessoas: Object.keys(porPessoa).length, naoEncontrados, fichasAtualizadas: fichaMudou.length, em: agora }] });
        resumo.push(`${arquivo.name}: ${Object.keys(porPessoa).length} pessoa(s) de ${rel.empresa.nome || "empresa"} em ${rotuloMes(comp)}${naoEncontrados.length ? ` — sem ficha no RH: ${naoEncontrados.join(", ")}` : ""}.`);
      }
      setCompetencia(compFinal);
      setAviso?.({ tipo: "ok", texto: [...resumo, fichaMudou.length ? `Fichas atualizadas — ${fichaMudou.join("; ")}.` : ""].filter(Boolean).join(" ") });
    } catch (ex) {
      setAviso?.({ tipo: "erro", texto: `Não consegui ler o PDF: ${ex.message}` });
    } finally { setImportando(false); }
  }

  function exportar() {
    baixarPlanilha({
      nome: `folha-pagamento-${competencia}`,
      titulo: `Folha de Pagamento — ${rotuloMes(competencia)}`,
      colunas: [
        { chave: "nome", rotulo: "Colaborador" }, { chave: "vinculo", rotulo: "Vínculo" }, { chave: "paga", rotulo: "Forma de pagamento" },
        { chave: "salario", rotulo: "Salário (ficha)", tipo: "dinheiro" }, { chave: "dias", rotulo: "Dias pagos (de 30)" }, { chave: "salarioMes", rotulo: "Salário do mês", tipo: "dinheiro" }, { chave: "liquido", rotulo: "Líquido holerite", tipo: "dinheiro" },
        { chave: "banco", rotulo: "Banco de horas" }, { chave: "hePagas", rotulo: "Horas extras pagas" }, { chave: "he", rotulo: "Hora extra 50%", tipo: "dinheiro" },
        { chave: "ajuda", rotulo: "Ajuda de custo", tipo: "dinheiro" }, { chave: "comissaoColetas", rotulo: "Comissão de coletas (CRM)", tipo: "dinheiro" }, { chave: "comissao", rotulo: "Comissão total", tipo: "dinheiro" },
        { chave: "bonus", rotulo: "Bônus", tipo: "dinheiro" }, { chave: "ajustes", rotulo: "Ajustes", tipo: "dinheiro" }, { chave: "extras", rotulo: "Total de extras", tipo: "dinheiro" }, { chave: "motivos", rotulo: "Motivos (bônus, comissão manual, ajustes)" },
        { chave: "totalMinasLab", rotulo: "Total MinasLab", tipo: "dinheiro" }, { chave: "pagarMLab", rotulo: "Pagar pela M Lab", tipo: "dinheiro" },
        { chave: "total", rotulo: "Total geral", tipo: "dinheiro" }, { chave: "comEncargos", rotulo: "Total com encargos", tipo: "dinheiro" },
        { chave: "holerite", rotulo: "Holerite" },
      ],
      linhas: [...linhas.map((l) => ({
        ...l, liquido: l.liquidoHolerite ?? "", dias: l.diasPagar ?? 30, banco: l.bancoMin === null ? "" : horas(l.bancoMin), hePagas: l.heMin ? hhmm(l.heMin) : "",
        motivos: [...l.bonusLista.map((a) => `bônus ${n2(a.valor)} ${a.motivo}`), ...l.comissaoManualLista.map((a) => `comissão ${n2(a.valor)} ${a.motivo}`), ...l.ajustesLista.map((a) => `ajuste ${n2(a.valor)} ${a.motivo}`)].join("; "),
        holerite: [SITUACAO[l.holerite.situacao][0], ...l.holerite.avisos].join(" — "),
      })), { nome: "Total da folha", ...t, dias: "", liquido: "", banco: "", hePagas: "", motivos: "", holerite: "" }],
    });
  }

  if (erro && !registros) return <Card><p role="alert" className="text-sm text-red-700">{erro}</p></Card>;
  if (!registros) return <Card><p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Carregando a folha…</p></Card>;

  const fichaAberta = aberta && fichas.find((f) => f.id === aberta);
  const divergentes = linhas.filter((l) => l.holerite.avisos.length);
  const ultimaImport = (mes?.importacoes || []).at(-1);
  // Extras = hora extra + ajuda de custo + comissão + bônus + ajustes. O detalhe fica na janela da pessoa.
  const COLS = ["Colaborador", "Vínculo", "Paga", "Salário", "Líquido holerite", "Banco de horas", "Extras", "Total MinasLab", "Pagar M Lab", "Total", "Com encargos", "Holerite", ""];
  const composicao = (l) => [["Hora extra", l.he], ["Ajuda de custo", l.ajuda], ["Comissão", l.comissao], ["Bônus", l.bonus], ["Ajustes", l.ajustes]].filter(([, v]) => v).map(([r, v]) => `${r} ${n2(v)}`).join(" · ");

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Folha de Pagamento</h2>
            <p className="text-xs text-slate-500">Clique em uma pessoa para ver o detalhe e lançar hora extra, ajuda de custo, comissão, bônus, ajustes e salário proporcional.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-600">Mês
              <select className="select mt-1 block" value={competencia} onChange={(e) => setCompetencia(e.target.value)}>
                {opcoesMes.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Gasolina (R$/l)
              <input className="input mt-1 block w-24" inputMode="decimal" value={gasolinaTexto} disabled={!editavel} placeholder="6,66"
                onChange={(e) => setGasolinaTexto(e.target.value)} onBlur={salvarGasolina} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
            </label>
            {editavel && (
              <label className={clsx("btn-outline cursor-pointer", importando && "pointer-events-none opacity-60")}>
                {importando ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                {importando ? "Lendo…" : "Importar relatórios (PDF)"}
                <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; void importar(f); }} />
              </label>
            )}
            <button type="button" className="btn-primary" onClick={exportar}><Download size={16} />Exportar Excel</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Importe a <b>Relação de Eventos</b> (ou a Relação de Líquidos) de cada empresa: os valores entram na folha e a ficha de cada pessoa é atualizada (cadastro na folha, empresa que paga e salário do mês cheio).
          {ultimaImport && <> Última importação: {ultimaImport.arquivo} ({ultimaImport.empresa}).</>}
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Total geral", t.total, `${t.pessoas} pessoas`], ["Pago pela MinasLab", t.totalMinasLab, "contratos, pró-labore, extras e benefícios"], ["Pago pela M Lab", t.pagarMLab, "salários CLT (líquido do holerite)"], ["Custo com encargos", t.comEncargos, "CLT: salário × 1,7 + extras e benefícios"]].map(([r, v, s]) => (
          <Card key={r}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r}</p><p className="mt-1 font-display text-2xl font-bold text-slate-900">{moeda(v)}</p><p className="text-xs text-slate-500">{s}</p></Card>
        ))}
      </div>

      {(divergentes.length > 0 || !gasolina || (ultimaImport?.naoEncontrados || []).length > 0 || coletasErro || semFichaColetas.length > 0) && (
        <div className="space-y-2">
          {divergentes.map((l) => (
            <p key={l.pessoaId} role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>{l.nome}:</b> {l.holerite.avisos.join("; ")}.</p>
          ))}
          {coletasErro && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Não consegui trazer as coletas do CRM ({coletasErro}). A comissão de coletas ficou de fora.</p>}
          {semFichaColetas.length > 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Coletor do CRM sem ficha no RH: {semFichaColetas.join(", ")}. A comissão dessas coletas não entrou.</p>}
          {!gasolina && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Informe o preço da gasolina do mês para calcular a ajuda de custo.</p>}
          {(ultimaImport?.naoEncontrados || []).length > 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">No último relatório, sem ficha no RH: {ultimaImport.naoEncontrados.join(", ")}. Confira o nome na ficha.</p>}
        </div>
      )}

      <Card className="p-0">
        {linhas.length === 0 ? <Empty>Ninguém no quadro neste mês.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>{COLS.map((h, i) => <th key={h || i} className={clsx("px-2 py-2.5 font-semibold", i >= 3 && i <= 10 && "text-right")}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const [rotulo, cor] = SITUACAO[l.holerite.situacao];
                  return (
                    <tr key={l.pessoaId} onClick={() => setAberta(l.pessoaId)} className={clsx("cursor-pointer border-t hover:bg-teal-50/60", l.holerite.avisos.length && "bg-amber-50/50")} style={{ borderColor: "var(--hairline)" }}>
                      <td className="px-2 py-2"><button type="button" className="text-left font-medium text-slate-900 hover:text-teal-800 hover:underline" onClick={(e) => { e.stopPropagation(); setAberta(l.pessoaId); }}>{l.nome}</button></td>
                      <td className="px-2 py-2">{l.vinculo}</td>
                      <td className="px-2 py-2">{l.paga}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{n2(l.salarioMes)}{l.diasPagar !== null && <span className="block text-[11px] text-amber-700">{l.diasPagar} de 30 dias</span>}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{l.liquidoHolerite === null ? vazio() : n2(l.liquidoHolerite)}</td>
                      <td className={clsx("px-2 py-2 text-right tabular-nums font-semibold", l.bancoMin > 0 ? "text-teal-700" : l.bancoMin < 0 ? "text-red-700" : "text-slate-500")}>{l.bancoMin === null ? vazio() : horas(l.bancoMin)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums" title={composicao(l)}>{l.extras ? n2(l.extras) : vazio()}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{n2(l.totalMinasLab)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{valorOuVazio(l.pagarMLab)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{n2(l.total)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{n2(l.comEncargos)}</td>
                      <td className="px-2 py-2">{l.holerite.situacao === "nao_se_aplica" ? <span className="text-xs text-slate-500">não se aplica</span> : <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", cor)}>{rotulo}</span>}</td>
                      <td className="px-1 py-2 text-slate-400"><ChevronRight size={16} aria-hidden="true" /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 bg-slate-50 font-bold text-slate-900" style={{ borderColor: "var(--hairline)" }}>
                <tr>
                  <td className="px-2 py-2.5" colSpan={3}>Total da folha</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.salarioMes)}</td>
                  <td colSpan={2} />
                  {[t.extras, t.totalMinasLab, t.pagarMLab, t.total, t.comEncargos].map((v, i) => <td key={i} className="px-2 py-2.5 text-right tabular-nums">{n2(v)}</td>)}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500">Extras = hora extra + ajuda de custo + comissão + bônus + ajustes (passe o mouse para ver a soma; clique na pessoa para o detalhe). Salário proporcional = salário ÷ 30 × dias. HE 50% = horas pagas × (salário ÷ 220) × 1,5; depois de pagar, lance o débito no banco de horas.</p>

      {fichaAberta && (
        <JanelaPessoa
          ficha={fichaAberta} registro={registroDe(fichaAberta.id)} contexto={contexto} competencia={competencia} editavel={editavel}
          aoFechar={() => setAberta(null)}
          aoSalvar={async (registro, camposFicha) => {
            if (Object.keys(camposFicha).length) await gravarFicha(fichaAberta, camposFicha);
            await gravarRegistro(registro);
            setAberta(null);
            setAviso?.({ tipo: "ok", texto: `Folha de ${fichaAberta.nome} gravada.` });
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- janela da pessoa */
function Lista({ titulo, itens, setItens, editavel, exemplo }) {
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const adicionar = () => {
    const v = lerValor(valor);
    if (v === null || Number.isNaN(v) || v === 0) return setErro("Informe o valor (negativo para descontar).");
    if (!motivo.trim()) return setErro("O motivo é obrigatório.");
    setItens([...itens, { valor: v, motivo: motivo.trim(), em: new Date().toISOString() }]);
    setValor(""); setMotivo(""); setErro("");
  };
  return (
    <fieldset className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
      <legend className="px-1 text-sm font-semibold text-slate-800">{titulo}</legend>
      <ul className="space-y-1.5">
        {itens.length === 0 && <li className="text-xs text-slate-500">Nenhum lançamento.</li>}
        {itens.map((a, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className={clsx("w-24 text-right font-semibold tabular-nums", a.valor < 0 ? "text-red-700" : "text-slate-900")}>{a.valor > 0 ? "+" : ""}{n2(a.valor)}</span>
            <span className="min-w-0 flex-1 truncate" title={a.motivo}>{a.motivo}</span>
            {editavel && <button type="button" onClick={() => setItens(itens.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Remover ${a.motivo}`}><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
      {editavel && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[110px_1fr_auto]">
          <input className="input" inputMode="decimal" placeholder="Valor" aria-label={`Valor — ${titulo}`} value={valor} onChange={(e) => setValor(e.target.value)} />
          <input className="input" placeholder={exemplo} aria-label={`Motivo — ${titulo}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }} />
          <button type="button" className="btn-outline" onClick={adicionar}><Plus size={15} />Lançar</button>
        </div>
      )}
      {erro && <p role="alert" className="mt-1 text-xs text-red-700">{erro}</p>}
    </fieldset>
  );
}

function Linha({ rotulo, valor, forte, sub }) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-3 py-1 text-sm", forte && "border-t pt-2 font-bold text-slate-900")} style={forte ? { borderColor: "var(--hairline)" } : undefined}>
      <span className={forte ? "" : "text-slate-600"}>{rotulo}{sub && <span className="block text-[11px] font-normal text-slate-500">{sub}</span>}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

function JanelaPessoa({ ficha, registro, contexto, competencia, editavel, aoFechar, aoSalvar }) {
  const [f, setF] = useState(() => ({
    heLiberada: registro.heLiberada === true,
    horasPagar: registro.horasPagarMin === null || registro.horasPagarMin === undefined ? "" : hhmm(registro.horasPagarMin),
    kmIda: ficha.kmIda ?? "", kmVolta: ficha.kmVolta ?? "", veiculo: ficha.veiculo || "Moto",
    ajudaFixa: registro.ajudaFixa === null || registro.ajudaFixa === undefined ? "" : String(registro.ajudaFixa).replace(".", ","),
    empresaPagadora: ficha.empresaPagadora || "",
    diasPagar: registro.diasPagar === null || registro.diasPagar === undefined ? "" : String(registro.diasPagar),
    bonus: registro.bonus || [], comissaoManual: registro.comissaoManual || [], ajustes: registro.ajustes || [],
  }));
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);
  const campo = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const km = (s) => (String(s).trim() === "" ? "" : Number(String(s).replace(",", ".")));

  const horasPagarMin = lerHoras(f.horasPagar);
  const ajudaFixa = lerValor(f.ajudaFixa);
  const diasPagar = String(f.diasPagar).trim() === "" ? null : Number(String(f.diasPagar).replace(",", "."));
  const diasInvalido = diasPagar !== null && !(Number.isFinite(diasPagar) && diasPagar >= 0 && diasPagar <= 30);
  const camposFicha = useMemo(() => {
    const c = {};
    if (String(km(f.kmIda)) !== String(ficha.kmIda ?? "")) c.kmIda = km(f.kmIda);
    if (String(km(f.kmVolta)) !== String(ficha.kmVolta ?? "")) c.kmVolta = km(f.kmVolta);
    if (f.veiculo !== (ficha.veiculo || "Moto")) c.veiculo = f.veiculo;
    if (f.empresaPagadora !== (ficha.empresaPagadora || "")) c.empresaPagadora = f.empresaPagadora;
    return c;
  }, [f, ficha]);
  const novoRegistro = {
    ...registro, heLiberada: f.heLiberada, horasPagarMin: Number.isNaN(horasPagarMin) ? null : horasPagarMin,
    ajudaFixa: ajudaFixa === null || Number.isNaN(ajudaFixa) ? null : ajudaFixa,
    diasPagar: diasPagar === null || diasInvalido ? null : diasPagar,
    bonus: f.bonus, comissaoManual: f.comissaoManual, ajustes: f.ajustes,
  };
  // Prévia ao vivo: a mesma conta da tabela, com o que está digitado na janela.
  const l = linhaDaFolha({ ...contexto, ficha: { ...ficha, ...camposFicha }, registro: novoRegistro });
  const hs = Object.entries(registro.holerites || {});

  const enviar = async (e) => {
    e.preventDefault();
    if (Number.isNaN(horasPagarMin)) return setErro("Horas a pagar: use 10:30 ou 10,5.");
    if (Number.isNaN(ajudaFixa)) return setErro("Ajuda de custo fixa: valor inválido.");
    if (diasInvalido) return setErro("Dias a pagar: de 0 a 30.");
    if ([f.kmIda, f.kmVolta].some((v) => String(v).trim() !== "" && !Number.isFinite(km(v)))) return setErro("Km inválido.");
    setGravando(true); setErro("");
    try { await aoSalvar(novoRegistro, camposFicha); } catch (ex) { setErro(ex.message); setGravando(false); }
  };

  return (
    <Modal titulo={`${ficha.nome} — ${rotuloMes(competencia)}`} aberto aoFechar={aoFechar} largura="max-w-4xl">
      <form onSubmit={enviar} className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{l.vinculo} · salário da ficha {moeda(l.salario)}{ficha.cadastroFolha ? ` · cadastro na folha ${ficha.cadastroFolha}` : ""}</p>

          <fieldset className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
            <legend className="px-1 text-sm font-semibold text-slate-800">Salário do mês</legend>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-slate-600">Dias a pagar (de 30)
                <input className="input mt-1 block w-28" inputMode="numeric" placeholder={l.diasSugeridos === null ? "30 (cheio)" : String(l.diasSugeridos)} value={f.diasPagar} disabled={!editavel} onChange={campo("diasPagar")} />
              </label>
              <p className="pb-2 text-sm">{moeda(l.salario)} ÷ 30 × {l.diasPagar ?? 30} = <b>{moeda(l.salarioMes)}</b></p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {l.diasSugeridos !== null
                ? `Pela ficha (${ficha.admissao?.startsWith(competencia) ? `admissão em ${ficha.admissao.split("-").reverse().join("/")}` : ""}${ficha.admissao?.startsWith(competencia) && ficha.desligadoEm?.startsWith(competencia) ? ", " : ""}${ficha.desligadoEm?.startsWith(competencia) ? `desligamento em ${ficha.desligadoEm.split("-").reverse().join("/")}` : ""}) o mês é de ${l.diasSugeridos} dias — já aplicado. Digite outro número para trocar.`
                : "Vazio = mês cheio. Para quem trabalhou só parte do mês (ex.: 10 dias), digite os dias."}
              {l.vinculo === "CLT" && l.liquidoHolerite !== null && " Com holerite importado, o valor pago é o líquido do holerite (a contabilidade já fez a conta)."}
            </p>
          </fieldset>

          {l.vinculo === "CLT" && (
            <fieldset className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
              <legend className="px-1 text-sm font-semibold text-slate-800">Hora extra</legend>
              <p className="text-sm">Saldo do banco no fim do mês: <b className={l.bancoMin > 0 ? "text-teal-700" : l.bancoMin < 0 ? "text-red-700" : ""}>{horas(l.bancoMin)}</b></p>
              <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-teal-700" checked={f.heLiberada} disabled={!editavel || !(l.bancoMin > 0)} onChange={campo("heLiberada")} />Pagar hora extra neste mês</label>
              {f.heLiberada && (
                <label className="mt-2 block text-xs text-slate-600">Horas a pagar (vazio = saldo inteiro)
                  <input className="input mt-1 w-36" placeholder={hhmm(l.bancoMin || 0)} value={f.horasPagar} disabled={!editavel} onChange={campo("horasPagar")} />
                </label>
              )}
              {!(l.bancoMin > 0) && <p className="mt-1 text-xs text-slate-500">Sem saldo positivo: não há hora extra a pagar.</p>}
            </fieldset>
          )}

          <fieldset className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
            <legend className="px-1 text-sm font-semibold text-slate-800">Ajuda de custo</legend>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-slate-600">Km ida<input className="input mt-1" inputMode="decimal" value={f.kmIda} disabled={!editavel} onChange={campo("kmIda")} /></label>
              <label className="text-xs text-slate-600">Km volta<input className="input mt-1" inputMode="decimal" value={f.kmVolta} disabled={!editavel} onChange={campo("kmVolta")} /></label>
              <label className="text-xs text-slate-600">Veículo<select className="select mt-1 block w-full" value={f.veiculo} disabled={!editavel} onChange={campo("veiculo")}><option>Moto</option><option>Carro</option></select></label>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Conta: {l.dias} dias com batida no Ponto × gasolina {contexto.mes.gasolina ? moeda(contexto.mes.gasolina) : "(informe na tela)"} · {f.veiculo === "Carro" ? CONSUMO_PADRAO.carro : CONSUMO_PADRAO.moto} km/l = <b>{moeda(l.ajudaCalculada)}</b>
            </p>
            <label className="mt-2 block text-xs text-slate-600">Valor fixo neste mês (opcional, substitui a conta)
              <input className="input mt-1 w-36" inputMode="decimal" placeholder="—" value={f.ajudaFixa} disabled={!editavel} onChange={campo("ajudaFixa")} />
            </label>
          </fieldset>

          <fieldset className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
            <legend className="px-1 text-sm font-semibold text-slate-800">Comissão</legend>
            <p className="text-sm">Do fechamento do Gestão: <b>{moeda(l.comissaoGestao)}</b></p>
            <p className="mt-1 text-sm">Coletas do CRM (composta / viagem, COLETADAS no mês): <b>{moeda(l.comissaoColetas)}</b></p>
            {l.coletasLista.length > 0 && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--hairline)" }}>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-2 py-1.5">Data</th><th className="px-2 py-1.5">OS</th><th className="px-2 py-1.5">Cliente</th><th className="px-2 py-1.5">Tipo</th><th className="px-2 py-1.5 text-right">Valor</th></tr></thead>
                  <tbody>
                    {l.coletasLista.map((c) => (
                      <tr key={c.id} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                        <td className="px-2 py-1.5 tabular-nums">{c.data ? new Date(c.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
                        <td className="px-2 py-1.5">{c.os || "—"}</td>
                        <td className="max-w-[180px] truncate px-2 py-1.5" title={c.cliente}>{c.cliente || "—"}</td>
                        <td className="px-2 py-1.5">{c.tipo === "VIAGEM" ? `Viagem · ${c.km ?? "?"} km` : "Composta"}</td>
                        <td className={clsx("px-2 py-1.5 text-right tabular-nums", c.semKm && "text-amber-700")}>{c.semKm ? "sem km" : n2(c.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {l.coletasLista.some((c) => c.semKm) && <p className="mt-1 text-xs text-amber-800">Há viagem sem km no CRM: corrija a coleta para ela entrar.</p>}
            <p className="mt-1 text-xs text-slate-500">Composta R$ 100 · viagem até 50 km (ida e volta) R$ 50, acima R$ 100. Marque o tipo na coleta do CRM.</p>
          </fieldset>
          <Lista titulo="Comissão lançada à mão" itens={f.comissaoManual} setItens={(v) => setF((x) => ({ ...x, comissaoManual: v }))} editavel={editavel} exemplo="Ex.: comissão de venda fora do Gestão" />
          <Lista titulo="Bônus" itens={f.bonus} setItens={(v) => setF((x) => ({ ...x, bonus: v }))} editavel={editavel} exemplo="Ex.: 8 coletas" />
          <Lista titulo="Ajustes" itens={f.ajustes} setItens={(v) => setF((x) => ({ ...x, ajustes: v }))} editavel={editavel} exemplo="Ex.: reembolso de exame admissional" />

          <label className="block text-xs text-slate-600">Quem paga
            <select className="select mt-1 block w-full sm:w-72" value={f.empresaPagadora} disabled={!editavel} onChange={campo("empresaPagadora")}>
              <option value="">Automático (pelo holerite / CLT na M Lab)</option>
              <option value="M Lab">M Lab</option>
              <option value="MinasLab">MinasLab</option>
            </select>
          </label>

          {hs.length > 0 && (
            <details className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Holerite da contabilidade</summary>
              {hs.map(([codigo, h]) => (
                <div key={codigo} className="mt-2">
                  <p className="text-xs font-semibold text-slate-700">{h.empresa || EMPRESAS[codigo] || codigo} · cadastro {h.cadastro}{h.rescisao ? " · rescisão" : ""}</p>
                  <table className="mt-1 w-full text-xs">
                    <tbody>
                      {(h.eventos || []).map((ev, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                          <td className="py-1">{ev.codigo} {ev.descricao}</td>
                          <td className="py-1 text-right tabular-nums">{ev.referencia ? n2(ev.referencia) : ""}</td>
                          <td className={clsx("py-1 text-right tabular-nums", ev.tipo === "desconto" && "text-red-700", ev.tipo === "informativo" && "text-slate-400")}>{ev.tipo === "desconto" ? "−" : ""}{n2(ev.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 text-xs">Líquido {h.liquido === null || h.liquido === undefined ? "—" : moeda(h.liquido)}{h.confere === true ? " · soma confere" : h.confere === false ? " · a soma não fecha" : ""} · {h.arquivo}</p>
                </div>
              ))}
            </details>
          )}
        </div>

        <aside className="h-fit rounded-xl bg-slate-50 p-3 lg:sticky lg:top-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo do mês</p>
          {l.holerite.avisos.length > 0 && <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">{l.holerite.avisos.join("; ")}.</p>}
          <Linha rotulo={l.paga === "M Lab" ? "Salário (pago pela M Lab)" : "Salário"} valor={moeda(l.liquidoHolerite ?? l.salarioMes)} sub={l.liquidoHolerite !== null ? "líquido do holerite" : l.diasPagar !== null ? `proporcional: ${l.diasPagar} de 30 dias` : l.vinculo === "CLT" ? "estimado: sem holerite importado" : undefined} />
          <Linha rotulo="Hora extra 50%" valor={moeda(l.he)} sub={l.heMin ? `${hhmm(l.heMin)} pagas` : undefined} />
          <Linha rotulo="Ajuda de custo" valor={moeda(l.ajuda)} sub={l.ajudaFixa ? "valor fixo do mês" : undefined} />
          <Linha rotulo="Comissão" valor={moeda(l.comissao)} />
          <Linha rotulo="Bônus" valor={moeda(l.bonus)} />
          <Linha rotulo="Ajustes" valor={moeda(l.ajustes)} />
          <Linha rotulo="Total de extras" valor={moeda(l.extras)} forte />
          <Linha rotulo="Total MinasLab" valor={moeda(l.totalMinasLab)} forte />
          <Linha rotulo="Pagar pela M Lab" valor={moeda(l.pagarMLab)} />
          <Linha rotulo="Total" valor={moeda(l.total)} forte />
          <Linha rotulo="Com encargos" valor={moeda(l.comEncargos)} />
          {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-outline flex-1" onClick={aoFechar}>{editavel ? "Cancelar" : "Fechar"}</button>
            {editavel && <button type="submit" className="btn-primary flex-1" disabled={gravando}>{gravando ? "Gravando…" : "Gravar"}</button>}
          </div>
        </aside>
      </form>
    </Modal>
  );
}
