// Aba "Folha de Pagamento" do RH: a conferência do mês, no lugar da planilha
// Funcionarios.xlsx. As contas moram em lib/rh/folhaPagamento.js (com teste); a
// leitura dos relatórios da contabilidade em lib/rh/folhaContabil.js.
// Só a direção vê (as coleções rh_* são da direção no servidor).
import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Download, FileUp, Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { Card, Empty, Modal } from "../ui.jsx";
import { listar, salvar, rhBancoListar } from "../../services/dados.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import { lerRelatorioFolha } from "../../lib/rh/folhaContabil.js";
import { linhasDoPdf } from "../../lib/rh/folhaPdf.js";
import { COLECAO_FOLHA, EMPRESAS, distribuirRelatorio, idDaLinha, idDoMes, linhaDaFolha, moeda, totaisDaFolha } from "../../lib/rh/folhaPagamento.js";
import { COLECAO_COMISSOES } from "../../lib/recibosComissao.js";

const n2 = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const horas = (min) => {
  if (min === null || min === undefined) return "—";
  const s = min < 0 ? "−" : "+", a = Math.abs(Math.round(min));
  return `${s}${String(Math.floor(a / 60)).padStart(2, "0")}h${String(a % 60).padStart(2, "0")}`;
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
  const [modal, setModal] = useState(null); // { tipo: "ajustes"|"config"|"holerite", pessoaId }
  const [gasolinaTexto, setGasolinaTexto] = useState("");

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

  const linhas = useMemo(() => {
    if (!registros) return [];
    const doMes = (f) => regPorId.get(idDaLinha(competencia, f.id));
    return fichas
      .filter((f) => f.ativo !== false || doMes(f))
      .map((f) => linhaDaFolha({ ficha: f, competencia, registro: doMes(f) || {}, mes: { gasolina }, pontoDia, movimentos, comissoes, fichas }))
      .sort((a, b) => a.paga.localeCompare(b.paga) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [registros, regPorId, fichas, competencia, gasolina, pontoDia, movimentos, comissoes]);
  const t = useMemo(() => totaisDaFolha(linhas), [linhas]);

  async function gravarRegistro(registro) {
    const r = await salvar(COLECAO_FOLHA, registro);
    setRegistros((lista) => [...(lista || []).filter((x) => x.id !== r.id), r]);
    return r;
  }
  const registroDe = (pessoaId) => regPorId.get(idDaLinha(competencia, pessoaId)) || { id: idDaLinha(competencia, pessoaId), tipo: "pessoa", competencia, pessoaId, pessoaNome: fichas.find((f) => f.id === pessoaId)?.nome || "" };
  const registroDoMes = (comp) => regPorId.get(idDoMes(comp)) || { id: idDoMes(comp), tipo: "mes", competencia: comp, importacoes: [] };

  async function alternarHE(l) {
    try { await gravarRegistro({ ...registroDe(l.pessoaId), heLiberada: !l.heLiberada }); }
    catch (ex) { setAviso?.({ tipo: "erro", texto: ex.message }); }
  }
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
    let compFinal = competencia;
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
          const reg = regPorId.get(id) || { id, tipo: "pessoa", competencia: comp, pessoaId, pessoaNome: fichas.find((f) => f.id === pessoaId)?.nome || h.nome };
          const atual = reg.holerites?.[codigo];
          // Líquidos depois de Eventos não apaga o detalhe: só confere o líquido.
          const novo = rel.tipo === "liquidos" && atual?.tipoRelatorio === "eventos"
            ? { ...atual, liquidoRelacao: h.liquido, confere: atual.confere !== false && Math.abs((atual.liquido ?? h.liquido) - h.liquido) < 0.05 }
            : { ...h, arquivo: arquivo.name, importadoEm: agora };
          await gravarRegistro({ ...reg, holerites: { ...(reg.holerites || {}), [codigo]: novo } });
        }
        const m = registroDoMes(comp);
        await gravarRegistro({ ...m, importacoes: [...(m.importacoes || []), { arquivo: arquivo.name, tipo: rel.tipo, empresa: rel.empresa.nome, codigo, pessoas: Object.keys(porPessoa).length, naoEncontrados, em: agora }] });
        resumo.push(`${arquivo.name}: ${Object.keys(porPessoa).length} pessoa(s) de ${rel.empresa.nome || "empresa"} em ${rotuloMes(comp)}${naoEncontrados.length ? ` — sem ficha no RH: ${naoEncontrados.join(", ")}` : ""}.`);
      }
      setCompetencia(compFinal);
      setAviso?.({ tipo: "ok", texto: resumo.join(" ") });
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
        { chave: "salario", rotulo: "Salário (ficha)", tipo: "dinheiro" }, { chave: "liquido", rotulo: "Líquido holerite", tipo: "dinheiro" },
        { chave: "banco", rotulo: "Banco de horas" }, { chave: "he", rotulo: "Hora extra 50%", tipo: "dinheiro" },
        { chave: "ajuda", rotulo: "Ajuda de custo", tipo: "dinheiro" }, { chave: "comissao", rotulo: "Comissão", tipo: "dinheiro" },
        { chave: "ajustes", rotulo: "Ajustes", tipo: "dinheiro" }, { chave: "motivos", rotulo: "Motivo dos ajustes" },
        { chave: "totalMinasLab", rotulo: "Total MinasLab", tipo: "dinheiro" }, { chave: "pagarMLab", rotulo: "Pagar pela M Lab", tipo: "dinheiro" },
        { chave: "total", rotulo: "Total geral", tipo: "dinheiro" }, { chave: "comEncargos", rotulo: "Total com encargos", tipo: "dinheiro" },
        { chave: "holerite", rotulo: "Holerite" },
      ],
      linhas: [...linhas.map((l) => ({
        ...l, liquido: l.liquidoHolerite ?? "", banco: l.bancoMin === null ? "" : horas(l.bancoMin),
        motivos: l.ajustesLista.map((a) => `${n2(a.valor)} ${a.motivo}`).join("; "),
        holerite: [SITUACAO[l.holerite.situacao][0], ...l.holerite.avisos].join(" — "),
      })), { nome: "Total da folha", ...t, liquido: "", banco: "", motivos: "", holerite: "" }],
    });
  }

  if (erro && !registros) return <Card><p role="alert" className="text-sm text-red-700">{erro}</p></Card>;
  if (!registros) return <Card><p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Carregando a folha…</p></Card>;

  const linhaModal = modal && linhas.find((l) => l.pessoaId === modal.pessoaId);
  const fichaModal = modal && fichas.find((f) => f.id === modal.pessoaId);
  const divergentes = linhas.filter((l) => l.holerite.avisos.length);
  const ultimaImport = (mes?.importacoes || []).at(-1);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Folha de Pagamento</h2>
            <p className="text-xs text-slate-500">Salário da ficha, horas do Ponto, comissão do Gestão e relatórios da contabilidade.</p>
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
          Importe a <b>Relação de Eventos</b> de cada empresa (a da M Lab e a da MinasLab). A Relação de Líquidos também serve de conferência. Os demais relatórios não precisam.
          {ultimaImport && <> Última importação: {ultimaImport.arquivo} ({ultimaImport.empresa}).</>}
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Total geral", t.total, `${t.pessoas} pessoas`], ["Pago pela MinasLab", t.totalMinasLab, "contratos, pró-labore, extras e benefícios"], ["Pago pela M Lab", t.pagarMLab, "salários CLT (líquido do holerite)"], ["Custo com encargos", t.comEncargos, "CLT: salário × 1,7 + extras e benefícios"]].map(([r, v, s]) => (
          <Card key={r}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r}</p><p className="mt-1 font-display text-2xl font-bold text-slate-900">{moeda(v)}</p><p className="text-xs text-slate-500">{s}</p></Card>
        ))}
      </div>

      {(divergentes.length > 0 || !gasolina || (ultimaImport?.naoEncontrados || []).length > 0) && (
        <div className="space-y-2">
          {divergentes.map((l) => (
            <p key={l.pessoaId} role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>{l.nome}:</b> {l.holerite.avisos.join("; ")}.</p>
          ))}
          {!gasolina && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Informe o preço da gasolina do mês para calcular a ajuda de custo.</p>}
          {(ultimaImport?.naoEncontrados || []).length > 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">No último relatório, sem ficha no RH: {ultimaImport.naoEncontrados.join(", ")}. Confira o nome na ficha.</p>}
        </div>
      )}

      <Card className="p-0">
        {linhas.length === 0 ? <Empty>Ninguém no quadro neste mês.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  {["Colaborador", "Vínculo", "Paga", "Salário", "Líquido holerite", "Banco de horas", "Liberar HE", "HE 50%", "Ajuda de custo", "Comissão", "Ajustes", "Total MinasLab", "Pagar M Lab", "Total", "Com encargos", "Holerite", ""].map((h, i) => (
                    <th key={h || i} className={clsx("px-2 py-2.5 font-semibold", i >= 3 && i <= 14 && i !== 6 && "text-right", i === 6 && "text-center")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const [rotulo, cor] = SITUACAO[l.holerite.situacao];
                  return (
                    <tr key={l.pessoaId} className={clsx("border-t", l.holerite.avisos.length && "bg-amber-50/50")} style={{ borderColor: "var(--hairline)" }}>
                      <td className="px-2 py-2 font-medium text-slate-900">{l.nome}</td>
                      <td className="px-2 py-2">{l.vinculo}</td>
                      <td className="px-2 py-2">{l.paga}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{n2(l.salario)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{l.liquidoHolerite === null ? vazio() : n2(l.liquidoHolerite)}</td>
                      <td className={clsx("px-2 py-2 text-right tabular-nums font-semibold", l.bancoMin > 0 ? "text-teal-700" : l.bancoMin < 0 ? "text-red-700" : "text-slate-500")}>{l.bancoMin === null ? vazio() : horas(l.bancoMin)}</td>
                      <td className="px-2 py-2 text-center">
                        {l.vinculo === "CLT" ? (
                          <button type="button" role="switch" aria-checked={l.heLiberada} disabled={!editavel} onClick={() => void alternarHE(l)}
                            aria-label={`Liberar hora extra de ${l.nome}`} className={clsx("relative inline-block h-6 w-11 rounded-full transition", l.heLiberada ? "bg-teal-700" : "bg-slate-300")}>
                            <span className={clsx("absolute top-1 h-4 w-4 rounded-full bg-white transition-all", l.heLiberada ? "left-6" : "left-1")} />
                          </button>
                        ) : vazio()}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{l.he ? n2(l.he) : vazio()}</td>
                      <td className="px-2 py-2 text-right tabular-nums" title={l.ajuda ? `${l.dias} dias no Ponto` : undefined}>{l.ajuda ? n2(l.ajuda) : vazio()}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{l.comissao ? n2(l.comissao) : vazio()}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <button type="button" className="rounded px-1 underline decoration-dotted underline-offset-2 hover:bg-slate-100 disabled:no-underline" disabled={!editavel && !l.ajustesLista.length}
                          title={l.ajustesLista.map((a) => `${n2(a.valor)} — ${a.motivo}`).join("\n") || "Lançar ajuste"} onClick={() => setModal({ tipo: "ajustes", pessoaId: l.pessoaId })}>
                          {l.ajustes ? (l.ajustes > 0 ? "+" : "") + n2(l.ajustes) : (editavel ? "lançar" : "—")}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{n2(l.totalMinasLab)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{l.pagarMLab ? n2(l.pagarMLab) : vazio()}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{n2(l.total)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{n2(l.comEncargos)}</td>
                      <td className="px-2 py-2">
                        {l.holerite.situacao === "nao_se_aplica" ? <span className="text-xs text-slate-500">não se aplica</span> : (
                          <button type="button" onClick={() => setModal({ tipo: "holerite", pessoaId: l.pessoaId })} className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", cor)}>{rotulo}</button>
                        )}
                      </td>
                      <td className="px-1 py-2">
                        {editavel && <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setModal({ tipo: "config", pessoaId: l.pessoaId })} aria-label={`Configurar ${l.nome}`} title="Empresa que paga e ajuda de custo"><Settings2 size={15} /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 bg-slate-50 font-bold text-slate-900" style={{ borderColor: "var(--hairline)" }}>
                <tr>
                  <td className="px-2 py-2.5" colSpan={3}>Total da folha</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.salario)}</td>
                  <td colSpan={3} />
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.he)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.ajuda)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.comissao)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.ajustes)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.totalMinasLab)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.pagarMLab)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.total)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n2(t.comEncargos)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500">HE 50% = horas do banco × (salário ÷ 220) × 1,5, só quando liberada; depois de pagar, lance o débito no banco de horas. Ajuda de custo = km ida + volta ÷ consumo × gasolina × dias com batida no Ponto. Todo ajuste leva motivo.</p>

      {modal?.tipo === "ajustes" && linhaModal && <ModalAjustes linha={linhaModal} editavel={editavel} aoFechar={() => setModal(null)}
        aoSalvar={async (ajustes) => { await gravarRegistro({ ...registroDe(linhaModal.pessoaId), ajustes }); }} />}
      {modal?.tipo === "config" && fichaModal && <ModalConfig ficha={fichaModal} aoFechar={() => setModal(null)}
        aoSalvar={async (campos) => { const r = await salvar("rh_pessoas", { ...fichaModal, ...campos }); setFichasEditadas((m) => ({ ...m, [r.id]: r })); setModal(null); }} />}
      {modal?.tipo === "holerite" && linhaModal && <ModalHolerite linha={linhaModal} registro={regPorId.get(idDaLinha(competencia, linhaModal.pessoaId))} aoFechar={() => setModal(null)} />}
    </div>
  );
}

function ModalAjustes({ linha, editavel, aoFechar, aoSalvar }) {
  const [lista, setLista] = useState(linha.ajustesLista);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);
  const gravar = async (nova) => { setGravando(true); setErro(""); try { await aoSalvar(nova); setLista(nova); } catch (ex) { setErro(ex.message); } finally { setGravando(false); } };
  const adicionar = async (e) => {
    e.preventDefault();
    const v = Number(String(valor).replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(v) || v === 0) return setErro("Informe o valor (negativo para desconto).");
    if (!motivo.trim()) return setErro("O motivo é obrigatório.");
    await gravar([...lista, { valor: v, motivo: motivo.trim(), em: new Date().toISOString() }]);
    setValor(""); setMotivo("");
  };
  return (
    <Modal titulo={`Ajustes de ${linha.nome}`} aberto aoFechar={aoFechar}>
      <ul className="space-y-2">
        {lista.length === 0 && <li className="text-sm text-slate-500">Nenhum ajuste neste mês.</li>}
        {lista.map((a, i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--hairline)" }}>
            <span className={clsx("w-24 text-right font-semibold tabular-nums", a.valor < 0 ? "text-red-700" : "text-slate-900")}>{a.valor > 0 ? "+" : ""}{n2(a.valor)}</span>
            <span className="min-w-0 flex-1">{a.motivo}</span>
            {editavel && <button type="button" disabled={gravando} onClick={() => void gravar(lista.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label="Remover ajuste"><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
      {editavel && (
        <form onSubmit={adicionar} className="mt-4 grid gap-2 sm:grid-cols-[120px_1fr_auto] sm:items-end">
          <label className="text-xs text-slate-600">Valor (R$)<input className="input mt-1" inputMode="decimal" placeholder="249,00 ou -50,00" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
          <label className="text-xs text-slate-600">Motivo<input className="input mt-1" placeholder="Ex.: reembolso de exame admissional" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
          <button type="submit" className="btn-primary" disabled={gravando}><Plus size={16} />Lançar</button>
        </form>
      )}
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
    </Modal>
  );
}

function ModalConfig({ ficha, aoFechar, aoSalvar }) {
  const [f, setF] = useState({ empresaPagadora: ficha.empresaPagadora || "", kmIda: ficha.kmIda ?? "", kmVolta: ficha.kmVolta ?? "", veiculo: ficha.veiculo || "Moto" });
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);
  const campo = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const enviar = async (e) => {
    e.preventDefault(); setGravando(true); setErro("");
    const km = (s) => (s === "" ? "" : Number(String(s).replace(",", ".")));
    try { await aoSalvar({ empresaPagadora: f.empresaPagadora, kmIda: km(f.kmIda), kmVolta: km(f.kmVolta), veiculo: f.veiculo }); }
    catch (ex) { setErro(ex.message); setGravando(false); }
  };
  return (
    <Modal titulo={`Folha de ${ficha.nome}`} aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-3">
        <label className="block text-xs text-slate-600">Quem paga
          <select className="select mt-1 block w-full" value={f.empresaPagadora} onChange={campo("empresaPagadora")}>
            <option value="">Automático (pelo holerite / CLT na M Lab)</option>
            <option value="M Lab">M Lab</option>
            <option value="MinasLab">MinasLab</option>
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-slate-600">Km ida<input className="input mt-1" inputMode="decimal" value={f.kmIda} onChange={campo("kmIda")} /></label>
          <label className="text-xs text-slate-600">Km volta<input className="input mt-1" inputMode="decimal" value={f.kmVolta} onChange={campo("kmVolta")} /></label>
          <label className="text-xs text-slate-600">Veículo<select className="select mt-1 block w-full" value={f.veiculo} onChange={campo("veiculo")}><option>Moto</option><option>Carro</option></select></label>
        </div>
        <p className="text-xs text-slate-500">Salário e vínculo vêm da ficha da pessoa (aba Pessoas). Consumo: moto 35 km/l, carro 12 km/l.</p>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button><button type="submit" className="btn-primary" disabled={gravando}>{gravando ? "Gravando…" : "Gravar"}</button></div>
      </form>
    </Modal>
  );
}

function ModalHolerite({ linha, registro, aoFechar }) {
  const hs = Object.entries(registro?.holerites || {});
  return (
    <Modal titulo={`Holerite de ${linha.nome}`} aberto aoFechar={aoFechar} largura="max-w-2xl">
      {linha.holerite.avisos.length > 0 && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{linha.holerite.avisos.join("; ")}.</p>}
      {hs.length === 0 && <p className="text-sm text-slate-500">Nenhum relatório da contabilidade importado para esta pessoa neste mês.</p>}
      {hs.map(([codigo, h]) => (
        <div key={codigo} className="mb-4">
          <p className="mb-1 text-sm font-semibold text-slate-800">{h.empresa || EMPRESAS[codigo] || codigo} · cadastro {h.cadastro} {h.rescisao && <span className="ml-1 rounded bg-slate-100 px-1.5 text-xs">rescisão</span>}</p>
          {h.eventos?.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Evento</th><th className="py-1 text-right">Ref.</th><th className="py-1 text-right">Proventos</th><th className="py-1 text-right">Descontos</th></tr></thead>
              <tbody>
                {h.eventos.map((e, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                    <td className="py-1">{e.codigo} {e.descricao}{e.tipo === "informativo" && <span className="text-xs text-slate-500"> (encargo, não entra no líquido)</span>}</td>
                    <td className="py-1 text-right tabular-nums">{e.referencia ? n2(e.referencia) : ""}</td>
                    <td className="py-1 text-right tabular-nums">{e.tipo === "provento" ? n2(e.valor) : ""}</td>
                    <td className="py-1 text-right tabular-nums">{e.tipo === "desconto" ? n2(e.valor) : e.tipo === "informativo" ? <span className="text-slate-400">{n2(e.valor)}</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-1 text-sm">Líquido: <b>{h.liquido === null || h.liquido === undefined ? "—" : moeda(h.liquido)}</b>{h.confere === true && <span className="text-emerald-700"> · soma confere</span>}{h.confere === false && <span className="text-amber-800"> · a soma não fecha com o líquido</span>}</p>
          <p className="text-xs text-slate-500">{h.arquivo} · importado em {h.importadoEm ? new Date(h.importadoEm).toLocaleString("pt-BR") : "—"}</p>
        </div>
      ))}
    </Modal>
  );
}
