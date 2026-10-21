// Toque curto de mensagem nova (feito na hora com o áudio do navegador, sem arquivo). Falha em silêncio se o navegador não deixar.
let ctx = null;
export const somLigado = () => { try { return localStorage.getItem("ml_msg_som") !== "0"; } catch { return true; } };
export const ligarSom = (ligado) => { try { localStorage.setItem("ml_msg_som", ligado ? "1" : "0"); } catch { /* sem armazenamento local, só vale nesta aba */ } };

// O navegador só libera som depois que a pessoa clica ou digita na página: prepara o áudio no primeiro gesto.
function preparar() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* sem som */ }
}
if (typeof document !== "undefined") {
  const unica = () => { preparar(); document.removeEventListener("pointerdown", unica, true); document.removeEventListener("keydown", unica, true); };
  document.addEventListener("pointerdown", unica, true);
  document.addEventListener("keydown", unica, true);
}

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
