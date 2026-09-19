import { proximasPorAlvo } from "./manutencaoRegra.js";
import { diasEntre, ymdLocal } from "./format.js";
import { aniversariosDoAno, textoDoAniversario } from "./rh/aniversarios.js";

// Soma dias a um "AAAA-MM-DD" sempre em horário LOCAL — nunca toISOString(),
// que depois das 21h no Brasil já virou amanhã.
function somaDias(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymdLocal(d);
}

const LICITACAO_EM_ANDAMENTO = ["estudando", "proposta_enviada", "em_sessao"];
// Cancelada não é agenda; concluída é: o período aconteceu e continua sendo a
// memória de quem esteve fora naqueles dias.
const FERIAS_VALEM = ["marcada", "concluida"];

// Traduz cada coleção em eventos { dia, hora, texto, cor, origem }. Só entram
// itens ABERTOS — feito, concluído e cancelado não são agenda.
export function montarEventos(dados, hojeISO, anos = []) {
  const eventos = [];
  const corPrazo = (dia) => (diasEntre(hojeISO, dia) < 0 ? "bad" : "warn");

  for (const c of dados.compromissos) {
    if (!c.feito && c.data) {
      eventos.push({ dia: c.data, hora: c.hora || "", texto: c.titulo, cor: "brand", origem: "compromissos" });
    }
  }

  // Sessão que já passou com a licitação ainda "em andamento" fica vermelha: a
  // data chegou e o status não andou — é disso que a direção precisa saber.
  for (const l of dados.licitacoes) {
    if (LICITACAO_EM_ANDAMENTO.includes(l.status) && l.dataSessao) {
      eventos.push({
        dia: l.dataSessao,
        hora: l.horaSessao || "",
        texto: `Sessão: ${l.orgao || "órgão sem registro"}`,
        cor: corPrazo(l.dataSessao),
        origem: "licitacoes",
      });
    }
  }

  // A agendada tem a própria data; das FEITAS, só a última de cada alvo
  // agenda a PRÓXIMA (lib/manutencaoRegra.js) — próxima superada por
  // manutenção mais nova não é agenda, senão fica vermelha para sempre e
  // infla o cartão "Atrasados". Passou da data, fica vermelha — manutenção
  // vencida é o que esta tela existe para gritar.
  for (const m of dados.manutencoes) {
    if (m.status === "agendada" && m.data) {
      eventos.push({ dia: m.data, hora: "", texto: `Manutenção: ${m.alvoNome}`, cor: corPrazo(m.data), origem: "manutencoes" });
    }
  }
  for (const m of proximasPorAlvo(dados.manutencoes).values()) {
    eventos.push({ dia: m.proxima, hora: "", texto: `Manutenção: ${m.alvoNome}`, cor: corPrazo(m.proxima), origem: "manutencoes" });
  }

  /* ANIVERSÁRIOS — de vida e de casa, só de quem está na casa. A conta mora em
     lib/rh/aniversarios.js, testada sem tela: é lá que 29/02 vira 28/02 no ano
     comum, que "zero ano de casa" não é aniversário e que ficha sem data é
     CONTADA em vez de sumir.

     Verde ("ok") e não amarelo: as outras origens usam a cor para dizer
     "vence" e "venceu", e aniversário não vence. Um ponto amarelo no dia do
     aniversário de alguém se leria como pendência. */
  for (const ano of anos) {
    for (const o of aniversariosDoAno(dados.quadro || [], ano).ocorrencias) {
      eventos.push({
        dia: o.dia,
        hora: "",
        texto: textoDoAniversario(o),
        cor: "ok",
        origem: "aniversarios",
        /* Viaja junto para a lista do dia poder pôr a ressalva onde a pessoa
           está olhando: a admissão destas fichas veio da primeira batida no
           relógio, não do contrato. */
        ressalva: o.tipo === "casa" && !o.conferida
          ? "Admissão ainda não conferida — a data veio do relógio de ponto, não do contrato."
          : o.ajustada
            ? "Nasceu em 29 de fevereiro; em ano comum a data cai em 28."
            : "",
      });
    }
  }

  for (const f of dados.ferias) {
    if (!FERIAS_VALEM.includes(f.status) || !f.inicio || !f.retorno) continue;
    // Um ponto por dia do período (inicio..retorno-1: o retorno é o dia em que
    // a pessoa VOLTA). Teto de 60 dias: um retorno digitado errado não pode
    // semear anos de calendário.
    const total = Math.min(diasEntre(f.inicio, f.retorno), 60);
    for (let i = 0; i < total; i++) {
      eventos.push({
        dia: somaDias(f.inicio, i),
        hora: "",
        texto: `Férias: ${f.pessoaNome || "pessoa sem registro"}`,
        cor: "neutral",
        origem: "ferias",
      });
    }
  }

  for (const v of dados.vencimentos) {
    if (v.vence) {
      const oQue = `${v.tipo || "documento sem tipo"} — ${v.pessoaNome || "pessoa sem registro"}`;
      eventos.push({ dia: v.vence, hora: "", texto: `Vence: ${oQue}`, cor: corPrazo(v.vence), origem: "vencimentos" });
    }
  }

  return eventos;
}

