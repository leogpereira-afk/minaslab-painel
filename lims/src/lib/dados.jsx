// Base de dados do LIMS: tudo pela porta ml-lims (Supabase "Projetos Léo",
// tabelas ml_lims_*). As telas só conhecem useDados(): leem dados.<coleção>
// (lista, nunca undefined) e gravam com salvar/apagar. Cada gravação vira uma
// linha na trilha de auditoria no servidor.
//
// Carrega todas as coleções de uma vez ao abrir: o volume do LIMS cabe com
// folga numa leitura, e as telas cruzam coleções o tempo todo (parâmetro →
// método → unidade, pacote → legislação → tabela de preço...).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LIMS } from "./api.js";
import { comCracha } from "./sessao.js";

const Ctx = createContext(null);
const vazio = Object.freeze([]);
const comListas = (obj) => new Proxy(obj, { get: (t, k) => (typeof k === "string" && !(k in t) ? vazio : t[k]) });

export function DadosProvider({ children }) {
  const [store, setStore] = useState({});
  const [eu, setEu] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const contasCache = useRef(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await comCracha(LIMS, { acao: "carregar" });
      setStore(r.dados || {});
      setEu(r.eu || null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);

  // Grava no servidor e só então atualiza a tela com o que o servidor devolveu
  // (com id, cod, criadoPor...). Erro sobe para a tela mostrar.
  const salvar = useCallback(async (colecao, registro, { motivo = "", numerar = false } = {}) => {
    const r = await comCracha(LIMS, { acao: "salvar", colecao, registro, motivo, numerar });
    setStore((s) => {
      const lista = s[colecao] || [];
      const i = lista.findIndex((x) => x.id === r.registro.id);
      return { ...s, [colecao]: i >= 0 ? lista.map((x, j) => (j === i ? r.registro : x)) : [...lista, r.registro] };
    });
    return r.registro;
  }, []);

  // Vários registros da mesma coleção numa chamada (ex.: as amostras de uma OS).
  const salvarLote = useCallback(async (colecao, registros, { motivo = "", numerar = false } = {}) => {
    const r = await comCracha(LIMS, { acao: "salvarLote", colecao, registros, motivo, numerar });
    setStore((s) => {
      const lista = [...(s[colecao] || [])];
      for (const reg of r.registros) { const i = lista.findIndex((x) => x.id === reg.id); if (i >= 0) lista[i] = reg; else lista.push(reg); }
      return { ...s, [colecao]: lista };
    });
    return r.registros;
  }, []);

  const apagar = useCallback(async (colecao, id, motivo = "") => {
    await comCracha(LIMS, { acao: "apagar", colecao, id, motivo });
    setStore((s) => ({ ...s, [colecao]: (s[colecao] || []).filter((x) => x.id !== id) }));
  }, []);

  const proximo = useCallback(async (chave, minimo = 0) => (await comCracha(LIMS, { acao: "proximo", chave, minimo })).numero, []);
  // Reserva um bloco de números de uma vez (atômico no servidor).
  const reservar = useCallback(async (chave, minimo = 0, quantidade = 1) => (await comCracha(LIMS, { acao: "proximo", chave, minimo, quantidade })).numeros, []);
  const auditoria = useCallback(async (filtro = {}) => (await comCracha(LIMS, { acao: "auditoria", ...filtro })).itens, []);
  const contas = useCallback(async () => {
    if (!contasCache.current) contasCache.current = (await comCracha(LIMS, { acao: "contas" })).contas;
    return contasCache.current;
  }, []);

  const dados = useMemo(() => comListas(store), [store]);
  const valor = useMemo(() => ({ dados, eu, carregando, erro, recarregar, salvar, salvarLote, apagar, proximo, reservar, auditoria, contas }), [dados, eu, carregando, erro, recarregar, salvar, salvarLote, apagar, proximo, reservar, auditoria, contas]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useDados = () => useContext(Ctx);

// Configuração do sistema é um registro único (colecao "config", id "sistema").
export const configSistema = (dados) => dados.config.find((c) => c.id === "sistema") || {};
