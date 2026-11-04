// Formatação no padrão brasileiro. Datas trafegam como "AAAA-MM-DD" (sem
// fuso) e só viram "DD/MM/AAAA" na tela.

export const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

export function isoDia(deslocamento = 0, hoje = new Date()) {
  const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) + deslocamento * 864e5);
  return d.toISOString().slice(0, 10);
}

export function agoraBR(agora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(agora.getDate())}/${p(agora.getMonth() + 1)}/${agora.getFullYear()} ${p(agora.getHours())}:${p(agora.getMinutes())}`;
}

export const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const agoraLocal = (d = new Date()) => { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
