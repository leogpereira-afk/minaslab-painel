// Ponto → aba PESSOAS DO RELÓGIO. A ponte entre quem existe no JIBBLE e quem
// existe no RH: lista as pessoas cadastradas no relógio (ativas e removidas),
// diz quem já tem ficha, e cria as fichas que faltam com os dados que o
// relógio já tem.
//
// ID MANDA, NOME SÓ EXIBE. O vínculo gravado é `jibbleId` na ficha do RH — é
// por ele que a batida importada casa com a pessoa (o dia de "rh_ponto_dia"
// chega com jibbleId, nunca com a ficha). Casar por nome cria sósia quando dois
// nomes são iguais e some com a pessoa que trocou de nome. Nome que não acha
// NÃO prova ausência: por isso, antes de criar, esta tela procura ficha
// parecida entre as que ainda não têm vínculo e OFERECE VINCULAR em vez de
// duplicar. Quem confirma é gente.
//
// ZERO NÃO É RESULTADO. Lista vazia pode ser "ninguém cadastrado no relógio" ou
// "não consegui falar com o Jibble" — são coisas diferentes e a tela diz qual
// das duas. Enquanto a chamada está em voo ela diz que está buscando; se falha,
// diz que falhou e não apresenta lista curta como se fosse a verdade. E o
// `total` que a Edge Function devolve (@odata.count) é o caso de controle da
// própria lista: a busca traz 200 por vez, e total maior que a lista significa
// lista cortada.
//
// QUEM JÁ TEM FICHA NÃO É SOBRESCRITO. A ficha do RH tem cargo, salário, CPF,
// banco, admissão conferida — o relógio tem cinco campos. Sobrescrever com o
// pouco apagaria o muito. O máximo que se oferece é preencher campo VAZIO da
// ficha, um a um, dizendo qual campo e com qual valor.
//
// A ADMISSÃO É O PONTO DELICADO. `entrouNoRelogio` é o dia em que a pessoa
// entrou NO RELÓGIO, não na empresa: quem já trabalhava aqui antes de o Jibble
// existir tem admissão anterior. Vai gravada como SUGESTÃO, com
// `admissaoConferida: false`, e a tela diz isso em toda parte. Admissão errada
// estraga férias, experiência e 13º — e estraga em silêncio, meses depois.
//
// DIVERGÊNCIA DE SITUAÇÃO É APONTADA, NUNCA CORRIGIDA SOZINHA. Removida no
// relógio com ficha ativa (ou o contrário) vai para um bloco próprio, com a
// frase do que diverge e o caminho para o RH. Desligar alguém é ato
// trabalhista, com data e verbas: não pode ser consequência silenciosa de um
// cadastro em outro sistema.
//
// ============================================================================
// CONTRATO — props que esta aba recebe da casca (pages/Ponto.jsx)
// ----------------------------------------------------------------------------
//   pessoas    Object[]  todas as fichas (rh_pessoas), ativas e desligadas.
//   ativos     Object[]  só o quadro, já ordenado por nome (não usado aqui: a
//                        ponte precisa enxergar quem já saiu para não recriar a
//                        ficha de quem foi desligado).
//   pontoDia   Object[]  "rh_ponto_dia" inteira — de onde sai quantos dias cada
//                        jibbleId já trouxe, e quais ids trouxeram batida sem
//                        ninguém por trás.
//   hojeISO    string    "AAAA-MM-DD" local (não usado: aqui não há competência).
//   editavel   boolean   esconde tudo que escreve.
//   salvando   boolean   true enquanto uma gravação da casca está em voo.
//   gravar     (colecao, registro, fraseOk, fechar?) => Promise<void>
//   setAviso   (aviso|null) => void
//   recarregar () => void
//
// COMO SE CONTA O QUE DEU CERTO NO LOTE: `gravar` da casca engole o erro (ela
// mesma avisa) e não devolve nada — mas só chama o quarto argumento DEPOIS de
// o servidor confirmar. É por esse callback que o laço sabe quem gravou; sem
// ele, "criei 13 fichas" seria uma frase sem prova, que é como nasce relatório
// bonito de gravação que não aconteceu.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  RefreshCw,
  Search,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { pessoasDoRelogio } from "../../services/ponto.js";
import { dataLonga } from "../../lib/format.js";
import { Card, Empty, SectionTitle, Skeleton, StatCard } from "../ui.jsx";

const txt = (v) => String(v ?? "").trim();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Data de dia é "AAAA-MM-DD" e ponto. O relógio devolve um ISO cortado em 10
// caracteres: se vier vazio, meia data ou lixo, NÃO vira data na ficha — data
// inventada em campo de admissão anda calada até a hora das férias.
const ehDataISO = (v) => /^\d{4}-\d{2}-\d{2}$/.test(txt(v));
const dataOuNada = (iso) => (ehDataISO(iso) ? dataLonga(iso) : "");

// Comparação de nome só para SUGERIR ficha parecida — nunca para decidir.
const norm = (s) =>
  txt(s)
    .toLowerCase()
    .normalize("NFD")
    // Os acentos vão pelo ESCAPE, não pelo caractere combinante cru: colado no
    // arquivo, ele some no primeiro editor que normaliza o texto, e o filtro
    // passa a deixar acento passar sem ninguém ver.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

/* Os campos que o relógio conhece e a ficha do RH também tem. `nome` fica de
   fora de propósito: é a identidade da ficha, e trocar identidade por um dado
   de outro sistema é o começo do sósia. */
const CAMPOS_DO_RELOGIO = [
  { campo: "apelido", rotulo: "Apelido", ler: (p) => txt(p.apelido) },
  { campo: "email", rotulo: "E-mail", ler: (p) => txt(p.email) },
  { campo: "telefone", rotulo: "Telefone", ler: (p) => txt(p.telefone) },
  { campo: "matricula", rotulo: "Matrícula", ler: (p) => txt(p.matricula) },
  {
    campo: "admissao",
    rotulo: "Admissão",
    ler: (p) => (ehDataISO(p.entrouNoRelogio) ? txt(p.entrouNoRelogio) : ""),
    mostrar: dataLonga,
    // Sugestão, não verdade: quem preencher por aqui deixa o carimbo de "a
    // conferir" ligado junto.
    sugestao: true,
    extra: { admissaoConferida: false },
  },
];

/* A FICHA QUE NASCE DO RELÓGIO. Campo por campo, sem `id` (services/dados.js
   gera) e sem inventar o que o relógio não tem — ficha nova com campo vazio é
   ficha honesta; ficha nova com campo chutado é mentira que ninguém revisa. */
function fichaDoRelogio(p) {
  const entrada = ehDataISO(p.entrouNoRelogio) ? txt(p.entrouNoRelogio) : "";
  const saida = ehDataISO(p.removidoEm) ? txt(p.removidoEm) : "";
  return {
    nome: txt(p.nome),
    apelido: txt(p.apelido),
    email: txt(p.email),
    telefone: txt(p.telefone),
    matricula: txt(p.matricula),
    // O vínculo. É ele que faz as batidas já importadas casarem com esta ficha.
    jibbleId: txt(p.jibbleId),
    ativo: !!p.ativoNoRelogio,
    // Removida no relógio nasce desligada com a data do relógio; ativa nasce
    // sem data nenhuma (e não com "" fingindo de data preenchida em outro lugar).
    desligadoEm: p.ativoNoRelogio ? "" : saida,
    // SUGESTÃO: o dia em que entrou no relógio, não na empresa.
    admissao: entrada,
    // O carimbo que mantém a dúvida visível até alguém do RH conferir. Fica
    // `false` de propósito: ausente seria "ninguém sabe se precisa conferir".
    admissaoConferida: false,
  };
}

/* Ficha que PODE ser esta pessoa, entre as que ainda não têm vínculo. Devolve
   o motivo junto — sugestão sem o porquê vira palpite que alguém aceita no
   automático. Ordem do mais forte para o mais fraco. */
function candidatasDaPessoa(p, fichasSemVinculo) {
  const mat = norm(p.matricula);
  const mail = norm(p.email);
  const nome = norm(p.nome);
  const partes = nome.split(" ").filter(Boolean);
  const primeiro = partes[0] || "";
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : "";

  const achadas = [];
  for (const f of fichasSemVinculo) {
    const fnome = norm(f.nome);
    const fpartes = fnome.split(" ").filter(Boolean);
    let motivo = "";
    if (mat && norm(f.matricula) === mat) motivo = `mesma matrícula (${txt(p.matricula)})`;
    else if (mail && norm(f.email) === mail) motivo = `mesmo e-mail (${txt(p.email)})`;
    else if (nome && fnome === nome) motivo = "mesmo nome";
    else if (primeiro && ultimo && fpartes.length > 1 && fpartes[0] === primeiro && fpartes[fpartes.length - 1] === ultimo)
      motivo = "mesmo primeiro e último nome";
    if (motivo) achadas.push({ ficha: f, motivo });
  }
  return achadas;
}

// Os campos VAZIOS da ficha que o relógio saberia preencher.
function camposParaPreencher(ficha, p) {
  if (!ficha) return [];
  return CAMPOS_DO_RELOGIO.map((c) => ({ ...c, valor: c.ler(p) })).filter(
    (c) => c.valor && !txt(ficha[c.campo])
  );
}

// ============================================================================
// Peças da tela. Todas FORA do componente da página: componente declarado
// dentro remonta a subárvore a cada render (e o lint reprova).
// ============================================================================

function Dado({ rotulo, valor }) {
  const v = txt(valor);
  return (
    <div className="min-w-0">
      <span className="block font-display text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {rotulo}
      </span>
      {/* Vazio diz "sem registro" — nunca um traço solto que se lê como zero. */}
      <span className={clsx("block truncate text-xs", v ? "text-slate-700" : "text-slate-400")}>
        {v || "sem registro"}
      </span>
    </div>
  );
}

function ChipsDaPessoa({ p }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {p.divergeAtivo && <span className="chip-bad">divergente</span>}
      {p.temFicha && !p.divergeAtivo && <span className="chip-ok">já tem ficha</span>}
      {!p.temFicha && (
        <span className="chip-warn">{p.candidatas.length ? "sem ficha — pode já existir" : "sem ficha"}</span>
      )}
      {/* A ficha nasceu daqui e ninguém conferiu a admissão ainda. Só `false`
          acende: ficha antiga, que nunca teve o campo, chega `undefined` — e
          ausente não é false. */}
      {p.ficha?.admissaoConferida === false && <span className="chip-warn">admissão a conferir</span>}
      {p.dias > 0 && (
        <span className="chip">
          {plural(p.dias, "dia importado", "dias importados")}
          {p.ultimoDia ? ` · até ${dataLonga(p.ultimoDia)}` : ""}
        </span>
      )}
    </span>
  );
}

function OfertaDeVinculo({ p, editavel, ocupado, aoVincular }) {
  if (p.temFicha || !p.candidatas.length) return null;
  return (
    <div className="mt-2 rounded-xl bg-warn-50 p-3">
      <p className="text-xs font-medium text-warn-800">
        Pode já ter ficha no RH, sem vínculo com o relógio. Criar outra faria duas pessoas iguais no quadro.
      </p>
      <div className="mt-2 space-y-1.5">
        {p.candidatas.map(({ ficha, motivo }) => (
          <div key={ficha.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 flex-1 basis-48 truncate text-xs text-slate-700">
              <span className="font-display font-medium text-slate-900">{ficha.nome}</span>
              {ficha.ativo === false && <span className="text-slate-500"> (desligado)</span>}
              <span className="text-slate-500"> — {motivo}</span>
            </span>
            {editavel && (
              <button
                type="button"
                className="sem-impressao btn-outline px-3 py-1.5 text-xs"
                disabled={ocupado}
                onClick={() => aoVincular(p, ficha)}
                title={`Gravar o id do relógio ${p.jibbleId} na ficha de ${ficha.nome}`}
              >
                <Link2 size={13} /> Vincular a esta ficha
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OfertaDePreenchimento({ p, editavel, ocupado, aoPreencher }) {
  if (!p.temFicha || !p.faltando.length) return null;
  return (
    <div className="mt-2 rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-600">
        A ficha do RH manda — ela não é sobrescrita. Estes campos dela estão VAZIOS e o relógio tem valor. Preencha um a
        um, se quiser:
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {p.faltando.map((c) => {
          const visivel = c.mostrar ? c.mostrar(c.valor) : c.valor;
          return editavel ? (
            <button
              key={c.campo}
              type="button"
              className="sem-impressao btn-outline px-3 py-1.5 text-xs"
              disabled={ocupado}
              onClick={() => aoPreencher(p, c)}
            >
              Preencher {c.rotulo.toLowerCase()} com “{visivel}”{c.sugestao ? " (sugestão)" : ""}
            </button>
          ) : (
            <span key={c.campo} className="chip">
              {c.rotulo.toLowerCase()}: “{visivel}”
            </span>
          );
        })}
      </div>
      {p.faltando.some((c) => c.sugestao) && (
        <p className="mt-2 text-xs text-warn-700">
          A admissão é sugestão da entrada no relógio, não da entrada na empresa. Preenchendo por aqui, a ficha fica
          marcada como “admissão a conferir”.
        </p>
      )}
    </div>
  );
}

function LinhaDoRelogio({ p, marcada, editavel, ocupado, aoMarcar, aoVincular, aoPreencher }) {
  const nomeDaFicha = p.ficha && norm(p.ficha.nome) !== norm(p.nome) ? txt(p.ficha.nome) : "";
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {editavel && !p.temFicha && (
          <span className="sem-impressao flex shrink-0 items-center pt-0.5">
            <label className="sr-only" htmlFor={`rel-${p.jibbleId}`}>
              Escolher {txt(p.nome) || p.jibbleId} para criar ficha
            </label>
            <input
              id={`rel-${p.jibbleId}`}
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand-300"
              checked={marcada}
              onChange={() => aoMarcar(p.jibbleId)}
            />
          </span>
        )}
        <span className="min-w-0 flex-1 basis-56">
          <span className="block truncate font-display text-sm font-medium text-slate-900">
            {txt(p.nome) || <span className="text-bad-700">sem nome no relógio</span>}
            {txt(p.apelido) && <span className="font-normal text-slate-400"> · {txt(p.apelido)}</span>}
          </span>
          <span className="block truncate text-xs text-slate-500">
            relógio {p.jibbleId}
            {nomeDaFicha && <span> · a ficha vinculada se chama “{nomeDaFicha}”</span>}
          </span>
        </span>
        <ChipsDaPessoa p={p} />
      </div>

      <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        <Dado rotulo="E-mail" valor={p.email} />
        <Dado rotulo="Telefone" valor={p.telefone} />
        <Dado rotulo="Matrícula" valor={p.matricula} />
        <Dado
          rotulo="Entrou no relógio"
          valor={
            dataOuNada(p.entrouNoRelogio) ||
            (txt(p.entrouNoRelogio) ? `data ilegível (${txt(p.entrouNoRelogio)})` : "")
          }
        />
      </div>

      {!p.ativoNoRelogio && (
        <p className="mt-2 text-xs text-slate-500">
          Removida do relógio{dataOuNada(p.removidoEm) ? ` em ${dataOuNada(p.removidoEm)}` : " (sem data no relógio)"}
          {txt(p.statusRelogio) ? ` · situação no Jibble: ${txt(p.statusRelogio)}` : ""}
        </p>
      )}

      <OfertaDeVinculo p={p} editavel={editavel} ocupado={ocupado} aoVincular={aoVincular} />
      <OfertaDePreenchimento p={p} editavel={editavel} ocupado={ocupado} aoPreencher={aoPreencher} />
    </div>
  );
}

function ListaDoRelogio({ titulo, sub, icone: Icone, itens, vazio, marcados, editavel, ocupado, acoes }) {
  // As "seguras" desta lista: sem ficha E sem nenhuma ficha parecida no RH.
  const semFichaSeguras = itens.filter((p) => !p.temFicha && !p.candidatas.length);
  return (
    <Card className="mb-4">
      <SectionTitle
        titulo={
          <span className="inline-flex items-center gap-2">
            <Icone size={18} strokeWidth={2.2} /> {titulo} ({itens.length})
          </span>
        }
        sub={sub}
        acao={
          editavel && semFichaSeguras.length > 0 ? (
            <button
              type="button"
              className="sem-impressao btn-outline px-3 py-1.5 text-xs"
              title="Não entra quem parece já ter ficha no RH sem vínculo — essa é para vincular, não para criar de novo."
              onClick={() => acoes.marcarVarias(semFichaSeguras.map((p) => p.jibbleId))}
            >
              Marcar as {semFichaSeguras.length} sem ficha desta lista
            </button>
          ) : null
        }
      />
      {itens.length === 0 ? (
        <Empty>{vazio}</Empty>
      ) : (
        <div className="space-y-2">
          {itens.map((p) => (
            <LinhaDoRelogio
              key={p.jibbleId}
              p={p}
              marcada={marcados.has(p.jibbleId)}
              editavel={editavel}
              ocupado={ocupado}
              aoMarcar={acoes.alternar}
              aoVincular={acoes.vincular}
              aoPreencher={acoes.preencher}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function BlocoDivergencias({ itens }) {
  if (!itens.length) return null;
  return (
    <Card className="mb-4">
      <SectionTitle
        titulo={
          <span className="inline-flex items-center gap-2 text-bad-700">
            <AlertTriangle size={18} strokeWidth={2.2} /> Situação divergente ({itens.length})
          </span>
        }
        sub="O relógio diz uma coisa e a ficha do RH diz outra. Ninguém é desligado nem readmitido por causa disto: desligar é ato trabalhista, com data e verbas. A tela aponta — quem decide é o RH."
        acao={
          <Link to="/rh" className="sem-impressao btn-outline px-3 py-1.5 text-xs">
            <Users size={13} /> Abrir o RH
          </Link>
        }
      />
      <div className="space-y-2">
        {itens.map((p) => (
          <div key={p.jibbleId} className="rounded-xl bg-bad-50 p-3">
            <p className="font-display text-sm font-medium text-slate-900">
              {txt(p.nome) || `relógio ${p.jibbleId}`}
            </p>
            <p className="mt-0.5 text-xs text-bad-800">
              {p.ativoNoRelogio
                ? `Ativa no relógio, mas a ficha do RH está desligada${
                    dataOuNada(p.ficha?.desligadoEm) ? ` em ${dataOuNada(p.ficha.desligadoEm)}` : ""
                  }.`
                : `Removida do relógio${
                    dataOuNada(p.removidoEm) ? ` em ${dataOuNada(p.removidoEm)}` : ""
                  }, mas a ficha do RH está ativa.`}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* Id do relógio que JÁ TROUXE BATIDA e não é ninguém: nem está na lista do
   relógio, nem tem ficha. Órfão quase sempre é id variante — o dia dele existe
   e vale dinheiro, então ele aparece para ser reconectado, nunca para ser
   apagado daqui. Só se calcula quando a lista do relógio veio inteira: dizer
   "não está no relógio" a partir de uma busca que falhou é deduzir ausência. */
function BlocoOrfaos({ itens }) {
  if (!itens.length) return null;
  return (
    <Card className="mb-4">
      <SectionTitle
        titulo="Batida sem ninguém por trás"
        sub="Ids do relógio com dia importado que não aparecem na lista do Jibble nem em ficha nenhuma. Não apague o dia: o vínculo se conserta na aba Fechamento e Batidas, escolhendo a ficha do id."
      />
      <div className="space-y-2">
        {itens.map((o) => (
          <div key={o.jibbleId} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            <span className="font-display font-medium text-slate-900">{o.nome || "sem nome na batida"}</span>{" "}
            <span className="text-slate-500">
              · relógio {o.jibbleId} · {plural(o.dias, "dia", "dias")}
              {o.ultimo ? ` · até ${dataLonga(o.ultimo)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================

export default function TrazerDoRelogio({
  pessoas,
  pontoDia,
  editavel,
  salvando,
  gravar,
  setAviso,
  recarregar,
}) {
  // A lista do relógio NÃO vem da casca: é chamada de rede, e toda medição por
  // rede leva o próprio estado de carregando/erro.
  const [relogio, setRelogio] = useState(null);
  const [buscando, setBuscando] = useState(true);
  const [erroRelogio, setErroRelogio] = useState(null);
  const [marcados, setMarcados] = useState(() => new Set());
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");

  const buscar = useCallback(async () => {
    setBuscando(true);
    setErroRelogio(null);
    try {
      setRelogio(await pessoasDoRelogio());
    } catch (e) {
      // Erro NÃO zera o que já estava na tela — mas a tela DIZ que a última
      // busca falhou. Apagar a lista boa faria a rede ruim parecer "ninguém
      // cadastrado"; guardá-la calada faria o velho passar por novo.
      setErroRelogio(e.message);
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  // Quantos dias cada id do relógio já trouxe, e até quando.
  const batidasPorJibble = useMemo(() => {
    const m = new Map();
    for (const d of pontoDia || []) {
      const j = txt(d.jibbleId);
      if (!j) continue;
      const g = m.get(j) || { jibbleId: j, dias: 0, ultimo: "", nome: "" };
      g.dias += 1;
      const dia = txt(d.data);
      if (dia > g.ultimo) {
        g.ultimo = dia;
        g.nome = txt(d.pessoaNome) || g.nome;
      }
      m.set(j, g);
    }
    return m;
  }, [pontoDia]);

  const fichaPorJibble = useMemo(() => {
    const m = new Map();
    for (const f of pessoas || []) {
      const j = txt(f.jibbleId);
      if (j) m.set(j, f);
    }
    return m;
  }, [pessoas]);

  const fichasSemVinculo = useMemo(() => (pessoas || []).filter((f) => !txt(f.jibbleId)), [pessoas]);

  /* A lista do relógio, enriquecida com o que só a tela sabe: a ficha
     vinculada, os dias já importados, as fichas parecidas e os campos vazios.
     `temFicha` vem do servidor, mas é recalculado com as fichas que a casca
     acabou de recarregar — senão, logo depois de criar, a linha continuaria
     dizendo "sem ficha" até a próxima busca no Jibble. */
  const todas = useMemo(() => {
    if (!relogio) return [];
    return relogio.pessoas
      .filter((p) => txt(p.jibbleId))
      .map((p) => {
        const jibbleId = txt(p.jibbleId);
        const ficha = fichaPorJibble.get(jibbleId) || null;
        const batidas = batidasPorJibble.get(jibbleId) || null;
        const temFicha = !!ficha;
        return {
          ...p,
          jibbleId,
          ficha,
          temFicha,
          pessoaId: ficha?.id || "",
          // Recalculado com as fichas que a tela tem AGORA — a do servidor foi
          // contada na busca anterior, e entre uma e outra alguém pode ter
          // desligado a pessoa no RH.
          divergeAtivo: ficha ? (ficha.ativo !== false) !== !!p.ativoNoRelogio : false,
          dias: batidas?.dias || 0,
          ultimoDia: batidas?.ultimo || "",
          candidatas: temFicha ? [] : candidatasDaPessoa(p, fichasSemVinculo),
          faltando: camposParaPreencher(ficha, p),
        };
      })
      // Ordem por nome, a mesma do resto do painel: lista que muda de ordem a
      // cada busca faz a pessoa procurada trocar de lugar entre um olhar e outro.
      .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
  }, [relogio, fichaPorJibble, fichasSemVinculo, batidasPorJibble]);

  /* PENEIRA QUE CONTA. Pessoa do relógio sem id não dá para vincular nem para
     virar ficha (o vínculo É o id), então sai da lista — mas sai CONTADA. O
     filtro que descarta em silêncio é o que faz a tela mostrar 19 e ninguém
     nunca descobrir a vigésima. */
  const semIdNoRelogio = useMemo(
    () => (relogio ? relogio.pessoas.filter((p) => !txt(p.jibbleId)).length : 0),
    [relogio]
  );

  const visiveis = useMemo(() => {
    const q = norm(busca);
    if (!q) return todas;
    return todas.filter((p) =>
      [p.nome, p.apelido, p.email, p.matricula, p.jibbleId].some((v) => norm(v).includes(q))
    );
  }, [todas, busca]);

  const ativas = useMemo(() => visiveis.filter((p) => p.ativoNoRelogio), [visiveis]);
  const removidas = useMemo(() => visiveis.filter((p) => !p.ativoNoRelogio), [visiveis]);
  const divergentes = useMemo(() => todas.filter((p) => p.divergeAtivo), [todas]);

  const orfaos = useMemo(() => {
    if (!relogio) return [];
    const noRelogio = new Set(todas.map((p) => p.jibbleId));
    return [...batidasPorJibble.values()]
      .filter((g) => !noRelogio.has(g.jibbleId) && !fichaPorJibble.has(g.jibbleId))
      .sort((a, b) => b.dias - a.dias);
  }, [relogio, todas, batidasPorJibble, fichaPorJibble]);

  const semFicha = useMemo(() => todas.filter((p) => !p.temFicha), [todas]);
  const semFichaSeguras = useMemo(() => semFicha.filter((p) => !p.candidatas.length), [semFicha]);
  const escolhidas = useMemo(
    () => todas.filter((p) => marcados.has(p.jibbleId) && !p.temFicha),
    [todas, marcados]
  );

  const ocupado = salvando || criando;

  // ---- Ações -------------------------------------------------------------

  const alternar = (jibbleId) =>
    setMarcados((antes) => {
      const novo = new Set(antes);
      if (novo.has(jibbleId)) novo.delete(jibbleId);
      else novo.add(jibbleId);
      return novo;
    });

  const marcarVarias = (ids) =>
    setMarcados((antes) => {
      const novo = new Set(antes);
      for (const id of ids) novo.add(id);
      return novo;
    });

  /* VINCULAR: grava a FICHA INTEIRA com o campo trocado. Montar um objeto novo
     com os campos que esta tela conhece apagaria cargo, salário, CPF e banco —
     tudo que ela não leu. */
  const vincular = async (p, ficha) => {
    const outro = (pessoas || []).find((x) => x.id !== ficha.id && txt(x.jibbleId) === p.jibbleId);
    if (outro) {
      setAviso({
        tipo: "erro",
        texto: `O relógio ${p.jibbleId} já está vinculado a ${outro.nome}. Desvincule lá antes de trocar.`,
      });
      return;
    }
    if (
      !window.confirm(
        `Vincular a ficha de ${ficha.nome} ao relógio de ${txt(p.nome) || p.jibbleId} (id ${p.jibbleId})?\n\n` +
          "As batidas já importadas desse id passam a ser dessa pessoa. Nenhum outro campo da ficha é tocado."
      )
    )
      return;
    await gravar(
      "rh_pessoas",
      { ...ficha, jibbleId: p.jibbleId },
      `${ficha.nome} vinculado ao relógio ${p.jibbleId}.`,
      () => setMarcados((antes) => {
        const novo = new Set(antes);
        novo.delete(p.jibbleId);
        return novo;
      })
    );
    buscar();
  };

  // PREENCHER um campo vazio, um de cada vez, dizendo qual e com quê.
  const preencher = async (p, c) => {
    const ficha = p.ficha;
    if (!ficha) return;
    const visivel = c.mostrar ? c.mostrar(c.valor) : c.valor;
    if (
      !window.confirm(
        `Preencher ${c.rotulo.toLowerCase()} da ficha de ${ficha.nome} com “${visivel}”, vindo do relógio?` +
          (c.sugestao
            ? "\n\nA admissão do relógio é o dia em que a pessoa entrou NO RELÓGIO, não na empresa. A ficha fica marcada como “admissão a conferir”."
            : "")
      )
    )
      return;
    await gravar(
      "rh_pessoas",
      { ...ficha, [c.campo]: c.valor, ...(c.extra || {}) },
      `${c.rotulo} de ${ficha.nome} preenchido com o dado do relógio.`
    );
  };

  /* CRIAR AS FICHAS ESCOLHIDAS — uma a uma pela porta da casca, contando quem
     gravou de verdade (o quarto argumento só roda depois de o servidor
     confirmar). O aviso final diz o número e CITA PELO NOME quem falhou: "13
     criadas" com duas caladas no meio é o tipo de relatório que só se descobre
     errado na folha. */
  const criarEscolhidas = async () => {
    const alvos = escolhidas;
    if (!alvos.length) return;

    const comCandidata = alvos.filter((p) => p.candidatas.length);
    const alerta =
      comCandidata.length > 0
        ? `\n\nATENÇÃO: ${comCandidata
            .map((p) => txt(p.nome) || p.jibbleId)
            .join(", ")} ${comCandidata.length === 1 ? "parece já ter" : "parecem já ter"} ficha no RH sem vínculo. ` +
          "Criar aqui faria ficha repetida — o certo seria vincular."
        : "";
    if (
      !window.confirm(
        `Criar ${plural(alvos.length, "ficha", "fichas")} no RH a partir do relógio?\n\n` +
          "A admissão vai como SUGESTÃO (o dia da entrada no relógio) e a ficha nasce marcada como “admissão a conferir”." +
          alerta
      )
    )
      return;

    setCriando(true);
    let criadas = 0;
    const falhas = [];
    for (const p of alvos) {
      if (!txt(p.nome)) {
        falhas.push(`relógio ${p.jibbleId} (sem nome no relógio)`);
        continue;
      }
      // Rede lenta, dois cliques, outra janela: se a ficha apareceu no meio do
      // laço, não se cria a segunda.
      if (fichaPorJibble.has(p.jibbleId)) {
        falhas.push(`${p.nome} (já tinha ficha)`);
        continue;
      }
      let deuCerto = false;
      await gravar(
        "rh_pessoas",
        fichaDoRelogio(p),
        `${p.nome} entrou no quadro — admissão sugerida pela entrada no relógio, confira na ficha.`,
        () => {
          deuCerto = true;
        }
      );
      if (deuCerto) criadas++;
      else falhas.push(p.nome);
    }
    setCriando(false);
    setMarcados(new Set());

    const frase = criadas
      ? `${plural(criadas, "ficha criada", "fichas criadas")} a partir do relógio. A admissão veio da ENTRADA NO RELÓGIO — confira ficha por ficha no RH.`
      : "Nenhuma ficha criada.";
    setAviso({
      tipo: falhas.length ? "erro" : "ok",
      texto: falhas.length ? `${frase} Não deu certo em: ${falhas.join(", ")}.` : frase,
    });

    recarregar();
    buscar();
  };

  const acoes = { alternar, marcarVarias, vincular, preencher };

  // ---- Tela ---------------------------------------------------------------

  if (!relogio && buscando) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <p className="text-sm text-slate-500">Buscando as pessoas no relógio…</p>
      </div>
    );
  }

  if (!relogio) {
    return (
      <Card>
        <SectionTitle titulo="Não consegui falar com o relógio" />
        <p className="text-sm text-slate-600">{erroRelogio}</p>
        {/* A frase que separa as duas coisas: isto NÃO é "ninguém cadastrado". */}
        <p className="mt-2 text-sm text-slate-500">
          Isto não quer dizer que não há ninguém no relógio — quer dizer que não sei. Não crie ficha nenhuma a partir
          desta tela enquanto ela não responder.
        </p>
        <button type="button" className="sem-impressao btn-primary mt-4" onClick={buscar} disabled={buscando}>
          <RefreshCw size={16} strokeWidth={2.5} /> {buscando ? "Buscando…" : "Tentar de novo"}
        </button>
      </Card>
    );
  }

  /* CASO DE CONTROLE DA PRÓPRIA LISTA: o Jibble diz quantas pessoas TEM
     (@odata.count) e a busca traz 200 por vez. Compara-se com o que a resposta
     trouxe — não com a lista já peneirada, senão a peneira daqui viraria
     "faltou gente no relógio". */
  const listaCortada = relogio.total !== null && relogio.total > relogio.pessoas.length;

  return (
    <div>
      <div className="sem-impressao mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500">
          Quem está cadastrado no Jibble, ativo ou removido. O vínculo com o RH é o id do relógio, nunca o nome.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="rel-busca">
            Buscar pessoa do relógio
          </label>
          <span className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="rel-busca"
              type="search"
              className="input h-9 w-56 py-0 pl-8 text-sm"
              placeholder="nome, e-mail, matrícula…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </span>
          <button type="button" className="btn-outline" onClick={buscar} disabled={buscando}>
            <RefreshCw size={16} strokeWidth={2.5} className={clsx(buscando && "animate-spin")} />{" "}
            {buscando ? "Buscando…" : "Atualizar do relógio"}
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          rotulo="No relógio"
          valor={String(todas.length)}
          sub={
            relogio.total === null
              ? "o relógio não disse o total"
              : listaCortada
                ? `o Jibble diz ter ${relogio.total} — a lista veio cortada`
                : "pessoas cadastradas no Jibble"
          }
          tom={listaCortada ? "warn" : "neutral"}
          icone={Users}
        />
        <StatCard
          rotulo="Ativas"
          valor={String(todas.filter((p) => p.ativoNoRelogio).length)}
          sub="batem ponto hoje"
          tom="ok"
          icone={Users}
        />
        <StatCard
          rotulo="Removidas"
          valor={String(todas.filter((p) => !p.ativoNoRelogio).length)}
          sub="saíram do relógio; os dias delas continuam valendo"
          tom="neutral"
          icone={UserMinus}
        />
        <StatCard
          rotulo="Sem ficha no RH"
          valor={String(semFicha.length)}
          sub={
            semFicha.length
              ? "nenhuma ficha tem o id do relógio delas"
              : "todo mundo do relógio já tem ficha vinculada"
          }
          tom={semFicha.length ? "warn" : "ok"}
          icone={UserPlus}
        />
      </div>

      {erroRelogio && (
        <div className="mb-4 rounded-xl bg-bad-50 p-3 text-sm text-bad-800">
          A última busca no relógio falhou: {erroRelogio}. O que está na tela é da busca anterior — pode estar velho.
        </div>
      )}

      {/* ZERO NÃO É RESULTADO — e este zero é resultado, porque a chamada
          voltou. A frase precisa dizer QUAL dos dois zeros é, senão a tela vira
          tabela de intenção: "não há ninguém" afirmado a partir de um silêncio. */}
      {relogio.pessoas.length === 0 && (
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          O relógio RESPONDEU e não trouxe ninguém cadastrado. Isto é resposta, não falha de rede — mas se você espera
          gente aqui, o problema está do lado do Jibble (credencial de outra empresa, ou ninguém cadastrado mesmo), e
          quem responde isso é o diagnóstico da credencial.
        </div>
      )}

      {semIdNoRelogio > 0 && (
        <div className="mb-4 rounded-xl bg-warn-50 p-3 text-sm text-warn-800">
          {plural(semIdNoRelogio, "pessoa do relógio veio", "pessoas do relógio vieram")} sem id e{" "}
          {semIdNoRelogio === 1 ? "ficou" : "ficaram"} de fora da lista: o vínculo com a ficha É o id, e sem ele não dá
          para vincular nem criar. Confira no Jibble.
        </div>
      )}

      {listaCortada && (
        <div className="mb-4 rounded-xl bg-warn-50 p-3 text-sm text-warn-800">
          O Jibble diz ter {relogio.total} pessoas e chegaram {relogio.pessoas.length}: a busca traz 200 por vez. Quem
          não aparece aqui não está provado ausente — não conclua nada sobre quem falta.
        </div>
      )}

      {/* O número contado no SERVIDOR, que enxerga todas as fichas. Divergir do
          contado aqui não é erro de conta: é sinal de que a casca carregou um
          quadro diferente do que o servidor tem agora. */}
      {relogio.semFicha !== null && relogio.semFicha !== semFicha.length && (
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          O servidor contou {plural(relogio.semFicha, "pessoa sem ficha", "pessoas sem ficha")} na última busca e a tela
          está mostrando {semFicha.length}. Atualize o relógio antes de criar em lote.
        </div>
      )}

      {/* A barra de criação é CONTROLE inteiro — some no papel. Impressa, ela
          diria "Nenhuma pessoa escolhida" como se fosse um dado da folha. */}
      {editavel && (
        <Card className="sem-impressao mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-slate-900">
                {escolhidas.length
                  ? `${plural(escolhidas.length, "pessoa escolhida", "pessoas escolhidas")} para virar ficha no RH`
                  : "Nenhuma pessoa escolhida"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                A ficha nasce com nome, apelido, e-mail, telefone, matrícula, id do relógio e situação. A ADMISSÃO vai
                como sugestão da entrada no relógio — que não é a entrada na empresa — e fica marcada como “admissão a
                conferir” na ficha. Admissão errada estraga férias, experiência e 13º.
              </p>
              {semFicha.length > semFichaSeguras.length && (
                <p className="mt-1 text-xs text-warn-700">
                  {plural(
                    semFicha.length - semFichaSeguras.length,
                    "pessoa sem ficha parece",
                    "pessoas sem ficha parecem"
                  )}{" "}
                  já ter ficha no RH sem vínculo — não entram no “marcar todas”. Vincule na própria linha, ou marque à
                  mão se quiser mesmo criar outra.
                </p>
              )}
            </div>
            <div className="sem-impressao flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-outline"
                disabled={!semFichaSeguras.length || ocupado}
                onClick={() => marcarVarias(semFichaSeguras.map((p) => p.jibbleId))}
              >
                Marcar todas as sem ficha ({semFichaSeguras.length})
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={!marcados.size || ocupado}
                onClick={() => setMarcados(new Set())}
              >
                Limpar seleção
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!escolhidas.length || ocupado}
                onClick={criarEscolhidas}
              >
                <UserPlus size={16} strokeWidth={2.5} />
                {criando ? "Criando…" : `Criar as fichas escolhidas (${escolhidas.length})`}
              </button>
            </div>
          </div>
        </Card>
      )}

      <BlocoDivergencias itens={divergentes} />

      <ListaDoRelogio
        titulo="Ativas no relógio"
        sub="Quem o Jibble considera em atividade hoje."
        icone={Users}
        itens={ativas}
        vazio={
          busca
            ? "Nenhuma pessoa ativa bate com a busca."
            : "O relógio respondeu e não trouxe ninguém ativo. Isso é resposta, não falha — mas se você espera gente aqui, rode o diagnóstico da credencial."
        }
        marcados={marcados}
        editavel={editavel}
        ocupado={ocupado}
        acoes={acoes}
      />

      <ListaDoRelogio
        titulo="Removidas do relógio"
        sub="Saíram do Jibble. Os dias que elas já trouxeram continuam valendo — e a ficha, se criada, nasce desligada com a data do relógio."
        icone={UserMinus}
        itens={removidas}
        vazio={busca ? "Nenhuma pessoa removida bate com a busca." : "Ninguém removido no relógio."}
        marcados={marcados}
        editavel={editavel}
        ocupado={ocupado}
        acoes={acoes}
      />

      <BlocoOrfaos itens={orfaos} />

      {semFicha.length === 0 && todas.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-ok-700">
          <CheckCircle2 size={16} strokeWidth={2.4} /> Todo mundo do relógio tem ficha vinculada no RH.
        </p>
      )}
    </div>
  );
}
