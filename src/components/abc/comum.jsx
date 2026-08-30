/* O QUE AS DUAS CURVAS DIVIDEM — clientes e produtos.
 *
 * As duas abas fazem a mesma pergunta ("quem/o que traz o dinheiro desta
 * casa?") sobre a mesma fonte (fin_vendas) e só trocam a unidade: uma conta o
 * comprador, a outra conta o item da nota. Tudo o que é igual mora aqui, num
 * lugar só — a lição de "lista copiada falha calada" foi paga com uma régua
 * que mudou em três arquivos e ficou velha em dois deles.
 *
 * NADA AQUI CALCULA CURVA. A classificação inteira é de lib/curvaAbc.js (que
 * roda sem React e tem teste próprio); daqui para cima é só desenho, texto e o
 * recorte de vendas que as duas abas usam igual.
 *
 * O DESENHO TAMBÉM NÃO NASCE AQUI: a linha do ranking, a seção recolhível e a
 * faixa de explicação são de components/lista.jsx. Este arquivo compõe com
 * elas, não redesenha.
 */

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { Download, Printer } from "lucide-react";
import { moeda, moedaCheia, diaLocalISO, MESES } from "../../lib/format.js";
import { porAno, porMes } from "../../lib/curvaAbc.js";
import { Empty } from "../ui.jsx";
import { LinhaRanking, Pilulas } from "../lista.jsx";

export const plural = (n, um, varios) => `${Number(n).toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

// Busca que não tropeça em acento nem em maiúscula: "sao" acha "São".
export const semAcento = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* Ausência continua ausência. Number(null) e Number("") devolvem 0, e é assim
   que uma venda sem valor vira uma venda de R$ 0,00 medida — que ninguém
   mediu. */
export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/* A data da venda em AAAA-MM-DD LOCAL, ou null quando não dá para saber.
   Nunca slice(0,10) de timestamp UTC: depois das 21h no Brasil isso devolve o
   dia de AMANHÃ, e a venda de terça à noite muda de mês (e às vezes de ano)
   sozinha. */
export function diaDaVenda(v) {
  if (v === null || v === undefined || v === "") return null;
  const dia = diaLocalISO(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;
}

// "2026-03" vira "mar/2026". A grade fechada de 12 meses NÃO se monta aqui:
// mês sem venda é ausência, e desenhar zero seria afirmar que não se vendeu.
export const rotuloMes = (mesISO) => {
  const [ano, mes] = String(mesISO).split("-");
  const nome = MESES[Number(mes) - 1];
  return nome ? `${nome}/${ano}` : String(mesISO);
};

// Fração -> "12,3%". Fração nula (total zero) devolve null, e quem chama
// escreve o travessão: 0% afirmaria uma participação que ninguém mediu.
export const pct = (fracao) =>
  fracao === null || fracao === undefined || !Number.isFinite(fracao)
    ? null
    : `${(Math.round(fracao * 1000) / 10).toLocaleString("pt-BR")}%`;

/* AS CORES DAS CLASSES. Escritas por extenso porque o Tailwind lê o código
   como texto e descarta em silêncio a classe montada por concatenação — a cor
   sumiria exatamente no selo que existe para gritar.
   A+ é o topo do topo (na Impresilk a classe A ia de R$ 2 milhões a R$ 35 mil
   na mesma caixa); B+ é a metade de cima da antiga B, no âmbar mais forte. */
export const TOM_CLASSE = {
  "A+": "bg-brand-600 text-white",
  A: "bg-brand-100 text-brand-800",
  "B+": "bg-warn-500 text-white",
  B: "bg-warn-100 text-warn-800",
  C: "bg-slate-100 text-slate-500",
};

export function SeloClasse({ classe }) {
  return (
    <span
      className={clsx(
        "mr-1.5 inline-block min-w-[1.6rem] rounded px-1 py-px text-center font-display text-[10px] font-semibold",
        TOM_CLASSE[classe] || TOM_CLASSE.C
      )}
    >
      {classe}
    </span>
  );
}

/* AS SEÇÕES RECOLHÍVEIS, com a escolha guardada no aparelho (pedido do Léo:
   em tela de análise, TODO quadro recolhe e a escolha persiste). Guarda-se a
   lista do que está ABERTO, e o padrão vale para quem nunca mexeu. */
export function useSecoes(chave, padrao) {
  const [abertas, setAbertas] = useState(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(chave) || "null");
      return Array.isArray(salvo) ? salvo : padrao;
    } catch {
      // Sem localStorage (ou JSON estragado) vale o padrão.
      return padrao;
    }
  });
  const alternar = useCallback(
    (id) =>
      setAbertas((atual) => {
        const nova = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
        try {
          localStorage.setItem(chave, JSON.stringify(nova));
        } catch {
          // Sem localStorage a escolha só não persiste.
        }
        return nova;
      }),
    [chave]
  );
  return [(id) => abertas.includes(id), alternar];
}

// Uma escolha de filtro (a classe vista), guardada do mesmo jeito.
export function useEscolha(chave, inicial = "") {
  const [valor, setValor] = useState(() => {
    try {
      const salvo = localStorage.getItem(chave);
      return salvo === null ? inicial : salvo;
    } catch {
      return inicial;
    }
  });
  const escolher = useCallback(
    (v) => {
      const texto = v === null || v === undefined ? "" : String(v);
      setValor(texto);
      try {
        localStorage.setItem(chave, texto);
      } catch {
        // Sem localStorage a escolha só não persiste.
      }
    },
    [chave]
  );
  return [valor, escolher];
}

/* O NOME DE CADA ID DE CLIENTE, em uma passada só. A ordem de preferência não
   é arbitrária: o cadastro (fin_clientes) é a fonte de nome; o nome que veio
   dentro da venda é o que o Omie carimbou naquele dia (a O.S. nem traz nome);
   e, quando não há nenhum dos dois, a tela mostra o ID e diz que é ID. Um
   travessão aqui esconderia QUAL cliente é — e o id é justamente o que permite
   ir procurar no Omie. */
export function indiceDeNomes(clientes, vendas) {
  const nomes = new Map();
  for (const c of Array.isArray(clientes) ? clientes : []) {
    const nome = String(c?.nome || c?.fantasia || "").trim();
    if (!nome) continue;
    // O ml-omie casa a venda pelo `omieId` do cliente; o `id` (cli_123) entra
    // junto porque um registro digitado à mão pode não ter omieId.
    if (c?.omieId) nomes.set(String(c.omieId), nome);
    if (c?.id && !nomes.has(String(c.id))) nomes.set(String(c.id), nome);
  }
  for (const v of Array.isArray(vendas) ? vendas : []) {
    const id = String(v?.clienteId ?? "");
    const nome = String(v?.clienteNome || "").trim();
    if (id && nome && !nomes.has(id)) nomes.set(id, nome);
  }
  return nomes;
}

/* O RECORTE: quais vendas de fin_vendas entram na conta.
 *
 * Três cortes, e NENHUM deles é calado — cada um volta contado, porque corte
 * mudo é como a soma da tela deixa de bater com a do ERP sem ninguém entender
 * por quê:
 *   · CANCELADA sai da soma e fica no histórico (é assim que o ml-omie grava:
 *     a nota cancelada vira `cancelada:true`, não é apagada).
 *   · SEM DATA não entra em recorte nenhum — não dá para dizer de que ano é.
 *   · DE OUTRO ANO sai deste recorte, mas continua em `validas`, que é o que
 *     alimenta o histórico completo de um cliente ou produto.
 */
export function recortarVendas(vendas, anoTexto) {
  const lista = Array.isArray(vendas) ? vendas : [];
  const validas = [];
  const usadas = [];
  const anos = new Set();
  let canceladas = 0;
  let canceladasValor = 0;
  let semData = 0;
  let foraDoAno = 0;

  for (const v of lista) {
    if (v?.cancelada) {
      canceladas += 1;
      canceladasValor += num(v?.valor) ?? 0;
      continue;
    }
    const dia = diaDaVenda(v?.data);
    if (!dia) {
      semData += 1;
      continue;
    }
    validas.push(v);
    anos.add(dia.slice(0, 4));
    if (anoTexto && dia.slice(0, 4) !== anoTexto) {
      foraDoAno += 1;
      continue;
    }
    usadas.push(v);
  }

  return {
    recebidas: lista.length,
    validas,
    usadas,
    anosComVenda: [...anos].sort(),
    canceladas,
    canceladasValor: Math.round(canceladasValor * 100) / 100,
    semData,
    foraDoAno,
  };
}

/* O que ficou de fora, dito em voz alta embaixo da lista.
   As frases terminam sem verbo de propósito: "N vendas canceladas fora da
   soma" lê certo com 1 e com 40, e frase montada por concatenação é onde a
   concordância quebra sem ninguém testar. */
export function frasesDoCorte(recorte) {
  const frases = [];
  if (recorte.canceladas > 0) {
    frases.push(
      `${plural(recorte.canceladas, "venda cancelada", "vendas canceladas")} (${moeda(
        recorte.canceladasValor
      )}) fora da soma — cancelada continua no histórico, mas não conta.`
    );
  }
  if (recorte.semData > 0) {
    frases.push(
      `${plural(recorte.semData, "venda sem data", "vendas sem data")} no ERP, fora de todo recorte por ano — sem o dia não dá para dizer de que ano é.`
    );
  }
  return frases;
}

/* O VAZIO HONESTO. Tela vazia e tela que não carregou são a mesma imagem, e
   por isso esta caixa diz QUAL das duas é — e por quê. Nenhum número aqui é
   inventado: todos vêm do que chegou (ou do que não chegou) do banco.

   Hoje a MinasLab não tem venda nenhuma gravada: o ERP é o Omie e a ponte
   ml-omie está publicada mas desligada, à espera dos segredos que só o dono
   grava. Uma curva de exemplo aqui seria pior que a tela vazia — quem visse
   números tomaria decisão em cima deles. */
export function SemVenda({ vendas, clientes, anoTexto, recorte, unidade = "venda", notas = [] }) {
  const totalVendas = Array.isArray(vendas) ? vendas.length : 0;
  const totalClientes = Array.isArray(clientes) ? clientes.length : 0;

  if (totalVendas === 0 && totalClientes === 0) {
    return (
      <Empty className="px-5">
        <div className="max-w-xl space-y-2">
          <p className="font-display text-base font-semibold text-slate-700">Nada veio do Omie ainda.</p>
          <p>
            O ERP da MinasLab é o Omie, e a ponte que traz as vendas (a função <code>ml-omie</code>) só
            trabalha depois que a direção grava os segredos do aplicativo no servidor. Até lá,{" "}
            <code>fin_vendas</code> e <code>fin_clientes</code> ficam vazias — é isto que esta tela está
            lendo: zero registro, não zero venda.
          </p>
          <p className="text-slate-400">
            Nenhum número de exemplo aparece aqui de propósito. No dia da primeira importação, a curva se
            acende sozinha.
          </p>
        </div>
      </Empty>
    );
  }

  if (totalVendas === 0) {
    return (
      <Empty className="px-5">
        <div className="max-w-xl space-y-2">
          <p className="font-display text-base font-semibold text-slate-700">
            {plural(totalClientes, "cliente veio", "clientes vieram")} do Omie, e nenhuma venda.
          </p>
          <p>
            O cadastro importou e as notas/O.S. não: ou a importação de vendas ainda não rodou, ou o
            período que ela pediu não tinha nenhuma. Sem venda não há curva — classificar quem não comprou
            devolveria uma fila de zeros que parece resultado.
          </p>
        </div>
      </Empty>
    );
  }

  /* Tem venda no banco, mas nada sobrou para classificar. Duas histórias
     diferentes moram aqui, e a tela precisa contar a certa: ou o recorte ficou
     sem venda nenhuma, ou as vendas do recorte existem e não somam valor
     nenhum (tudo zero, ou tudo sem número). Dizer "nenhuma venda" no segundo
     caso mandaria a pessoa procurar no ano errado. */
  const outrosAnos = recorte.anosComVenda.filter((a) => a !== anoTexto);
  const noRecorte = recorte.usadas.length;
  return (
    <Empty className="px-5">
      <div className="max-w-xl space-y-2">
        <p className="font-display text-base font-semibold text-slate-700">
          {noRecorte > 0
            ? `${plural(noRecorte, "venda", "vendas")} no recorte, e nenhuma soma valor.`
            : anoTexto
              ? `Nenhuma ${unidade} em ${anoTexto}.`
              : `Nenhuma ${unidade} para classificar.`}
        </p>
        {noRecorte > 0 && (
          <p>
            As vendas do recorte vieram com valor zero, sem valor nenhum, ou sem a informação que esta
            curva agrupa. Não há o que classificar: uma curva de zeros parece resultado e não é.
          </p>
        )}
        {notas.filter(Boolean).map((n) => (
          <p key={n} className="text-slate-400">
            {n}
          </p>
        ))}
        {outrosAnos.length > 0 && (
          <p>
            Há venda em {outrosAnos.join(", ")} — troque o ano no filtro do topo para ver a curva daquele
            recorte.
          </p>
        )}
        {frasesDoCorte(recorte).map((f) => (
          <p key={f} className="text-slate-400">
            {f}
          </p>
        ))}
        {recorte.anosComVenda.length === 0 && (
          <p className="text-slate-400">
            As {recorte.recebidas.toLocaleString("pt-BR")} vendas que existem no banco estão canceladas ou
            sem data: nenhuma delas pode entrar numa curva por ano.
          </p>
        )}
      </div>
    </Empty>
  );
}

/* OS TRÊS CARTÕES. O cartão mostra a SOMA das irmãs (A+ e A juntas, B+ e B
   juntas) e a diferença entre elas abre no clique, como sub-cartões — foi o
   pedido do dono na Impresilk e é o que faz a régua caber em três caixas.

   FAIXA VAZIA NÃO É BOTÃO e não mostra R$ 0: cartão que promete recorte e
   entrega lista vazia é pior que cartão apagado, e "R$ 0" se lê como "esta
   faixa comprou zero" quando o que houve é que ninguém caiu nela. */
export function CartoesDaCurva({ faixas, unidade, classeVista, aoEscolherClasse, grupoAberto, aoAlternarGrupo }) {
  const partes = faixas.find((f) => f.id === grupoAberto)?.partes || [];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {faixas.map((f) => {
          const vazia = f.quantidade === 0;
          const ativo = classeVista === f.id || f.membros.includes(classeVista);
          const divisivel = f.membros.length > 1;
          const abertoAqui = grupoAberto === f.id;
          const Comp = vazia ? "div" : "button";
          return (
            <Comp
              key={f.id}
              type={vazia ? undefined : "button"}
              aria-pressed={vazia ? undefined : ativo}
              aria-expanded={!vazia && divisivel ? abertoAqui : undefined}
              title={`Numa curva ABC típica esta faixa soma perto de ${pct(f.fatiaTipica)} do valor. O que está no cartão é o medido neste recorte, não o típico.`}
              onClick={
                vazia
                  ? undefined
                  : () => {
                      if (!divisivel) {
                        aoAlternarGrupo(null);
                        aoEscolherClasse(classeVista === f.id ? "" : f.id);
                        return;
                      }
                      if (abertoAqui) {
                        aoAlternarGrupo(null);
                        aoEscolherClasse("");
                      } else {
                        aoAlternarGrupo(f.id);
                        aoEscolherClasse(f.id);
                      }
                    }
              }
              className={clsx(
                "rounded-xl border p-3.5 text-left transition-colors",
                vazia && "opacity-70",
                !vazia && "hover:bg-slate-50",
                ativo ? "border-brand-400 bg-brand-50/60" : "border-slate-200"
              )}
            >
              <span
                className={clsx(
                  "inline-block rounded px-1.5 py-0.5 font-display text-xs font-semibold",
                  TOM_CLASSE[f.rotulo] || TOM_CLASSE.C
                )}
              >
                {f.titulo}
              </span>
              <span className="tnum mt-1.5 block font-display text-xl font-semibold text-slate-900">
                {vazia ? "—" : moeda(f.valor)}
              </span>
              <span className="block text-xs text-slate-500">
                {vazia
                  ? `nenhum ${unidade.um} nesta faixa`
                  : `${plural(f.quantidade, unidade.um, unidade.varios)} · ${pct(f.participacao) ?? "—"} do valor`}
              </span>
              {!vazia && f.id !== "C" && (
                <span className="block text-[11px] text-slate-400">
                  {f.corte === null ? "—" : `entra quem passa de ${moedaCheia(f.corte)}`}
                </span>
              )}
              {!vazia && divisivel && (
                <span className="sem-impressao mt-0.5 block text-[11px] font-medium text-brand-600">
                  {abertoAqui ? "fechar a divisão" : `toque para ver ${f.membros.join(" e ")}`}
                </span>
              )}
            </Comp>
          );
        })}
      </div>

      {partes.length > 0 && (
        <div className="sem-impressao grid grid-cols-2 gap-3">
          {partes.map((p) => {
            const vazia = p.quantidade === 0;
            const Comp = vazia ? "div" : "button";
            return (
              <Comp
                key={p.classe}
                type={vazia ? undefined : "button"}
                aria-pressed={vazia ? undefined : classeVista === p.classe}
                onClick={vazia ? undefined : () => aoEscolherClasse(classeVista === p.classe ? grupoAberto : p.classe)}
                className={clsx(
                  "rounded-xl border p-3 text-left transition-colors",
                  vazia && "opacity-70",
                  !vazia && "hover:bg-slate-50",
                  classeVista === p.classe ? "border-brand-400 bg-brand-50/60" : "border-slate-200"
                )}
              >
                <span
                  className={clsx(
                    "inline-block rounded px-1.5 py-0.5 font-display text-xs font-semibold",
                    TOM_CLASSE[p.classe] || TOM_CLASSE.C
                  )}
                >
                  {p.classe}
                </span>
                <span className="tnum mt-1 block font-display text-base font-semibold text-slate-900">
                  {vazia ? "—" : moeda(p.valor)}
                </span>
                <span className="block text-xs text-slate-500">
                  {vazia
                    ? `nenhum ${unidade.um} aqui`
                    : `${plural(p.quantidade, unidade.um, unidade.varios)} · ${pct(p.participacao) ?? "—"} do valor`}
                </span>
                {!vazia && p.corte !== null && (
                  <span className="block text-[11px] text-slate-400">
                    entra quem passa de {moedaCheia(p.corte)}
                  </span>
                )}
              </Comp>
            );
          })}
        </div>
      )}
    </>
  );
}

/* O COMPORTAMENTO NO TEMPO — mês a mês e ano a ano, com a mesma linha do
   ranking (o desenho não muda de dialeto quando o assunto muda).
 *
 * `itens` chega no formato mínimo [{ data, valor }]; quem sabe de onde vem a
 * data é a aba. O ano a ano é o HISTÓRICO COMPLETO e o mês a mês é de um ano
 * escolhido — sem escolher, os meses de dez anos viram uma lista que ninguém
 * lê. Meses sem movimento não aparecem: mês vazio é ausência, e desenhar zero
 * afirmaria que se vendeu nada num mês que talvez nem tenha chegado.
 *
 * O estado do ano escolhido vive AQUI dentro; quem chama passa `key` com a
 * identidade da linha aberta, e trocar de cliente devolve o padrão. */
export function ComportamentoNoTempo({ itens, anoPadrao, um, varios }) {
  const anos = porAno(itens);
  const disponiveis = anos.anos.map((a) => a.ano);
  const [anoDosMeses, setAnoDosMeses] = useState(
    () => (disponiveis.includes(anoPadrao) ? anoPadrao : disponiveis[disponiveis.length - 1] || "")
  );
  const ano = disponiveis.includes(anoDosMeses) ? anoDosMeses : disponiveis[disponiveis.length - 1] || "";
  const meses = porMes(itens.filter((i) => (diaDaVenda(i.data) || "").slice(0, 4) === ano));
  const tetoMes = Math.max(...meses.meses.map((m) => m.valor), 0);
  const tetoAno = Math.max(...anos.anos.map((a) => a.valor), 0);

  if (!disponiveis.length) {
    return <p className="text-xs text-slate-400">Nenhuma venda com data para desenhar o comportamento.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
            Mês a mês
          </span>
          {/* O filtro do topo em pílulas é o mesmo de toda a casa
              (components/lista.jsx) — desenhar outro aqui faria a mesma
              escolha ter duas caras na mesma tela. */}
          {disponiveis.length > 1 && (
            <Pilulas opcoes={disponiveis} valor={ano} aoEscolher={setAnoDosMeses} />
          )}
        </div>
        {meses.meses.map((m) => (
          <LinhaRanking
            key={m.mes}
            nome={rotuloMes(m.mes)}
            valor={moeda(m.valor)}
            apoios={[plural(m.quantidade, um, varios)]}
            medida={m.valor}
            teto={tetoMes}
          />
        ))}
      </div>
      <div>
        <span className="font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
          Ano a ano — histórico completo
        </span>
        <div className="mt-1.5">
          {anos.anos.map((a) => (
            <LinhaRanking
              key={a.ano}
              nome={a.ano}
              valor={moeda(a.valor)}
              apoios={[plural(a.quantidade, um, varios)]}
              medida={a.valor}
              teto={tetoAno}
            />
          ))}
        </div>
      </div>
      {anos.semData.quantidade > 0 && (
        <p className="text-[11px] text-slate-400">
          {plural(anos.semData.quantidade, "venda sem data ficou", "vendas sem data ficaram")} fora destes
          quadros.
        </p>
      )}
    </div>
  );
}

/* Os dois botões do recorte. O PDF É A IMPRESSÃO: no destino da impressão,
   "Salvar como PDF". Não há segunda geração de documento — se houvesse, a
   folha e a tela discordariam no dia em que uma das duas mudasse. */
export function AcoesDoRecorte({ aoBaixarPlanilha }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-outline"
        onClick={() => window.print()}
        title="Imprime esta tela; no destino da impressão escolha Salvar como PDF"
      >
        <Printer size={16} strokeWidth={2.5} /> Baixar PDF
      </button>
      <button type="button" className="btn-outline" onClick={aoBaixarPlanilha}>
        <Download size={16} strokeWidth={2.5} /> Baixar planilha
      </button>
    </div>
  );
}

/* O cabeçalho que só existe no papel. Folha impressa circula solta: sem dizer
   de que recorte é, de quando é e qual régua usou, ela vira um ranking sem
   dono na mesa de alguém — e a primeira pergunta ("isso é de que ano?") não
   tem quem responda. */
export function CabecalhoDoPapel({ titulo, linhas }) {
  return (
    <div className="apenas-impressao mb-4 border-b pb-2" style={{ borderColor: "var(--hairline)" }}>
      <p className="font-display text-base font-bold">{titulo}</p>
      {(linhas || []).filter(Boolean).map((l) => (
        <p key={l} className="text-xs">
          {l}
        </p>
      ))}
    </div>
  );
}
