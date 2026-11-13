// Qualidade › Manuseio de itens de ensaio (ISO/IEC 17025 · 7.4; PT 009 e PT 010).
// Desvio no recebimento (7.4.3): item fora das condições especificadas → consulta ao cliente antes de seguir,
// decisão registrada e, se o ensaio seguir assim mesmo, a ressalva que vai no relatório. Imprime o FM-LAB-117.
import { useState } from "react";
import { Plus, Printer } from "lucide-react";
import { salvarDesvio } from "../../../services/qualidade.js";
import { abrirImpressao, dadosDoFormulario, dataBr, esc, texto } from "../../../lib/impressao/formularioQualidade.js";
import { StatCard, Modal } from "../../ui.jsx";
import { Anexos, Cabecalho, Campo, Pill, SelectPessoa, fmtData, hojeYmd, nomeDe } from "./comum.jsx";

export const FORM_DESVIO = { codigo: "FM-LAB-117", titulo: "Registro de Desvio no Recebimento de Amostras", revisao: "00", emissao: null, extra: "Documento de origem: PT 009" };
const TIPOS = [["TEMPERATURA", "Temperatura"], ["INTEGRIDADE", "Integridade / embalagem"], ["VOLUME", "Volume ou quantidade insuficiente"], ["PRAZO", "Prazo de validade da amostra excedido"], ["IDENTIFICACAO", "Identificação"], ["PRESERVACAO", "Preservação"], ["FRASCO", "Frasco inadequado"], ["OUTRO", "Outro"]];
const DECISOES = [["AGUARDANDO", "Aguardando o cliente"], ["PROSSEGUIR_COM_RESSALVA", "Prosseguir com ressalva no relatório"], ["NOVA_AMOSTRA", "Nova amostra / nova coleta"], ["CANCELAR", "Cancelar o ensaio"]];
const rot = (l, v) => l.find((x) => x[0] === v)?.[1] || v || "";

export function corpoDesvio(d, { nome = (u) => u } = {}) {
  const linha = (a, va, b, vb) => `<tr><td class="rot">${a}</td><td>${va || ""}</td><td class="rot">${b}</td><td>${vb || ""}</td></tr>`;
  return `<table style="margin-top:6px"><colgroup><col style="width:22%"><col style="width:28%"><col style="width:22%"><col></colgroup>
${linha("Nº do registro:", esc(d.codigo), "Data:", esc(dataBr(d.data)))}
${linha("OS / amostra:", esc(d.os_referencia), "Cliente:", esc(d.cliente_nome))}
${linha("Matriz:", esc(d.matriz), "Responsável:", esc(d.responsavel ? nome(d.responsavel) : ""))}
<tr><td class="rot">Tipo de desvio:</td><td colspan="3">${TIPOS.map(([v, l]) => `${(d.tipos || []).includes(v) ? "[X]" : "[ &nbsp;]"} ${esc(l)}`).join(" &nbsp; ")}</td></tr>
${linha("Condição encontrada:", esc(d.condicao_encontrada), "Condição especificada:", esc(d.condicao_especificada))}
<tr><td colspan="4" class="sec">Descrição do desvio</td></tr><tr><td colspan="4" class="caixa">${texto(d.descricao) || "&nbsp;"}</td></tr>
<tr><td colspan="4" class="sec">Consulta ao cliente (ISO/IEC 17025 · 7.4.3)</td></tr>
${linha("Consultado em:", esc(dataBr(d.cliente_consultado_em)), "Meio:", esc(d.consulta_meio))}
${linha("Quem foi consultado:", esc(d.consulta_com), "Decisão do cliente:", `<b>${esc(rot(DECISOES, d.decisao))}</b>`)}
<tr><td colspan="4" class="sec">Ressalva no relatório de ensaio</td></tr><tr><td colspan="4" class="caixa">${texto(d.ressalva) || (d.decisao && d.decisao !== "PROSSEGUIR_COM_RESSALVA" ? "NA" : "&nbsp;")}</td></tr>
<tr><td class="rot">Observação:</td><td colspan="3">${texto(d.observacao) || "NA"}</td></tr>
${linha("Encerrado:", d.encerrado ? "Sim" : "Não", "Assinatura:", "")}
</table>`;
}

export default function DesviosAmostra({ q, voltar, recarregar, avisar }) {
  const { contas, arquivos, podeEscrever } = q;
  const lista = q.desvios || [];
  const hoje = hojeYmd(), ano = hoje.slice(0, 4);
  const [ed, setEd] = useState(null); const [salvando, setSalvando] = useState(false); const [filtro, setFiltro] = useState(null);
  const nome = (u) => nomeDe(contas, u);
  const form = dadosDoFormulario(q.documentos, FORM_DESVIO);
  const abertos = lista.filter((d) => !d.encerrado);
  const semConsulta = abertos.filter((d) => !d.cliente_consultado_em);
  const doAno = lista.filter((d) => String(d.data).startsWith(ano));
  const porTipo = TIPOS.map(([v, l]) => [l, doAno.filter((d) => (d.tipos || []).includes(v)).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const vis = lista.filter((d) => !filtro || (filtro === "ABERTOS" ? !d.encerrado : filtro === "SEMCONSULTA" ? semConsulta.includes(d) : true));
  const imprimir = (d) => { try { abrirImpressao({ form, corpo: corpoDesvio(d || {}, { nome }), impressoPor: nome(q.eu), controlada: !!d }); } catch (e) { avisar({ tipo: "erro", texto: e.message }); } };
  async function salvar(e, encerrar = false) {
    e?.preventDefault?.(); setSalvando(true);
    try { const r = await salvarDesvio({ ...ed, ...(encerrar ? { encerrado: true } : {}) }); await recarregar(); setEd(null); avisar({ tipo: "ok", texto: `Desvio ${r.codigo} ${encerrar ? "encerrado" : "salvo"}.` }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Manuseio de amostras · desvios no recebimento" iso="ISO 17025 · 7.4 · PT 009" voltar={voltar} acoes={<>
        <button type="button" onClick={() => imprimir(null)} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> {form.codigo} em branco</button>
        {podeEscrever && <button type="button" onClick={() => setEd({ data: hoje, tipos: [], decisao: "AGUARDANDO", responsavel: q.eu })} className="btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Registrar desvio</button>}
      </>} />
      <p className="text-sm text-slate-500">Quando a amostra chega fora do especificado (temperatura, frasco, volume, prazo, preservação…), registre aqui, <b>consulte o cliente antes de seguir</b> e, se o ensaio continuar, escreva a ressalva que vai no relatório.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard rotulo="Desvios em aberto" valor={abertos.length} tom={abertos.length ? "warn" : "ok"} onClick={() => setFiltro(filtro === "ABERTOS" ? null : "ABERTOS")} ativo={filtro === "ABERTOS"} />
        <StatCard rotulo="Sem consulta ao cliente" valor={semConsulta.length} tom={semConsulta.length ? "bad" : "ok"} sub="7.4.3: consultar antes de ensaiar" onClick={() => setFiltro(filtro === "SEMCONSULTA" ? null : "SEMCONSULTA")} ativo={filtro === "SEMCONSULTA"} />
        <StatCard rotulo={`Desvios em ${ano}`} valor={doAno.length} sub={porTipo.slice(0, 2).map(([l, n]) => `${l}: ${n}`).join(" · ") || "—"} onClick={() => setFiltro(null)} />
        <StatCard rotulo="Seguiram com ressalva" valor={doAno.filter((d) => d.decisao === "PROSSEGUIR_COM_RESSALVA").length} sub="ressalva no relatório" />
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Nº</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">OS / cliente</th><th className="px-3 py-2">Desvio</th><th className="px-3 py-2">Cliente consultado</th><th className="px-3 py-2">Decisão</th><th className="px-3 py-2" /></tr></thead>
        <tbody>{vis.map((d) => (
          <tr key={d.id} className="border-t align-top">
            <td className="whitespace-nowrap px-3 py-2 font-semibold">{d.codigo}{d.encerrado ? <span className="block"><Pill tom="ok">encerrado</Pill></span> : <span className="block"><Pill tom="warn">aberto</Pill></span>}</td>
            <td className="whitespace-nowrap px-3 py-2">{fmtData(d.data)}</td>
            <td className="px-3 py-2">{d.os_referencia || "—"}<span className="block text-xs text-slate-500">{d.cliente_nome}</span></td>
            <td className="px-3 py-2 text-xs"><span className="font-medium">{(d.tipos || []).map((t) => rot(TIPOS, t)).join(", ")}</span><span className="line-clamp-2 block text-slate-600">{d.descricao}</span></td>
            <td className={`whitespace-nowrap px-3 py-2 ${!d.cliente_consultado_em && !d.encerrado ? "font-semibold text-bad-700" : ""}`}>{d.cliente_consultado_em ? fmtData(d.cliente_consultado_em) : "pendente"}</td>
            <td className="px-3 py-2 text-xs">{rot(DECISOES, d.decisao)}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right"><button type="button" onClick={() => imprimir(d)} className="btn-ghost px-2 py-1" title={`Imprimir ${form.codigo}`}><Printer className="h-4 w-4" aria-hidden /></button>{podeEscrever && <button type="button" onClick={() => setEd({ ...d })} className="btn-outline ml-1 px-2.5 py-1 text-xs">Abrir</button>}</td>
          </tr>))}
          {vis.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">{lista.length ? "Nada com esse filtro." : "Nenhum desvio registrado."}</td></tr>}
        </tbody></table></div></div>

      <Modal titulo={ed?.id ? `Desvio ${ed.codigo}` : "Registrar desvio no recebimento"} aberto={!!ed} aoFechar={() => setEd(null)} largura="max-w-2xl">
        {ed && <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Data"><input type="date" className="input" value={ed.data || ""} onChange={(e) => setEd({ ...ed, data: e.target.value })} disabled={ed.encerrado} /></Campo>
          <Campo rotulo="OS / amostra"><input className="input" value={ed.os_referencia || ""} onChange={(e) => setEd({ ...ed, os_referencia: e.target.value })} disabled={ed.encerrado} /></Campo>
          <Campo rotulo="Cliente"><input className="input" value={ed.cliente_nome || ""} onChange={(e) => setEd({ ...ed, cliente_nome: e.target.value })} disabled={ed.encerrado} /></Campo>
          <Campo rotulo="Matriz"><input className="input" value={ed.matriz || ""} onChange={(e) => setEd({ ...ed, matriz: e.target.value })} disabled={ed.encerrado} placeholder="Água tratada, alimento…" /></Campo>
          <Campo rotulo="Tipo de desvio" className="sm:col-span-2"><div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{TIPOS.map(([v, l]) => <label key={v} className="inline-flex items-center gap-1.5"><input type="checkbox" disabled={ed.encerrado} checked={(ed.tipos || []).includes(v)} onChange={(e) => setEd({ ...ed, tipos: e.target.checked ? [...(ed.tipos || []), v] : (ed.tipos || []).filter((x) => x !== v) })} /> {l}</label>)}</div></Campo>
          <Campo rotulo="Condição encontrada"><input className="input" value={ed.condicao_encontrada || ""} onChange={(e) => setEd({ ...ed, condicao_encontrada: e.target.value })} disabled={ed.encerrado} placeholder="12,4 °C na chegada" /></Campo>
          <Campo rotulo="Condição especificada"><input className="input" value={ed.condicao_especificada || ""} onChange={(e) => setEd({ ...ed, condicao_especificada: e.target.value })} disabled={ed.encerrado} placeholder="≤ 10 °C" /></Campo>
          <Campo rotulo="Descrição *" className="sm:col-span-2"><textarea className="input" rows={3} required value={ed.descricao || ""} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} disabled={ed.encerrado} /></Campo>
          <Campo rotulo="Cliente consultado em"><input type="date" className="input" value={ed.cliente_consultado_em || ""} onChange={(e) => setEd({ ...ed, cliente_consultado_em: e.target.value })} disabled={ed.encerrado} /></Campo>
          <Campo rotulo="Meio / com quem"><div className="flex gap-2"><input className="input" value={ed.consulta_meio || ""} onChange={(e) => setEd({ ...ed, consulta_meio: e.target.value })} disabled={ed.encerrado} placeholder="WhatsApp" /><input className="input" value={ed.consulta_com || ""} onChange={(e) => setEd({ ...ed, consulta_com: e.target.value })} disabled={ed.encerrado} placeholder="Nome" /></div></Campo>
          <Campo rotulo="Decisão do cliente" className="sm:col-span-2"><select className="input" value={ed.decisao || "AGUARDANDO"} onChange={(e) => setEd({ ...ed, decisao: e.target.value })} disabled={ed.encerrado}>{DECISOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          {ed.decisao === "PROSSEGUIR_COM_RESSALVA" && <Campo rotulo="Ressalva no relatório de ensaio *" className="sm:col-span-2"><textarea className="input" rows={2} value={ed.ressalva || ""} onChange={(e) => setEd({ ...ed, ressalva: e.target.value })} disabled={ed.encerrado} placeholder="Amostra recebida a 12,4 °C, acima do especificado (≤ 10 °C). Ensaio realizado a pedido do cliente; o resultado pode não representar…" /></Campo>}
          <Campo rotulo="Responsável"><SelectPessoa contas={contas} valor={ed.responsavel} onChange={(v) => setEd({ ...ed, responsavel: v })} disabled={ed.encerrado} /></Campo>
          <Campo rotulo="Observação"><input className="input" value={ed.observacao || ""} onChange={(e) => setEd({ ...ed, observacao: e.target.value })} disabled={ed.encerrado} /></Campo>
          {ed.id && <div className="sm:col-span-2"><span className="label">Evidências (foto da amostra, conversa com o cliente)</span><Anexos refTipo="desvio" refId={ed.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>}
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            {ed.id && <button type="button" onClick={() => imprimir(ed)} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> Imprimir {form.codigo}</button>}
            {!ed.encerrado && <button disabled={salvando} className="btn-outline">Salvar</button>}
            {!ed.encerrado && ed.id && <button type="button" disabled={salvando} onClick={() => salvar(null, true)} className="btn-primary">Encerrar desvio</button>}
          </div>
        </form>}
      </Modal>
    </div>
  );
}
