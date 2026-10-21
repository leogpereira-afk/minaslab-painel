// O estado do sistema num lugar só: o setor escolhido (Comercial ou
// Laboratório), o que o usuário pode ver (Acessos), os dados do setor, os
// números do CRM, os colaboradores do RH e o mês escolhido. As telas leem
// daqui e gravam por aqui; depois de gravar, a lista local é atualizada com o
// registro que o SERVIDOR devolveu. Quem tranca é o servidor; aqui só se
// esconde o que ele já recusa.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { carregarTudo, salvar, apagar, elencoRH, quemSou } from "../services/dados.js";
import { CHAVES, PAGINAS, SETORES, podeAcao } from "../../supabase/functions/ml-comercial/acessos.mjs";
import { resumoCRM } from "../services/crm.js";
import { mesAtual } from "../lib/format.js";
import { configCompleta, naEquipeNoMes } from "../lib/calculos.js";

const Ctx = createContext(null);

const VAZIO = Object.fromEntries(CHAVES.map((c) => [c, []]));
const K_SETOR = "gc_setor";
const lerSetor = () => { try { return localStorage.getItem(K_SETOR) || ""; } catch { return ""; } };
const guardarSetor = (s) => { try { localStorage.setItem(K_SETOR, s); } catch { /* sem armazenamento */ } };

export function BaseProvider({ children }) {
  const [dados, setDados] = useState(VAZIO);
  const [resumo, setResumo] = useState(null);
  const [elenco, setElenco] = useState([]);
  const [acesso, setAcesso] = useState(null);
  const [setor, setSetorEstado] = useState(lerSetor);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [erroCRM, setErroCRM] = useState("");
  const [mes, setMes] = useState(mesAtual());
  // Leituras extras do CRM (cockpit, funil, carteira…), guardadas por 10 minutos.
  const [crmCache, setCrmCache] = useState({});

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    let eu;
    try { eu = await quemSou(); } catch (e) {
      setErro(e.status === 403 ? "Você ainda não tem acesso a este sistema. Peça a liberação à administração." : e.message || "Não consegui confirmar seu acesso.");
      setCarregando(false);
      return;
    }
    setAcesso(eu);
    const permitidos = Object.keys(SETORES).filter((s) => eu.setores?.[s]?.length);
    const alvo = permitidos.includes(setor) ? setor : permitidos[0];
    if (alvo !== setor) { setSetorEstado(alvo); guardarSetor(alvo); return; } // recarrega pelo efeito
    const querResumo = alvo === "comercial" && podeAcao({ setores: { comercial: eu.setores.comercial } }, "resumo");
    const [d, r, e] = await Promise.allSettled([carregarTudo(alvo), querResumo ? resumoCRM(36) : Promise.resolve(null), elencoRH()]);
    if (d.status === "fulfilled") setDados({ ...VAZIO, ...d.value });
    else setErro(d.reason?.message || "Não consegui carregar os dados.");
    if (r.status === "fulfilled") { setResumo(r.value); setErroCRM(""); }
    else setErroCRM(r.reason?.message || "Não consegui ler o CRM agora.");
    if (e.status === "fulfilled") setElenco(e.value);
    setCarregando(false);
  }, [setor]);

  useEffect(() => { recarregar(); }, [recarregar]);

  const setSetor = useCallback((s) => {
    if (!SETORES[s]) return;
    guardarSetor(s);
    setDados(VAZIO);
    setResumo(null);
    setCrmCache({});
    setSetorEstado(s);
  }, []);

  const gravar = useCallback(async (chave, registro) => {
    const salvo = await salvar(setor, chave, registro);
    setDados((d) => ({ ...d, [chave]: [...d[chave].filter((x) => x.id !== salvo.id), salvo] }));
    return salvo;
  }, [setor]);

  const remover = useCallback(async (chave, id) => {
    await apagar(setor, chave, id);
    setDados((d) => ({ ...d, [chave]: d[chave].filter((x) => x.id !== id) }));
  }, [setor]);

  const valor = useMemo(() => {
    const ordenar = (xs) => [...xs].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    // equipe = quem fazia parte da equipe no MÊS escolhido (entrada e saída);
    // equipeAtual = quem está na equipe hoje (cadastro, cockpit, atribuições).
    const equipe = ordenar(dados.equipe.filter((m) => naEquipeNoMes(m, mes)));
    const equipeAtual = ordenar(dados.equipe.filter((m) => m.ativo !== false));
    const config = configCompleta(dados.config.find((c) => c.id === "geral"));
    const ocorrenciasDe = (pessoaId, m = mes) => dados.ocorrencias.filter((o) => o.mes === m && o.pessoaId === pessoaId);
    const funcaoDe = (membro) => dados.funcoes.find((f) => f.id === membro?.funcaoId) || null;
    const nomeCRM = (id) => resumo?.pessoas?.[id]?.nome || (id ? "Usuário do CRM" : "Sem responsável");
    const paginas = (PAGINAS[setor] || []).filter((p) => acesso?.setores?.[setor]?.includes(p.id));
    const pode = (id) => paginas.some((p) => p.id === id);
    const setoresPermitidos = Object.keys(SETORES).filter((s) => acesso?.setores?.[s]?.length);
    return { dados, equipe, equipeAtual, config, resumo, elenco, carregando, erro, erroCRM, mes, setMes, recarregar, gravar, remover, ocorrenciasDe, funcaoDe, nomeCRM, crmCache, setCrmCache, setor, setSetor, acesso, paginas, pode, setoresPermitidos, nomeSetor: SETORES[setor]?.nome || "" };
  }, [dados, resumo, elenco, carregando, erro, erroCRM, mes, recarregar, gravar, remover, crmCache, setor, setSetor, acesso]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useBase = () => useContext(Ctx);

/**
 * Lê uma visão do CRM sob demanda e guarda por 10 minutos.
 * `chave` identifica a leitura; `buscar` é a função do services/crm.js.
 */
export function useCRM(chave, buscar, { semCRM = false } = {}) {
  const base = useBase();
  const { crmCache, setCrmCache } = base;
  // semCRM: leituras que não dependem do CRM (ex.: votações) não travam se o CRM falhar.
  const erroCRM = semCRM ? "" : base.erroCRM;
  const item = crmCache[chave];
  const [erro, setErro] = useState("");
  const fresco = item && Date.now() - item.em < 10 * 60 * 1000;
  useEffect(() => {
    if (fresco || erroCRM) return;
    let vivo = true;
    setErro("");
    buscar()
      .then((dados) => vivo && setCrmCache((c) => ({ ...c, [chave]: { dados, em: Date.now() } })))
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, fresco, erroCRM]);
  const recarregar = () => setCrmCache((c) => { const n = { ...c }; delete n[chave]; return n; });
  return { dados: item?.dados ?? null, erro: erroCRM || erro, carregando: !item && !erro && !erroCRM, recarregar };
}
