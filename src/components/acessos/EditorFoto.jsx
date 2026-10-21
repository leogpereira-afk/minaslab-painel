// Escolher uma foto, enquadrar (zoom e posição) e salvar ou remover. Usado na foto de perfil (Acessos) e na foto do grupo (Mensagens).
import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Modal } from "../ui.jsx";
import { prepararFotoPerfil } from "../../lib/fotoPerfil.js";

export default function EditorFoto({ titulo, atual, aoSalvar, aoRemover, aoFechar, legenda, children }) {
  const entrada = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [px, setPx] = useState(0.5);
  const [py, setPy] = useState(0.5);
  const [previa, setPrevia] = useState("");
  const [base64, setBase64] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!arquivo) return undefined;
    let vivo = true;
    prepararFotoPerfil(arquivo, { zoom, px, py })
      .then((r) => { if (vivo) { setPrevia(r.previa); setBase64(r.base64); setErro(""); } })
      .catch((e) => { if (vivo) { setErro(e.message); setPrevia(""); setBase64(""); } });
    return () => { vivo = false; };
  }, [arquivo, zoom, px, py]);

  const escolher = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setZoom(1); setPx(0.5); setPy(0.5); setArquivo(f);
  };
  const salvar = async () => {
    if (!base64 || ocupado) return;
    setOcupado(true); setErro("");
    try { await aoSalvar(base64); aoFechar(); } catch (e) { setErro(e.message); setOcupado(false); }
  };
  const remover = async () => {
    if (ocupado || !window.confirm("Remover a foto?")) return;
    setOcupado(true); setErro("");
    try { await aoRemover(); aoFechar(); } catch (e) { setErro(e.message); setOcupado(false); }
  };

  return (
    <Modal titulo={titulo} aberto aoFechar={aoFechar} largura="max-w-md">
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3">
          {previa
            ? <img src={previa} alt="Prévia da nova foto" width={160} height={160} className="h-40 w-40 rounded-full border object-cover" style={{ borderColor: "var(--hairline)" }} />
            : children}
          {legenda && <p className="text-center text-xs text-slate-500">{legenda}</p>}
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Escolher foto" onChange={escolher} />
          <button type="button" className="btn-outline" onClick={() => entrada.current?.click()} disabled={ocupado}><Camera size={15} />{arquivo || atual ? "Escolher outra foto" : "Escolher foto"}</button>
        </div>

        {arquivo && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <label className="flex items-center gap-3"><span className="w-24 text-slate-600">Aproximar</span><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" aria-label="Aproximar" /></label>
            <label className="flex items-center gap-3"><span className="w-24 text-slate-600">Esquerda/direita</span><input type="range" min="0" max="1" step="0.01" value={px} onChange={(e) => setPx(Number(e.target.value))} className="flex-1" aria-label="Mover para os lados" /></label>
            <label className="flex items-center gap-3"><span className="w-24 text-slate-600">Cima/baixo</span><input type="range" min="0" max="1" step="0.01" value={py} onChange={(e) => setPy(Number(e.target.value))} className="flex-1" aria-label="Mover para cima ou para baixo" /></label>
          </div>
        )}

        {erro && <p role="alert" className="rounded-xl bg-bad-50 p-3 text-sm text-bad-800 break-words">{erro}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={salvar} disabled={!base64 || ocupado}>{ocupado ? "Salvando..." : "Salvar foto"}</button>
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          </div>
          {atual && !arquivo && aoRemover && <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline" onClick={remover} disabled={ocupado}><Trash2 size={14} />Remover foto</button>}
        </div>
      </div>
    </Modal>
  );
}
