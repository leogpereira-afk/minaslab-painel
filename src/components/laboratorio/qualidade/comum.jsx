// Peças comuns das páginas de Laboratório › Qualidade (documentos, equipamentos, NC, auditorias, indicadores).
import { useRef, useState } from "react";
import { ArrowLeft, Download, Paperclip, Trash2 } from "lucide-react";
import { enviarArquivo, baixarArquivo, apagarArquivo } from "../../../services/qualidade.js";
import { lerArquivoParaEnvio, problemaDoArquivo, formatarTamanho } from "../../../lib/anexos.js";

export const hojeYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const fmtData = (v) => (v ? new Date(String(v).length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("pt-BR") : "—");
export const diasAte = (ymd) => (ymd ? Math.round((new Date(`${ymd}T12:00:00`) - new Date(`${hojeYmd()}T12:00:00`)) / 86400000) : null);
export const somaMeses = (ymd, m) => { const d = new Date(`${ymd}T12:00:00`); d.setMonth(d.getMonth() + Number(m || 0)); return d.toLocaleDateString("en-CA"); };
export const nomeDe = (contas, u) => contas.find((c) => c.usuario === u)?.nome || u || "—";

export function Pill({ tom = "gray", children }) {
  const cor = { ok: "bg-ok-50 text-ok-700", warn: "bg-warn-50 text-warn-700", bad: "bg-bad-50 text-bad-700", brand: "bg-brand-50 text-brand-700", sky: "bg-sky-50 text-sky-700", vio: "bg-violet-50 text-violet-700", gray: "bg-slate-100 text-slate-600" }[tom];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cor}`}>{children}</span>;
}

export function Cabecalho({ titulo, iso, voltar, acoes }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={voltar} className="btn-ghost inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" aria-hidden /> Qualidade</button>
      <h2 className="font-display text-lg font-semibold text-slate-900">{titulo}</h2>
      {iso && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{iso}</span>}
      <div className="ml-auto flex flex-wrap gap-2">{acoes}</div>
    </div>
  );
}

export function Campo({ rotulo, children, className = "" }) {
  return <label className={className}><span className="label">{rotulo}</span>{children}</label>;
}

export function SelectPessoa({ contas, valor, onChange, vazio = "—", disabled }) {
  return (
    <select className="input" value={valor || ""} onChange={(e) => onChange(e.target.value || null)} disabled={disabled}>
      <option value="">{vazio}</option>
      {contas.map((c) => <option key={c.usuario} value={c.usuario}>{c.nome}</option>)}
    </select>
  );
}

// Anexos de um registro (certificado, POP em PDF, evidência da NC...). Guardados no servidor; download por link temporário.
export function Anexos({ refTipo, refId, arquivos, podeEscrever, aoMudar, avisar }) {
  const input = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const meus = arquivos.filter((a) => a.ref_tipo === refTipo && a.ref_id === refId);
  async function escolher(e) {
    const arq = e.target.files?.[0]; e.target.value = "";
    if (!arq) return;
    const problema = problemaDoArquivo(arq);
    if (problema) { avisar({ tipo: "erro", texto: problema }); return; }
    setEnviando(true);
    try { const { nome, base64 } = await lerArquivoParaEnvio(arq); await enviarArquivo(refTipo, refId, nome, base64); await aoMudar(); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setEnviando(false); }
  }
  async function baixar(a) {
    try { const r = await baixarArquivo(a.id); window.open(r.url, "_blank", "noopener"); } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  async function apagar(a) {
    if (!window.confirm(`Tirar o arquivo "${a.nome}"?`)) return;
    try { await apagarArquivo(a.id); await aoMudar(); } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  return (
    <div className="space-y-1.5">
      {meus.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
          <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <button type="button" onClick={() => baixar(a)} className="min-w-0 flex-1 truncate text-left text-brand-700 hover:underline">{a.nome}</button>
          <span className="text-xs text-slate-400">{formatarTamanho(a.tamanho)}</span>
          <button type="button" onClick={() => baixar(a)} className="btn-ghost p-1" title="Baixar"><Download className="h-4 w-4" aria-hidden /></button>
          {podeEscrever && <button type="button" onClick={() => apagar(a)} className="btn-ghost p-1 text-bad-700" title="Tirar"><Trash2 className="h-4 w-4" aria-hidden /></button>}
        </div>
      ))}
      {meus.length === 0 && <p className="text-xs text-slate-400">Nenhum arquivo.</p>}
      {podeEscrever && <>
        <input ref={input} type="file" className="hidden" onChange={escolher} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" />
        <button type="button" onClick={() => input.current?.click()} disabled={enviando} className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Paperclip className="h-3.5 w-3.5" aria-hidden />{enviando ? "Enviando..." : "Anexar arquivo"}</button>
      </>}
    </div>
  );
}
