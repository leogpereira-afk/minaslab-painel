// Toque curto de mensagem nova (feito na hora com o áudio do navegador, sem arquivo). Falha em silêncio se o navegador não deixar.
let ctx = null;
export function tocarAviso() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    [[880, 0], [1175, 0.12]].forEach(([freq, atraso]) => {
      const osc = ctx.createOscillator(), ganho = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, t0 + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.18, t0 + atraso + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + atraso + 0.22);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(t0 + atraso); osc.stop(t0 + atraso + 0.25);
    });
  } catch { /* sem som */ }
}
