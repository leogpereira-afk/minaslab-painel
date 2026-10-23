// Arte da publicação no mural (no estilo de post de Instagram), com a paleta
// das apresentações coloridas. Estilos: capa, citacao, aviso, evento, numero.
import { MESES } from "../../lib/canais.js";

const tamanhoTitulo = (t) => (t.length > 90 ? "text-xl sm:text-2xl" : t.length > 50 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl");
const ROTULO_TIPO = { noticia: "Notícia", comunicado: "Comunicado", evento: "Evento" };

function Bolhas({ cor }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <circle cx="360" cy="30" r="70" fill="#fff" opacity=".12" />
      <circle cx="40" cy="220" r="55" fill="#fff" opacity=".10" />
      <circle cx="330" cy="200" r="18" fill="#fff" opacity=".18" />
      <path d="M352 168h12M355 168v14l-11 20a3 3 0 0 0 2.6 4.5h23a3 3 0 0 0 2.6-4.5L361 182v-14" fill="none" stroke={cor.claro} strokeOpacity=".45" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const Marca = ({ claro }) => <span className={`text-[11px] font-bold tracking-wide ${claro ? "text-white/80" : "text-slate-400"}`}>MinasLab</span>;

export default function ArtePost({ titulo, tipo, visual }) {
  const { estilo, cor, destaque, data } = visual;
  const t = String(titulo || "");
  if (estilo === "simples") return null;

  if (estilo === "capa") {
    return (
      <div className="relative flex min-h-[220px] flex-col justify-between overflow-hidden px-6 py-6 sm:min-h-[260px] sm:px-8" style={{ background: `linear-gradient(135deg, ${cor.base} 0%, ${cor.escuro} 100%)`, color: cor.sobre }}>
        <Bolhas cor={cor} />
        <span className="relative w-fit rounded-full bg-white/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">{ROTULO_TIPO[tipo] || "MinasLab"}</span>
        <h2 className={`relative my-4 font-display font-extrabold leading-[1.1] ${tamanhoTitulo(t)}`}>{t}</h2>
        <div className="relative flex items-center gap-2"><span className="h-1 w-10 rounded-full bg-white/70" /><Marca claro /></div>
      </div>
    );
  }

  if (estilo === "citacao") {
    return (
      <div className="relative overflow-hidden px-6 py-8 text-center sm:px-10" style={{ background: cor.claro }}>
        <span className="pointer-events-none absolute -top-6 left-4 font-display text-[140px] font-black leading-none opacity-20" style={{ color: cor.base }} aria-hidden="true">“</span>
        <p className={`relative mx-auto max-w-xl font-display font-bold leading-snug ${t.length > 90 ? "text-xl" : "text-2xl sm:text-[28px]"}`} style={{ color: cor.escuro }}>{t}</p>
        <div className="relative mx-auto mt-4 h-1 w-14 rounded-full" style={{ background: cor.base }} />
      </div>
    );
  }

  if (estilo === "aviso") {
    return (
      <div className="relative flex items-center gap-4 overflow-hidden border-l-[10px] px-5 py-5 sm:px-6" style={{ borderColor: cor.base, background: cor.claro }}>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl shadow-sm" style={{ background: cor.base }} aria-hidden="true">📣</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cor.escuro }}>{ROTULO_TIPO[tipo] || "Aviso"} · leia com atenção</p>
          <h2 className="font-display text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl">{t}</h2>
        </div>
      </div>
    );
  }

  if (estilo === "evento") {
    const [, m, d] = (data || "").split("-");
    return (
      <div className="relative flex items-stretch overflow-hidden" style={{ background: cor.claro }}>
        <div className="flex w-28 shrink-0 flex-col items-center justify-center py-5 text-center sm:w-32" style={{ background: cor.base, color: cor.sobre }}>
          {data ? <>
            <span className="font-display text-5xl font-black leading-none">{Number(d)}</span>
            <span className="mt-1 text-xs font-bold uppercase tracking-wider">{MESES[Number(m) - 1]?.slice(0, 3)}</span>
          </> : <span className="px-2 text-sm font-bold uppercase leading-tight">Em breve</span>}
        </div>
        <div className="flex min-w-0 flex-col justify-center px-5 py-5">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cor.escuro }}>📅 Evento MinasLab</p>
          <h2 className="font-display text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl">{t}</h2>
        </div>
      </div>
    );
  }

  if (estilo === "numero") {
    return (
      <div className="relative overflow-hidden px-6 py-7 text-center" style={{ background: `linear-gradient(160deg, ${cor.claro} 0%, #ffffff 100%)` }}>
        <p className="font-display text-6xl font-black leading-none sm:text-7xl" style={{ color: cor.base }}>{destaque || "★"}</p>
        <p className="mx-auto mt-3 max-w-lg font-display text-lg font-bold leading-snug text-slate-800 sm:text-xl">{t}</p>
        <div className="mx-auto mt-3 h-1 w-14 rounded-full" style={{ background: cor.base }} />
      </div>
    );
  }
  return null;
}
