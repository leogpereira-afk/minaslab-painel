// Rotas pelo hash (#/proposedlist, #/proposta/941): funciona no GitHub Pages
// sem 404 especial, e cada tela tem link próprio para favoritar ou mandar.
// Os nomes das telas são os mesmos caminhos do GerenciaLab (customers,
// proposedlist, criar-proposta...), para quem vem de lá se achar.
import { useEffect, useState } from "react";

export function lerHash(hash) {
  const h = String(hash || "").replace(/^#\/?/, "");
  const [tela = "", ...resto] = h.split("/");
  return { tela: tela || "dashboard", param: resto.join("/") || "" };
}

export function useRota() {
  const [rota, setRota] = useState(() => lerHash(window.location.hash));
  useEffect(() => {
    const f = () => { setRota(lerHash(window.location.hash)); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return rota;
}

export const link = (tela, param = "") => `#/${tela}${param !== "" ? `/${param}` : ""}`;
export function navegar(tela, param = "") {
  window.location.hash = link(tela, param);
}
