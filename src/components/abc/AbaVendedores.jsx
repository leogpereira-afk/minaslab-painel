/* CURVA ABC → aba VENDEDORES. Quanto cada pessoa vendeu no recorte, do maior
 * para o menor.
 *
 * É a mais simples das três de propósito: NÃO TEM CLASSE A/B/C. Curva ABC de
 * vendedor é uma conta que quase sempre mente — numa equipe de três ou quatro
 * pessoas o primeiro colocado passa dos 30% sozinho, e a tela anunciaria "A+"
 * para quem só é o único. A pergunta aqui é outra e é direta: QUEM VENDEU
 * QUANTO. Ranking, barra de proporção, e ponto.
 *
 * O RECORTE É O MESMO DAS OUTRAS DUAS: `recortarVendas` de comum.jsx, a mesma
 * função, com os mesmos três cortes contados em voz alta (cancelada, sem data,
 * de outro ano). Uma cópia da régua aqui dentro é o defeito que a casa já
 * pagou: ela envelhece num arquivo só e as três abas passam a dar três
 * respostas para a mesma pergunta.
 *
 * ============================================================================
 * O QUE ESTA ABA NÃO FAZ
 *
 * NÃO DEDUZ VENDEDOR. O vendedor é o que o Omie mandou junto com a nota fiscal
 * ou com a ordem de serviço. O painel não adivinha por cliente ("o fulano
 * sempre atende essa empresa"), não adivinha por região e não rateia. Dedução
 * vira dado com cara de fato, e o dono decide em cima dela.
 *
 * NÃO INVENTA UMA LINHA "SEM VENDEDOR". Venda sem quem vendeu fica FORA do
 * ranking e é CONTADA logo abaixo dele, com o valor. Um balde "Sem vendedor" no
 * topo da lista se leria como uma pessoa — e ainda por cima como a melhor
 * vendedora da casa.
 *
 * NÃO MOSTRA LISTA VAZIA quando nenhuma venda traz vendedor. Lista vazia se lê
 * como "ninguém vendeu", que é o oposto do que o dado diz. Nesse caso a aba
 * escreve, com todas as letras, que o campo não veio do ERP e onde consertar.
 *
 * ============================================================================
 * A CHAVE É O CÓDIGO; O NOME SÓ EXIBE
 *
 * Quando a venda traz o código do vendedor, é ele que agrupa — nome muda de
 * grafia, código não. Só na falta do código o nome vira chave (em minúsculas,
 * para "MARIA" e "Maria" não virarem duas pessoas). O efeito colateral está
 * medido e DITO na tela: se parte das vendas vier com código e parte só com
 * nome, a mesma pessoa aparece em duas linhas — e a aba avisa quando dois
 * rótulos iguais têm chaves diferentes, em vez de emendar por conta própria.
 *
 * ----------------------------------------------------------------------------
 * ESTA ABA NÃO GRAVA NADA — não recebe `gravar` nem `apagarReg`, e não toca em
 * services/dados.js. Relatório que altera o dado que ele mesmo mostra é o jeito
 * mais rápido de perder a confiança no número.
 */

import { useMemo } from "react";
import { UserRoundX } from "lucide-react";
import { dataLonga, moeda, moedaCheia } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import { Card } from "../ui.jsx";
import { Explicacao, LinhaRanking, Secao } from "../lista.jsx";
import {
  AcoesDoRecorte,
  CabecalhoDoPapel,
  SemVenda,
  frasesDoCorte,
  num,
  plural,
  recortarVendas,
  useSecoes,
} from "./comum.jsx";

const K_SECOES = "minaslab.abc.vendedores.secoes";
// O ranking É a tela: nasce aberto.
const SECOES_PADRAO = ["ranking"];

const COLUNAS = [
  { chave: "posicao", rotulo: "Posição", tipo: "numero" },
  { chave: "vendedor", rotulo: "Vendedor" },
  { chave: "documentos", rotulo: "Documentos", tipo: "numero" },
  { chave: "clientes", rotulo: "Clientes distintos", tipo: "numero" },
  { chave: "valor", rotulo: "Valor", tipo: "dinheiro" },
];

/* QUEM VENDEU, ou `null`. Os mapeadores do ml-omie ainda não trazem este campo
   (30/08/2026) — que é justamente o caso que esta aba precisa saber dizer em
   voz alta. Por isso lê as formas plausíveis em que ele pode chegar quando
   chegar (texto solto, objeto do ERP, ou só o código) em vez de uma só:
   descobrir isso na primeira importação custaria uma tela mentindo por um dia.
   Três respostas diferentes, nunca confundidas:
     · código (com ou sem nome) → agrupa pelo código, exibe o nome quando há
     · só nome                  → agrupa pelo nome em minúsculas
     · nada                     → null, e a venda fica fora do ranking */
function vendedorDaVenda(v) {
  const cru = v?.vendedorNome ?? v?.vendedor ?? null;
  const objeto = cru !== null && typeof cru === "object" ? cru : null;
  const nome = String((objeto ? objeto.nome ?? objeto.rotulo : cru) ?? "").trim();
  const codigo = String(
    (objeto ? objeto.id ?? objeto.codigo : null) ?? v?.vendedorId ?? ""
  ).trim();

  if (codigo) {
    return {
      chave: `c:${codigo}`,
      // Código sem nome não vira "Vendedor" genérico: o número é o que se sabe,
      // e escrevê-lo deixa a pessoa ir procurá-lo no Omie.
      rotulo: nome || `Vendedor ${codigo} (sem nome no cadastro)`,
    };
  }
  if (nome) return { chave: `n:${nome.toLowerCase()}`, rotulo: nome };
  return null;
}

/* Cliente DISTINTO, para o apoio "N cli.". Mesma escada do vendedor: id do
   cadastro, senão o documento só com dígitos (o Omie manda com e sem máscara),
   senão o nome. Venda que não identifica cliente nenhum devolve null e NÃO
   conta como mais um cliente — inflar essa contagem com anônimos diria que o
   vendedor atende mais gente do que atende. */
function clienteDaVenda(v) {
  const id = String(v?.clienteId ?? "").trim();
  if (id) return `i:${id}`;
  const doc = String(v?.clienteDoc ?? "").replace(/\D/g, "");
  if (doc) return `d:${doc}`;
  const nome = String(v?.clienteNome ?? "").trim().toLowerCase();
  return nome ? `n:${nome}` : null;
}

/* O primeiro apoio da linha. A MinasLab fatura NOTA e ORDEM DE SERVIÇO na mesma
   coleção, e chamar as duas de "O.S." seria escrever no ranking uma coisa que o
   ERP não disse. Então a unidade sai do que a linha realmente tem: só O.S., só
   NF, ou "docs" quando a pessoa emite os dois. */
function apoioDeDocumentos(b) {
  const total = b.nf + b.os + b.outros;
  if (!total) return null;
  if (b.os === total) return plural(total, "O.S.", "O.S.");
  if (b.nf === total) return plural(total, "NF", "NF");
  return plural(total, "doc.", "docs");
}

/* O bloco que substitui a lista quando NENHUMA venda do recorte traz vendedor.
   Fica fora do componente da página: componente declarado dentro remonta a cada
   render, e o lint da casa reprova como erro. */
function SemVendedorNenhum({ quantidade, valor }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn-100 text-warn-700">
          <UserRoundX size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="font-display text-base font-semibold text-slate-900">
            O faturamento desta casa não vem com vendedor.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            {plural(quantidade, "título deste recorte chegou", "títulos deste recorte chegaram")} do
            Omie sem quem vendeu — nem nome, nem código
            {valor === null ? "" : `, somando ${moedaCheia(valor)}`}.
          </p>
          {/* O CONSELHO ANTIGO MANDAVA PARA O LUGAR ERRADO: dizia para preencher
              o vendedor na nota fiscal e na ordem de serviço. Medido em
              30/08/2026 contra a conta real: esta casa tem 0 notas e 0 O.S. no
              Omie — fatura por RPS, lançando título a receber, e o título não
              tem campo de vendedor. Mandar conferir um cadastro que não existe
              faria o dono procurar por horas o defeito que não está lá. */}
          <p className="text-sm leading-relaxed text-slate-600">
            Não é campo em branco que alguém esqueceu: a MinasLab fatura lançando{" "}
            <strong>título a receber</strong>, e o título do Omie não tem onde guardar o vendedor.
            Enquanto o faturamento entrar por aí, esta aba não tem como somar por pessoa — venha de
            onde vier a vontade de ver o ranking.
          </p>
          <p className="text-xs leading-relaxed text-slate-500">
            Não desenhamos uma lista vazia nem uma linha “Sem vendedor”: a lista vazia se leria como
            “ninguém vendeu”, e a linha inventada colocaria no ranking um nome que não existe.
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function AbaVendedores({ vendas, clientes, ano, hojeISO, setAviso }) {
  // Mesma conferência das outras duas abas: só "AAAA" vira recorte de ano;
  // qualquer outra coisa cai em "todos os anos", que é o recorte honesto para
  // um filtro que não dá para entender.
  const anoTexto = /^\d{4}$/.test(String(ano ?? "")) ? String(ano) : "";
  const [aberta, alternar] = useSecoes(K_SECOES, SECOES_PADRAO);

  const recorte = useMemo(() => recortarVendas(vendas, anoTexto), [vendas, anoTexto]);

  const analise = useMemo(() => {
    const grupos = new Map();
    // As vendas que não têm vendedor: contadas à parte, nunca em balde nenhum.
    const sem = { quantidade: 0, valor: 0, medidas: 0 };

    for (const v of recorte.usadas) {
      const val = num(v?.valor);
      const quem = vendedorDaVenda(v);

      if (!quem) {
        sem.quantidade += 1;
        if (val !== null) {
          sem.valor += val;
          sem.medidas += 1;
        }
        continue;
      }

      let b = grupos.get(quem.chave);
      if (!b) {
        b = {
          chave: quem.chave,
          rotulo: quem.rotulo,
          valor: 0,
          medidas: 0,
          semValor: 0,
          nf: 0,
          os: 0,
          outros: 0,
          clientes: new Set(),
        };
        grupos.set(quem.chave, b);
      }

      if (val === null) b.semValor += 1;
      else {
        b.valor += val;
        b.medidas += 1;
      }

      const doc = String(v?.documento ?? "").toUpperCase();
      if (doc === "NF") b.nf += 1;
      else if (doc === "OS") b.os += 1;
      else b.outros += 1;

      const c = clienteDaVenda(v);
      if (c) b.clientes.add(c);
    }

    const linhas = [...grupos.values()].map((b) => ({
      chave: b.chave,
      rotulo: b.rotulo,
      /* Vendedor sem UMA venda medida fica com valor NULO, não com zero: a
         linha mostra travessão e a barra some, em vez de desenhar um trilho
         vazio que se lê como "não vendeu". */
      valor: b.medidas ? Math.round(b.valor * 100) / 100 : null,
      semValor: b.semValor,
      documentos: b.nf + b.os + b.outros,
      apoioDocumentos: apoioDeDocumentos(b),
      clientes: b.clientes.size,
    }));

    /* Ordem: dinheiro desc, e quem não tem medida nenhuma vai para o fim — no
       meio da lista ele pareceria alguém que vendeu pouco. Desempate pelo nome
       para duas leituras seguidas devolverem a mesma ordem. */
    linhas.sort((a, b) => {
      if (a.valor === null && b.valor === null) return a.rotulo.localeCompare(b.rotulo, "pt-BR");
      if (a.valor === null) return 1;
      if (b.valor === null) return -1;
      return b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR");
    });

    const medidos = linhas.filter((l) => l.valor !== null);
    const teto = medidos.length ? Math.max(...medidos.map((l) => l.valor)) : null;
    const total = medidos.length ? medidos.reduce((t, l) => t + l.valor, 0) : null;
    const semValor = linhas.reduce((t, l) => t + l.semValor, 0);

    /* Dois rótulos iguais em chaves diferentes = a mesma pessoa partida em duas
       linhas (parte das vendas veio com código, parte só com nome). O painel
       NÃO emenda: juntar códigos diferentes seria adivinhar. Ele avisa. */
    const contagem = new Map();
    for (const l of linhas) contagem.set(l.rotulo, (contagem.get(l.rotulo) || 0) + 1);
    const homonimos = [...contagem.entries()].filter(([, n]) => n > 1).map(([r]) => r);

    return {
      linhas,
      teto,
      total,
      semValor,
      homonimos,
      sem: { ...sem, valor: sem.medidas ? sem.valor : null },
    };
  }, [recorte]);

  const baixar = () => {
    try {
      const arquivo = baixarPlanilha({
        nome: `curva-abc-vendedores${anoTexto ? `-${anoTexto}` : ""}`,
        titulo: `Vendedores${anoTexto ? ` — ${anoTexto}` : " — todos os anos"}`,
        colunas: COLUNAS,
        linhas: analise.linhas.map((l, i) => ({
          posicao: i + 1,
          vendedor: l.rotulo,
          documentos: l.documentos,
          // Zero cliente identificado é ausência, não zero cliente atendido: a
          // célula fica vazia em vez de afirmar "0".
          clientes: l.clientes || null,
          valor: l.valor,
        })),
      });
      setAviso?.({ tipo: "ok", texto: `Planilha ${arquivo} baixada.` });
    } catch (e) {
      setAviso?.({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  const explicacao = (
    <Explicacao>
      O vendedor é o que o Omie manda em cada nota fiscal e em cada ordem de serviço — o painel não
      deduz por cliente nem por região. O número forte é o faturamento do recorte; ao lado, quantos
      documentos e quantos clientes distintos. Venda sem vendedor não vira linha: fica contada
      abaixo da lista.
    </Explicacao>
  );

  const tituloDoPapel = `MinasLab — Vendedores${anoTexto ? ` · ${anoTexto}` : " · todos os anos"}`;

  // Nada sobrou do recorte: quem fala é o vazio honesto compartilhado, que sabe
  // separar "nada veio do Omie" de "nada neste ano" e aponta os anos com venda.
  if (recorte.usadas.length === 0) {
    return (
      <div className="space-y-3">
        <CabecalhoDoPapel
          titulo={tituloDoPapel}
          linhas={[hojeISO ? `Emitido em ${dataLonga(hojeISO)}` : null, "Nenhuma venda no recorte."]}
        />
        {explicacao}
        <SemVenda
          vendas={vendas}
          clientes={clientes}
          anoTexto={anoTexto}
          recorte={recorte}
          unidade="venda"
        />
      </div>
    );
  }

  // Há vendas no recorte, e nenhuma diz quem vendeu.
  if (analise.linhas.length === 0) {
    return (
      <div className="space-y-3">
        <CabecalhoDoPapel
          titulo={tituloDoPapel}
          linhas={[
            hojeISO ? `Emitido em ${dataLonga(hojeISO)}` : null,
            `${plural(recorte.usadas.length, "venda", "vendas")} no recorte, nenhuma com vendedor.`,
            ...frasesDoCorte(recorte),
          ]}
        />
        {explicacao}
        <SemVendedorNenhum quantidade={analise.sem.quantidade} valor={analise.sem.valor} />
      </div>
    );
  }

  const sub = `${plural(analise.linhas.length, "vendedor", "vendedores")} no recorte · ${
    analise.total === null ? "sem valor apurado" : moedaCheia(analise.total)
  }`;

  return (
    <div className="space-y-3">
      <CabecalhoDoPapel
        titulo={tituloDoPapel}
        linhas={[
          hojeISO ? `Emitido em ${dataLonga(hojeISO)}` : null,
          sub,
          "O vendedor vem do Omie, nota a nota — o painel não deduz nem rateia.",
          ...frasesDoCorte(recorte),
        ]}
      />

      {explicacao}

      <Secao
        titulo={anoTexto ? `Vendedores de ${anoTexto}` : "Vendedores — todos os anos"}
        sub={sub}
        aberta={aberta("ranking")}
        aoAlternar={() => alternar("ranking")}
        acao={<AcoesDoRecorte aoBaixarPlanilha={baixar} />}
      >
        <div className="space-y-0.5">
          {analise.linhas.map((l) => (
            <LinhaRanking
              key={l.chave}
              nome={l.rotulo}
              valor={l.valor === null ? null : moeda(l.valor)}
              medida={l.valor === null ? undefined : l.valor}
              teto={analise.teto ?? undefined}
              apoios={[l.apoioDocumentos, l.clientes ? plural(l.clientes, "cli.", "cli.") : null]}
            />
          ))}
        </div>

        {/* O QUE FICOU DE FORA, embaixo da lista. Ranking que não diz o que
            descartou é um total que nunca bate com o do ERP. Some inteiro
            quando não há nada a dizer: uma faixa vazia com borda em cima da
            lista se lê como um aviso que ninguém escreveu. */}
        {(analise.sem.quantidade > 0 ||
          analise.semValor > 0 ||
          analise.homonimos.length > 0 ||
          frasesDoCorte(recorte).length > 0) && (
        <div
          className="space-y-1 border-t pt-2 text-xs leading-relaxed text-slate-500"
          style={{ borderColor: "var(--hairline)" }}
        >
          {analise.sem.quantidade > 0 && (
            <p>
              {plural(analise.sem.quantidade, "venda do recorte não traz", "vendas do recorte não trazem")}{" "}
              vendedor
              {analise.sem.valor === null ? "" : ` (${moeda(analise.sem.valor)})`} e{" "}
              {analise.sem.quantidade === 1 ? "ficou" : "ficaram"} fora do ranking.
            </p>
          )}
          {analise.semValor > 0 && (
            <p>
              {plural(analise.semValor, "venda está sem valor", "vendas estão sem valor")} e não
              {analise.semValor === 1 ? " entra" : " entram"} na soma de ninguém.
            </p>
          )}
          {analise.homonimos.length > 0 && (
            <p>
              Mesmo nome em mais de uma linha ({analise.homonimos.join(", ")}): o Omie mandou códigos
              de vendedor diferentes para o mesmo rótulo. O painel mantém as linhas separadas —
              juntar códigos diferentes seria adivinhar.
            </p>
          )}
          {frasesDoCorte(recorte).map((f) => (
            <p key={f}>{f}</p>
          ))}
        </div>
        )}
      </Secao>
    </div>
  );
}
