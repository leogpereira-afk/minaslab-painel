// Botão "Orientação": o método de gestão por trás de cada tela, em linguagem
// prática. Resumos próprios das ideias das obras citadas (não são citações).
import { useState } from "react";
import { IcLivro } from "./icones.jsx";

const ORIENTACOES = {
  visao: { fonte: "Andrew Grove, Gestão de Alta Performance", itens: ["Olhe volume e qualidade juntos: propostas enviadas sempre ao lado da taxa de aprovação.", "Indicador de tendência (propostas, follow-up) avisa antes do resultado (valor aprovado) cair.", "Um número fora do esperado vira pergunta para a pessoa, não conclusão."] },
  dado: { fonte: "Vicente Falconi, Gerenciamento da Rotina", itens: ["Sem dado confiável não há gestão: arrume o registro antes de cobrar meta.", "Trate a causa (proposta nasce sem responsável), não só o sintoma (corrigir no fim do mês).", "Padronize: o combinado vira regra e a regra vira rotina."] },
  cockpit: { fonte: "McChesney, Covey e Huling, As 4 Disciplinas da Execução", itens: ["Foque na meta crucial do mês; o resto é rotina.", "Aja nas medidas de direção (follow-up, propostas abertas), que você controla hoje.", "Placar visível e simples: em 5 segundos dá para saber se estamos ganhando."] },
  funil: { fonte: "Eliyahu Goldratt, A Meta · Aaron Ross, Receita Previsível", itens: ["O resultado é limitado pela etapa que mais perde: melhore o gargalo primeiro.", "Funil previsível nasce de etapas bem definidas e registro em cada passagem.", "Proposta envelhecendo perde chance: o tempo é uma etapa do funil."] },
  pessoas: { fonte: "Kim Scott, Empatia Assertiva · Andrew Grove", itens: ["Importe-se pessoalmente e desafie diretamente: elogio específico, crítica clara.", "Feedback com o fato e o número, nunca com rótulo (“você é desorganizada”).", "A 1:1 é da pessoa: comece perguntando o que está atrapalhando."] },
  avaliacao: { fonte: "Regra única e transparente", itens: ["A mesma regra para todos, conhecida antes do mês começar.", "Cada nota tem de onde veio: meta do CRM, critério ou ocorrência registrada.", "Saúde, atestados e faltas justificadas ficam fora da avaliação."] },
  ocorrencias: { fonte: "Vicente Falconi, PDCA", itens: ["Registre o fato no dia, sem adjetivo.", "Ocorrência que se repete é problema de processo: vire ação em Estratégias.", "Ocorrência não é punição: é a matéria-prima da melhoria."] },
  estrategias: { fonte: "John Doerr, Medir o que Importa · Bossidy e Charan, Execução", itens: ["Poucas ações por vez, cada uma com dono, prazo e como medir.", "Objetivo do trimestre qualitativo; resultados-chave com número.", "Estratégia sem acompanhamento semanal vira intenção."] },
  equipe: { fonte: "Liderança Situacional, Hersey e Blanchard", itens: ["Meta calibrada pelo histórico da pessoa (média + 10% a 15%), não por desejo.", "No máximo 3 metas de resultado e 2 de atividade por pessoa.", "Ajuste o estilo de liderança à maturidade de cada um em cada tarefa."] },
  funcoes: { fonte: "Descrição de cargo → estratégia", itens: ["Da descrição tire: missão, responsabilidades, metas e critérios de avaliação.", "Cada responsabilidade importante precisa de um jeito de medir.", "A rotina semanal é onde a estratégia vira hábito."] },
  carteira: { fonte: "Curva ABC e retenção", itens: ["Poucos clientes fazem a maior parte do valor: proteja a curva A primeiro.", "Cliente que passou do próprio intervalo de compra merece ligação da gestora.", "Contrato e recorrência vencendo são as vendas mais fáceis do mês."] },
  satisfacao: { fonte: "NPS", itens: ["Pergunte de 0 a 10 se recomendaria e o porquê.", "Detrator (0 a 6): contato em até 48 horas.", "Promotor (9 e 10): peça indicação."] },
  licitacoes: { fonte: "Disciplina de prazos", itens: ["Escolha bem o edital: melhor disputar menos e ganhar mais.", "Nenhuma perda por documento: checklist e validade das certidões.", "Registre motivo da perda e preço do vencedor."] },
  reunioes: { fonte: "As 4 Disciplinas da Execução · Andrew Grove", itens: ["Reunião começa pelo que foi combinado na anterior.", "Placar primeiro, discussão depois, compromisso no fim.", "Toda reunião termina com dono e prazo para cada decisão."] },
  treinamentos: { fonte: "Treinar para um número", itens: ["Cada treinamento ataca um número que o sistema mostra.", "Pratique com casos reais da casa, não com exemplos genéricos.", "Meça antes e depois: se o número não mudou, o treinamento não funcionou."] },
  decisoes: { fonte: "Annie Duke, Thinking in Bets", itens: ["Separe a qualidade da decisão da sorte do resultado.", "Registre o problema, as opções, o número que sustentou a escolha e a data de revisão.", "Na revisão, pergunte: com o que eu sabia, decidiria igual?"] },
};

export function Orientacao({ tela }) {
  const [aberta, setAberta] = useState(false);
  const o = ORIENTACOES[tela];
  if (!o) return null;
  return (
    <div>
      <button type="button" className="btn claro mini" aria-expanded={aberta} onClick={() => setAberta((a) => !a)}>
        <IcLivro size={16} /> Orientação
      </button>
      {aberta && (
        <div className="aviso marca" style={{ marginTop: 8 }}>
          <div className="peq" style={{ fontWeight: 600 }}>{o.fonte}</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{o.itens.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
