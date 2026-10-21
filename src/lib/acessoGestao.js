// Gestão (Comercial e Laboratório) é um app à parte, publicado junto em
// <base>/gestao/, com os próprios acessos (tela Acessos da Gestão, guardados
// pelo servidor ml-comercial). O item do menu só aparece para quem tem alguma
// página liberada lá: pergunta ao servidor uma vez por sessão.
import { useEffect, useState } from "react";
import { API } from "./api.js";
import { getToken } from "./sessao.js";

export const GESTAO_FN = `${API}/ml-comercial`;
const CHAVE = "ml_gestao_acesso";

export async function temAcessoGestao(token = getToken()) {
  if (!token) return false;
  try {
    const r = await fetch(GESTAO_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "eu" }),
    });
    if (!r.ok) return false;
    const d = await r.json();
    return Object.keys(d?.setores || {}).length > 0;
  } catch {
    return false;
  }
}

/** true/false quando souber; enquanto pergunta, usa a última resposta desta sessão. */
export function useAcessoGestao(sessao) {
  const usuario = sessao?.usuario || "";
  const [ok, setOk] = useState(() => {
    try { return sessionStorage.getItem(CHAVE) === `${usuario}:1`; } catch { return false; }
  });
  useEffect(() => {
    if (!usuario) return undefined;
    let vivo = true;
    temAcessoGestao().then((v) => {
      if (!vivo) return;
      setOk(v);
      try { sessionStorage.setItem(CHAVE, `${usuario}:${v ? 1 : 0}`); } catch { /* sem armazenamento */ }
    });
    return () => { vivo = false; };
  }, [usuario]);
  return ok;
}
