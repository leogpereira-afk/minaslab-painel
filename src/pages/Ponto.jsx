// PONTO — a CASCA do módulo próprio. Saiu de dentro do RH em 28/08/2026, a
// pedido do Leonardo ("criar um botão na barra lateral escrito Ponto").
//
// Por que virou módulo, e não mais uma aba do RH: o ponto tem telas e duas
// coleções só dele. Espremido numa aba, ele empurrava o RH para sete abas que
// não cabem na largura do celular — e o RH carregava "rh_ponto" e
// "rh_ponto_dia" em toda visita, mesmo de quem só ia ver férias.
//
// DUAS PORTAS PARA A MESMA TELA ENVELHECEM DESENCONTRADAS: a aba "Ponto" foi
// TIRADA do RH no mesmo commit. Lá ficou uma linha apontando para cá, e mais
// nada — quem procura o ponto no lugar velho é levado ao novo, em vez de achar
// uma cópia parada no tempo.
//
// Só a direção chega nesta rota (SO_DIRECAO em lib/sessao.js): ponto é dado de
// pessoa, mesma régua das coleções rh_*. O que a tela esconde é conforto — quem
// barra de verdade é o servidor, que confere o crachá em toda chamada.
//
// ============================================================================
// AS TRÊS ABAS (eram cinco em 28/08/2026 de manhã)
//
//   "Ponto"       → AbaPonto (components/rh/AbaPonto.jsx), inteira, com as
//                   mesmas props que a casca do RH passava. É o dia a dia:
//                   fechamento do mês e batidas, alternados por dentro dela.
//   "Faltas"      → components/ponto/Faltas.jsx
//   "Relatórios"  → components/ponto/Relatorios.jsx
//
// A ABA "PESSOAS DO RELÓGIO" DEIXOU DE EXISTIR, e o arquivo TrazerDoRelogio.jsx
// foi apagado junto — tela que ninguém abre mais é código que envelhece dizendo
// coisa errada. Ela pedia DOIS passos manuais numa casa de cadastro vazio:
// criar a ficha no RH e depois vincular a ficha ao relógio. Com o RH em zero
// fichas, o seletor de "vincular a qual ficha" abria sem opção nenhuma — foi
// exatamente o que o dono do sistema viu ("o vincular não apareceu as pessoas
// para vincular"). Hoje a Edge Function ml-ponto faz os três passos numa
// chamada só (ação "sincronizar"), e o vínculo NASCE pronto. O que era uma tela
// virou o botão da faixa do topo.
//
// POR QUE A ENTRADA CHAMA "PONTO", E NÃO "FECHAMENTO" E "BATIDAS" SEPARADOS. O
// AbaPonto guarda a escolha entre as duas visões num estado interno (`visao`) e
// não a aceita por prop. Duas abas aqui em cima que não trocassem a visão de lá
// embaixo seriam dois botões que não fazem nada — e botão que não faz nada é
// pior que a falta dele. O alternador de verdade é o do próprio AbaPonto.
//
// ----------------------------------------------------------------------------
// O MÊS DA FAIXA É DA FAIXA, e ela DIZ qual é, em letra grande. Pelo mesmo
// motivo de cima: cada aba guarda a competência dela por dentro, e a casca não
// tem como perguntar qual é. Um seletor mudo aqui em cima mostraria agosto no
// alto e julho na tabela. Então a faixa carrega o próprio seletor (que começa
// no mês de hoje) e escreve por extenso o mês que vai puxar — ninguém puxa um
// mês achando que puxou outro. Quando o AbaPonto aceitar a competência por
// prop, o seletor vira um só e vale para as três abas.
//
// ----------------------------------------------------------------------------
// IMPRESSÃO: o botão "Imprimir / PDF" chama a impressão do navegador — é por
// ela que sai o PDF ("Salvar como PDF" no destino). O que é controle sai
// marcado com `sem-impressao` e some no papel; o cabeçalho de papel
// (`apenas-impressao`) só existe impresso, para a folha dizer de onde veio, de
// quem e de quando. As regras estão em src/index.css.

import { useCallback, useEffect, useMemo, useState, useRef} from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Printer, RefreshCw, Users } from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { estadoDoRelogio, sincronizarPeriodo } from "../services/ponto.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { ymdLocal, dataLonga, MESES_LONGOS } from "../lib/format.js";
import { PageTitle, Card, Segmented, CarregandoModulo, ErroModulo, Aviso } from "../components/ui.jsx";
import AbaPonto from "../components/rh/AbaPonto.jsx";
import Faltas from "../components/ponto/Faltas.jsx";
import Relatorios from "../components/ponto/Relatorios.jsx";

const ABAS = [
  { valor: "ponto", rotulo: "Ponto" },
  { valor: "faltas", rotulo: "Faltas" },
  { valor: "relatorios", rotulo: "Relatórios" },
];

/* ============================================================================
   AS PALAVRAS DA FAIXA — fora de qualquer componente, porque são só texto e
   assim dá para lê-las todas juntas, que é como o usuário as lê.
   ========================================================================= */

const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

// "2026-08" → "agosto de 2026". Competência quebrada não vira frase bonita:
// devolve o que veio, para o defeito aparecer em vez de sumir.
function rotuloDoMes(competencia) {
  const [ano, mes] = String(competencia || "").split("-");
  const nome = MESES_LONGOS[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : String(competencia || "mês não escolhido");
}

// O último dia do mês, em "AAAA-MM-DD" local. new Date(ano, mes, 0) é o dia 0
// do mês SEGUINTE, que é o último deste — e acerta fevereiro bissexto sozinho.
function fimDoMes(competencia) {
  const [ano, mes] = competencia.split("-").map(Number);
  const dia = new Date(ano, mes, 0).getDate();
  return `${competencia}-${String(dia).padStart(2, "0")}`;
}

/* A frase da última leitura. Ela existe para responder, sem clicar em nada, a
   pergunta que o dono do sistema faz ao abrir a tela: "isto aqui está velho?".
   DADO AUSENTE NÃO É ZERO nem é "agora": sem carimbo, a frase diz que nunca
   foi lido — nunca inventa uma data. */
function fraseDaUltimaLeitura(ultima, hojeISO) {
  if (!ultima?.em) return "O relógio ainda não foi lido por aqui.";
  const d = new Date(ultima.em);
  if (Number.isNaN(d.getTime())) return "O relógio já foi lido, mas a data do registro não é legível.";
  const dia = ymdLocal(d);
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const quando = dia === hojeISO ? `hoje às ${hora}` : `em ${dataLonga(dia)} às ${hora}`;
  const periodo = ultima.de && ultima.ate ? ` (período de ${dataLonga(ultima.de)} a ${dataLonga(ultima.ate)})` : "";
  return `Relógio lido ${quando}${periodo}.`;
}

// O progresso EM PALAVRAS, enquanto roda. Botão parado parece travado, e a
// importação anda por janelas de pessoas — cada janela tem o que contar.
function fraseDoProgresso(p) {
  if (!p) return "Conversando com o relógio...";
  const partes = [];
  if (p.pessoasLidas > 0) partes.push(plural(p.pessoasLidas, "pessoa lida", "pessoas lidas"));
  if (p.fichasCriadas > 0) partes.push(plural(p.fichasCriadas, "ficha nova", "fichas novas"));
  if (p.diasGravados > 0) partes.push(plural(p.diasGravados, "dia trazido", "dias trazidos"));
  if (partes.length === 0) return `Janela ${p.janelas}: ainda sem novidade.`;
  return `Janela ${p.janelas}: ${partes.join(" · ")}.`;
}

/* O RESUMO EM UMA FRASE, com números de verdade.

   ZERO NÃO É RESULTADO. Se o relógio não devolveu dia nenhum, a frase NÃO é um
   "pronto!" verde: pode ser mês errado, relógio sem batida no período ou uma
   ponte que respondeu vazio. A tela manda conferir, em vez de ensinar a
   confiar no silêncio. Mês com tudo preservado (dias corrigidos à mão) é outro
   caso, e tem outra frase — ali o zero é medido, não é ausência. */
function lerResumo(r, competencia) {
  const mes = rotuloDoMes(competencia);
  const quantos =
    r.pessoasNoRelogio == null
      ? "o relógio não disse quantas pessoas tem"
      : `${plural(r.pessoasNoRelogio, "pessoa", "pessoas")} no relógio` +
        (r.ativas == null ? "" : ` (${r.ativas} ${r.ativas === 1 ? "ativa" : "ativas"})`);
  const fichas = r.fichasCriadas === 0 ? "nenhuma ficha nova" : plural(r.fichasCriadas, "ficha nova", "fichas novas");

  let tom = "ok";
  // O MÊS VAI NA FRASE também no sucesso: sem ele, quem puxou julho lia
  // "120 dias trazidos" e via as abas abrirem agosto vazio — e concluía que
  // a puxada falhou.
  let frase = `${quantos}, ${fichas}, ${plural(r.diasGravados, "dia trazido", "dias trazidos")} em ${mes}.`;
  if (r.diasGravados === 0 && r.preservados === 0) {
    tom = "warn";
    frase = `O relógio não devolveu batida nenhuma em ${mes} — confira o mês. Li ${quantos}.`;
  } else if (r.diasGravados === 0) {
    tom = "warn";
    frase =
      `Nenhum dia NOVO em ${mes}: os ${r.preservados} dias deste período já estavam corrigidos à mão e foram ` +
      `preservados. Li ${quantos}.`;
  }

  /* Rodada parada no teto de janelas NÃO é sucesso: o serviço se deu ao
     trabalho de calcular `incompleto` justamente para a frase não dizer
     "pronto" pela metade. */
  if (r.incompleto) {
    tom = "warn";
    frase += " Parei no limite de janelas — falta terminar o período.";
  }

  const detalhes = [];
  if (r.fichasCompletadas > 0) {
    detalhes.push(`${plural(r.fichasCompletadas, "ficha teve", "fichas tiveram")} campos vazios completados pelo relógio`);
  }
  if (r.preservados > 0 && r.diasGravados > 0) {
    detalhes.push(`${plural(r.preservados, "dia corrigido", "dias corrigidos")} à mão foram preservados`);
  }
  if (r.vinculados > 0) detalhes.push(`${plural(r.vinculados, "dia sem dono ganhou", "dias sem dono ganharam")} ficha`);
  if (r.removidas > 0) detalhes.push(`${plural(r.removidas, "pessoa removida", "pessoas removidas")} no relógio`);

  return { tom, frase, detalhes, mes };
}

/* ============================================================================
   A FAIXA DE SINCRONIZAÇÃO — o rosto do módulo.

   Fica FORA do componente da página de propósito: componente declarado dentro
   remonta a cada render (e o lint reprova).

   Ela é a única porta do "puxar" na casca. O AbaPonto tem um botão próprio de
   puxar, que só importa as batidas do mês dele — este aqui faz o serviço
   inteiro, numa chamada: cria ficha, completa campo vazio, traz o dia e carimba
   o dono do dia.
   ========================================================================= */
function FaixaDoRelogio({ competencia, setCompetencia, anos, hojeISO, editavel, setAviso, aoTerminar }) {
  // O último progresso, para o catch saber até onde a rodada foi.
  const progressoRef = useRef(null);
  // null = AINDA NÃO PERGUNTEI, que não é o mesmo que "desligado". A faixa não
  // oferece um botão que vai falhar, mas também não afirma que está desligado
  // antes de o servidor responder.
  const [estado, setEstado] = useState(null);
  const [estadoFalhou, setEstadoFalhou] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState(null);

  const perguntarEstado = useCallback(() => {
    estadoDoRelogio()
      .then((e) => {
        setEstado(e);
        setEstadoFalhou(null);
      })
      .catch((e) => setEstadoFalhou(e.message));
  }, []);

  useEffect(() => {
    perguntarEstado();
  }, [perguntarEstado]);

  const puxar = async () => {
    if (rodando) return;
    const de = `${competencia}-01`;
    const ate = fimDoMes(competencia);
    setRodando(true);
    setProgresso(null);
    setResumo(null);
    progressoRef.current = null;
    try {
      const r = await sincronizarPeriodo(de, ate, (p) => {
        progressoRef.current = p;
        setProgresso(p);
      });
      const lido = lerResumo(r, competencia);
      setResumo({ ...r, ...lido });
      // Aviso no SUCESSO e no ERRO — e o aviso do "zero dias" não sai verde,
      // senão o mês errado passaria por trabalho feito.
      setAviso({
        tipo: lido.tom === "ok" ? "ok" : "erro",
        texto: lido.tom === "ok" ? `Relógio lido: ${lido.frase}` : lido.frase,
      });
    } catch (e) {
      /* O QUE JÁ ENTROU, ENTROU. Cada janela grava no servidor antes de
         devolver, então parar no meio não desfaz nada — mas a tela apagava o
         resumo e não repintava, e quem lia concluía que nada tinha sido
         gravado. Aqui o progresso parcial vira o resumo, com tom de aviso e a
         frase dizendo até onde foi. */
      const parcial = progressoRef.current;
      if (parcial) {
        setResumo({
          ...parcial,
          tom: "warn",
          frase:
            `Parei no meio: ${plural(parcial.fichasCriadas || 0, "ficha nova", "fichas novas")} e ` +
            `${plural(parcial.diasGravados || 0, "dia trazido", "dias trazidos")} em ${rotuloDoMes(competencia)} ` +
            `já foram gravados. Motivo: ${e.message}`,
        });
      } else {
        setResumo(null);
      }
      setAviso({ tipo: "erro", texto: `Não consegui terminar: ${e.message}` });
    } finally {
      setRodando(false);
      setProgresso(null);
      /* Repinta SEMPRE, inclusive no erro: o carimbo da última leitura e as
         abas têm de mostrar o que chegou até parar. */
      perguntarEstado();
      aoTerminar?.();
    }
  };

  const [ano, mes] = competencia.split("-");
  const desligado = estado && estado.ligado === false;
  const rotulo = rotuloDoMes(competencia);

  return (
    <Card className="sem-impressao mb-6 border-l-4 border-l-brand">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        {/* basis-72 é o PISO da coluna de texto, e não enfeite: com flex-1
            sozinho (base 0) a linha nunca quebra — o bloco dos controles fica
            do lado e espreme o texto até virar uma coluna de uma letra. Com um
            piso de 18rem, quando os dois não cabem juntos os controles descem
            para a linha de baixo, inteiros. */}
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
            <RefreshCw size={18} strokeWidth={2.5} className="text-brand" />
            Puxar do relógio
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Uma chamada só: cria a ficha de quem ainda não tem, completa o que está vazio, traz os dias do mês e já
            deixa cada dia com dono. Não é preciso importar planilha nem vincular ninguém à mão.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {estadoFalhou
              ? `Não consegui perguntar ao servidor quando foi a última leitura: ${estadoFalhou}`
              : estado
                ? fraseDaUltimaLeitura(estado.ultima, hojeISO)
                : "Perguntando ao servidor quando foi a última leitura..."}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="fx-mes">Mês que vou puxar</label>
            <select
              id="fx-mes"
              className="select w-36"
              value={mes}
              disabled={rodando}
              onChange={(e) => { setResumo(null); setCompetencia(`${ano}-${e.target.value}`); }}
            >
              {MESES_LONGOS.map((nome, i) => (
                <option key={nome} value={String(i + 1).padStart(2, "0")}>{nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fx-ano">Ano</label>
            <select
              id="fx-ano"
              className="select w-28"
              value={ano}
              disabled={rodando}
              onChange={(e) => { setResumo(null); setCompetencia(`${e.target.value}-${mes}`); }}
            >
              {anos.map((a) => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          </div>
          {editavel && !desligado && (
            <button
              type="button"
              className="btn-primary px-6 py-3 text-base"
              onClick={puxar}
              disabled={rodando}
              title={`Busca no Jibble as pessoas e as batidas de ${rotulo}`}
            >
              <RefreshCw size={18} strokeWidth={2.5} className={rodando ? "animate-spin" : undefined} />
              {rodando
                ? progresso?.pessoasLidas > 0
                  ? `Puxando... ${plural(progresso.pessoasLidas, "pessoa", "pessoas")}`
                  : "Puxando..."
                : "Puxar do relógio"}
            </button>
          )}
        </div>
      </div>

      {/* O MÊS POR EXTENSO, sempre à vista. O seletor diz "agosto" numa caixa
          pequena; esta linha diz a frase inteira, para ninguém puxar um mês
          achando que puxou outro. */}
      <p className="mt-4 border-t pt-3 text-sm text-slate-600" style={{ borderColor: "var(--hairline)" }}>
        Vai puxar o <strong className="font-semibold text-slate-900">mês de {rotulo}</strong> — de{" "}
        {dataLonga(`${competencia}-01`)} a {dataLonga(fimDoMes(competencia))}.
      </p>

      {desligado && (
        <div className="mt-3 rounded-xl border border-warn-200 bg-warn-50 p-3 text-sm text-warn-800">
          <p className="font-display font-semibold">O relógio ainda não foi ligado neste servidor.</p>
          <p className="mt-1">
            Faltam os segredos do Jibble (ML_JIBBLE_CLIENT_ID e ML_JIBBLE_CLIENT_SECRET) na Edge Function ml-ponto. Não
            adianta clicar em puxar: a chamada volta com erro. Enquanto isso o ponto funciona à mão — as batidas e as
            faltas podem ser lançadas nas abas abaixo.
          </p>
        </div>
      )}

      {!editavel && !desligado && (
        <p className="mt-3 text-sm text-slate-500">
          Seu acesso é de leitura: dá para ver o que já foi lido, mas puxar do relógio grava ficha e dia.
        </p>
      )}

      {rodando && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
          <RefreshCw size={14} className="animate-spin text-brand" />
          {fraseDoProgresso(progresso)}
        </p>
      )}

      {resumo && !rodando && (
        <div
          className={
            resumo.tom === "ok"
              ? "mt-3 rounded-xl border border-ok-200 bg-ok-50 p-3"
              : "mt-3 rounded-xl border border-warn-200 bg-warn-50 p-3"
          }
        >
          <p className={resumo.tom === "ok" ? "text-sm font-medium text-ok-800" : "text-sm font-medium text-warn-800"}>
            {resumo.frase}
          </p>
          {resumo.detalhes.length > 0 && (
            <p className="mt-1 text-xs text-slate-600">{resumo.detalhes.join(" · ")}.</p>
          )}
          {/* Parar no teto de janelas em silêncio seria dizer "pronto" para um
              trabalho pela metade. */}
          {resumo.incompleto && (
            <p className="mt-1 text-xs font-medium text-warn-800">
              Parei no limite de janelas desta rodada — clique em puxar de novo para terminar o mês.
            </p>
          )}
        </div>
      )}

      {/* AS DIVERGÊNCIAS. O painel APONTA e não mexe: desligar alguém é ato
          trabalhista, tem data e verbas, e quem faz isso é o RH. */}
      {resumo && !rodando && resumo.divergencias.length > 0 && (
        <div className="mt-3 rounded-xl border border-warn-200 bg-white p-3">
          <p className="flex items-center gap-2 font-display text-sm font-semibold text-warn-800">
            <AlertTriangle size={15} />
            {plural(resumo.divergencias.length, "pessoa está", "pessoas estão")} numa situação no relógio e noutra na ficha
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {resumo.divergencias.map((d, i) => (
              <li key={`${d.nome}-${d.noRelogio}-${d.naFicha}-${i}`}>
                <strong className="font-semibold">{d.nome || "pessoa sem nome na ficha"}</strong>: {d.noRelogio} no
                relógio, {d.naFicha} na ficha.
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">
            O painel NÃO desliga ninguém sozinho: desligamento tem data e verbas, e é o RH que faz. Aqui fica só o
            aviso.
          </p>
          <Link to="/rh" className="btn-outline mt-2">
            Resolver no RH <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>
      )}
    </Card>
  );
}

/* O cabeçalho que SÓ existe no papel. Folha impressa circula solta: sem dizer
   de que sistema saiu, de qual mês e de quando, ela vira um número sem dono na
   mesa de alguém. Fica fora do componente da página de propósito — componente
   declarado dentro remonta a cada render (e o lint reprova). */
function CabecalhoDoPapel({ hojeISO, aba, sessao }) {
  const nomeDaAba = ABAS.find((a) => a.valor === aba)?.rotulo || "";
  return (
    <div className="apenas-impressao mb-4 border-b pb-2" style={{ borderColor: "var(--hairline)" }}>
      <p className="font-display text-base font-bold">MinasLab — Ponto · {nomeDaAba}</p>
      <p className="text-xs">
        Impresso em {dataLonga(hojeISO)} por {sessao?.nome || sessao?.usuario || "usuário sem nome"} ·
        Painel de Gestão MinasLab
      </p>
    </div>
  );
}

export default function Ponto() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [dados, setDados] = useState(null); // { pessoas, ponto, pontoDia }
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aba, setAba] = useState("ponto");
  const [salvando, setSalvando] = useState(false);
  // "Hoje" é ESTADO, nunca uma constante do módulo: esta tela fica aberta de um
  // dia para o outro na sala da direção, e um dia congelado faz a folha do mês
  // errado parecer a do mês corrente.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));
  // A competência DA FAIXA (ver o cabeçalho): começa no mês de hoje e só muda
  // quando alguém troca o seletor da faixa.
  const [competencia, setCompetencia] = useState(() => ymdLocal(new Date()).slice(0, 7));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    Promise.all([listar("rh_pessoas"), listar("rh_ponto"), listar("rh_ponto_dia")])
      .then(([pessoas, ponto, pontoDia]) => {
        setDados({ pessoas, ponto, pontoDia });
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (dados
        // existe). Sem este aviso, a recarga que falha deixaria a tela velha em
        // silêncio — e o mês fechado a partir dela seria fechado às cegas.
        setAviso({
          tipo: "erro",
          texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga.",
        });
      });
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Voltou para a aba: refaz a conta do dia e busca o que chegou (uma
  // importação do relógio pode ter rodado noutra janela).
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [recarregar]);

  // Quem está no quadro, já ordenado por nome — é o contrato que as abas
  // esperam receber pronto, para nenhuma delas ordenar de um jeito diferente.
  const ativos = useMemo(() => {
    if (!dados) return [];
    const norm = (s) => String(s || "").toLowerCase();
    return dados.pessoas
      .filter((p) => p.ativo !== false)
      .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
  }, [dados]);

  /* Os anos que o seletor da faixa oferece: o de hoje MAIS todo ano que já tem
     dado gravado. Uma lista fixa envelheceria em silêncio, e uma lista só com o
     que existe travaria a primeira leitura de um ano novo. */
  const anos = useMemo(() => {
    const set = new Set([Number(hojeISO.slice(0, 4))]);
    for (const d of dados?.pontoDia || []) {
      const a = Number(String(d?.data || "").slice(0, 4));
      if (a) set.add(a);
    }
    for (const p of dados?.ponto || []) {
      const a = Number(String(p?.competencia || "").slice(0, 4));
      if (a) set.add(a);
    }
    return [...set].sort((a, b) => b - a);
  }, [dados, hojeISO]);

  /* A ÚNICA PORTA DE ESCRITA do módulo: nenhuma aba fala com services/dados.js
     por conta própria. Aviso no SUCESSO e no ERRO, e recarga depois — gravação
     que só avisa quando dá certo ensina a confiar no silêncio. */
  const gravarRegistro = async (colecao, registro, fraseOk, fechar) => {
    setSalvando(true);
    try {
      await salvar(colecao, registro);
      fechar?.();
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // O window.confirm fica em quem chama, junto do texto que faz sentido para
  // aquele registro.
  const apagarRegistro = async (colecao, id, fraseOk) => {
    try {
      await apagar(colecao, id);
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    }
  };

  if (erro && !dados) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!dados) return <CarregandoModulo />;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <CabecalhoDoPapel hojeISO={hojeISO} aba={aba} sessao={sessao} />

      <PageTitle
        titulo="Ponto"
        descricao="O relógio da MinasLab é o Jibble. Puxe o mês no topo — o painel busca as pessoas e as batidas de uma vez — e confira aqui embaixo o dia, o fechamento, as faltas e os relatórios."
        acao={
          <div className="sem-impressao flex flex-wrap items-center gap-2">
            {/* Imprimir não é escrita: quem só consulta também leva a folha.
                O PDF sai daqui — no destino da impressão, "Salvar como PDF". */}
            <button
              type="button"
              className="btn-outline"
              onClick={() => window.print()}
              title="Imprimir esta tela (ou salvar como PDF no destino da impressão)"
            >
              <Printer size={16} strokeWidth={2.5} /> Imprimir / PDF
            </button>
            <Link to="/rh" className="btn-ghost">
              <Users size={16} strokeWidth={2.5} /> Ir para o RH
            </Link>
          </div>
        }
      />

      <FaixaDoRelogio
        competencia={competencia}
        setCompetencia={setCompetencia}
        anos={anos}
        hojeISO={hojeISO}
        editavel={editavel}
        setAviso={setAviso}
        aoTerminar={recarregar}
      />

      {/* As abas não cabem na largura do celular. Sem o overflow aqui, a PÁGINA
          INTEIRA passava a rolar de lado. */}
      <div className="sem-impressao mb-4 max-w-full overflow-x-auto pb-1">
        <Segmented opcoes={ABAS} valor={aba} onChange={setAba} />
      </div>

      {aba === "ponto" && (
        <AbaPonto
          pessoas={dados.pessoas}
          ativos={ativos}
          ponto={dados.ponto}
          pontoDia={dados.pontoDia}
          hojeISO={hojeISO}
          editavel={editavel}
          gravar={gravarRegistro}
          apagarReg={apagarRegistro}
          setAviso={setAviso}
          recarregar={recarregar}
        />
      )}

      {aba === "faltas" && (
        <Faltas
          pessoas={dados.pessoas}
          ativos={ativos}
          pontoDia={dados.pontoDia}
          hojeISO={hojeISO}
          editavel={editavel}
          salvando={salvando}
          gravar={gravarRegistro}
          apagarReg={apagarRegistro}
          setAviso={setAviso}
          recarregar={recarregar}
        />
      )}

      {aba === "relatorios" && (
        <Relatorios
          pessoas={dados.pessoas}
          ativos={ativos}
          ponto={dados.ponto}
          pontoDia={dados.pontoDia}
          hojeISO={hojeISO}
          setAviso={setAviso}
        />
      )}
    </div>
  );
}
