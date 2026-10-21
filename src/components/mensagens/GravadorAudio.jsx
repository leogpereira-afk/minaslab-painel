// Barra de gravação de mensagem de voz: grava com o microfone, mostra o tempo, e envia ou descarta.
// Para sozinha em 5 minutos. O navegador pede permissão do microfone na primeira vez.
import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { MAX_GRAVACAO_SEG, formatarDuracao, formatoDeGravacao } from "../../lib/audioVoz.js";

export default function GravadorAudio({ aoEnviar, aoCancelar, aoErro }) {
  const [seg, setSeg] = useState(0);
  const [pronto, setPronto] = useState(false);
  const gravador = useRef(null);
  const pedacos = useRef([]);
  const fluxo = useRef(null);
  const inicio = useRef(0);
  const decisao = useRef("enviar"); // o que fazer quando a gravação parar: "enviar" | "descartar"
  const formato = useRef(null);

  const soltar = () => { fluxo.current?.getTracks().forEach((t) => t.stop()); fluxo.current = null; };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Este navegador não grava áudio. Use o Chrome, o Edge ou o Safari atualizado.");
        const fmt = formatoDeGravacao((m) => MediaRecorder.isTypeSupported(m));
        if (!fmt) throw new Error("Este navegador não tem um formato de gravação de áudio compatível.");
        formato.current = fmt;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!vivo) { stream.getTracks().forEach((t) => t.stop()); return; }
        fluxo.current = stream;
        const rec = new MediaRecorder(stream, { mimeType: fmt.mime });
        rec.ondataavailable = (e) => { if (e.data?.size) pedacos.current.push(e.data); };
        rec.onstop = () => {
          soltar();
          const duracao = Math.max(1, Math.round((Date.now() - inicio.current) / 1000));
          if (decisao.current === "enviar" && pedacos.current.length) aoEnviar(new Blob(pedacos.current, { type: fmt.mime }), fmt.ext, Math.min(duracao, MAX_GRAVACAO_SEG));
          else aoCancelar();
        };
        gravador.current = rec;
        inicio.current = Date.now();
        rec.start(1000);
        setPronto(true);
      } catch (ex) {
        soltar();
        aoErro(ex?.name === "NotAllowedError" || ex?.name === "SecurityError" ? "O microfone está bloqueado. Libere o microfone para este site (ícone de cadeado ao lado do endereço) e tente de novo." : ex?.name === "NotFoundError" ? "Não encontrei um microfone neste computador." : ex?.message || "Não consegui gravar o áudio.");
        aoCancelar();
      }
    })();
    return () => { vivo = false; decisao.current = "descartar"; try { if (gravador.current?.state === "recording") gravador.current.stop(); } catch { /* já parou */ } soltar(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pronto) return undefined;
    const t = setInterval(() => {
      const s = (Date.now() - inicio.current) / 1000;
      setSeg(s);
      if (s >= MAX_GRAVACAO_SEG && gravador.current?.state === "recording") { decisao.current = "enviar"; gravador.current.stop(); }
    }, 250);
    return () => clearInterval(t);
  }, [pronto]);

  const parar = (como) => { decisao.current = como; if (gravador.current?.state === "recording") gravador.current.stop(); else aoCancelar(); };

  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl bg-red-50 px-3 py-2" role="status" aria-label="Gravando mensagem de voz">
      <button type="button" className="btn-ghost h-10 w-10 shrink-0 p-0 text-slate-500 hover:text-red-600" onClick={() => parar("descartar")} aria-label="Cancelar gravação" title="Cancelar"><Trash2 size={18} /></button>
      <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
      <span className="font-display text-sm font-semibold tabular-nums text-red-700">{pronto ? formatarDuracao(seg) : "Permita o microfone..."}</span>
      <span className="hidden flex-1 text-xs text-red-500 sm:block">{pronto ? `Gravando (até ${MAX_GRAVACAO_SEG / 60} min)` : ""}</span>
      <span className="flex-1 sm:hidden" />
      <button type="button" className="btn-primary h-10 w-10 shrink-0 p-0" onClick={() => parar("enviar")} disabled={!pronto} aria-label="Parar e enviar mensagem de voz" title="Enviar"><Send size={18} /></button>
    </div>
  );
}
