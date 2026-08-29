// O PADRÃO DA LISTA DE TRABALHO — o mesmo desenho em toda tela onde a pessoa
// olha um ranking e decide em quem mexer (horas por pessoa, faltas do mês,
// atrasos por setor, e o que vier).
//
// Portado do Painel da Impresilk (aba Vendedores, o print que o Léo mandou em
// 28/08/2026: "eu quero a tela assim, inteligente, que já sai os nomes assim, e
// bem mais moderno"), adaptado ao verde-água da MinasLab. As regras não são
// gosto: vieram de medir como Linear, Geist/Vercel e Attio desenham lista densa,
// e cada uma delas já foi paga com um defeito real.
//
//   · O VALOR É O ÚNICO NÚMERO FORTE da linha. Ele fica à direita, em coluna
//     fixa e tabular, na cor cheia. Todo o resto — dias, atrasos, faltas — é
//     APOIO: cinza, menor, coluna estreita. Com dois números fortes na mesma
//     linha o olho não sabe qual responde a pergunta, e a lista vira tabela.
//   · NO MÁXIMO TRÊS APOIOS. A quarta coluna espreme o nome, que é a primeira
//     coisa que a pessoa lê. Se precisa de um quarto número, a tela precisa de
//     outra seção, não de mais uma coluna.
//   · UM SINAL DE ESTADO POR LINHA, nunca dois. Aqui o sinal é `tom` — ele
//     tinge a barra e o valor. Cor só marca ESTADO; o resto é cinza. Tom em
//     tudo é tom em nada.
//   · DADO AUSENTE É TRAVESSÃO "—", nunca "N/A", nunca 0, nunca "00:00". Zero é
//     uma afirmação ("essa pessoa teve zero atraso"); ausência é outra coisa
//     ("ninguém apurou"). A linha não pode transformar uma na outra — e é por
//     isso que a barra some quando falta a medida, em vez de desenhar um trilho
//     vazio que se lê como zero.
//   · SEM ZEBRA e sem borda grossa entre linhas: só o realce do hover e o fundo
//     de quem está aberta. Uma borda por linha × 60 pessoas são 60 traços
//     competindo com o conteúdo.
//   · A BARRA SOME NO CELULAR (hidden sm:block). Em 375px ela rouba o nome, que
//     é o que a pessoa foi ali ler.
//   · LINHA QUE NÃO ABRE NADA NÃO É BOTÃO. Sem `aoAbrir` a linha vira <div>:
//     sem cursor, sem hover, sem foco de teclado. Cursor que promete detalhe e
//     não entrega é pior que lista morta.
//
// NADA AQUI CONHECE PONTO, HORA NEM DINHEIRO. `valor` e `apoios` chegam prontos
// como texto — quem formata é a tela, que sabe se aquilo é "07:45", "21 dias"
// ou "3 atrasos". No dia em que este arquivo aprender a formatar hora, ele
// passa a errar em toda tela que não é a de hora.

import { clsx } from "clsx";
import { ChevronDown, Info } from "lucide-react";
import { Card } from "./ui.jsx";

/* O tom pinta a BARRA e o VALOR — os dois pedaços que o olho varre de cima a
   baixo. Classes escritas por extenso de propósito: o Tailwind lê o código
   fonte como texto e descarta classe montada por concatenação SEM ERRO, o que
   faz a cor sumir exatamente no estado em que ela existia para gritar. */
const TOM_LINHA = {
  brand: { barra: "bg-brand-300", valor: "text-slate-800" },
  ok: { barra: "bg-ok-300", valor: "text-slate-800" },
  warn: { barra: "bg-warn-300", valor: "text-warn-700" },
  bad: { barra: "bg-bad-300", valor: "text-bad-700" },
  neutral: { barra: "bg-slate-300", valor: "text-slate-800" },
};

// A regra do travessão em um lugar só, para não haver duas versões dela.
const ouTravessao = (t) => (t === null || t === undefined || t === "" ? "—" : t);

/* UMA LINHA DO RANKING: nome à esquerda, barra de proporção, os apoios em
   cinza e o valor forte à direita.
 *
 * `valor` chega PRONTO como texto (ver o cabeçalho). Por isso a barra precisa
 * de `medida`: o número cru daquela linha, que junto com `teto` (o maior do
 * recorte) dá a proporção. Ler a proporção de dentro do texto exigiria o
 * componente adivinhar se "07:45" são horas ou 7 vírgula 45 — e adivinhar é o
 * que este arquivo não faz. Sem `medida` ou sem `teto` a barra não aparece, e o
 * espaço dela fica reservado para as colunas continuarem alinhadas.
 *
 * `apoios` é um array de textos JÁ FORMATADOS ("21 dias", "3 atrasos"), no
 * máximo três.
 */
export function LinhaRanking({ nome, valor, apoios, teto, medida, aberta, aoAbrir, tom = "brand" }) {
  const t = TOM_LINHA[tom] || TOM_LINHA.brand;
  const clicavel = typeof aoAbrir === "function";
  const Comp = clicavel ? "button" : "div";

  const lista = Array.isArray(apoios) ? apoios : [];
  const colunas = lista.slice(0, 3);
  // Cortar calado é o defeito que a lista copiada da Impresilk já cometeu: o
  // quarto apoio sumiria sem ninguém notar. Em desenvolvimento, ele reclama.
  if (import.meta.env?.DEV && lista.length > 3) {
    console.warn(
      `LinhaRanking "${nome}": ${lista.length} apoios recebidos, só os 3 primeiros entram — a quarta coluna espreme o nome.`
    );
  }

  /* Mínimo de 2%: sem ele o menor do recorte desenha uma barra de zero pixel e
     se lê como "não tem nada", quando na verdade tem pouco. Máximo de 100% para
     um teto desatualizado não estourar o trilho. */
  const proporcao =
    Number.isFinite(medida) && Number.isFinite(teto) && teto > 0
      ? Math.max(2, Math.min(100, (medida / teto) * 100))
      : null;

  return (
    <Comp
      type={clicavel ? "button" : undefined}
      onClick={clicavel ? aoAbrir : undefined}
      aria-expanded={clicavel ? !!aberta : undefined}
      className={clsx(
        "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        clicavel && "hover:bg-slate-50",
        aberta && "bg-brand-50/70"
      )}
    >
      {/* min-w-0 junto do flex-1: sem ele o nome longo não trunca, empurra as
          colunas para fora e a linha inteira passa a rolar de lado. */}
      <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={typeof nome === "string" ? nome : undefined}>
        {ouTravessao(nome)}
      </span>

      {proporcao === null ? (
        // Lugar guardado: sem medida não se desenha trilho vazio (leria zero),
        // mas as colunas seguintes têm de continuar alinhadas com as das outras.
        <span className="hidden w-40 shrink-0 sm:block" aria-hidden="true" />
      ) : (
        // A barra é enfeite de leitura, não informação nova: o valor à direita
        // já diz tudo. Por isso aria-hidden — o leitor de tela não repete.
        <span className="hidden h-2.5 w-40 shrink-0 overflow-hidden rounded bg-slate-100 sm:block" aria-hidden="true">
          <span className={clsx("block h-full rounded", t.barra)} style={{ width: `${proporcao}%` }} />
        </span>
      )}

      {colunas.map((apoio, i) => (
        <span key={i} className="tnum w-16 shrink-0 truncate text-right text-xs text-slate-400">
          {ouTravessao(apoio)}
        </span>
      ))}

      <span className={clsx("tnum w-28 shrink-0 text-right", t.valor)}>{ouTravessao(valor)}</span>
    </Comp>
  );
}

/* SEÇÃO RECOLHÍVEL — título grande e um `sub` que diz o TAMANHO DO RECORTE
   ("6 pessoas com ponto no mês"), porque a primeira dúvida diante de um ranking
   é "isso aqui é tudo?".
 *
   O CONTEÚDO CONTINUA MONTADO quando recolhido (escondido por `hidden`), e não
   desmontado por um `&&`. Duas razões: recolher e reabrir não perde o que
   estava aberto ali dentro; e o papel sai completo — `print:block` traz de
   volta na impressão. Recolher é um gesto de leitura, não uma decisão sobre o
   que o relatório mostra.
 *
   A escolha de aberta/fechada é do CHAMADOR (`aberta` + `aoAlternar`), que a
   guarda no aparelho: quem trabalha com um quadro fechado não quer reabri-lo a
   cada visita. */
export function Secao({ titulo, sub, aberta, aoAlternar, acao, children }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => aoAlternar?.()}
          aria-expanded={!!aberta}
          className="group flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <ChevronDown
            size={18}
            className={clsx(
              "mt-1 shrink-0 text-slate-400 transition-transform group-hover:text-slate-600",
              !aberta && "-rotate-90"
            )}
          />
          <span className="min-w-0">
            <span className="block font-display text-lg font-semibold text-slate-900">{titulo}</span>
            {sub && <span className="mt-0.5 block text-sm text-slate-500">{sub}</span>}
          </span>
        </button>
        {/* A ação (fechar o detalhe, exportar) é controle: some no papel. */}
        {acao && <div className="sem-impressao shrink-0">{acao}</div>}
      </div>
      <div className={aberta ? "space-y-3" : "hidden print:block"}>{children}</div>
    </Card>
  );
}

/* O FILTRO DO TOPO EM PÍLULAS. `opcoes` aceita { valor, rotulo } ou o valor
   cru (vira o próprio rótulo), e a escolhida fica PREENCHIDA na cor da marca —
   contorno só não basta: em pílula pequena o contorno some no cinza da tela.
 *
   A comparação é por texto de propósito: o recorte "Todos" chega ora como ""
   ora como null, e o ano ora como 2026 ora como "2026". Errar isso não dá erro
   nenhum — só deixa a tela sem nenhuma pílula acesa, que é como o usuário
   descobre que o filtro "não funciona". */
export function Pilulas({ opcoes, valor, aoEscolher }) {
  const lista = (opcoes || []).map((o) =>
    o !== null && typeof o === "object" ? o : { valor: o, rotulo: String(o) }
  );
  const atual = String(valor ?? "");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lista.map((o) => {
        const chave = String(o.valor ?? "");
        const sel = chave === atual;
        return (
          <button
            key={chave}
            type="button"
            onClick={() => aoEscolher?.(o.valor)}
            aria-pressed={sel}
            style={sel ? undefined : { borderColor: "var(--hairline)" }}
            className={clsx(
              "tnum h-8 rounded-full border px-3.5 font-display text-sm font-medium transition-all",
              sel
                ? "border-brand bg-brand text-white shadow-sm"
                : "bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            )}
          >
            {o.rotulo ?? chave}
          </button>
        );
      })}
    </div>
  );
}

/* A FAIXA DE EXPLICAÇÃO acima da lista: DE ONDE VEM O DADO e O QUE FAZER com
   ele ("toque numa pessoa para ver a curva"). Ela existe porque um ranking sem
   procedência gera a mesma pergunta toda semana — "isso conta o atestado?" — e
   porque uma linha que abre detalhe, sem ninguém dizer, ninguém toca.
   Fundo claro da marca, letra pequena: é apoio de leitura, não alerta. Alerta
   tem cor de alerta (o Aviso, em ui.jsx). */
export function Explicacao({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-800">
      <Info size={14} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
      <p className="min-w-0">{children}</p>
    </div>
  );
}
