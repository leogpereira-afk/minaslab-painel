// A conversa com o relógio de ponto (Jibble), sempre pela Edge Function
// ml-ponto — o navegador nunca fala com o Jibble direto: a credencial mora no
// servidor, e este repositório é público.
//
// Toda importação é COMANDADA PELA TELA, uma janela por chamada: a Edge
// Function tem teto de 150s, e uma varredura de mês inteiro estoura. Em troca,
// a tela mostra onde está e pode parar — e o que já veio fica gravado.

import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

const BASE = `${API}/ml-ponto`;

async function chamar(action, corpo = {}) {
  const resp = await comCracha(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body;
}

// O relógio está ligado? (responde sem falar com o Jibble)
export const estadoDoRelogio = () => chamar("estado");

// Confere a credencial e pergunta a cada fonte quem responde — é o caso de
// controle antes de confiar em qualquer número importado.
export const diagnosticar = (de, ate) => chamar("diagnostico", { de, ate });

/* AS PESSOAS CADASTRADAS NO RELÓGIO, já casadas com as fichas do RH pelo
   jibbleId. Devolve o CORPO INTEIRO, não só a lista — o resto do envelope é
   controle, e controle jogado fora é controle que não existe:

     total        quantas o Jibble diz TER (@odata.count). A busca traz 200 por
                  vez: se `total` for maior que a lista, ela veio cortada, e
                  "não está aqui" deixa de provar "não existe".
     semFicha     contadas NO SERVIDOR, que enxerga todas as fichas — a tela só
                  conhece as que carregou.
     divergentes  removida no relógio com ficha ativa (ou o contrário).

   DADO AUSENTE NÃO É ZERO: o que não vier fica `null`, para a tela dizer "sem
   registro" em vez de afirmar zero que ninguém contou. */
export const pessoasDoRelogio = () =>
  chamar("pessoas").then((r) => ({
    pessoas: Array.isArray(r?.pessoas) ? r.pessoas : [],
    total: Number.isFinite(r?.total) ? r.total : null,
    semFicha: Number.isFinite(r?.semFicha) ? r.semFicha : null,
    divergentes: Number.isFinite(r?.divergentes) ? r.divergentes : null,
  }));

/* Importa o período inteiro, janela a janela. `aoAndar` recebe o progresso
   para a tela mostrar; devolve o total. Erro no meio NÃO descarta o que já
   veio (cada janela grava antes de devolver) — a frase do erro sobe para
   quem chamou decidir. */
export async function importarPeriodo(de, ate, aoAndar) {
  let skip = 0;
  let lidos = 0;
  let gravados = 0;
  let preservados = 0;
  for (;;) {
    const r = await chamar("importar", { de, ate, skip });
    lidos += r.lidos || 0;
    gravados += r.gravados || 0;
    preservados += r.preservados || 0;
    aoAndar?.({ lidos, gravados, preservados, total: r.total ?? null });
    if (!r.proximaSkip) break;
    skip = r.proximaSkip;
  }
  await chamar("carimbarImportacao", { resumo: { de, ate, lidos, gravados, preservados } });
  return { lidos, gravados, preservados };
}

/* ============================================================================
   SINCRONIZAR — a única chamada que o botão do topo precisa fazer.

   POR QUE ELA EXISTE. O desenho antigo pedia DOIS passos manuais numa casa de
   cadastro vazio: criar a ficha no RH e depois vincular a ficha ao relógio. Com
   o RH em zero fichas, o seletor de "vincular a qual ficha" abria sem opção
   nenhuma — a tela pedia uma escolha que não existia. A ação "sincronizar" faz
   os três de uma vez, no servidor: cria a ficha de quem não tem (já com o
   jibbleId, então o vínculo NASCE pronto), completa só os campos vazios de quem
   já tem, importa o resumo diário e carimba o pessoaId nos dias.

   O QUE ELA NÃO FAZ, de propósito: ninguém é DESLIGADO por estar removido no
   relógio. Isso volta em `divergencias` para a tela apontar — desligar é ato
   trabalhista, tem data e verbas, e quem decide é o RH.

   ----------------------------------------------------------------------------
   POR QUE NEM TUDO SE SOMA. A ação roda uma JANELA de pessoas por chamada (o
   teto de 150s da Edge Function), mas os passos 1 e 2 (ler o relógio, conferir
   as fichas) rodam INTEIROS em toda janela. Então:

     pessoasNoRelogio / ativas / removidas   são um RETRATO do mesmo cadastro em
        toda janela. Somar transformaria 20 pessoas em 60 na terceira janela —
        o número mais visível da frase final seria o mais errado. Fica o último.
     divergencias                            mesma lista repetida; entra sem
        repetição, pela chave do relógio (jibbleId).
     fichasCriadas / fichasCompletadas       somam com segurança: a janela
        seguinte já encontra a ficha criada e não a cria de novo.
     diasGravados / preservados / vinculados somam: cada janela trata dias
        diferentes, e o dia carimbado sai do filtro "sem pessoaId".

   DADO AUSENTE NÃO É ZERO: o que o servidor não mandar fica `null`, para a tela
   dizer "sem registro" em vez de afirmar um zero que ninguém contou. Os
   contadores que somamos começam em 0 porque aí o zero é medido: é a soma de
   janelas que responderam.

   `pessoasLidas` é PISO, não total: só sabemos com certeza quantas pessoas a
   janela consumiu quando ela veio cheia (o servidor devolve `proximaSkip`). Na
   última janela o número real é esse piso mais o que sobrou. Serve para o botão
   andar em voz alta; quem vale na frase final é `pessoasNoRelogio`.

   `incompleto: true` quando paramos no teto de janelas. Parar calado seria
   dizer "pronto" para um trabalho pela metade. */
const TETO_DE_JANELAS = 60;

export async function sincronizarPeriodo(de, ate, aoAndar) {
  let skip = 0;
  let janelas = 0;
  let incompleto = false;
  const vistas = new Set();
  const total = {
    pessoasNoRelogio: null,
    ativas: null,
    removidas: null,
    fichasCriadas: 0,
    fichasCompletadas: 0,
    diasGravados: 0,
    preservados: 0,
    vinculados: 0,
    pessoasLidas: 0,
    divergencias: [],
  };

  for (;;) {
    const r = await chamar("sincronizar", { de, ate, skip });

    if (Number.isFinite(r?.pessoasNoRelogio)) total.pessoasNoRelogio = r.pessoasNoRelogio;
    if (Number.isFinite(r?.ativas)) total.ativas = r.ativas;
    if (Number.isFinite(r?.removidas)) total.removidas = r.removidas;

    total.fichasCriadas += r?.fichasCriadas || 0;
    total.fichasCompletadas += r?.fichasCompletadas || 0;
    total.diasGravados += r?.diasGravados || 0;
    total.preservados += r?.preservados || 0;
    total.vinculados += r?.vinculados || 0;

    for (const d of Array.isArray(r?.divergencias) ? r.divergencias : []) {
      /* A chave é o jibbleId — NOME NÃO IDENTIFICA PESSOA. Duas homônimas na
         mesma situação viravam uma linha só, o RH resolvia uma, achava que
         tinha acabado, e a segunda seguia ativa na folha sem ninguém ver. */
      const chave = d?.jibbleId || `${d?.nome}|${d?.noRelogio}|${d?.naFicha}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      total.divergencias.push(d);
    }

    janelas += 1;
    const proxima = Number(r?.proximaSkip);
    const temMais = Number.isFinite(proxima) && proxima > skip;
    if (temMais) total.pessoasLidas = proxima;

    // A cópia da lista impede que a tela guarde o mesmo array que ainda vamos
    // empurrar — estado que muda por baixo do render não repinta.
    aoAndar?.({ ...total, divergencias: [...total.divergencias], janelas });

    if (!temMais) break;
    if (janelas >= TETO_DE_JANELAS) {
      incompleto = true;
      break;
    }
    skip = proxima;
  }

  return { ...total, janelas, incompleto };
}
