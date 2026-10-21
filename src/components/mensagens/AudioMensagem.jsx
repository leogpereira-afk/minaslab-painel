// Mensagem de voz: play/pausa, barra de progresso (clique para ir a outro ponto), tempo e velocidade (1x, 1,5x, 2x).
import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { formatarDuracao, fracaoDoClique, proximaVelocidade } from "../../lib/audioVoz.js";
import { conversaArquivoUrl } from "../../services/mensagens.js";

export default function AudioMensagem({ conversaId, mensagem: m }) {
  const audio = useRef(null);
  const quer = useRef(false);
  const [url, setUrl] = useState("");
  const [tocando, setTocando] = useState(false);
  const [pos, setPos] = useState(0);
  const [vel, setVel] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const dur = m.anexo.duracao || 0;
  const enviando = m.seq == null;

  useEffect(() => { if (url && quer.current) { quer.current = false; audio.current?.play().catch(() => setErro(true)); } }, [url]);
  useEffect(() => {
    // Um áudio por vez: quando outro começa, este pausa.
    const outro = (e) => { if (e.detail !== m.id && audio.current && !audio.current.paused) audio.current.pause(); };
    window.addEventListener("ml-audio-tocando", outro);
    return () => window.removeEventListener("ml-audio-tocando", outro);
  }, [m.id]);

  const alternar = async () => {
    if (enviando) return;
    setErro(false);
    if (!url) {
      setCarregando(true); quer.current = true;
      try { const r = await conversaArquivoUrl(conversaId, m.id, false); setUrl(r.url); } catch { quer.current = false; setErro(true); } finally { setCarregando(false); }
      return;
    }
    const a = audio.current;
    if (a.paused) a.play().catch(() => setErro(true)); else a.pause();
  };
  const ir = (e) => {
    if (!url || !dur || !audio.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    try { audio.current.currentTime = fracaoDoClique(e.clientX, r.left, r.width) * dur; } catch { /* formato sem busca: toca do começo */ }
  };
  const trocarVel = () => { const v = proximaVelocidade(vel); setVel(v); if (audio.current) audio.current.playbackRate = v; };
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div className="flex min-w-[13rem] max-w-xs items-center gap-2" aria-label="Mensagem de voz">
      <button type="button" onClick={alternar} disabled={enviando} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60" aria-label={tocando ? "Pausar" : "Ouvir mensagem de voz"}>
        {enviando || carregando ? <Loader2 size={18} className="animate-spin" /> : tocando ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-5 cursor-pointer py-2" onClick={ir} role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(pos)} aria-label="Progresso do áudio">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-sky-600" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="flex items-center justify-between text-[11px] tabular-nums opacity-70">
          <span>{erro ? "Não consegui tocar" : enviando ? "Enviando..." : `${formatarDuracao(tocando || pos > 0 ? pos : dur)}${tocando || pos > 0 ? ` / ${formatarDuracao(dur)}` : ""}`}</span>
          <button type="button" onClick={trocarVel} className="rounded px-1 font-semibold hover:bg-black/5" aria-label={`Velocidade ${vel}x`}>{vel === 1 ? "1x" : `${String(vel).replace(".", ",")}x`}</button>
        </div>
      </div>
      <audio ref={audio} src={url || undefined} preload="none" onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} onPlay={() => { setTocando(true); window.dispatchEvent(new CustomEvent("ml-audio-tocando", { detail: m.id })); }} onPause={() => setTocando(false)} onEnded={() => { setTocando(false); setPos(0); }} onError={() => { if (url) setErro(true); }} />
    </div>
  );
}
