// Arquivos da tarefa: anexar (botão ou arrastando), baixar e apagar. O servidor decide quem pode (`pode.colaborar`).
import { useRef, useState } from "react";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import IconeArquivo from "../anexos/IconeArquivo.jsx";
import { ACEITAR_NO_INPUT, formatarTamanho, lerArquivoParaEnvio, problemaDoArquivo } from "../../lib/anexos.js";
import { tarefaAnexoApagar, tarefaAnexoEnviar, tarefaAnexoUrl } from "../../services/tarefas.js";
import { diaLocal, horaLocal } from "../../lib/tarefas.js";

export default function ArquivosTarefa({ id, anexos, nomes, eu, pode, executar }) {
  const entrada = useRef(null);
  const [arrastando, setArrastando] = useState(false);
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState("");

  const enviar = async (lista) => {
    const arquivos = [...lista];
    if (!arquivos.length) return;
    setErro("");
    const recusados = arquivos.map(problemaDoArquivo).filter(Boolean);
    const validos = arquivos.filter((a) => !problemaDoArquivo(a));
    if (recusados.length) setErro(recusados.join(" "));
    for (let i = 0; i < validos.length; i++) {
      setStatus(`Enviando ${i + 1} de ${validos.length}: ${validos[i].name}`);
      try {
        const { nome, base64 } = await lerArquivoParaEnvio(validos[i]);
        await executar(() => tarefaAnexoEnviar(id, nome, base64));
      } catch (ex) { setErro(ex.message); break; }
    }
    setStatus("");
  };
  const baixar = async (a) => {
    setErro("");
    try { const r = await tarefaAnexoUrl(id, a.id); window.open(r.url, "_blank", "noopener"); } catch (ex) { setErro(ex.message); }
  };
  const apagar = (a) => { if (window.confirm(`Apagar o arquivo "${a.nome}"?`)) void executar(() => tarefaAnexoApagar(id, a.id)); };

  return (
    <section
      aria-label="Arquivos"
      className={clsx("rounded-xl border p-3 transition", arrastando && "border-sky-400 bg-sky-50")}
      style={arrastando ? undefined : { borderColor: "var(--hairline)" }}
      onDragOver={pode.colaborar ? (e) => { e.preventDefault(); setArrastando(true); } : undefined}
      onDragLeave={() => setArrastando(false)}
      onDrop={pode.colaborar ? (e) => { e.preventDefault(); setArrastando(false); void enviar(e.dataTransfer.files); } : undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 font-display text-sm font-semibold text-slate-800"><Paperclip size={15} aria-hidden="true" />Arquivos{anexos.length > 0 && <span className="font-normal text-slate-400">({anexos.length})</span>}</h4>
        {pode.colaborar && (
          <>
            <input ref={entrada} type="file" multiple accept={ACEITAR_NO_INPUT} className="sr-only" aria-label="Escolher arquivos para anexar" onChange={(e) => { const l = e.target.files; void enviar(l).then(() => { e.target.value = ""; }); }} />
            <button type="button" className="btn-outline h-8 min-h-0 text-xs" onClick={() => entrada.current?.click()} disabled={!!status}><Plus size={13} />Anexar arquivo</button>
          </>
        )}
      </div>
      {anexos.length === 0 && !status && <p className="text-sm text-slate-400">{pode.colaborar ? "Nenhum arquivo. Clique em Anexar ou arraste para cá." : "Nenhum arquivo."}</p>}
      <ul className="space-y-1">
        {anexos.map((a) => (
          <li key={a.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-slate-50">
            <IconeArquivo nome={a.nome} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => baixar(a)} title="Abrir ou baixar">
              <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-sky-700">{a.nome}</span>
              <span className="block truncate text-xs text-slate-500">{formatarTamanho(a.tamanho)} · {nomes[a.autor] || a.autor} · {diaLocal(a.criadoEm).split("-").reverse().slice(0, 2).join("/")} {horaLocal(a.criadoEm)}</span>
            </button>
            {(a.autor === eu || pode.gerir) && <button type="button" className="shrink-0 rounded p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100" aria-label={`Apagar ${a.nome}`} onClick={() => apagar(a)}><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
      {status && <p role="status" className="mt-2 text-xs text-sky-700">{status}</p>}
      {erro && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 [overflow-wrap:anywhere]">{erro}</p>}
    </section>
  );
}
