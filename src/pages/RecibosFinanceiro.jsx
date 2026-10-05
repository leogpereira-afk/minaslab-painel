import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, Plus, Trash2, FilePlus2, Eraser, Calculator, Save, History, FileText, Copy, Search } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";
import { carregarColecoes, salvar, apagar } from "../services/dados.js";
import { filtrarPessoasPorNome } from "../lib/rhApresentacao.js";
import logoMinasLab from "../assets/logo-minaslab.webp";
import {
  EMPRESAS_RECIBO, valorPorExtenso, moeda, numeroBR, lerValor, dataExtenso, dataCurta,
  horasTexto, calcularHoraExtra, calcularDescontoDano, somarItens, periodoExtenso, competenciaDe, listaPorExtenso, identificacaoFiscal, valorDoRecibo, nomeDoRecibo,
} from "../lib/recibos.js";

const CHAVE_RASCUNHO = "financeiro.recibos.rascunho.v1";
const COLECAO_HISTORICO = "fin_recibos"; // prefixo fin_: só a direção lê e grava (regra do ml-sync)
const hoje = () => new Date().toISOString().slice(0, 10);

const MODELOS = [
  { chave: "pagamento", titulo: "Recibo de pagamento", descricao: "PJ, limpeza, coletas, remuneração com descontos e comissões." },
  { chave: "horasExtras", titulo: "Horas extras (retroativo)", descricao: "Calcula valor da hora, da hora extra e o total pago." },
  { chave: "estagio", titulo: "Recibo de estágio", descricao: "Bolsa de estágio, integral ou proporcional ao período." },
  { chave: "cliente", titulo: "Recibo de cliente", descricao: "Cartão de crédito (com taxa), PIX com quitação ou pagamento parcial por amostra." },
  { chave: "danos", titulo: "Desconto por danos materiais", descricao: "Termo de autorização de desconto em horas extras (art. 462 CLT)." },
];

const padrao = () => ({
  pagamento: { empresa: "minaslab", nome: "", cpf: "", valor: "", tipoServico: "colaborador(a) PJ", periodoInicio: "", periodoFim: "", competencia: "", referenteLivre: "", itens: [], dataPagamento: hoje(), dataRecibo: hoje(), cidade: "Montes Claros" },
  horasExtras: { empresa: "minaslab", nome: "", cpf: "", salario: "", jornada: "220", adicional: "50", periodo: "", totalRealizadas: "", horasPagas: "", horasBanco: "", percentualPago: "50", valorManual: "", dataRecibo: hoje(), cidade: "Montes Claros" },
  estagio: { empresa: "minaslab", nome: "", cpf: "", tipoBolsa: "proporcional", valor: "", inicio: "", fim: "", forma: "PIX ou transferência bancária.", dataRecibo: hoje(), cidade: "Montes Claros" },
  cliente: { empresa: "minaslab", tipo: "cartao", pagador: "", pagadorDoc: "", valorPago: "", nf: "", os: "", valorOriginal: "", forma: "PIX", servico: "", totalServicos: "", amostras: "", amostraPaga: "", outrasAmostras: "", dataPagamento: hoje(), complemento: "", dataRecibo: hoje(), cidade: "Montes Claros" },
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
  return <div className={`recibo-assinaturas${rotulos.length === 1 ? " unica" : ""}`}>{rotulos.map((r) => <div key={r}><span className="linha" /><p>{r}</p></div>)}</div>;
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

function DocCliente({ d }) {
  const emp = empresaDe(d.empresa), pago = lerValor(d.valorPago), original = lerValor(d.valorOriginal);
  const acrescimo = original > 0 ? Math.max(0, Math.round((pago - original) * 100) / 100) : 0;
  const fiscal = identificacaoFiscal(d.pagadorDoc), pagador = d.pagador.trim() || "________________";
  const quem = <><b>{pagador.toLocaleUpperCase("pt-BR")}</b>{fiscal ? `, ${fiscal}` : ""}</>;
  const os = listaPorExtenso(d.os) || "________", amostras = listaPorExtenso(d.amostras) || "________";
  const taxaTexto = acrescimo > 0 && <>, sendo que o montante final pago inclui acréscimos de <b>{moeda(acrescimo)}</b> ({valorPorExtenso(acrescimo)}), relativos às taxas de processamento da maquininha de cartão</>;
  const local = <p className="recibo-local centro">{d.cidade}, {dataExtenso(d.dataRecibo)}{d.tipo === "pix" || d.tipo === "parcial" ? "." : ""}</p>;
  if (d.tipo === "pix") return <>
    <Cabecalho titulo="RECIBO DE PAGAMENTO" />
    <p className="just"><b>A empresa {emp.nome.toLocaleUpperCase("pt-BR")} declara, para os devidos fins, que recebeu de {quem}, a importância de {moeda(pago)} ({valorPorExtenso(pago)}), paga via {d.forma.trim() || "________"}.</b></p>
    <p>Referente ao pagamento de:<br />Serviço: {d.servico.trim() || "________"}.<br />Identificação: {d.nf.trim() ? `Nota Fiscal ${d.nf.trim()}, ` : ""}Ordem de Serviço {os}.</p>
    <p className="just">Pelo presente, damos plena e geral quitação pelo valor recebido, não restando quaisquer pendências financeiras relativas a este serviço.</p>
    {local}
    <Assinaturas rotulos={["Assinatura do Responsável"]} />
  </>;
  if (d.tipo === "parcial") {
    const total = lerValor(d.totalServicos), saldo = Math.round((total - original) * 100) / 100;
    return <>
      <Cabecalho titulo="RECIBO DE PAGAMENTO" />
      <p className="just">Declaro, para os devidos fins, que o valor total dos serviços prestados pela Minaslab a {quem}, é de <b>{moeda(total)}</b> ({valorPorExtenso(total)}), referentes às análises das amostras {amostras}, todas vinculadas à Ordem de Serviço {os}.</p>
      <p className="just">Declaro, para os devidos fins, que recebemos de {pagador.toLocaleUpperCase("pt-BR")}, em {dataCurta(d.dataPagamento) || "__/__/____"}, o valor de <b>{moeda(pago)}</b> ({valorPorExtenso(pago)}), referente ao pagamento da amostra {d.amostraPaga.trim() || "________"}{d.complemento.trim() ? `, ${d.complemento.trim()},` : ""} vinculada à Ordem de Serviço {os}.</p>
      <p className="just">O valor {acrescimo > 0 ? "original " : ""}devido pela amostra é de <b>{moeda(original)}</b> ({valorPorExtenso(original)}){acrescimo > 0 ? <>, sendo que o montante final pago, de {moeda(pago)}, inclui acréscimos de <b>{moeda(acrescimo)}</b> ({valorPorExtenso(acrescimo)}), relativos às taxas de processamento da maquininha de cartão</> : null}.</p>
      {saldo > 0 && <p className="just">As demais amostras, {listaPorExtenso(d.outrasAmostras) || "________"}, totalizam o valor de <b>{moeda(saldo)}</b> ({valorPorExtenso(saldo)}), que permanece como saldo a pagar referente à mesma Ordem de Serviço {os}.</p>}
      <p className="just">Declaro, para os devidos fins, que o valor acima discriminado, referente à amostra {d.amostraPaga.trim() || "________"}, foi recebido integralmente, não havendo pendências financeiras relacionadas a esta amostra.</p>
      {local}
      <Assinaturas rotulos={["Assinatura do Responsável"]} />
    </>;
  }
  return <>
    <Cabecalho titulo="RECIBO DE PAGAMENTO" />
    <p className="just">Declaro, para os devidos fins, que recebemos de {quem}, o valor de <b>{moeda(pago)}</b> ({valorPorExtenso(pago)}), referente ao pagamento da Nota Fiscal: {d.nf.trim() || "________"} dos serviços prestados pela Minaslab, identificados pelas ordens de serviço {os}.</p>
    {acrescimo > 0 && <p className="just">O valor original da nota fiscal é de <b>{moeda(original)}</b> ({valorPorExtenso(original)}){taxaTexto}.</p>}
    <p className="just">Declaro, para os devidos fins, que o valor acima foi recebido integralmente e que não há pendências financeiras relacionadas a este serviço.</p>
    {local}
    <Assinaturas rotulos={["Assinatura do Responsável"]} />
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

export { DocPagamento, DocHorasExtras, DocEstagio, DocCliente, DocDanos, ESTILO_IMPRESSAO };
const DOCUMENTOS = { pagamento: DocPagamento, horasExtras: DocHorasExtras, estagio: DocEstagio, cliente: DocCliente, danos: DocDanos };

const ESTILO_IMPRESSAO = `
.recibo-folha{background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11.5pt;line-height:1.5;padding:18mm 22mm;box-sizing:border-box}
.recibo-folha p{margin:0 0 10pt}.recibo-folha .just{text-align:justify}
.recibo-logo{text-align:center;margin-bottom:16pt}.recibo-logo img{width:41.5mm;height:auto;display:inline-block}
.recibo-titulo{text-align:center;font-size:14pt;font-weight:700;margin:0 0 16pt}
.recibo-itens{margin:0 0 10pt;padding-left:18pt}.recibo-itens li{margin-bottom:2pt}
.recibo-local{margin-top:22pt!important}
.recibo-assinaturas{display:flex;gap:18mm;margin-top:42pt}.recibo-assinaturas>div{flex:1;text-align:center}
.recibo-assinaturas.unica{justify-content:center}.recibo-assinaturas.unica>div{flex:0 1 95mm}.recibo-local.centro{text-align:center}
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

function FormCliente({ d, set }) {
  const cartao = d.tipo === "cartao", pix = d.tipo === "pix", parcial = d.tipo === "parcial";
  const pago = lerValor(d.valorPago), original = lerValor(d.valorOriginal);
  return <div className="grid gap-3 sm:grid-cols-2">
    <Campo rotulo="Tipo de recibo" largo><select className="input w-full" value={d.tipo} onChange={(e) => set({ tipo: e.target.value })}>
      <option value="cartao">Cartão de crédito — pagamento da nota com taxa da maquininha</option>
      <option value="pix">PIX / pagamento com quitação (serviço e OS)</option>
      <option value="parcial">Pagamento parcial por amostra (com saldo a pagar)</option>
    </select></Campo>
    <SelectEmpresa valor={d.empresa} onChange={(empresa) => set({ empresa })} rotulo="Empresa que recebeu" />
    <Campo rotulo="Quem pagou (cliente)"><Entrada d={d} set={set} campo="pagador" placeholder="Nome ou razão social" /></Campo>
    <Campo rotulo="CNPJ ou CPF de quem pagou"><Entrada d={d} set={set} campo="pagadorDoc" placeholder="00.000.000/0000-00" /></Campo>
    <Campo rotulo={parcial ? "Valor recebido (R$)" : "Valor pago (R$)"}><Entrada d={d} set={set} campo="valorPago" inputMode="decimal" placeholder="0,00" /></Campo>
    {(cartao || parcial) && <Campo rotulo={parcial ? "Valor original da amostra (R$)" : "Valor original da nota (R$)"}><Entrada d={d} set={set} campo="valorOriginal" inputMode="decimal" placeholder="0,00" /></Campo>}
    {(cartao || pix) && <Campo rotulo="Nota Fiscal nº"><Entrada d={d} set={set} campo="nf" placeholder="514" /></Campo>}
    <Campo rotulo="Ordem(ns) de serviço" largo={!(cartao || pix)}><Entrada d={d} set={set} campo="os" placeholder="OS00067/2026, OS00065/2026" /></Campo>
    {pix && <>
      <Campo rotulo="Forma de pagamento"><Entrada d={d} set={set} campo="forma" placeholder="PIX" /></Campo>
      <Campo rotulo="Serviço"><Entrada d={d} set={set} campo="servico" placeholder="Análise de água" /></Campo>
    </>}
    {parcial && <>
      <Campo rotulo="Valor total dos serviços (R$)"><Entrada d={d} set={set} campo="totalServicos" inputMode="decimal" placeholder="0,00" /></Campo>
      <Campo rotulo="Data do pagamento"><Entrada d={d} set={set} campo="dataPagamento" type="date" /></Campo>
      <Campo rotulo="Todas as amostras" largo><Entrada d={d} set={set} campo="amostras" placeholder="AM00002238/2026, AM00002239/2026, AM00002240/2026" /></Campo>
      <Campo rotulo="Amostra paga"><Entrada d={d} set={set} campo="amostraPaga" placeholder="AM00002238/2026" /></Campo>
      <Campo rotulo="Complemento (opcional)"><Entrada d={d} set={set} campo="complemento" placeholder="junto à coleta" /></Campo>
      <Campo rotulo="Demais amostras (saldo a pagar)" largo><Entrada d={d} set={set} campo="outrasAmostras" placeholder="AM00002239/2026, AM00002240/2026" /></Campo>
    </>}
    <Campo rotulo="Cidade"><Entrada d={d} set={set} campo="cidade" /></Campo>
    <Campo rotulo="Data do recibo"><Entrada d={d} set={set} campo="dataRecibo" type="date" /></Campo>
    {(cartao || parcial) && original > 0 && <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm sm:col-span-2">
      Acréscimo da maquininha: <b>{moeda(Math.max(0, pago - original))}</b>{parcial && <> · saldo a pagar: <b>{moeda(Math.max(0, lerValor(d.totalServicos) - original))}</b></>}
    </div>}
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

const FORMULARIOS = { pagamento: FormPagamento, horasExtras: FormHorasExtras, estagio: FormEstagio, cliente: FormCliente, danos: FormDanos };

/* A prévia mostra a folha A4 inteira (210 mm) reduzida para caber na coluna, em vez de espremer o texto numa largura menor. */
const LARGURA_A4_PX = (210 / 25.4) * 96;
function PreviaA4({ children }) {
  const caixa = useRef(null), folha = useRef(null);
  const [escala, setEscala] = useState(1), [altura, setAltura] = useState(0);
  useEffect(() => {
    const medir = () => {
      if (caixa.current) setEscala(Math.min(1, caixa.current.clientWidth / LARGURA_A4_PX));
      if (folha.current) setAltura(folha.current.offsetHeight);
    };
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    if (caixa.current) ro.observe(caixa.current);
    if (folha.current) ro.observe(folha.current);
    return () => ro.disconnect();
  }, []);
  return <div ref={caixa} className="w-full">
    <div style={{ height: altura * escala }}>
      <div ref={folha} className="recibo-folha shadow-md" style={{ width: "210mm", transform: `scale(${escala})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  </div>;
}

/* ---------- Página ---------- */

const hashDe = (modelo, d) => JSON.stringify([modelo, d]);
const quandoBR = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");

export default function RecibosFinanceiro() {
  const [aba, setAba] = useState("novo");
  const [modelo, setModelo] = useState("pagamento");
  const [dados, setDados] = useState(lerRascunho);
  const [fila, setFila] = useState([]);
  const [imprimindo, setImprimindo] = useState("atual");
  const pendente = useRef(false);
  const [pessoas, setPessoas] = useState([]);
  const [avisoCadastro, setAvisoCadastro] = useState("");
  // Histórico: idAtual só existe quando o recibo foi ABERTO do histórico (editar o mesmo registro);
  // recibo novo sempre cria um registro novo, e a mesma impressão repetida não duplica (ultimo.hash).
  const [historico, setHistorico] = useState([]);
  const [carregandoHist, setCarregandoHist] = useState(true);
  const [avisoHist, setAvisoHist] = useState(null);
  const [idAtual, setIdAtual] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [buscaHist, setBuscaHist] = useState("");
  const [modeloHist, setModeloHist] = useState("");
  const ultimo = useRef({ hash: "", id: "" });

  const carregarHistorico = useCallback(async () => {
    setCarregandoHist(true);
    try {
      const r = await carregarColecoes([COLECAO_HISTORICO]);
      if (r._recusadas?.length) throw new Error("Sem permissão para consultar o histórico de recibos.");
      setHistorico([...(r[COLECAO_HISTORICO] || [])].sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))));
      setAvisoHist((v) => (v?.tipo === "carga" ? null : v));
    } catch (e) {
      setAvisoHist({ tipo: "carga", texto: e.message || "Não consegui consultar o histórico de recibos." });
    } finally { setCarregandoHist(false); }
  }, []);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

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
  const titulo = (m) => MODELOS.find((x) => x.chave === m)?.titulo || m;

  // Grava no histórico e CONFERE o efeito (salvar() só devolve se o servidor confirmou).
  async function gravar(m, d, { id = "", novo = false } = {}) {
    const hash = hashDe(m, d);
    if (!novo && !id && ultimo.current.hash === hash) return ultimo.current.id;
    const anterior = id ? historico.find((h) => h.id === id) : null;
    const salvo = await salvar(COLECAO_HISTORICO, {
      ...(id ? { id, criadoEm: anterior?.criadoEm } : {}),
      modelo: m, titulo: titulo(m), nome: nomeDoRecibo(d), valor: valorDoRecibo(m, d), dados: d,
    });
    ultimo.current = { hash, id: salvo.id };
    return salvo.id;
  }

  async function salvarNoHistorico({ comoNovo = false } = {}) {
    if (salvando) return null;
    setSalvando(true);
    try {
      const id = await gravar(modelo, atual, { id: comoNovo ? "" : idAtual, novo: comoNovo });
      if (comoNovo) setIdAtual("");
      setAvisoHist({ tipo: "ok", texto: "Recibo salvo no histórico." });
      carregarHistorico();
      return id;
    } catch (e) {
      setAvisoHist({ tipo: "erro", texto: `Não consegui salvar no histórico: ${e.message}` });
      return null;
    } finally { setSalvando(false); }
  }

  const impressao = useMemo(() => (imprimindo === "fila" ? fila : [{ id: "atual", modelo, dados: atual }]), [imprimindo, fila, modelo, atual]);

  // O modo de impressão só pode mudar o DOM antes do print; por isso o print espera o próximo ciclo de renderização.
  useEffect(() => {
    if (!pendente.current) return;
    pendente.current = false;
    const t = setTimeout(() => window.print(), 50);
    return () => clearTimeout(t);
  }, [imprimindo, fila]);

  async function imprimir(qual) {
    if (qual === "fila" && !fila.length) return;
    // Imprimir registra no histórico; se o registro falhar, imprime assim mesmo e avisa.
    try {
      if (qual === "fila") {
        const feitos = [];
        for (const f of fila) feitos.push(f.registroId || await gravar(f.modelo, f.dados, { novo: true }));
        setFila((l) => l.map((f, n) => ({ ...f, registroId: feitos[n] })));
      } else {
        await gravar(modelo, atual, { id: idAtual });
      }
      carregarHistorico();
    } catch (e) {
      setAvisoHist({ tipo: "erro", texto: `Imprimindo, mas não consegui registrar no histórico: ${e.message}` });
    }
    pendente.current = true;
    setImprimindo(qual);
    // Se já estava no mesmo modo o efeito não dispara; força o print direto.
    if (qual === imprimindo) { pendente.current = false; setTimeout(() => window.print(), 50); }
  }
  function adicionarNaFila() { setFila((f) => [...f, { id: `${Date.now()}-${f.length}`, modelo, dados: { ...atual, itens: atual.itens ? [...atual.itens] : undefined } }]); }
  function limpar() { if (window.confirm("Limpar os campos deste modelo?")) { setDados((v) => ({ ...v, [modelo]: padrao()[modelo] })); setIdAtual(""); } }
  function trocarModelo(m) { setModelo(m); setIdAtual(""); }

  function abrirDoHistorico(reg, { duplicar = false } = {}) {
    const m = DOCUMENTOS[reg.modelo] ? reg.modelo : "pagamento";
    const d = { ...padrao()[m], ...(reg.dados || {}) };
    setModelo(m);
    setDados((v) => ({ ...v, [m]: d }));
    setIdAtual(duplicar ? "" : reg.id);
    ultimo.current = duplicar ? { hash: "", id: "" } : { hash: hashDe(m, d), id: reg.id };
    setAba("novo");
  }
  async function excluirDoHistorico(reg) {
    if (!window.confirm(`Excluir o recibo de ${reg.nome || "sem nome"} (${titulo(reg.modelo)}) do histórico?`)) return;
    try {
      await apagar(COLECAO_HISTORICO, reg.id);
      if (idAtual === reg.id) setIdAtual("");
      if (ultimo.current.id === reg.id) ultimo.current = { hash: "", id: "" };
      setAvisoHist({ tipo: "ok", texto: "Recibo excluído do histórico." });
      carregarHistorico();
    } catch (e) { setAvisoHist({ tipo: "erro", texto: `Não consegui excluir: ${e.message}` }); }
  }

  const histFiltrado = useMemo(() => {
    const q = buscaHist.trim().toLocaleLowerCase("pt-BR");
    return historico.filter((h) => (!modeloHist || h.modelo === modeloHist)
      && (!q || `${h.nome || ""} ${h.titulo || ""} ${h.dados?.os || ""} ${h.dados?.nf || ""}`.toLocaleLowerCase("pt-BR").includes(q)));
  }, [historico, buscaHist, modeloHist]);
  const registroAberto = idAtual ? historico.find((h) => h.id === idAtual) : null;

  const aviso = avisoHist && <p role="status" className={`rounded-lg px-3 py-2 text-xs ${avisoHist.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{avisoHist.texto}</p>;

  return <div className="space-y-4">
    <style>{ESTILO_IMPRESSAO}</style>
    <PageTitle titulo="Recibos" descricao="Escolha o modelo, preencha os dados e imprima. O valor por extenso e os cálculos são automáticos; cada recibo impresso fica no histórico." />

    <div className="flex gap-1 border-b border-slate-200" role="tablist">
      {[["novo", "Novo recibo", FileText], ["historico", `Histórico${historico.length ? ` (${historico.length})` : ""}`, History]].map(([chave, rotulo, Icone]) =>
        <button key={chave} type="button" role="tab" aria-selected={aba === chave} onClick={() => setAba(chave)}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${aba === chave ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icone size={15} /> {rotulo}</button>)}
    </div>

    {aba === "historico" && <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {aviso}
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-3.5 text-slate-400" /><input className="input w-full pl-9" placeholder="Buscar por nome, OS ou NF…" value={buscaHist} onChange={(e) => setBuscaHist(e.target.value)} /></label>
        <select className="input" value={modeloHist} onChange={(e) => setModeloHist(e.target.value)} aria-label="Filtrar por modelo"><option value="">Todos os modelos</option>{MODELOS.map((m) => <option key={m.chave} value={m.chave}>{m.titulo}</option>)}</select>
      </div>
      {carregandoHist ? <p className="p-6 text-center text-sm text-slate-500">Carregando histórico…</p>
        : histFiltrado.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">{historico.length ? "Nenhum recibo com esse filtro." : "Nenhum recibo no histórico ainda. Os recibos aparecem aqui quando você imprime ou clica em “Salvar no histórico”."}</p>
        : <div className="overflow-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Data</th><th className="px-2 py-2">Modelo</th><th className="px-2 py-2">Nome</th><th className="px-2 py-2 text-right">Valor</th><th className="px-2 py-2">Gerado por</th><th className="px-2 py-2 text-right">Ações</th></tr></thead>
          <tbody>{histFiltrado.map((h) => <tr key={h.id} className="border-b last:border-0 hover:bg-slate-50">
            <td className="whitespace-nowrap px-2 py-2">{quandoBR(h.criadoEm)}</td>
            <td className="px-2 py-2">{titulo(h.modelo)}</td>
            <td className="px-2 py-2 font-semibold text-slate-900">{h.nome || "—"}</td>
            <td className="whitespace-nowrap px-2 py-2 text-right">{moeda(h.valor)}</td>
            <td className="px-2 py-2 text-slate-500">{h.atualizadoPor || "—"}</td>
            <td className="whitespace-nowrap px-2 py-2 text-right">
              <button type="button" className="btn-outline mr-1 text-xs" onClick={() => abrirDoHistorico(h)}><Printer size={14} /> Abrir / reimprimir</button>
              <button type="button" className="btn-outline mr-1 text-xs" title="Abrir como novo recibo (outra pessoa, outro mês…)" onClick={() => abrirDoHistorico(h, { duplicar: true })}><Copy size={14} /> Duplicar</button>
              <button type="button" className="btn-outline text-xs" aria-label="Excluir do histórico" onClick={() => excluirDoHistorico(h)}><Trash2 size={14} /></button>
            </td></tr>)}</tbody></table></div>}
    </section>}

    {aba === "novo" && <>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {MODELOS.map((m) => <button key={m.chave} type="button" onClick={() => trocarModelo(m.chave)} aria-pressed={modelo === m.chave}
        className={`rounded-xl border p-3 text-left transition ${modelo === m.chave ? "border-teal-600 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
        <p className="font-bold text-slate-900">{m.titulo}</p><p className="mt-0.5 text-xs text-slate-500">{m.descricao}</p>
      </button>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {avisoCadastro && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{avisoCadastro}</p>}
        {registroAberto && <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">Editando um recibo do histórico (de {quandoBR(registroAberto.criadoEm)}). Salvar ou imprimir atualiza esse registro; use “Salvar como novo” para manter o original.</p>}
        {aviso && <div className="mb-3">{aviso}</div>}
        <Form d={atual} set={set} pessoas={pessoas} escolher={escolher} />
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
          <button type="button" className="btn-primary" onClick={() => imprimir("atual")}><Printer size={16} /> Imprimir este recibo</button>
          <button type="button" className="btn-outline" disabled={salvando} onClick={() => salvarNoHistorico()}><Save size={16} /> {salvando ? "Salvando…" : "Salvar no histórico"}</button>
          {idAtual && <button type="button" className="btn-outline" disabled={salvando} onClick={() => salvarNoHistorico({ comoNovo: true })}><Copy size={16} /> Salvar como novo</button>}
          <button type="button" className="btn-outline" onClick={adicionarNaFila}><FilePlus2 size={16} /> Adicionar à fila</button>
          <button type="button" className="btn-outline" onClick={limpar}><Eraser size={16} /> Limpar</button>
        </div>
        {fila.length > 0 && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Fila de impressão ({fila.length})</p><button type="button" className="btn-primary text-sm" onClick={() => imprimir("fila")}><Printer size={15} /> Imprimir fila</button></div>
          <ul className="space-y-1 text-sm">{fila.map((f) => <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5"><span>{titulo(f.modelo)} — <b>{nomeDoRecibo(f.dados) || "sem nome"}</b></span><button type="button" aria-label="Remover da fila" className="text-slate-400 hover:text-red-600" onClick={() => setFila((l) => l.filter((x) => x.id !== f.id))}><Trash2 size={15} /></button></li>)}</ul>
          <p className="mt-2 text-xs text-slate-500">Cada recibo sai em uma página e é registrado no histórico.</p>
        </div>}
      </section>

      <section className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pré-visualização</p>
        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
          <PreviaA4><Doc d={atual} /></PreviaA4>
        </div>
      </section>
    </div>
    </>}

    <div className="recibos-impressao" aria-hidden="true">
      {impressao.map((i) => { const D = DOCUMENTOS[i.modelo]; return <div key={i.id} className="recibo-folha"><D d={i.dados} /></div>; })}
    </div>
  </div>;
}
