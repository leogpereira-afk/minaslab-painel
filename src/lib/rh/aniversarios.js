// ANIVERSÁRIOS DO QUADRO — o do colaborador e o de casa.
//
// Duas datas por pessoa, e as duas se repetem todo ano: o NASCIMENTO (do
// `dataNascimento` da ficha) e a ADMISSÃO (o "aniversário de empresa"). Esta
// lib só traduz data fixa em ocorrência do ano pedido; quem desenha é o
// calendário.
//
// SÓ QUEM ESTÁ NA CASA. Pessoa desligada sai: um "10 anos de casa" de quem foi
// embora não é comemoração, é constrangimento.
//
// ============================================================================
// AS TRÊS COISAS QUE ESTA LIB SE RECUSA A INVENTAR
//
// 1. ANIVERSÁRIO DE CASA COMEÇA NO PRIMEIRO ANO. No dia da admissão a pessoa
//    faz zero ano de casa — isso é o primeiro dia de trabalho, não um
//    aniversário. Marcar "0 anos" enche o calendário de eventos que ninguém
//    comemora e ainda faz o primeiro dia parecer aniversário.
//
// 2. 29 DE FEVEREIRO CAI EM 28 nos anos comuns. É preciso escolher, e a
//    escolha vai DITA na ocorrência (`ajustada: true`), para a tela poder
//    explicar por que a data do calendário não é a data da ficha. Sumir com o
//    aniversário em três de cada quatro anos seria pior; mover em silêncio
//    faria alguém achar que a ficha está errada.
//
// 3. DATA AUSENTE NÃO VIRA NADA — E É CONTADA. Em 30/08/2026 as 20 fichas da
//    MinasLab nasceram do relógio de ponto, que não sabe data de nascimento:
//    ZERO tinham `dataNascimento`. Um calendário que simplesmente não mostra
//    aniversário nenhum é indistinguível de um calendário quebrado. Por isso
//    `aniversariosDoAno` devolve `semData`, para a tela dizer "7 ativos,
//    nenhum com data de nascimento na ficha" em vez de calar.
//
// E A ADMISSÃO DESTA CASA AINDA NÃO FOI CONFERIDA. As mesmas 20 fichas
// trouxeram a admissão da PRIMEIRA BATIDA no relógio, não do contrato — quem
// foi contratado em 2019 e só entrou no relógio em 2025 aparece com seis anos
// a menos. Por isso a ocorrência carrega `conferida`, copiado de
// `admissaoConferida`: o calendário mostra, mas avisa que o número ainda é do
// relógio. Número de anos de casa exibido sem ressalva vira placa de bronze.

const ehISO = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

/* Bissexto pela regra inteira (400 anos), não pelo "divisível por 4": 1900 não
   foi bissexto e 2000 foi. Errar isso desloca o 29/02 num ano de virada de
   século — daqui a muito tempo, e ninguém vai lembrar de onde veio. */
export function ehBissexto(ano) {
  const a = Number(ano);
  if (!Number.isInteger(a)) return false;
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
}

/* Quantos anos a pessoa completa NAQUELE aniversário (não "quantos tem hoje").
   Devolve null quando a data original é posterior ao ano pedido: aniversário
   antes de nascer não existe, e 0 seria uma afirmação errada. */
export function anosNoAniversario(dataISO, ano) {
  if (!ehISO(dataISO)) return null;
  const anoOrigem = Number(String(dataISO).slice(0, 4));
  const alvo = Number(ano);
  if (!Number.isInteger(alvo) || alvo < anoOrigem) return null;
  return alvo - anoOrigem;
}

/* A data em que a repetição CAI no ano pedido. 29/02 em ano comum vira 28/02,
   e a ocorrência diz que foi ajustada. Devolve null para data inválida ou para
   ano anterior à data original. */
export function ocorrenciaNoAno(dataISO, ano) {
  if (!ehISO(dataISO)) return null;
  const anoOrigem = Number(String(dataISO).slice(0, 4));
  const alvo = Number(ano);
  if (!Number.isInteger(alvo) || alvo < anoOrigem) return null;

  const mes = String(dataISO).slice(5, 7);
  let dia = String(dataISO).slice(8, 10);
  let ajustada = false;
  if (mes === "02" && dia === "29" && !ehBissexto(alvo)) {
    dia = "28";
    ajustada = true;
  }
  return { dia: `${alvo}-${mes}-${dia}`, ajustada };
}

/* Está na casa? `ativo === false` é o desligado explícito; a ficha antiga sem o
   campo conta como ativa (é como o resto do sistema lê — ver a ação `elenco`
   no ml-sync). `desligadoEm` preenchido também tira da lista: duas formas de
   dizer a mesma coisa, e basta uma para a pessoa não aparecer. */
export function estaNaCasa(pessoa) {
  if (!pessoa) return false;
  if (pessoa.ativo === false) return false;
  return !String(pessoa.desligadoEm ?? "").trim();
}

/* AS OCORRÊNCIAS DE UM ANO, para as duas datas, de quem está na casa.
 *
 * Devolve { ocorrencias, ativos, semNascimento, semAdmissao } — os três
 * números existem para a tela poder explicar um calendário sem aniversário
 * nenhum, que é exatamente o estado da MinasLab hoje.
 */
export function aniversariosDoAno(pessoas, ano) {
  const lista = (Array.isArray(pessoas) ? pessoas : []).filter(estaNaCasa);
  const ocorrencias = [];
  let semNascimento = 0;
  let semAdmissao = 0;

  for (const p of lista) {
    const nome = String(p?.apelido || p?.nome || "").trim();

    const nasc = ocorrenciaNoAno(p?.dataNascimento, ano);
    if (!ehISO(p?.dataNascimento)) semNascimento += 1;
    else if (nasc) {
      ocorrencias.push({
        tipo: "nascimento",
        pessoaId: p?.id ?? null,
        nome,
        dia: nasc.dia,
        ajustada: nasc.ajustada,
        anos: anosNoAniversario(p.dataNascimento, ano),
        dataOriginal: p.dataNascimento,
        conferida: true,
      });
    }

    const adm = ocorrenciaNoAno(p?.admissao, ano);
    if (!ehISO(p?.admissao)) semAdmissao += 1;
    else if (adm) {
      const anos = anosNoAniversario(p.admissao, ano);
      /* Zero ano de casa não é aniversário — ver a regra 1 lá em cima. */
      if (anos !== null && anos >= 1) {
        ocorrencias.push({
          tipo: "casa",
          pessoaId: p?.id ?? null,
          nome,
          dia: adm.dia,
          ajustada: adm.ajustada,
          anos,
          dataOriginal: p.admissao,
          /* Só é fato conferido se ALGUÉM marcou. Ausente = não conferida: o
             padrão otimista faria a tela afirmar o que ninguém confirmou. */
          conferida: p?.admissaoConferida === true,
        });
      }
    }
  }

  ocorrencias.sort((a, b) => a.dia.localeCompare(b.dia) || a.nome.localeCompare(b.nome, "pt-BR"));
  return { ocorrencias, ativos: lista.length, semNascimento, semAdmissao };
}

/* O texto da linha no calendário. Sai daqui, e não da tela, porque a mesma
   frase aparece na grade, na lista do dia e na impressão — três redações da
   mesma coisa envelhecem em ritmos diferentes. */
export function textoDoAniversario(o) {
  if (!o) return "";
  if (o.tipo === "nascimento") {
    return o.anos === null || o.anos === 0 ? `Aniversário: ${o.nome}` : `Aniversário: ${o.nome} (${o.anos})`;
  }
  const anos = o.anos === 1 ? "1 ano" : `${o.anos} anos`;
  return `${anos} de casa: ${o.nome}`;
}
