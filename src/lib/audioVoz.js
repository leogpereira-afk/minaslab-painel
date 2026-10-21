// Regras puras da mensagem de voz: duração em texto, formato de gravação do navegador e limite.
export const MAX_GRAVACAO_SEG = 300; // 5 minutos (o servidor aceita até 10, com folga)

/** 75 → "1:15"; 7 → "0:07". */
export const formatarDuracao = (seg) => { const s = Math.max(0, Math.round(Number(seg) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const CANDIDATOS = [["audio/webm;codecs=opus", "webm"], ["audio/webm", "webm"], ["audio/ogg;codecs=opus", "ogg"], ["audio/mp4", "m4a"]];
/** Primeiro formato que o navegador sabe gravar → { mime, ext } (Chrome/Firefox: webm/ogg; Safari: m4a). `suporta` é o MediaRecorder.isTypeSupported. */
export function formatoDeGravacao(suporta) {
  for (const [mime, ext] of CANDIDATOS) if (suporta(mime)) return { mime, ext };
  return null;
}

/** Posição (0–1) em que a pessoa clicou numa barra de progresso. */
export const fracaoDoClique = (x, esquerda, largura) => (largura > 0 ? Math.min(1, Math.max(0, (x - esquerda) / largura)) : 0);

export const VELOCIDADES = [1, 1.5, 2];
export const proximaVelocidade = (v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length] ?? 1;
