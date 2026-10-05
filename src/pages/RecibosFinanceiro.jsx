import { useEffect, useMemo, useRef, useState } from "react";
import { Printer, Plus, Trash2, FilePlus2, Eraser, Calculator } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";
import { carregarColecoes } from "../services/dados.js";
import { filtrarPessoasPorNome } from "../lib/rhApresentacao.js";
import logoMinasLab from "../assets/logo-minaslab.webp";
import {
  EMPRESAS_RECIBO, valorPorExtenso, moeda, numeroBR, lerValor, dataExtenso, dataCurta,
  horasTexto, calcularHoraExtra, calcularDescontoDano, somarItens, periodoExtenso, competenciaDe,
} from "../lib/recibos.js";

const CHAVE_RASCUNHO = "financeiro.recibos.rascunho.v1";
const hoje = () => new Date().toISOString().slice(0, 10);

const MODELOS = [
  { chave: "pagamento", titulo: "Recibo de pagamento", descricao: "PJ, limpeza, coletas, remuneração com descontos e comissões." },
  { chave: "horasExtras", titulo: "Horas extras (retroativo)", descricao: "Calcula valor da hora, da hora extra e o total pago." },
  { chave: "estagio", titulo: "Recibo de estágio", descricao: "Bolsa de estágio, integral ou proporcional ao período." },
  { chave: "danos", titulo: "Desconto por danos materiais", descricao: "Termo de autorização de desconto em horas extras (art. 462 CLT)." },
];

const padrao = () => ({
  pagamento: { empresa: "minaslab", nome: "", cpf: "", valor: "", tipoServico: "colaborador(a) PJ", periodoInicio: "", periodoFim: "", competencia: "", referenteLivre: "", itens: [], dataPagamento: hoje(), dataRecibo: hoje(), cidade: "Montes Claros" },
  horasExtras: { empresa: "minaslab", nome: "", cpf: "", salario: "", jornada: "220", adicional: "50", periodo: "", totalRealizadas: "", horasPagas: "", horasBanco: "", percentualPago: "50", valorManual: "", dataRecibo: hoje(), cidade: "Montes Claros" },
  estagio: { empresa: "minaslab", nome: "", cpf: "", tipoBolsa: "proporcional", valor: "", inicio: "", fim: "", forma: "PIX ou transferência bancária.", dataRecibo: hoje(), cidade: "Montes Claros" },
  danos: { empresa: "mlab", nome: "", cpf: "", cargo: "", descricao: "", valorItem: "", frete: "", salario: "", jornada: "220", adicional: "50", forma: "Compensação total via horas extras", dataRecibo: hoje(), cidade: "Montes Claros – MG" },
});

function lerRascunho() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || "null");
    const base = padrao();
    if (!salvo || typeof salvo !== "object") return base;
    return Object.fromEntries(Object.keys(base).map((k) => [k, { ...base[k], ...(salvo[k] || {}) }]));
  } catch { return padrao(); }
}

const empresaDe = (chave) => EMPRESAS_RECIBO.find((e) => e.chave === chave) || EMPRESAS_RECIBO[0];

function Campo({ rotulo, children, largo }) {
  return <label className={`block text-sm ${largo ? "sm:col-span-2" : ""}`}><span className="mb-1 block font-semibold text-slate-700">{rotulo}</span>{children}</label>;
}

/* ---------- Documentos (o que vai para o papel) ---------- */

function Cabecalho({ titulo }) {
  return <>
    <header className="recibo-logo"><img src={logoMinasLab} alt="MinasLab" /></header>
    <h1 className="recibo-titulo">{titulo}</h1>
  </>;
}

function Assinaturas({ rotulos }) {
  return <div className="recibo-assinaturas">{rotulos.map((r) => <div key={r}><span className="linha" /><p>{r}</p></div>)}</div>;
}

function DocPagamento({ d }) {
  const emp = empresaDe(d.empresa), valor = lerValor(d.valor);
  const periodo = periodoExtenso(d.periodoInicio, d.periodoFim), competencia = d.competencia.trim() || competenciaDe(d.periodoFim);
  const livre = d.referenteLivre.trim();
  const referente = livre ? `Referente ${livre}${/[.:]$/.test(livre) ? "" : "."}` : `Referente aos serviços prestados como ${d.tipoServico.trim() || "________"} no período de ${periodo || "________"}.`;
  return <>
    <Cabecalho titulo="RECIBO DE PAGAMENTO" />
    <p className="just">Eu, <b>{d.nome || "________________"}</b>, inscrito no CPF nº {d.cpf || "________________"}, declaro que recebi de {emp.nome}, inscrito no CPF/CNPJ nº {emp.cnpj}, a quantia de <b>{moeda(valor)}</b> ({valorPorExtenso(valor)}). {referente}</p>
    {d.itens.length > 0 && <ul className="recibo-itens">{d.itens.map((i, n) => <li key={n}>{i.descricao || "Item"}{i.tipo === "desconto" ? " – desconto" : ""} – {moeda(lerValor(i.valor))}</li>)}</ul>}
    <p className="just">O pagamento foi realizado no dia {dataExtenso(d.dataPagamento) || "________"}, referente aos serviços prestados no período de {competencia || "________"}.</p>
    <p className="just">Declaro, para os devidos fins, que o valor acima foi recebido integralmente e que não há pendências financeiras relacionadas a este serviço.</p>
    <p className="recibo-local">{d.cidade}, {dataExtenso(d.dataRecibo)}</p>
    <Assinaturas rotulos={["Assinatura do Funcionário", "Assinatura do Responsável"]} />
  </>;
}

function DocHorasExtras({ d }) {
  const emp = empresaDe(d.empresa), c = calcularHoraExtra(d), total = d.valorManual !== "" ? lerValor(d.valorManual) : c.total;
  return <>
    <Cabecalho titulo="RECIBO DE PAGAMENTO DE HORAS EXTRAS – RETROATIVO" />
    <p className="just">Eu, <b>{d.nome || "________________"}</b>, inscrito no CPF nº {d.cpf || "________________"}, declaro que recebi de {emp.nome}, inscrito no CPF/CNPJ nº {emp.cnpj}, o valor total de <b>{moeda(total)}</b> ({valorPorExtenso(total)}), referente ao pagamento de {d.percentualPago}% das horas extras realizadas no período:</p>
    <p><b>Período das horas extras:</b> {d.periodo || "________"}<br /><b>Total de horas extras realizadas:</b> {horasTexto(d.totalRealizadas) || "—"}<br /><b>Horas pagas ({d.percentualPago}%):</b> {horasTexto(d.horasPagas) || "—"}<br /><b>Horas lançadas no banco ({100 - Number(d.percentualPago || 0)}%):</b> {horasTexto(d.horasBanco) || "—"}</p>
    <p><b>Cálculo</b></p>
    <ul className="recibo-itens">
      <li>Salário base: {moeda(lerValor(d.salario))}</li>
      <li>Valor da hora normal: {moeda(c.horaNormal)}</li>
      <li>Adicional: {d.adicional}%</li>
      <li>Valor da hora extra: {moeda(c.horaExtra)}</li>
      <li>Total de horas pagas: {c.horas.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} h</li>
      <li><b>Total pago neste recibo: {moeda(total)}</b></li>
    </ul>
    <p className="just">Declaro que recebi integralmente o valor acima referente às horas extras acumuladas no período informado.</p>
    <p className="recibo-local">{d.cidade}, {dataExtenso(d.dataRecibo)}</p>
    <Assinaturas rotulos={["Assinatura do colaborador"]} />
  </>;
}

function DocEstagio({ d }) {
  const emp = empresaDe(d.empresa), valor = lerValor(d.valor), prop = d.tipoBolsa === "proporcional";
  const periodo = d.inicio && d.fim ? `${dataCurta(d.inicio)} a ${dataCurta(d.fim)}` : "________ a ________";
  return <>
    <Cabecalho titulo="RECIBO DE PAGAMENTO DE ESTÁGIO" />
    <p className="just">Eu, <b>{d.nome || "________________"}</b>, inscrito no CPF nº {d.cpf || "________________"}, declaro que recebi de {emp.nome}, inscrito no CNPJ nº {emp.cnpj}, a quantia de <b>{moeda(valor)}</b> ({valorPorExtenso(valor)}), referente à bolsa de estágio{prop ? " proporcional ao" : " do"} período de {periodo}.</p>
    <p><b>Discriminação:</b><br />Bolsa {prop ? "proporcional" : "integral"}: {moeda(valor)}</p>
    <p><b>Total: {moeda(valor)}</b></p>
    <p><b>Forma de pagamento: {d.forma}</b></p>
    <p className="recibo-local">{d.cidade}, {dataExtenso(d.dataRecibo)}.</p>
    <Assinaturas rotulos={["Assinatura do Estagiário", "Assinatura do Responsável"]} />
  </>;
}

function DocDanos({ d }) {
  const emp = empresaDe(d.empresa), c = calcularDescontoDano(d), salario = lerValor(d.salario);
  return <>
    <Cabecalho titulo="TERMO DE AUTORIZAÇÃO DE DESCONTO POR DANOS MATERIAIS" />
    <p><b>Colaborador:</b> {d.nome || "________________"}<br /><b>CPF:</b> {d.cpf || "________________"}<br /><b>Cargo:</b> {d.cargo || "________________"}<br /><b>Empresa:</b> {emp.nome} – CNPJ {emp.cnpj}</p>
    <p className="just">Eu, <b>{d.nome || "________________"}</b>, acima identificado(a), declaro para os devidos fins que reconheço ter causado danos materiais a bens pertencentes ao laboratório, conforme descrição abaixo:</p>
    <p><b>Descrição dos itens danificados:</b><br />{d.descricao || "________________"}</p>
    <p><b>Valor do item:</b> {moeda(lerValor(d.valorItem))}<br /><b>Valor do frete:</b> {moeda(lerValor(d.frete))}<br /><b>Valor total do prejuízo: {moeda(c.total)}</b></p>
    <p><b>DETALHAMENTO DO CÁLCULO DO DESCONTO</b></p>
    <ol className="recibo-itens">
      <li>Salário mensal: {moeda(salario)}</li>
      <li>Jornada mensal considerada: {d.jornada} horas</li>
      <li>Valor da hora trabalhada: {moeda(salario)} ÷ {d.jornada} = {moeda(c.horaNormal)}</li>
      <li>Valor da hora extra ({d.adicional}%): {moeda(c.horaNormal)} × {(1 + Number(d.adicional || 0) / 100).toLocaleString("pt-BR")} = {moeda(c.horaExtra)}</li>
      <li>Horas necessárias para quitar o valor total do dano: {moeda(c.total)} ÷ {moeda(c.horaExtra)} = {numeroBR(c.horas)} horas</li>
    </ol>
    <p><b>Total necessário: {c.hms} (horas:minutos:segundos)</b></p>
    <p className="just">Com base no artigo 462, §1º da CLT, autorizo expressamente que o valor acima seja descontado das minhas horas extras, de forma integral ou parcelada, conforme acordado com o setor de Recursos Humanos.</p>
    <p>Declaro ainda que:</p>
    <ul className="recibo-itens">
      <li>Fui informado(a) sobre o valor do dano e concordo com o desconto.</li>
      <li>Estou ciente de que esta autorização é voluntária e necessária para que o desconto seja realizado de forma legal.</li>
      <li>Recebi explicações sobre o cálculo e a forma de compensação.</li>
    </ul>
    <p><b>Forma de desconto:</b> {d.forma}</p>
    <p><b>Data:</b> {dataExtenso(d.dataRecibo)}<br /><b>Local:</b> {d.cidade}</p>
    <Assinaturas rotulos={["Assinatura do colaborador", "Assinatura da empresa"]} />
  </>;
}

const DOCUMENTOS = { pagamento: DocPagamento, horasExtras: DocHorasExtras, estagio: DocEstagio, danos: DocDanos };

const ESTILO_IMPRESSAO = `
.recibo-folha{background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11.5pt;line-height:1.5;padding:18mm 22mm;box-sizing:border-box}
.recibo-folha p{margin:0 0 10pt}.recibo-folha .just{text-align:justify}
.recibo-logo{text-align:center;margin-bottom:12pt}.recibo-logo img{height:11mm;width:auto;display:inline-block}
.recibo-titulo{text-align:center;font-size:14pt;font-weight:700;margin:0 0 16pt}
.recibo-itens{margin:0 0 10pt;padding-left:18pt}.recibo-itens li{margin-bottom:2pt}
.recibo-local{margin-top:22pt!important}
.recibo-assinaturas{display:flex;gap:18mm;margin-top:42pt}.recibo-assinaturas>div{flex:1;text-align:center}
.recibo-assinaturas .linha{display:block;border-top:1px solid #111;margin-bottom:4pt}.recibo-assinaturas p{margin:0;font-weight:700;font-size:10.5pt}
.recibos-impressao{display:none}
@media print{
 @page{size:A4 portrait;margin:0}
 body *{visibility:hidden!important}
 .recibos-impressao,.recibos-impressao *{visibility:visible!important}
 .recibos-impressao{display:block!important;position:absolute;left:0;top:0;width:100%}
 .recibos-impressao .recibo-folha{page-break-after:always;break-after:page;min-height:297mm}
 .recibos-impressao .recibo-folha:last-child{page-break-after:auto;break-after:auto}
}`;

/* ---------- Formulários por modelo ---------- */

function SelectEmpresa({ valor, onChange, rotulo = "Empresa pagadora" }) {
  return <Campo rotulo={rotulo}><select className="input w-full" value={valor} onChange={(e) => onChange(e.target.value)}>{EMPRESAS_RECIBO.map((e) => <option key={e.chave} value={e.chave}>{e.nome} — {e.cnpj}</option>)}</select></Campo>;
}

function Entrada({ d, set, campo, ...resto }) {
  return <input className="input w-full" value={d[campo]} onChange={(e) => set({ [campo]: e.target.value })} {...resto} />;
}

/* Nome com busca no cadastro do RH: ao escolher a pessoa, os dados dela entram no recibo (e continuam editáveis). */
function CampoNome({ rotulo, d, set, pessoas, aoEscolher, placeholder = "Digite para buscar no cadastro" }) {
  const [aberto, setAberto] = useState(false);
  const termo = String(d.nome || "").trim();
  const achadas = useMemo(
    () => (aberto && termo.length >= 2 ? filtrarPessoasPorNome(pessoas, termo).slice(0, 8) : []),
    [aberto, termo, pessoas],
  );
  return <label className="relative block text-sm">
    <span className="mb-1 block font-semibold text-slate-700">{rotulo}</span>
    <input className="input w-full" value={d.nome} placeholder={placeholder} autoComplete="off"
      onChange={(e) => { set({ nome: e.target.value }); setAberto(true); }}
      onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)} />
    {achadas.length > 0 && <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
      {achadas.map((pe) => <li key={pe.id}>
        <button type="button" className="block w-full px-3 py-2 text-left hover:bg-teal-50" onMouseDown={(e) => { e.preventDefault(); aoEscolher(pe); setAberto(false); }}>
          <span className="font-semibold text-slate-900">{pe.nome}</span>
          <span className="ml-2 text-xs text-slate-500">{[pe.cargo, pe.cpf, pe.ativo === false ? "desligado" : ""].filter(Boolean).join(" · ")}</span>
        </button>
      </li>)}
    </ul>}
  </label>;
}

function FormPagamento({ d, set, pessoas, escolher }) {
  const mexerItem = (n, patch) => set({ itens: d.itens.map((i, k) => (k === n ? { ...i, ...patch } : i)) });
  return <div className="grid gap-3 sm:grid-cols-2">
    <SelectEmpresa valor={d.empresa} onChange={(empresa) => set({ empresa })} />
    <CampoNome rotulo="Nome de quem recebeu" d={d} set={set} pessoas={pessoas} aoEscolher={escolher} />
    <Campo rotulo="CPF"><Entrada d={d} set={set} campo="cpf" placeholder="000.000.000-00" /></Campo>
    <Campo rotulo="Valor total (R$)"><div className="flex gap-2"><Entrada d={d} set={set} campo="valor" inputMode="decimal" placeholder="0,00" />{d.itens.length > 0 && <button type="button" className="btn-outline whitespace-nowrap" title="Preencher com a soma dos itens" onClick={() => set({ valor: numeroBR(somarItens(d.itens)) })}><Calculator size={15} /> Somar itens</button>}</div></Campo>
    <Campo rotulo="Tipo de serviço"><Entrada d={d} set={set} campo="tipoServico" placeholder="colaborador(a) PJ, coletor, limpeza…" /></Campo>
    <Campo rotulo="Data do pagamento"><Entrada d={d} set={set} campo="dataPagamento" type="date" /></Campo>
    <Campo rotulo="Período — início"><Entrada d={d} set={set} campo="periodoInicio" type="date" /></Campo>
    <Campo rotulo="Período — fim"><Entrada d={d} set={set} campo="periodoFim" type="date" /></Campo>
    <Campo rotulo="Competência (opcional — por padrão, mês do fim do período)" largo><Entrada d={d} set={set} campo="competencia" placeholder={competenciaDe(d.periodoFim) || "agosto de 2026"} /></Campo>
    <Campo rotulo="Texto livre após “Referente” (opcional — substitui tipo de serviço e período)" largo><textarea className="input w-full" rows={2} placeholder="Ex.: às coletas:" value={d.referenteLivre} onChange={(e) => set({ referenteLivre: e.target.value })} /></Campo>
    <Campo rotulo="Cidade"><Entrada d={d} set={set} campo="cidade" /></Campo>
    <Campo rotulo="Data do recibo"><Entrada d={d} set={set} campo="dataRecibo" type="date" /></Campo>
    <div className="sm:col-span-2">
      <div className="mb-1 flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">Discriminação (opcional)</span><button type="button" className="btn-outline text-xs" onClick={() => set({ itens: [...d.itens, { descricao: "", valor: "", tipo: "credito" }] })}><Plus size={14} /> Adicionar linha</button></div>
      {d.itens.map((i, n) => <div key={n} className="mb-2 grid grid-cols-[1fr_110px_110px_auto] gap-2">
        <input className="input" placeholder="Ex.: Remuneração, Desconto INSS, Comissão…" value={i.descricao} onChange={(e) => mexerItem(n, { descricao: e.target.value })} />
        <input className="input" inputMode="decimal" placeholder="0,00" value={i.valor} onChange={(e) => mexerItem(n, { valor: e.target.value })} />
        <select className="input" value={i.tipo} onChange={(e) => mexerItem(n, { tipo: e.target.value })}><option value="credito">Crédito</option><option value="desconto">Desconto</option></select>
        <button type="button" className="btn-outline" aria-label="Remover linha" onClick={() => set({ itens: d.itens.filter((_, k) => k !== n) })}><Trash2 size={15} /></button>
      </div>)}
    </div>
  </div>;
}

function FormHorasExtras({ d, set, pessoas, escolher }) {
  const c = calcularHoraExtra(d);
  return <div className="grid gap-3 sm:grid-cols-2">
    <SelectEmpresa valor={d.empresa} onChange={(empresa) => set({ empresa })} />
    <CampoNome rotulo="Nome do colaborador" d={d} set={set} pessoas={pessoas} aoEscolher={escolher} />
    <Campo rotulo="CPF"><Entrada d={d} set={set} campo="cpf" placeholder="000.000.000-00" /></Campo>
    <Campo rotulo="Salário base (R$)"><Entrada d={d} set={set} campo="salario" inputMode="decimal" placeholder="0,00" /></Campo>
    <Campo rotulo="Jornada mensal (horas)"><Entrada d={d} set={set} campo="jornada" inputMode="numeric" /></Campo>
    <Campo rotulo="Adicional de hora extra (%)"><Entrada d={d} set={set} campo="adicional" inputMode="numeric" /></Campo>
    <Campo rotulo="Período das horas extras" largo><Entrada d={d} set={set} campo="periodo" placeholder="Janeiro/2026 a Maio/2026" /></Campo>
    <Campo rotulo="Total realizado (hh:mm)"><Entrada d={d} set={set} campo="totalRealizadas" placeholder="51:40" /></Campo>
    <Campo rotulo="Horas pagas (hh:mm)"><Entrada d={d} set={set} campo="horasPagas" placeholder="25:50" /></Campo>
    <Campo rotulo="Lançadas no banco de horas (hh:mm)"><Entrada d={d} set={set} campo="horasBanco" placeholder="25:50" /></Campo>
    <Campo rotulo="Parte paga neste recibo (%)"><Entrada d={d} set={set} campo="percentualPago" inputMode="numeric" /></Campo>
    <Campo rotulo="Cidade"><Entrada d={d} set={set} campo="cidade" /></Campo>
    <Campo rotulo="Data do recibo"><Entrada d={d} set={set} campo="dataRecibo" type="date" /></Campo>
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm sm:col-span-2">
      <p>Hora normal <b>{moeda(c.horaNormal)}</b> · hora extra <b>{moeda(c.horaExtra)}</b> · {numeroBR(c.horas)} h pagas · total calculado <b>{moeda(c.total)}</b></p>
      <label className="mt-2 block"><span className="mr-2 text-xs font-semibold text-slate-600">Ajustar valor total manualmente (opcional)</span><input className="input w-40" inputMode="decimal" placeholder={numeroBR(c.total)} value={d.valorManual} onChange={(e) => set({ valorManual: e.target.value })} /></label>
    </div>
  </div>;
}

function FormEstagio({ d, set, pessoas, escolher }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <SelectEmpresa valor={d.empresa} onChange={(empresa) => set({ empresa })} />
    <CampoNome rotulo="Nome do estagiário" d={d} set={set} pessoas={pessoas} aoEscolher={escolher} />
    <Campo rotulo="CPF"><Entrada d={d} set={set} campo="cpf" placeholder="000.000.000-00" /></Campo>
    <Campo rotulo="Bolsa"><select className="input w-full" value={d.tipoBolsa} onChange={(e) => set({ tipoBolsa: e.target.value })}><option value="proporcional">Proporcional ao período</option><option value="integral">Integral</option></select></Campo>
    <Campo rotulo="Valor (R$)"><Entrada d={d} set={set} campo="valor" inputMode="decimal" placeholder="0,00" /></Campo>
    <Campo rotulo="Forma de pagamento"><Entrada d={d} set={set} campo="forma" /></Campo>
    <Campo rotulo="Início do período"><Entrada d={d} set={set} campo="inicio" type="date" /></Campo>
    <Campo rotulo="Fim do período"><Entrada d={d} set={set} campo="fim" type="date" /></Campo>
    <Campo rotulo="Cidade"><Entrada d={d} set={set} campo="cidade" /></Campo>
    <Campo rotulo="Data do recibo"><Entrada d={d} set={set} campo="dataRecibo" type="date" /></Campo>
  </div>;
}

function FormDanos({ d, set, pessoas, escolher }) {
  const c = calcularDescontoDano(d);
  return <div className="grid gap-3 sm:grid-cols-2">
    <SelectEmpresa valor={d.empresa} onChange={(empresa) => set({ empresa })} rotulo="Empresa" />
    <CampoNome rotulo="Nome do colaborador" d={d} set={set} pessoas={pessoas} aoEscolher={escolher} />
    <Campo rotulo="CPF"><Entrada d={d} set={set} campo="cpf" placeholder="000.000.000-00" /></Campo>
    <Campo rotulo="Cargo"><Entrada d={d} set={set} campo="cargo" placeholder="Analista de laboratório II" /></Campo>
    <Campo rotulo="Descrição do item danificado" largo><textarea className="input w-full" rows={2} value={d.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Campo>
    <Campo rotulo="Valor do item (R$)"><Entrada d={d} set={set} campo="valorItem" inputMode="decimal" placeholder="0,00" /></Campo>
    <Campo rotulo="Valor do frete (R$)"><Entrada d={d} set={set} campo="frete" inputMode="decimal" placeholder="0,00" /></Campo>
    <Campo rotulo="Salário mensal (R$)"><Entrada d={d} set={set} campo="salario" inputMode="decimal" placeholder="0,00" /></Campo>
    <Campo rotulo="Jornada mensal (horas)"><Entrada d={d} set={set} campo="jornada" inputMode="numeric" /></Campo>
    <Campo rotulo="Adicional de hora extra (%)"><Entrada d={d} set={set} campo="adicional" inputMode="numeric" /></Campo>
    <Campo rotulo="Forma de desconto"><Entrada d={d} set={set} campo="forma" /></Campo>
    <Campo rotulo="Cidade / UF"><Entrada d={d} set={set} campo="cidade" /></Campo>
    <Campo rotulo="Data"><Entrada d={d} set={set} campo="dataRecibo" type="date" /></Campo>
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm sm:col-span-2">
      Prejuízo total <b>{moeda(c.total)}</b> · hora extra <b>{moeda(c.horaExtra)}</b> · necessário <b>{c.hms}</b> de horas extras
    </div>
  </div>;
}

const FORMULARIOS = { pagamento: FormPagamento, horasExtras: FormHorasExtras, estagio: FormEstagio, danos: FormDanos };

/* ---------- Página ---------- */

export default function RecibosFinanceiro() {
  const [modelo, setModelo] = useState("pagamento");
  const [dados, setDados] = useState(lerRascunho);
  const [fila, setFila] = useState([]);
  const [imprimindo, setImprimindo] = useState("atual");
  const pendente = useRef(false);
  const [pessoas, setPessoas] = useState([]);
  const [avisoCadastro, setAvisoCadastro] = useState("");

  useEffect(() => {
    let vivo = true;
    carregarColecoes(["rh_pessoas"])
      .then((r) => {
        if (!vivo) return;
        if (r._recusadas?.length) { setAvisoCadastro("Não consegui consultar o cadastro de pessoas; digite os dados manualmente."); return; }
        // Ativos primeiro; desligados continuam na busca (recibo retroativo é comum).
        setPessoas([...(r.rh_pessoas || [])].sort((a, b) => (b.ativo !== false) - (a.ativo !== false) || String(a.nome).localeCompare(String(b.nome), "pt-BR")));
      })
      .catch(() => { if (vivo) setAvisoCadastro("Não consegui consultar o cadastro de pessoas; digite os dados manualmente."); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados)); } catch { /* rascunho é só conveniência */ }
  }, [dados]);

  const Form = FORMULARIOS[modelo], Doc = DOCUMENTOS[modelo], atual = dados[modelo];
  const escolher = (pe) => {
    const salario = pe.salario === "" || pe.salario == null || Number(pe.salario) === 0 ? "" : numeroBR(pe.salario);
    const base = { nome: String(pe.nome || ""), cpf: String(pe.cpf || "") };
    const porModelo = {
      pagamento: pe.cargo ? { tipoServico: String(pe.cargo).toLocaleLowerCase("pt-BR") } : {},
      horasExtras: salario ? { salario } : {},
      estagio: salario ? { valor: salario } : {},
      danos: { ...(pe.cargo ? { cargo: String(pe.cargo) } : {}), ...(salario ? { salario } : {}) },
    };
    setDados((v) => ({ ...v, [modelo]: { ...v[modelo], ...base, ...porModelo[modelo] } }));
  };
  const set = (patch) => setDados((v) => ({ ...v, [modelo]: { ...v[modelo], ...patch } }));
  const titulo = (m) => MODELOS.find((x) => x.chave === m)?.titulo;

  const impressao = useMemo(() => (imprimindo === "fila" ? fila : [{ id: "atual", modelo, dados: atual }]), [imprimindo, fila, modelo, atual]);

  // O modo de impressão só pode mudar o DOM antes do print; por isso o print espera o próximo ciclo de renderização.
  useEffect(() => {
    if (!pendente.current) return;
    pendente.current = false;
    const t = setTimeout(() => window.print(), 50);
    return () => clearTimeout(t);
  }, [imprimindo, fila]);

  function imprimir(qual) {
    if (qual === "fila" && !fila.length) return;
    pendente.current = true;
    setImprimindo(qual);
    // Se já estava no mesmo modo o efeito não dispara; força o print direto.
    if (qual === imprimindo) { pendente.current = false; setTimeout(() => window.print(), 50); }
  }
  function adicionarNaFila() { setFila((f) => [...f, { id: `${Date.now()}-${f.length}`, modelo, dados: { ...atual, itens: atual.itens ? [...atual.itens] : undefined } }]); }
  function limpar() { if (window.confirm("Limpar os campos deste modelo?")) setDados((v) => ({ ...v, [modelo]: padrao()[modelo] })); }

  return <div className="space-y-4">
    <style>{ESTILO_IMPRESSAO}</style>
    <PageTitle titulo="Recibos" descricao="Escolha o modelo, preencha os dados e imprima. O valor por extenso e os cálculos são automáticos." />

    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {MODELOS.map((m) => <button key={m.chave} type="button" onClick={() => setModelo(m.chave)} aria-pressed={modelo === m.chave}
        className={`rounded-xl border p-3 text-left transition ${modelo === m.chave ? "border-teal-600 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
        <p className="font-bold text-slate-900">{m.titulo}</p><p className="mt-0.5 text-xs text-slate-500">{m.descricao}</p>
      </button>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {avisoCadastro && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{avisoCadastro}</p>}
        <Form d={atual} set={set} pessoas={pessoas} escolher={escolher} />
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
          <button type="button" className="btn-primary" onClick={() => imprimir("atual")}><Printer size={16} /> Imprimir este recibo</button>
          <button type="button" className="btn-outline" onClick={adicionarNaFila}><FilePlus2 size={16} /> Adicionar à fila</button>
          <button type="button" className="btn-outline" onClick={limpar}><Eraser size={16} /> Limpar</button>
        </div>
        {fila.length > 0 && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Fila de impressão ({fila.length})</p><button type="button" className="btn-primary text-sm" onClick={() => imprimir("fila")}><Printer size={15} /> Imprimir fila</button></div>
          <ul className="space-y-1 text-sm">{fila.map((f) => <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5"><span>{titulo(f.modelo)} — <b>{f.dados.nome || "sem nome"}</b></span><button type="button" aria-label="Remover da fila" className="text-slate-400 hover:text-red-600" onClick={() => setFila((l) => l.filter((x) => x.id !== f.id))}><Trash2 size={15} /></button></li>)}</ul>
          <p className="mt-2 text-xs text-slate-500">Cada recibo sai em uma página.</p>
        </div>}
      </section>

      <section className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pré-visualização</p>
        <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-3">
          <div className="recibo-folha mx-auto max-w-[210mm] shadow-md"><Doc d={atual} /></div>
        </div>
      </section>
    </div>

    <div className="recibos-impressao" aria-hidden="true">
      {impressao.map((i) => { const D = DOCUMENTOS[i.modelo]; return <div key={i.id} className="recibo-folha"><D d={i.dados} /></div>; })}
    </div>
  </div>;
}
