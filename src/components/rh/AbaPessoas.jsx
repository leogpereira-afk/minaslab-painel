// Aba Pessoas do RH: o quadro (ativos + desligados), a ficha completa da pessoa
// e o histórico dela. Estado e gravação da FICHA moram na casca (pages/RH.jsx);
// aqui mora a renderização da aba, a inteligência de LEITURA — completude e
// prazo do contrato de experiência — e os dois modais que a ficha abre
// (desligamento e acontecimento do histórico). Quem decide as regras é a lib
// (src/lib/rh); aqui é só frase e cor.
//
// ============================================================================
// CONTRATO — props que esta aba recebe da casca (pages/RH.jsx)
//   ativos, desligados, visiveis  Object[]  fichas já filtradas e ordenadas.
//   historico   Object[]  coleção "rh_historico" INTEIRA (a aba filtra a pessoa).
//   hojeISO     string    "AAAA-MM-DD" local; é estado da casca.
//   editavel    boolean   podeEditar(getSessao()).
//   busca/setBusca, verDesligados/setVerDesligados
//   form/setForm, salvando   rascunho da ficha (mora na casca).
//   aoAbrir(p), aoGravar(), aoFechar(), aoReativar(), aoEfetivar()
//   aoDesligar(motivo, dataISO) => Promise<boolean>  true = ficha gravada.
//   gravar(colecao, registro, fraseOk, fechar?)  porta única de gravação.
//   apagarReg(colecao, id, fraseOk)              porta única de exclusão.
//   setAviso({ tipo, texto } | null)
// ============================================================================
//
// POR QUE A FICHA É RECOLHÍVEL: são mais de 30 campos. Numa coluna só, ninguém
// preenche — a pessoa desiste no meio e a ficha fica pela metade, que é
// exatamente o que a completude existe para evitar. Cada seção abre e fecha, e
// a escolha fica guardada no navegador.

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle, BadgeCheck, Building2, ChevronDown, ChevronRight, CircleDot,
  Download, GraduationCap, HandCoins, HeartPulse, Plus, Star, Trash2, UserMinus, UserPlus,
} from "lucide-react";
import { moedaCheia, dataLonga, ymdLocal, paraNumero } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import { completudeDaFicha, tomDaCompletude } from "../../lib/rh/completudeCadastro.js";
import { situacaoExperiencia } from "../../lib/rh/clt.js";
import { SectionTitle, Empty, Modal, Card } from "../ui.jsx";
import { anoRuim, tempoDeCasa } from "./uteis.js";
import FichaPessoa from "./FichaPessoa.jsx";

// "Hoje" circula como "AAAA-MM-DD"; a lib da CLT quer Date. Meia-noite LOCAL:
// new Date("AAAA-MM-DD") seria meia-noite UTC e o dia voltaria um no Brasil.
function dataLocalDe(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, m - 1, d);
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// As listas fechadas da ficha. Texto legível já no banco: o valor gravado é o
// que a planilha e o histórico mostram, sem tabela de tradução no meio.
const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];
const TIPOS_CONTRATO = ["CLT", "Estágio", "Aprendiz", "Prestador"];
const SETORES = ["Coleta", "Análises", "Qualidade", "Administrativo", "Comercial", "Direção"];
const ESCOLARIDADES = [
  "Fundamental", "Médio", "Técnico", "Superior incompleto", "Superior",
  "Pós-graduação", "Mestrado", "Doutorado",
];
const ESTILOS_APRENDIZAGEM = ["Prático", "Teórico", "Visual", "Conversando"];

// O vocabulário do histórico. Numa linha do tempo de 20 acontecimentos, o
// ícone diz o que é antes de a pessoa ler o título.
const TIPOS_HISTORICO = {
  admissao: { rotulo: "Admissão", icone: UserPlus, cor: "text-brand-600" },
  cargo: { rotulo: "Cargo", icone: BadgeCheck, cor: "text-brand-600" },
  salario: { rotulo: "Salário", icone: HandCoins, cor: "text-ok-700" },
  setor: { rotulo: "Setor", icone: Building2, cor: "text-brand-600" },
  afastamento: { rotulo: "Afastamento", icone: HeartPulse, cor: "text-warn-700" },
  advertencia: { rotulo: "Advertência", icone: AlertTriangle, cor: "text-bad-700" },
  elogio: { rotulo: "Elogio", icone: Star, cor: "text-ok-700" },
  treinamento: { rotulo: "Treinamento", icone: GraduationCap, cor: "text-brand-600" },
  desligamento: { rotulo: "Desligamento", icone: UserMinus, cor: "text-bad-700" },
  outro: { rotulo: "Outro", icone: CircleDot, cor: "text-slate-500" },
};

/* O modal de "Registrar acontecimento" só oferece o que NÃO vem de mudança de
   ficha. Admissão, cargo, setor, salário e desligamento são CARIMBADOS NO ATO
   pela própria ficha (uteis.js: marcosDaFicha) — deixar digitá-los à mão abriria
   uma segunda verdade, que diverge da ficha e envelhece sozinha. */
const TIPOS_ACONTECIMENTO = ["advertencia", "elogio", "treinamento", "afastamento", "outro"];

const COLUNAS_HISTORICO = [
  { chave: "data", rotulo: "Data", tipo: "data" },
  { chave: "pessoa", rotulo: "Pessoa" },
  { chave: "tipo", rotulo: "Tipo" },
  { chave: "titulo", rotulo: "Acontecimento" },
  { chave: "valorDe", rotulo: "De" },
  { chave: "valorPara", rotulo: "Para" },
  { chave: "detalhe", rotulo: "Detalhe" },
  { chave: "obs", rotulo: "Observações" },
];

// Onde a escolha de seção aberta fica guardada. Perfil nasce fechado (pedido do
// Léo); Histórico nasce aberto porque é o que se olha antes de conversar.
const K_SECOES = "minaslab.rh.ficha.secoes";
const SECOES_PADRAO = ["identificacao", "contrato", "historico"];

function lerSecoes() {
  try {
    const salvo = JSON.parse(localStorage.getItem(K_SECOES) || "null");
    return Array.isArray(salvo) ? salvo : SECOES_PADRAO;
  } catch {
    // Sem localStorage (ou JSON estragado) vale o padrão.
    return SECOES_PADRAO;
  }
}

// A frase de cada marco do contrato de experiência (CLT art. 445): `curta` vai
// no chip da linha, `longa` no aviso da ficha. O marco quem decide é
// situacaoExperiencia — inclusive PARAR de avisar (decidida, desligada ou
// passados 15 dias do fim).
function fraseExperiencia(s) {
  const fim = dataLonga(ymdLocal(s.fim));
  if (s.situacao === "expirou") {
    const ha = plural(-s.diasParaFim, "dia", "dias");
    return {
      chip: "chip-bad",
      curta: `experiência expirou há ${ha}`,
      longa: `Os 90 dias da experiência passaram há ${ha} (fim em ${fim}). Sem decisão registrada, o contrato vira por prazo indeterminado.`,
    };
  }
  if (s.situacao === "decidir-efetivacao") {
    const hojeMesmo = s.diasParaFim === 0;
    return {
      chip: "chip-warn",
      curta: hojeMesmo
        ? "experiência: 90 dias completam HOJE"
        : `experiência: decidir efetivação em ${plural(s.diasParaFim, "dia", "dias")}`,
      longa: `Últimos 15 dias da experiência: ${
        hojeMesmo ? "os 90 dias completam HOJE" : `faltam ${plural(s.diasParaFim, "dia", "dias")} para os 90 (${fim})`
      } — hora de decidir a efetivação.`,
    };
  }
  if (s.situacao === "decidir-prorrogacao") {
    return {
      chip: "chip-warn",
      curta: `experiência: decidir prorrogação (dia ${s.diasDeCasa})`,
      longa: `Dia ${s.diasDeCasa} da experiência — hora de decidir a prorrogação (o marco é o dia 45; os 90 completam em ${fim}).`,
    };
  }
  return {
    chip: "chip",
    curta: `experiência: dia ${s.diasDeCasa} de 90`,
    longa: `Primeiro período da experiência: dia ${s.diasDeCasa} de 90 — completa em ${fim}. A decisão de prorrogar chega perto do dia 45.`,
  };
}

// O chip da lista: só aparece quando a ficha pede atenção. Essencial faltando
// é sempre vermelho, mesmo com % alta — regra da própria lib (tomDaCompletude):
// 90% sem CPF não é "quase pronto", é ficha que não admite ninguém.
function chipCompletude(c) {
  const tom = tomDaCompletude(c);
  if (tom === "bom") return null;
  return { chip: tom === "ruim" ? "chip-bad" : "chip-warn", texto: `ficha ${c.pct}%` };
}

// Quem é cobrado pelo relógio. AUSENTE VALE SIM, e a leitura passa por aqui em
// todo lugar: a maioria das fichas é anterior ao campo, e ler undefined como
// "não bate" tiraria o quadro inteiro da cobrança do ponto de uma vez, sem
// ninguém ter decidido isso. Só o `false` gravado — alguém que desmarcou a
// caixa — significa que a pessoa não bate ponto.
function batePontoDe(p) {
  return p?.batePonto !== false;
}

/* Barra no topo da ficha: a % com peso e O QUE falta. O número sozinho engana —
   por isso a lista de lacunas vem junto, vermelha quando falta essencial.
   ATENÇÃO: a conta é a de src/lib/rh/completudeCadastro.js, que mede uma LISTA
   FIXA de 9 campos (nome, CPF, admissão, cargo, salário, telefone, contato de
   emergência, apelido, CNH) e não aceita outra lista por parâmetro. Os campos
   novos desta ficha — endereço, banco, formação, perfil — NÃO entram na conta:
   a ficha ficar em 100% não quer dizer que o perfil esteja preenchido. */
function BarraCompletude({ c }) {
  const tom = tomDaCompletude(c);
  const cor = tom === "bom" ? "bg-ok-600" : tom === "atencao" ? "bg-warn-600" : "bg-bad-600";
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <span className="label mb-0">Completude da ficha</span>
        <span className="font-display text-xs font-semibold tabular-nums text-slate-700">{c.pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx("h-full rounded-full", cor)} style={{ width: `${c.pct}%` }} />
      </div>
      {c.faltam.length > 0 ? (
        <p className={clsx("mt-1.5 text-xs", c.faltamEssenciais > 0 ? "text-bad-700" : "text-slate-500")}>
          faltam: {c.faltam.map((f) => f.rotulo).join(", ")}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ok-700">Campos obrigatórios preenchidos.</p>
      )}
    </div>
  );
}

// O aviso do prazo da experiência dentro da ficha, com as TRÊS saídas: efetivar
// (o botão aqui), desligar (o botão no rodapé da ficha) ou corrigir a admissão
// (editar o campo — o aviso recalcula do rascunho na hora).
function AvisoExperiencia({ s, podeEfetivar, salvando, aoEfetivar }) {
  const f = fraseExperiencia(s);
  const cores =
    s.situacao === "expirou"
      ? { caixa: "border-bad-200 bg-bad-50", texto: "text-bad-800" }
      : s.situacao === "primeiro-periodo"
        ? { caixa: "border-slate-200 bg-slate-50", texto: "text-slate-700" }
        : { caixa: "border-warn-200 bg-warn-50", texto: "text-warn-800" };
  return (
    <div className={clsx("mb-4 rounded-xl border p-3", cores.caixa)}>
      <p className={clsx("text-sm font-medium", cores.texto)}>{f.longa}</p>
      <p className="mt-1 text-xs text-slate-500">
        As saídas: <strong>Efetivar</strong> (registra a decisão com a data de hoje), <strong>Desligar</strong> (botão
        no rodapé da ficha) ou corrigir a data de admissão, se ela estiver errada.
      </p>
      {podeEfetivar && (
        <button type="button" className="btn-outline mt-2.5" onClick={aoEfetivar} disabled={salvando}>
          Efetivar
        </button>
      )}
    </div>
  );
}

function LinhaPessoa({ p, hojeISO, editavel, aoAbrir }) {
  const desligada = p.ativo === false;
  // Inteligência de leitura da linha (nada disso vai ao banco): ficha
  // incompleta e prazo da experiência. Desligado não é cobrado aqui.
  const cc = desligada ? null : chipCompletude(completudeDaFicha(p));
  const exp = desligada ? null : situacaoExperiencia(p, dataLocalDe(hojeISO));
  const chipExp = exp ? fraseExperiencia(exp) : null;
  // Este não é cobrança, é FATO DO CONTRATO — por isso aparece também em quem
  // foi desligado (a linha inteira já vem apagada) e usa o chip neutro: quem
  // não bate ponto não está errado, só não é medido pelo relógio.
  const semPonto = !batePontoDe(p);
  const Comp = editavel ? "button" : "div";
  return (
    <Comp
      type={editavel ? "button" : undefined}
      onClick={editavel ? aoAbrir : undefined}
      className={clsx(
        "flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border p-3 text-left transition-colors",
        editavel && "hover:bg-slate-50",
        desligada && "opacity-60"
      )}
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {p.nome}
          {p.apelido && <span className="font-normal text-slate-400"> · {p.apelido}</span>}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {[p.cargo || "cargo sem registro", p.setor].filter(Boolean).join(" · ")}
        </span>
        {(chipExp || cc || semPonto) && (
          <span className="mt-1 flex flex-wrap gap-1">
            {chipExp && <span className={clsx(chipExp.chip, "whitespace-nowrap")}>{chipExp.curta}</span>}
            {cc && <span className={clsx(cc.chip, "whitespace-nowrap")}>{cc.texto}</span>}
            {semPonto && (
              <span
                className="chip whitespace-nowrap"
                title={
                  String(p.motivoSemPonto || "").trim()
                    ? `Não bate ponto: ${String(p.motivoSemPonto).trim()}`
                    : "Não bate ponto — motivo sem registro na ficha."
                }
              >
                não bate ponto
              </span>
            )}
          </span>
        )}
      </span>

      {desligada ? (
        <span className="shrink-0 text-right text-xs text-slate-500">
          desligado(a) em {p.desligadoEm ? dataLonga(p.desligadoEm) : "data sem registro"}
        </span>
      ) : (
        <>
          <span className="shrink-0 text-right text-xs text-slate-500">
            {p.admissao ? (
              <>
                <span className="block text-slate-700">{dataLonga(p.admissao)}</span>
                <span className="block">{tempoDeCasa(p.admissao, hojeISO)}</span>
              </>
            ) : (
              <span className="block">admissão sem registro</span>
            )}
          </span>
          <span className="shrink-0 basis-36 text-right text-xs text-slate-500">
            <span className="block text-slate-700">{p.telefone || "sem telefone"}</span>
            <span className="block tabular-nums">
              {/* 0 cai no "sem registro" DE PROPÓSITO: pela regra da lib
                  (completudeCadastro), 0 não é salário registrado, é lacuna
                  — e a completude cobra o campo do mesmo jeito. */}
              {p.salario ? moedaCheia(p.salario) : "salário sem registro"}
            </span>
          </span>
        </>
      )}
    </Comp>
  );
}

/* Os tijolos do formulário. Declarados NO MÓDULO, nunca dentro do componente
   que os usa: componente criado dentro de componente remonta a subárvore a cada
   render e o campo perde o foco a cada letra (o lint reprova como erro). */
function Secao({ titulo, sub, aberta, aoAlternar, children }) {
  const Seta = aberta ? ChevronDown : ChevronRight;
  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--hairline)" }}>
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <Seta size={16} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold text-slate-900">{titulo}</span>
          {sub && <span className="block text-xs text-slate-500">{sub}</span>}
        </span>
      </button>
      {aberta && (
        <div className="border-t px-3.5 py-3.5" style={{ borderColor: "var(--hairline)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Campo({ id, rotulo, valor, aoMudar, tipo = "text", dica, ...resto }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{rotulo}</label>
      <input id={id} type={tipo} className="input" value={valor ?? ""} onChange={aoMudar} {...resto} />
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
    </div>
  );
}

function CampoLongo({ id, rotulo, valor, aoMudar, linhas = 2, dica, ...resto }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{rotulo}</label>
      <textarea id={id} className="input" rows={linhas} value={valor ?? ""} onChange={aoMudar} {...resto} />
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
    </div>
  );
}

function Escolha({ id, rotulo, valor, aoMudar, opcoes, vazio = "não informado", dica }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{rotulo}</label>
      <select id={id} className="select" value={valor ?? ""} onChange={aoMudar}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
    </div>
  );
}

// A linha do tempo da pessoa: o mais recente primeiro, que é a ordem em que se
// pergunta ("o que aconteceu com fulano ultimamente?").
function LinhaTempo({ eventos, editavel, aoApagar }) {
  if (eventos.length === 0) {
    return (
      <Empty>
        Nada registrado ainda. Mudança de cargo, setor e salário entra sozinha quando a ficha for gravada; o resto
        entra em &quot;Registrar acontecimento&quot;.
      </Empty>
    );
  }
  return (
    <ol className="space-y-2">
      {eventos.map((h) => {
        const t = TIPOS_HISTORICO[h.tipo] || TIPOS_HISTORICO.outro;
        const Icone = t.icone;
        return (
          <li key={h.id} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <Icone size={16} strokeWidth={2.2} className={clsx("mt-0.5 shrink-0", t.cor)} />
            <span className="min-w-0 flex-1 text-sm text-slate-700">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  {h.data ? dataLonga(h.data) : "data sem registro"}
                </span>
                <span className="chip">{t.rotulo}</span>
              </span>
              <span className="block font-medium text-slate-900">{h.titulo || t.rotulo}</span>
              {(h.valorDe || h.valorPara) && (
                <span className="block text-xs text-slate-500">
                  {h.valorDe || "sem registro"} → {h.valorPara || "sem registro"}
                </span>
              )}
              {h.detalhe && <span className="block whitespace-pre-wrap">{h.detalhe}</span>}
              {h.obs && <span className="block text-xs text-slate-500">{h.obs}</span>}
            </span>
            {editavel && (
              <button
                type="button"
                onClick={() => aoApagar(h)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
                title="Apagar este registro"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FormPessoa({
  form, setForm, ativos, hojeISO, salvando, secoes, aoAlternarSecao,
  eventos, editavel, aoSalvar, aoFechar, aoAbrirDesligamento, aoReativar, aoEfetivar,
  aoRegistrarAcontecimento, aoApagarEvento, aoBaixarHistorico,
}) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const desligada = form.ativo === false;
  const aberta = (id) => secoes.includes(id);
  // Completude e experiência calculadas do RASCUNHO: preencher um campo ou
  // corrigir a admissão atualiza a barra e o aviso na hora, antes de gravar.
  // O salário mede NORMALIZADO, com o MESMO paraNumero da gravação: no
  // rascunho ele é texto, e "0" digitado contaria como preenchido — mas a
  // regra da lib (e da lista, que lê o gravado) é que salário 0 é lacuna.
  // Sem isso o mesmo cadastro dizia "completa" aqui e "ficha 89%" na lista.
  const cc = completudeDaFicha({
    ...form,
    salario: String(form.salario).trim() ? paraNumero(form.salario) : "",
  });
  const exp = desligada ? null : situacaoExperiencia(form, dataLocalDe(hojeISO));
  // Ninguém é gestor de si mesmo; e o gestor que saiu do quadro continua na
  // lista para não sumir da ficha sem ninguém decidir isso.
  const gestores = ativos.filter((x) => x.id !== form.id);
  const gestorForaDoQuadro = form.gestorId && !ativos.some((x) => x.id === form.gestorId);

  return (
    <Modal titulo={form.id ? "Ficha da pessoa" : "Nova pessoa"} aberto={!!form} aoFechar={aoFechar} largura="max-w-2xl">
      {desligada && (
        <p className="mb-3 text-sm text-slate-500">
          Desligado(a) em {form.desligadoEm ? dataLonga(form.desligadoEm) : "data sem registro"}.
        </p>
      )}
      <BarraCompletude c={cc} />
      {exp && (
        <AvisoExperiencia s={exp} podeEfetivar={!!form.id} salvando={salvando} aoEfetivar={aoEfetivar} />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {/* Nome e apelido ficam FORA das seções: são a identidade da ficha, e
            campo obrigatório escondido dentro de uma seção fechada trava o
            envio do formulário sem o navegador conseguir mostrar onde. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="p-nome" rotulo="Nome" valor={form.nome} aoMudar={setCampo("nome")} autoFocus required />
          <Campo id="p-apelido" rotulo="Apelido" valor={form.apelido} aoMudar={setCampo("apelido")} />
        </div>

        <div className="space-y-2">
          <Secao
            titulo="Identificação"
            sub="Documento, contato e endereço"
            aberta={aberta("identificacao")}
            aoAlternar={() => aoAlternarSecao("identificacao")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="p-nasc" rotulo="Nascimento" tipo="date" valor={form.dataNascimento} aoMudar={setCampo("dataNascimento")} />
              <Escolha id="p-civil" rotulo="Estado civil" valor={form.estadoCivil} aoMudar={setCampo("estadoCivil")} opcoes={ESTADOS_CIVIS} />
              <Campo id="p-cpf" rotulo="CPF" inputMode="numeric" placeholder="000.000.000-00" valor={form.cpf} aoMudar={setCampo("cpf")} />
              <Campo id="p-rg" rotulo="RG" valor={form.rg} aoMudar={setCampo("rg")} />
              <Campo id="p-telefone" rotulo="Telefone" tipo="tel" placeholder="(31) 99999-0000" valor={form.telefone} aoMudar={setCampo("telefone")} />
              <Campo id="p-email" rotulo="E-mail" tipo="email" placeholder="nome@minaslab.com.br" valor={form.email} aoMudar={setCampo("email")} />
              <div className="sm:col-span-2">
                <Campo id="p-endereco" rotulo="Endereço" placeholder="rua, número, bairro" valor={form.endereco} aoMudar={setCampo("endereco")} />
              </div>
              <Campo id="p-cidade" rotulo="Cidade" valor={form.cidade} aoMudar={setCampo("cidade")} />
              <Campo id="p-uf" rotulo="UF" maxLength={2} placeholder="MG" valor={form.uf} aoMudar={setCampo("uf")} />
              {/* CNH fica escrito à mão (e não com o <Escolha>): os valores
                  gravados são "sim"/"nao" desde o começo, e o rótulo que a
                  pessoa lê é outro. Trocar o gravado pelo rótulo renomearia o
                  dado de todas as fichas antigas. */}
              <div>
                <label className="label" htmlFor="p-cnh">CNH</label>
                <select id="p-cnh" className="select" value={form.cnh} onChange={setCampo("cnh")}>
                  <option value="">não informado</option>
                  <option value="sim">tem CNH</option>
                  <option value="nao">não tem</option>
                </select>
              </div>
              <Campo
                id="p-emergencia"
                rotulo="Contato de emergência"
                placeholder="nome e telefone"
                valor={form.contatoEmergencia}
                aoMudar={setCampo("contatoEmergencia")}
              />
            </div>
          </Secao>

          <Secao
            titulo="Contrato"
            sub="Vínculo, jornada, salário, ponto e a quem responde"
            aberta={aberta("contrato")}
            aoAlternar={() => aoAlternarSecao("contrato")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="p-matricula" rotulo="Matrícula" valor={form.matricula} aoMudar={setCampo("matricula")} />
              <Campo id="p-admissao" rotulo="Admissão" tipo="date" valor={form.admissao} aoMudar={setCampo("admissao")} />
              <Campo id="p-cargo" rotulo="Cargo" valor={form.cargo} aoMudar={setCampo("cargo")} />
              <Escolha id="p-setor" rotulo="Setor" valor={form.setor} aoMudar={setCampo("setor")} opcoes={SETORES} />
              <Escolha id="p-contrato" rotulo="Tipo de contrato" valor={form.tipoContrato} aoMudar={setCampo("tipoContrato")} opcoes={TIPOS_CONTRATO} />
              <Campo
                id="p-salario"
                rotulo="Salário (R$)"
                inputMode="decimal"
                placeholder="vazio = sem registro"
                valor={form.salario}
                aoMudar={setCampo("salario")}
              />
              <div className="sm:col-span-2">
                <Campo
                  id="p-jornada"
                  rotulo="Jornada"
                  placeholder="07:30–11:30 e 13:00–17:00"
                  valor={form.jornada}
                  aoMudar={setCampo("jornada")}
                  dica="Escrita como a pessoa cumpre. É daqui que o ponto vai tirar o previsto do dia."
                />
              </div>
              {/* PONTO: quem o relógio cobra. Nasce MARCADO, e a leitura é a
                  mesma de batePontoDe — ficha antiga não tem o campo, e ausente
                  vale SIM. Só o `false` gravado daqui tira alguém da cobrança.
                  Desmarcar abre o motivo AO LADO porque a marca sozinha
                  envelhece: seis meses depois ninguém lembra se foi acordo,
                  cargo de confiança ou esquecimento de quem cadastrou. */}
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3 sm:col-span-2">
                <div className="flex min-w-0 flex-1 basis-64 items-start gap-2.5 py-1">
                  <input
                    id="p-bate-ponto"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-brand"
                    checked={form.batePonto !== false}
                    onChange={(e) =>
                      /* Os dois gravam juntos: voltar a bater ponto apaga o
                         motivo. Guardado, ele seria a justificativa de uma regra
                         que não vale mais — e reapareceria inteiro na próxima
                         vez que alguém desmarcasse, passando por razão de hoje. */
                      setForm({
                        ...form,
                        batePonto: e.target.checked,
                        motivoSemPonto: e.target.checked ? "" : form.motivoSemPonto,
                      })
                    }
                  />
                  <label htmlFor="p-bate-ponto" className="text-sm text-slate-700">
                    Bate ponto no relógio
                    <span className="block text-xs text-slate-500">
                      Desmarque quem não é medido pelo relógio. A lista passa a dizer isso na linha da pessoa.
                    </span>
                  </label>
                </div>
                {form.batePonto === false && (
                  <div className="min-w-0 flex-1 basis-64">
                    <Campo
                      id="p-motivo-sem-ponto"
                      rotulo="Por que não bate"
                      placeholder="ex.: cargo de confiança, acordo, trabalho externo"
                      valor={form.motivoSemPonto}
                      aoMudar={setCampo("motivoSemPonto")}
                      dica="Sem isto escrito, daqui a seis meses ninguém sabe se foi decisão ou esquecimento."
                    />
                  </div>
                )}
              </div>
              <Campo
                id="p-horas"
                rotulo="Horas semanais"
                inputMode="decimal"
                placeholder="vazio = sem registro"
                valor={form.horasSemanais}
                aoMudar={setCampo("horasSemanais")}
              />
              <div>
                <label className="label" htmlFor="p-gestor">Gestor</label>
                <select id="p-gestor" className="select" value={form.gestorId} onChange={setCampo("gestorId")}>
                  <option value="">— sem gestor definido —</option>
                  {gestorForaDoQuadro && (
                    <option value={form.gestorId}>{form.gestorNome || "—"} (fora do quadro)</option>
                  )}
                  {gestores.map((x) => (
                    <option key={x.id} value={x.id}>{x.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </Secao>

          <Secao
            titulo="Banco"
            sub="Para onde o pagamento vai"
            aberta={aberta("banco")}
            aoAlternar={() => aoAlternarSecao("banco")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="p-banco" rotulo="Banco" valor={form.banco} aoMudar={setCampo("banco")} />
              <Campo id="p-agencia" rotulo="Agência" valor={form.agencia} aoMudar={setCampo("agencia")} />
              <Campo id="p-conta" rotulo="Conta" valor={form.conta} aoMudar={setCampo("conta")} />
              <Campo id="p-pix" rotulo="Chave Pix" valor={form.chavePix} aoMudar={setCampo("chavePix")} />
            </div>
          </Secao>

          <Secao
            titulo="Formação"
            sub="Escolaridade, curso e registro de conselho"
            aberta={aberta("formacao")}
            aoAlternar={() => aoAlternarSecao("formacao")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Escolha id="p-escolaridade" rotulo="Escolaridade" valor={form.escolaridade} aoMudar={setCampo("escolaridade")} opcoes={ESCOLARIDADES} />
              <Campo id="p-formacao" rotulo="Formação" placeholder="ex.: Química Industrial" valor={form.formacao} aoMudar={setCampo("formacao")} />
              <div className="sm:col-span-2">
                <Campo
                  id="p-conselho"
                  rotulo="Registro de conselho"
                  placeholder="ex.: CRQ 02-123456"
                  valor={form.registroConselho}
                  aoMudar={setCampo("registroConselho")}
                  dica="Num laboratório é o registro que autoriza assinar laudo — sem ele, o laudo não vale."
                />
              </div>
            </div>
          </Secao>

          {/* PERFIL — regra herdada da Impresilk: ponto forte é CARACTERÍSTICA
              que evolui, não evento de uma conversa. Por isso mora na FICHA, em
              uma versão atual (a que serve na hora de falar com a pessoa ou de
              decidir uma promoção), e não vira uma pilha de registros datados
              como o feedback. É TEXTO LIVRE de propósito: a palavra da casa
              ("segura o cliente difícil no telefone") vale mais que uma etiqueta
              genérica de catálogo comportamental. */}
          <Secao
            titulo="Perfil"
            sub="Como a pessoa trabalha e aprende — a versão de hoje, que muda com ela"
            aberta={aberta("perfil")}
            aoAlternar={() => aoAlternarSecao("perfil")}
          >
            <div className="space-y-3">
              <CampoLongo
                id="p-fortes"
                rotulo="Pontos fortes"
                valor={form.pontosFortes}
                aoMudar={setCampo("pontosFortes")}
                dica="Com as palavras da casa, não com etiqueta de catálogo."
              />
              <CampoLongo
                id="p-melhoria"
                rotulo="Pontos a melhorar"
                valor={form.pontosMelhoria}
                aoMudar={setCampo("pontosMelhoria")}
              />
              <Escolha
                id="p-estilo"
                rotulo="Estilo de aprendizagem"
                valor={form.estiloAprendizagem}
                aoMudar={setCampo("estiloAprendizagem")}
                opcoes={ESTILOS_APRENDIZAGEM}
                dica="Como o treinamento pega melhor com esta pessoa."
              />
              <CampoLongo
                id="p-obsperfil"
                rotulo="Observações do perfil"
                valor={form.observacoesPerfil}
                aoMudar={setCampo("observacoesPerfil")}
                linhas={3}
              />
            </div>
          </Secao>
        </div>

        {/* Observações gerais e o plano de desenvolvimento ficam sempre à vista:
            já eram assim antes das seções, e o plano muda a cadência do feedback
            — controle que muda outra tela não pode ficar escondido. */}
        <CampoLongo id="p-obs" rotulo="Observações" valor={form.obs} aoMudar={setCampo("obs")} />
        <div className="flex items-start gap-2.5">
          <input
            id="p-plano"
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand"
            checked={form.planoAberto === true}
            onChange={(e) => setForm({ ...form, planoAberto: e.target.checked })}
          />
          <label htmlFor="p-plano" className="text-sm text-slate-700">
            Tem plano de desenvolvimento aberto
            <span className="block text-xs text-slate-500">Com plano aberto, a cadência do feedback aperta para 45 dias.</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {form.id && (desligada ? (
              <button type="button" className="btn-outline" onClick={aoReativar}>Reativar</button>
            ) : (
              <button type="button" className="btn-outline text-bad-700" onClick={aoAbrirDesligamento}>Desligar</button>
            ))}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={salvando || !String(form.nome).trim()}>
              {salvando ? "Gravando..." : "Gravar"}
            </button>
          </span>
        </div>
      </form>

      {/* O histórico fica FORA do <form> acima: formulário dentro de formulário
          é HTML inválido, e o modal de acontecimento traz um form próprio. */}
      {form.id && (
        <div className="mt-4">
          <Secao
            titulo="Histórico"
            sub={`${eventos.length === 0 ? "nada registrado" : plural(eventos.length, "acontecimento", "acontecimentos")} — mais recente primeiro`}
            aberta={aberta("historico")}
            aoAlternar={() => aoAlternarSecao("historico")}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {editavel && (
                <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={aoRegistrarAcontecimento}>
                  <Plus size={14} strokeWidth={2.5} /> Registrar acontecimento
                </button>
              )}
              <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={aoBaixarHistorico}>
                <Download size={14} strokeWidth={2.5} /> Baixar planilha
              </button>
            </div>
            <LinhaTempo eventos={eventos} editavel={editavel} aoApagar={aoApagarEvento} />
          </Secao>
        </div>
      )}
    </Modal>
  );
}

/* O desligamento tem modal próprio porque agora ele PERGUNTA o motivo — e o
   motivo vira registro no histórico, no ato. Daqui a dois anos ninguém vai
   perguntar "quando", vai perguntar "por quê", e essa resposta só existe se for
   gravada na hora. Este modal é a confirmação (o botão diz o que vai acontecer),
   por isso não há window.confirm antes: desligar não apaga a ficha. */
function FormDesligamento({ alvo, setAlvo, salvando, aoConfirmar, aoFechar }) {
  if (!alvo) return null;
  return (
    <Modal titulo={`Desligar ${alvo.nome}`} aberto={!!alvo} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoConfirmar();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-600">
          A ficha não é apagada — fica guardada em &quot;Desligados&quot;, e férias, exames e histórico continuam
          apontando para alguém que existe.
        </p>
        <Campo
          id="d-data"
          rotulo="Data do desligamento"
          tipo="date"
          valor={alvo.data}
          aoMudar={(e) => setAlvo({ ...alvo, data: e.target.value })}
          required
        />
        <CampoLongo
          id="d-motivo"
          rotulo="Motivo"
          linhas={3}
          valor={alvo.motivo}
          aoMudar={(e) => setAlvo({ ...alvo, motivo: e.target.value })}
          placeholder="Pedido de demissão, dispensa, fim de contrato — e o que for preciso saber depois."
          dica="O motivo entra no histórico da pessoa, com esta data."
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !alvo.data}>
            {salvando ? "Gravando..." : "Desligar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormAcontecimento({ item, setItem, salvando, aoSalvar, aoFechar }) {
  if (!item) return null;
  const setCampo = (campo) => (e) => setItem({ ...item, [campo]: e.target.value });
  return (
    <Modal titulo={`Registrar acontecimento — ${item.pessoaNome}`} aberto={!!item} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="h-data" rotulo="Quando" tipo="date" valor={item.data} aoMudar={setCampo("data")} required />
          <div>
            <label className="label" htmlFor="h-tipo">Tipo</label>
            <select id="h-tipo" className="select" value={item.tipo} onChange={setCampo("tipo")}>
              {TIPOS_ACONTECIMENTO.map((t) => (
                <option key={t} value={t}>{TIPOS_HISTORICO[t].rotulo}</option>
              ))}
            </select>
          </div>
        </div>
        <Campo
          id="h-titulo"
          rotulo="O que aconteceu"
          valor={item.titulo}
          aoMudar={setCampo("titulo")}
          autoFocus
          placeholder="ex.: NR-32 concluída"
          required
        />
        <CampoLongo id="h-detalhe" rotulo="Detalhe" linhas={3} valor={item.detalhe} aoMudar={setCampo("detalhe")} />
        <p className="text-xs text-slate-500">
          Mudança de cargo, setor e salário não se registra aqui: a própria ficha grava essas, com o valor de antes e o
          de depois, na hora em que ela é gravada.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !item.titulo.trim() || !item.data}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaPessoas({
  ativos, desligados, visiveis, historico, hojeISO, editavel,
  ferias = [], exames = [], vencimentos = [], feedbacks = [], aoIrParaAba,
  busca, setBusca, verDesligados, setVerDesligados,
  form, setForm, salvando, aoAbrir, aoGravar, aoFechar, aoDesligar, aoReativar, aoEfetivar,
  gravar, apagarReg, setAviso,
}) {
  /* A FICHA ABRE NO LUGAR DA LISTA — navegação, não janela flutuante. É o
     desenho da Impresilk: quem abre uma pessoa está indo até ela, e o
     Anterior/Próximo anda na MESMA ordem que a tela mostra. */
  const [fichaId, setFichaId] = useState(null);
  const [secoes, setSecoes] = useState(lerSecoes);
  const [desligando, setDesligando] = useState(null);
  const [acontecimento, setAcontecimento] = useState(null);

  const pessoaId = form?.id || "";
  const eventos = useMemo(() => {
    if (!pessoaId) return [];
    return (historico || [])
      .filter((h) => h.pessoaId === pessoaId)
      .sort(
        (a, b) =>
          String(b.data || "").localeCompare(String(a.data || "")) ||
          String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""))
      );
  }, [historico, pessoaId]);

  const alternarSecao = (id) =>
    setSecoes((atual) => {
      const nova = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
      try {
        localStorage.setItem(K_SECOES, JSON.stringify(nova));
      } catch {
        // Sem localStorage a escolha só não persiste.
      }
      return nova;
    });

  const confirmarDesligamento = async () => {
    const ano = anoRuim(desligando.data);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano da data do desligamento: ${ano}` });
    const ok = await aoDesligar(desligando.motivo, desligando.data);
    // Só fecha se o servidor confirmou: modal que some depois de um erro faz a
    // pessoa achar que deu certo.
    if (ok) setDesligando(null);
  };

  const gravarAcontecimento = () => {
    const a = acontecimento;
    const ano = anoRuim(a.data);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano da data: ${ano}` });
    return gravar(
      "rh_historico",
      {
        pessoaId: a.pessoaId,
        // Nome é CARIMBO: gravado junto, o histórico continua legível quando a
        // pessoa for desligada ou a ficha mudar de nome.
        pessoaNome: a.pessoaNome,
        data: a.data,
        tipo: a.tipo,
        titulo: a.titulo.trim(),
        detalhe: a.detalhe.trim(),
        // Só mudança de ficha preenche De/Para — aqui não há valor anterior.
        valorDe: "",
        valorPara: "",
        obs: "",
      },
      "Acontecimento registrado no histórico.",
      () => setAcontecimento(null)
    );
  };

  const apagarEvento = (h) => {
    if (
      !window.confirm(
        `Apagar "${h.titulo || TIPOS_HISTORICO[h.tipo]?.rotulo || "este registro"}" do histórico de ${
          h.pessoaNome || "esta pessoa"
        }? O histórico não terá mais este registro.`
      )
    ) {
      return;
    }
    apagarReg("rh_historico", h.id, "Registro apagado do histórico.");
  };

  // A planilha leva a linha do tempo que está na tela, desta pessoa.
  const baixarHistorico = () => {
    if (eventos.length === 0) {
      setAviso({ tipo: "erro", texto: "Esta pessoa ainda não tem histórico para baixar." });
      return;
    }
    try {
      const arquivo = baixarPlanilha({
        nome: `historico-${form.nome || "pessoa"}`,
        titulo: `Histórico — ${form.nome}`,
        colunas: COLUNAS_HISTORICO,
        linhas: eventos.map((h) => ({
          data: h.data,
          pessoa: h.pessoaNome || form.nome,
          tipo: (TIPOS_HISTORICO[h.tipo] || TIPOS_HISTORICO.outro).rotulo,
          titulo: h.titulo,
          valorDe: h.valorDe,
          valorPara: h.valorPara,
          detalhe: h.detalhe,
          obs: h.obs,
        })),
      });
      setAviso({
        tipo: "ok",
        texto: `Planilha baixada: ${arquivo} (${plural(eventos.length, "acontecimento", "acontecimentos")}).`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  /* A ORDEM DA NAVEGAÇÃO É A ORDEM DA TELA. Anterior/Próximo andam sobre a
     lista VISÍVEL (com busca e filtro aplicados) mais os desligados quando
     estão à mostra — navegar por uma lista que a pessoa não está vendo pula
     gente e abre a errada. */
  const navegaveis = verDesligados ? [...visiveis, ...desligados] : visiveis;
  const iFicha = fichaId ? navegaveis.findIndex((p) => p.id === fichaId) : -1;
  const pessoaFicha = iFicha >= 0 ? navegaveis[iFicha] : null;
  const daPessoa = (lista) => (lista || []).filter((r) => r.pessoaId === fichaId);

  return (
    <>
      {/* A ficha ocupa o LUGAR da lista (navegação, não janela flutuante), e os
          modais continuam montados abaixo: editar, desligar e registrar
          acontecimento são as ações que a própria ficha oferece. */}
      {pessoaFicha ? (
        <FichaPessoa
          pessoa={pessoaFicha}
          ferias={daPessoa(ferias)}
          todasFerias={ferias}
          exames={daPessoa(exames)}
          vencimentos={daPessoa(vencimentos)}
          feedbacks={daPessoa(feedbacks)}
          historico={daPessoa(historico)}
          hojeISO={hojeISO}
          editavel={editavel}
          aoVoltar={() => setFichaId(null)}
          aoAnterior={iFicha > 0 ? () => setFichaId(navegaveis[iFicha - 1].id) : null}
          aoProximo={iFicha >= 0 && iFicha < navegaveis.length - 1 ? () => setFichaId(navegaveis[iFicha + 1].id) : null}
          aoEditar={() => aoAbrir(pessoaFicha)}
          aoDesligar={() => setDesligando(pessoaFicha)}
          aoEfetivar={() => aoEfetivar(pessoaFicha)}
          aoIrParaAba={aoIrParaAba}
          aoRegistrarAcontecimento={() =>
            setAcontecimento({ pessoaId: pessoaFicha.id, pessoaNome: pessoaFicha.nome, data: hojeISO, tipo: "elogio", titulo: "", detalhe: "" })
          }
        />
      ) : (
      <Card>
        <SectionTitle
          titulo="Quadro"
          sub={`${ativos.length} ${ativos.length === 1 ? "pessoa ativa" : "pessoas ativas"}`}
          acao={
            <>
              <label className="sr-only" htmlFor="rh-busca">Buscar por nome</label>
              <input
                id="rh-busca"
                type="search"
                className="input h-9 w-56"
                placeholder="Buscar por nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </>
          }
        />
        {visiveis.length === 0 && (
          <Empty>
            {ativos.length === 0
              ? "Ninguém no quadro ainda. Cadastre a primeira pessoa no botão lá em cima."
              : "Ninguém no quadro com esse nome."}
          </Empty>
        )}
        <div className="space-y-2">
          {visiveis.map((p) => (
            <LinhaPessoa key={p.id} p={p} hojeISO={hojeISO} editavel={editavel} aoAbrir={() => setFichaId(p.id)} />
          ))}
        </div>

        {desligados.length > 0 && (
          <button
            type="button"
            className="mt-4 text-sm font-medium text-slate-500 underline hover:text-slate-700"
            onClick={() => setVerDesligados(!verDesligados)}
          >
            {verDesligados ? "Ocultar desligados" : `Ver desligados (${desligados.length})`}
          </button>
        )}
        {verDesligados && desligados.length === 0 && (
          <p className="mt-4 text-sm text-slate-400">Nenhum desligamento registrado.</p>
        )}
        {verDesligados && desligados.length > 0 && (
          <div className="mt-3 space-y-2">
            {desligados.map((p) => (
              <LinhaPessoa key={p.id} p={p} hojeISO={hojeISO} editavel={editavel} aoAbrir={() => setFichaId(p.id)} />
            ))}
          </div>
        )}
      </Card>
      )}

      {/* Um modal por vez, de propósito: dois <form> aninhados são HTML inválido
          e o Escape fecharia os dois de uma vez, jogando fora o rascunho da
          ficha sem ninguém pedir. O rascunho continua guardado na casca — ao
          fechar o modal de cima, a ficha volta como estava. */}
      <FormPessoa
        form={desligando || acontecimento ? null : form}
        setForm={setForm}
        ativos={ativos}
        hojeISO={hojeISO}
        salvando={salvando}
        secoes={secoes}
        aoAlternarSecao={alternarSecao}
        eventos={eventos}
        editavel={editavel}
        aoSalvar={aoGravar}
        aoFechar={aoFechar}
        aoAbrirDesligamento={() => setDesligando({ nome: form.nome, data: hojeISO, motivo: "" })}
        aoReativar={aoReativar}
        aoEfetivar={aoEfetivar}
        aoRegistrarAcontecimento={() =>
          setAcontecimento({
            pessoaId: form.id,
            pessoaNome: form.nome,
            data: hojeISO,
            tipo: "elogio",
            titulo: "",
            detalhe: "",
          })
        }
        aoApagarEvento={apagarEvento}
        aoBaixarHistorico={baixarHistorico}
      />

      <FormDesligamento
        alvo={desligando}
        setAlvo={setDesligando}
        salvando={salvando}
        aoConfirmar={confirmarDesligamento}
        aoFechar={() => setDesligando(null)}
      />

      <FormAcontecimento
        item={acontecimento}
        setItem={setAcontecimento}
        salvando={salvando}
        aoSalvar={gravarAcontecimento}
        aoFechar={() => setAcontecimento(null)}
      />
    </>
  );
}
