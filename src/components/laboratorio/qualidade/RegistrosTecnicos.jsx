// Qualidade › Registros técnicos (ISO/IEC 17025 · 7.5; PG 017 e PT 006).
// Trilha de alterações do LIMS: quem alterou, quando, o que era e o que ficou — o original continua
// recuperável (7.5.2). Filtra por período, cadastro e pessoa; imprime o relatório do período (FM-LAB-118).
import { useEffect, useState } from "react";
import { Printer, RefreshCw } from "lucide-react";
import { lerRegistrosTecnicos } from "../../../services/qualidade.js";
import { abrirImpressao, dadosDoFormulario, esc } from "../../../lib/impressao/formularioQualidade.js";
import { Cabecalho, Campo, fmtData, hojeYmd, nomeDe } from "./comum.jsx";

const FORM_REG = { codigo: "FM-LAB-118", titulo: "Relatório de Alterações em Registros Técnicos", revisao: "00", emissao: null, extra: "Documento de origem: PG 017" };
const dataHora = (v) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const IGNORAR = new Set(["atualizadoEm", "atualizado_em", "atualizadoPor", "atualizado_por", "_v"]);

/** Campos que mudaram entre antes e depois (só o primeiro nível do registro). */
export function diferencas(antes, depois) {
  const a = antes && typeof antes === "object" ? antes : {}, d = depois && typeof depois === "object" ? depois : {};
  return [...new Set([...Object.keys(a), ...Object.keys(d)])].filter((k) => !IGNORAR.has(k) && JSON.stringify(a[k] ?? null) !== JSON.stringify(d[k] ?? null))
    .map((k) => ({ campo: k, de: a[k], para: d[k] }));
}
const curto = (v) => { if (v == null || v === "") return "—"; const s = typeof v === "object" ? JSON.stringify(v) : String(v); return s.length > 80 ? `${s.slice(0, 80)}…` : s; };

export default function RegistrosTecnicos({ q, voltar, avisar }) {
  const hoje = hojeYmd();
  const [f, setF] = useState({ de: new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA"), ate: hoje, colecao: "", usuario: "", semImportacao: true, pagina: 1 });
  const [r, setR] = useState(null); const [carregando, setCarregando] = useState(false); const [aberto, setAberto] = useState(null);
  async function carregar(filtros = f) {
    setCarregando(true);
    try { setR(await lerRegistrosTecnicos(filtros)); } catch (e) { avisar({ tipo: "erro", texto: e.message }); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const nome = (u) => nomeDe(q.contas, u);
  function imprimir() {
    const linhas = (r?.itens || []).map((x) => { const dif = diferencas(x.antes, x.depois); return `<tr><td style="white-space:nowrap">${esc(dataHora(x.em))}</td><td>${esc(nome(x.usuario))}</td><td>${esc(x.colecao)}</td><td>${esc(x.registro_id)}</td><td>${esc(x.acao)}</td><td>${dif.length ? dif.map((d) => `<b>${esc(d.campo)}</b>: ${esc(curto(d.de))} → ${esc(curto(d.para))}`).join("<br>") : "—"}</td></tr>`; }).join("");
    const corpo = `<table style="margin-top:6px"><tr><td class="rot">Período:</td><td>${esc(fmtData(f.de))} a ${esc(fmtData(f.ate))}</td><td class="rot">Cadastro / pessoa:</td><td>${esc(f.colecao || "todos")} · ${esc(f.usuario ? nome(f.usuario) : "todos")}</td></tr></table>
<table style="margin-top:4px;font-size:8pt"><tr><th>Data e hora</th><th>Quem</th><th>Cadastro</th><th>Registro</th><th>Ação / motivo</th><th>O que mudou (antes → depois)</th></tr>${linhas || '<tr><td colspan="6">Nenhuma alteração no período.</td></tr>'}</table>
<p style="font-size:8pt;margin-top:4px">${esc(String(r?.total ?? 0))} alteração(ões) no período${(r?.total || 0) > (r?.itens || []).length ? `; esta folha mostra ${(r?.itens || []).length} (página ${r?.pagina})` : ""}. O valor original de cada registro continua guardado na trilha de auditoria do LIMS.</p>`;
    try { abrirImpressao({ form: dadosDoFormulario(q.documentos, FORM_REG), corpo, impressoPor: nome(q.eu), paisagem: true }); } catch (e) { avisar({ tipo: "erro", texto: e.message }); }
  }
  const total = r?.total || 0, paginas = Math.max(1, Math.ceil(total / 100));
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Registros técnicos" iso="ISO 17025 · 7.5 · PG 017" voltar={voltar} acoes={<button type="button" onClick={imprimir} disabled={!r} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> Relatório do período ({FORM_REG.codigo})</button>} />
      <p className="text-sm text-slate-500">Toda alteração nos cadastros técnicos do LIMS (parâmetros, métodos, escopo, equipamentos…) fica gravada com quem fez, quando, o motivo e o valor anterior. Aqui a Qualidade confere e imprime a trilha.</p>
      <form onSubmit={(e) => { e.preventDefault(); const nf = { ...f, pagina: 1 }; setF(nf); carregar(nf); }} className="card flex flex-wrap items-end gap-3 p-4">
        <Campo rotulo="De"><input type="date" className="input" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></Campo>
        <Campo rotulo="Até"><input type="date" className="input" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></Campo>
        <Campo rotulo="Cadastro"><select className="input" value={f.colecao} onChange={(e) => setF({ ...f, colecao: e.target.value })}><option value="">Todos</option>{(r?.colecoes || []).map((c) => <option key={c} value={c}>{c}</option>)}</select></Campo>
        <Campo rotulo="Pessoa"><select className="input" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })}><option value="">Todas</option>{q.contas.map((c) => <option key={c.usuario} value={c.usuario}>{c.nome}</option>)}</select></Campo>
        <label className="inline-flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={f.semImportacao} onChange={(e) => setF({ ...f, semImportacao: e.target.checked })} /> esconder importações</label>
        <button disabled={carregando} className="btn-primary inline-flex items-center gap-1.5"><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} aria-hidden /> Filtrar</button>
      </form>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Quem</th><th className="px-3 py-2">Cadastro</th><th className="px-3 py-2">Ação / motivo</th><th className="px-3 py-2">O que mudou</th></tr></thead>
        <tbody>{(r?.itens || []).map((x) => { const dif = diferencas(x.antes, x.depois); return (
          <tr key={x.id} onClick={() => setAberto(aberto === x.id ? null : x.id)} className="cursor-pointer border-t align-top hover:bg-slate-50">
            <td className="whitespace-nowrap px-3 py-2">{dataHora(x.em)}</td><td className="px-3 py-2">{nome(x.usuario)}</td>
            <td className="px-3 py-2">{x.colecao}<span className="block text-xs text-slate-400">{x.registro_id}</span></td>
            <td className="px-3 py-2 text-xs">{x.acao}</td>
            <td className="px-3 py-2 text-xs">{dif.length === 0 ? "—" : (aberto === x.id ? dif : dif.slice(0, 2)).map((d) => <span key={d.campo} className="block"><b>{d.campo}</b>: <span className="text-bad-700 line-through">{curto(d.de)}</span> → <span className="text-ok-700">{curto(d.para)}</span></span>)}{aberto !== x.id && dif.length > 2 && <span className="text-slate-400">+{dif.length - 2} campo(s)</span>}</td>
          </tr>); })}
          {r && !(r.itens || []).length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhuma alteração no período.</td></tr>}
          {!r && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Carregando…</td></tr>}
        </tbody></table></div>
        {paginas > 1 && <div className="flex items-center justify-between border-t p-3 text-sm"><span>{total} alteração(ões) · página {f.pagina} de {paginas}</span><div className="flex gap-2"><button type="button" disabled={f.pagina <= 1 || carregando} onClick={() => { const nf = { ...f, pagina: f.pagina - 1 }; setF(nf); carregar(nf); }} className="btn-outline px-3 py-1">Anterior</button><button type="button" disabled={f.pagina >= paginas || carregando} onClick={() => { const nf = { ...f, pagina: f.pagina + 1 }; setF(nf); carregar(nf); }} className="btn-outline px-3 py-1">Próxima</button></div></div>}
      </div>
    </div>
  );
}
