// Base de dados desta etapa: dados de demonstração guardados SÓ neste
// navegador (localStorage). Cada pessoa vê a própria cópia; nada vai para o
// servidor. Na próxima etapa este arquivo passa a ler e gravar pela porta do
// LIMS no Supabase, e as telas não precisam mudar: elas só conhecem
// useDados() e as ações abaixo.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { dadosDemo } from "./demo.js";

const CHAVE = "lims_demo_v1";

function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (d?.versao === 1 && Array.isArray(d.clientes)) return d;
  } catch { /* sem armazenamento ou dado ilegível */ }
  return dadosDemo();
}

const Ctx = createContext(null);

export function DadosProvider({ children }) {
  const [dados, setDados] = useState(carregar);

  const mudar = useCallback((fn) => {
    setDados((atual) => {
      const novo = fn(structuredClone(atual)) || atual;
      try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch { /* sem armazenamento: segue só na memória */ }
      return novo;
    });
  }, []);

  const restaurar = useCallback(() => {
    const d = dadosDemo();
    try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* idem */ }
    setDados(d);
  }, []);

  const valor = useMemo(() => ({ dados, mudar, restaurar }), [dados, mudar, restaurar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useDados = () => useContext(Ctx);
