// Guia da equipe: Tarefas e Mensagens numa folha A4 só, para ler na tela e para colar no mural.
// A mesma página serve de tela e de papel (botão Imprimir / PDF): o que é controle some no papel
// (sem-impressao) e o cabeçalho de papel (apenas-impressao) diz de onde a folha veio.
import { Printer } from "lucide-react";
import logoMinasLab from "../assets/logo-minaslab.webp";
import { PageTitle } from "../components/ui.jsx";
import { dataLonga, ymdLocal } from "../lib/format.js";
import { getSessao } from "../lib/sessao.js";

const PASSOS = [
  ["Abra Tarefas", "no menu e clique em Criar."],
  ["Escreva o nome", "e, se precisar, a descrição e a lista de verificação."],
  ["Escolha o responsável e o prazo.", "O responsável recebe aviso no sino."],
  ["Clique em Criar.", "Para ajudantes e observadores, use o Formulário detalhado."],
];

const BLOCOS = [
  {
    titulo: "Dentro da tarefa",
    itens: [
      "Iniciar, pausar e concluir: botões da própria tarefa.",
      "Passar para outra pessoa: menu … > Delegar.",
      "Conversar e anexar arquivos (até 8 MB) na própria tarefa.",
      "Dividir o trabalho em subtarefas.",
    ],
  },
  {
    titulo: "Lembrete e repetição",
    itens: [
      "Lembrete: com prazo definido, escolha quanto tempo antes quer o aviso (de 15 minutos a 2 dias).",
      "Repetir: todo dia, dias úteis, toda semana ou todo mês. As próximas tarefas nascem sozinhas.",
      "Pausar ou apagar uma repetição: botão Repetições, na página de Tarefas.",
    ],
  },
  {
    titulo: "Mensagens",
    itens: [
      "Conversa com uma pessoa ou grupo: botão + em Mensagens.",
      "Arquivo ou imagem: clipe. Voz: microfone (até 5 minutos).",
      "Emoji: carinha. Reação: passe o mouse na mensagem.",
      "Só quem participa da conversa lê. Nem a direção lê as dos outros.",
    ],
  },
  {
    titulo: "Sino de avisos",
    itens: [
      "Tarefa nova, prazo chegando, comentário e mensagem aparecem no sino e ele apita.",
      "Para receber aviso com o painel em segundo plano, permita as notificações do navegador.",
    ],
  },
];

export default function GuiaEquipe() {
  const sessao = getSessao();
  return (
    <div className="guia-folha mx-auto max-w-4xl">
      <div className="sem-impressao">
        <PageTitle
          titulo="Guia da equipe: Tarefas e Mensagens"
          descricao="Tudo o que você precisa para o dia a dia. Use Imprimir para tirar a folha do mural."
          acao={<button type="button" className="btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Imprimir / PDF</button>}
        />
      </div>

      <div className="apenas-impressao mb-3 flex items-center justify-between border-b pb-2" style={{ borderColor: "#000" }}>
        <img src={logoMinasLab} alt="MinasLab, Laboratório de Controle de Qualidade" width="150" height="44" />
        <p className="text-right text-xs">
          Impresso em {dataLonga(ymdLocal(new Date()))} por {sessao?.nome || sessao?.usuario || "usuário sem nome"}
          <br />Painel de Gestão MinasLab
        </p>
      </div>

      <article className="card p-5 sm:p-6">
        <header className="mb-4 border-b pb-3" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="font-display text-2xl font-bold leading-tight text-brand-ink">Tarefas e Mensagens no painel MinasLab</h2>
          <p className="mt-1 text-sm font-semibold text-slate-800 print:text-[12pt]">O Bitrix24 fica só para consultar o que já existe lá. Não crie tarefa nova no Bitrix.</p>
        </header>

        <section aria-labelledby="guia-criar" className="mb-4">
          <h3 id="guia-criar" className="mb-2 font-display text-base font-bold text-brand-700">Criar uma tarefa</h3>
          <ol className="grid gap-2 sm:grid-cols-2">
            {PASSOS.map(([forte, resto], i) => (
              <li key={forte} className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-brand font-display text-sm font-bold text-brand" aria-hidden="true">{i + 1}</span>
                <span className="text-sm leading-snug print:text-[11.5pt]"><b>{forte}</b> {resto}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {BLOCOS.map((b) => (
            <section key={b.titulo} className="guia-bloco break-inside-avoid">
              <h3 className="mb-1.5 border-b pb-1 font-display text-base font-bold text-brand-700" style={{ borderColor: "var(--hairline)" }}>{b.titulo}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-snug print:text-[11pt]">
                {b.itens.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-4 border-t pt-3 text-sm print:text-[11pt]" style={{ borderColor: "var(--hairline)" }}>
          <b>Quem pode o quê:</b> proprietário, responsável e direção editam, passam adiante e concluem. Participantes iniciam, marcam a lista e anexam. Observadores acompanham e comentam.
          <br /><b>Dúvida ou algo estranho?</b> Fale com a direção e conte o que tentou fazer e o que apareceu na tela.
        </footer>
      </article>
    </div>
  );
}
