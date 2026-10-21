// Rotas pelo hash (#/visao, #/pessoas/<id>): funciona em qualquer hospedagem
// estática sem configurar redirecionamento, e o F5 volta para a mesma tela.
import { useEffect, useState } from "react";

const ler = () => {
  const h = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#\/?/, "");
  const [tela = "", ...resto] = h.split("/");
  return { tela: tela || "cockpit", param: resto.join("/") || "" };
};

export function useRota() {
  const [rota, setRota] = useState(ler);
  useEffect(() => {
    const f = () => setRota(ler());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return rota;
}

export function navegar(tela, param = "") {
  window.location.hash = `#/${tela}${param ? `/${param}` : ""}`;
}
