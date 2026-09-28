// APLICAÇÕES E SÓCIOS (rotas /financas/aplicacoes e /financas/socios).
//
// Redesenhada em 28/09/2026 a pedido do Léo: saldo e gráfico de evolução nas
// duas, visual moderno, mais chips. A conta toda é de lib/financeiroPatrimonial.js
// (com teste); a matemática do gráfico, de lib/graficoPatrimonial.js. Aqui é
// desenho, e a ordem da tela segue o que cada número escuta:
//   1. recorte (empresa, conta, sócio): vale para TUDO abaixo;
//   2. posição de hoje e gráfico: histórico completo, NÃO mudam com o período;
//   3. período (atalhos e datas): vale só para o que vem depois dele.
// Assim nenhum número fica parado ao lado de um filtro que ele não escuta.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarRange, Coins, FileText,
  Landmark, ListChecks, PiggyBank, Plus, RefreshCw, Scale, Trash2, TrendingUp, Users,
} from "lucide-react";
import { consultarBaseFinanceira } from "../services/financeiroCache.js";
import { apagar, listar, salvar } from "../services/dados.js";
import { montarPatrimonial } from "../lib/financeiroPatrimonial.js";
import { periodoValido } from "../lib/relatorioFinanceiro.js";
import { dataLonga, moedaCheia, ymdLocal } from "../lib/format.js";
import { mesLongo, moedaCurta, periodoAtivo, periodosRapidos, somasDoHistorico } from "../lib/graficoPatrimonial.js";
import { Aviso, TOM } from "../components/ui.jsx";
import { LinhaRanking, Pilulas, Secao } from "../components/lista.jsx";
import { useSecoes } from "../components/abc/comum.jsx";
import GraficoPatrimonial from "../components/financeiro/GraficoPatrimonial.jsx";
import SaldoAplicacaoJanela from "../components/financeiro/SaldoAplicacaoJanela.jsx";
import "../components/financeiro/patrimonial.css";

// Saldo do extrato informado pela direção (a integração não traz a posição da
// aplicação). Coleção "fin_": o servidor só deixa a direção ler e gravar.
const COLECAO_SALDOS = "fin_aplicacao_saldos";
const hojeLocal = () => ymdLocal(new Date());
const plural = (n, um, varios) => `${Number(n).toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
const dinheiro = (v) => moedaCheia(Math.round((Number(v) || 0) * 100) / 100 || 0);
const dinheiroOu = (v, ausente) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? ausente : dinheiro(v));
const JANELAS_GRAFICO = [
  { valor: "12", rotulo: "12 meses" },
  { valor: "24", rotulo: "24 meses" },
  { valor: "tudo", rotulo: "Tudo" },
];

/* Cartão de número com ícone. `fraco` é para o que não é valor medido ("Não
   informado", "Nenhum"): cinza e menor, para não se ler como um número. Com
   `onClick` vira botão, e então não pode ter botão dentro. */
function Cartao({ rotulo, icone: Icone, tom = "neutral", valor, fraco, sub, children, onClick }) {
  const t = TOM[tom] || TOM.neutral;
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx("card flex min-w-0 flex-col p-4 text-left", onClick && "card-hover cursor-pointer")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="label mb-0">{rotulo}</p>
        {Icone && (
          <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", t.bg, t.texto)}>
            <Icone size={18} strokeWidth={2.2} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={clsx("mt-1.5 break-words font-display font-semibold tnum", fraco ? "text-lg text-slate-500" : "text-2xl text-slate-900")}>{valor}</p>
      {sub && <p className="mt-1 text-xs leading-relaxed text-slate-500">{sub}</p>}
      {children}
    </Comp>
  );
}

function Navegacao({ tipo }) {
  const itens = [
    { to: "/financas/aplicacoes", rotulo: "Aplicações", Icone: PiggyBank, atual: tipo === "aplicacoes" },
    { to: "/financas/socios", rotulo: "Sócios", Icone: Users, atual: tipo === "socios" },
    { to: "/financas/relatorios", rotulo: "Relatórios gerais", Icone: FileText, atual: false },
  ];
  return (
    <nav aria-label="Relatórios patrimoniais" className="sem-impressao flex flex-wrap gap-2">
      {itens.map(({ to, rotulo, Icone, atual }) => (
        <Link
          key={to}
          to={to}
          aria-current={atual ? "page" : undefined}
          style={atual ? undefined : { borderColor: "var(--hairline)" }}
          className={clsx(
            "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-display text-sm font-medium transition-colors",
            atual ? "border-brand bg-brand text-white shadow-sm" : "bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
          )}
        >
          <Icone size={16} aria-hidden="true" />
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}

/* Chips de sócio: filtram a tela inteira. A lista vem do período (quem teve
   movimento), e o sócio escolhido fica visível mesmo recolhido. */
function ChipsSocios({ pessoas, pessoa, aoEscolher }) {
  const [todos, setTodos] = useState(false);
  const limite = 6;
  const lista = todos ? pessoas : [...pessoas.slice(0, limite), ...pessoas.slice(limite).filter((p) => p.ativo)];
  const escondidos = pessoas.length - lista.length;
  const chip = (ativo) =>
    clsx(
      "inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
      ativo ? "border-brand bg-brand text-white shadow-sm" : "bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50",
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" aria-pressed={!pessoa} onClick={() => aoEscolher("")} className={chip(!pessoa)} style={pessoa ? { borderColor: "var(--hairline)" } : undefined}>
        <span className="font-medium">Todos</span>
      </button>
      {lista.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={p.ativo}
          onClick={() => aoEscolher(p.ativo ? "" : p.id)}
          className={chip(p.ativo)}
          style={p.ativo ? undefined : { borderColor: "var(--hairline)" }}
          title={`${p.nome}${p.empresa ? ` (${p.empresa})` : ""}: saídas ${dinheiro(p.saidas)}, entradas ${dinheiro(p.entradas)}, ${plural(p.quantidade, "lançamento", "lançamentos")} no período`}
        >
          <span className="max-w-[14rem] truncate font-medium">{p.nome}</span>
          <span className={clsx("tnum text-xs", p.ativo ? "text-white/85" : "text-slate-500")}>
            {p.quantidade ? (p.saidas > 0 ? moedaCurta(p.saidas) : `entrou ${moedaCurta(p.entradas)}`) : "sem movimento no período"}
          </span>
        </button>
      ))}
      {(escondidos > 0 || todos) && pessoas.length > limite && (
        <button type="button" className="min-h-10 rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50" onClick={() => setTodos((v) => !v)}>
          {todos ? "Mostrar menos" : `Mais ${escondidos}`}
        </button>
      )}
    </div>
  );
}

function CartoesHojeAplicacoes({ r, somas, saldos, outrosRecortes, aoInformar, aoRecarregarSaldos, aoConferir }) {
  const s = r.saldo;
  const diasDoExtrato = s ? Math.round((new Date(`${r.hoje}T12:00:00`) - new Date(`${s.informado.data}T12:00:00`)) / 86400000) : null;
  const possiveis = r.possiveisResgates || { quantidade: 0, total: 0 };
  let saldo;
  if (saldos.estado === "erro") {
    saldo = (
      <Cartao rotulo="Saldo estimado hoje" icone={Landmark} tom="bad" valor="Não foi possível ler" fraco sub={`Os saldos informados não carregaram (${saldos.erro}). Nenhum valor foi estimado.`}>
        <div className="mt-3"><button type="button" className="btn-outline" onClick={aoRecarregarSaldos}><RefreshCw size={15} aria-hidden="true" />Tentar de novo</button></div>
      </Cartao>
    );
  } else if (saldos.estado === "carregando" && !saldos.lista.length) {
    saldo = <Cartao rotulo="Saldo estimado hoje" icone={Landmark} tom="brand" valor="Lendo os saldos…" fraco sub="Consultando os extratos informados." />;
  } else if (s && s.abaixoDeZero) {
    // Resgatar tudo depois do extrato (principal mais o rendimento de dentro do banco)
    // deixa a conta abaixo de zero: isso não é saldo, é sinal de extrato velho.
    saldo = (
      <Cartao
        rotulo="Saldo estimado hoje"
        icone={Landmark}
        tom="warn"
        valor="Informe um extrato mais recente"
        fraco
        sub={`Os resgates depois do extrato de ${dataLonga(s.informado.data)} (${dinheiro(s.resgatesDepois)}) passam do saldo informado (${dinheiro(s.informado.valor)}). O rendimento de dentro da aplicação não aparece na conta, por isso a conta não fecha.`}
      >
        <div className="mt-3 sem-impressao"><button type="button" className="btn-primary" onClick={aoInformar}><Plus size={15} aria-hidden="true" />Informar saldo mais recente</button></div>
      </Cartao>
    );
  } else if (s) {
    const depois = s.movimentosDepois
      ? `, mais ${dinheiro(s.aportesDepois)} em aportes e menos ${dinheiro(s.resgatesDepois)} em resgates depois dele.`
      : ". Nenhum aporte ou resgate reconhecido depois dele.";
    saldo = (
      <Cartao rotulo="Saldo estimado hoje" icone={Landmark} tom="brand" valor={dinheiro(s.estimadoHoje)} sub={`Extrato de ${dataLonga(s.informado.data)}: ${dinheiro(s.informado.valor)}${depois}`}>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip-brand">a partir do extrato informado</span>
          {s.movimentosDepois > 0 && <span className="chip" title="O rendimento de dentro da aplicação só aparece no próximo extrato informado.">estimativa mínima</span>}
          {s.origem === "equivalente" && <span className="chip">extrato de recorte equivalente</span>}
          {diasDoExtrato > 45 && <span className="chip-warn">extrato de {diasDoExtrato} dias atrás</span>}
          {s.anteriorABase && <span className="chip-warn">extrato anterior ao início da base: o que houve entre os dois não está aqui</span>}
          {s.possiveisResgatesDepois?.quantidade > 0 && (
            <span className="chip-warn">{plural(s.possiveisResgatesDepois.quantidade, "crédito sem categoria depois do extrato", "créditos sem categoria depois do extrato")}, não descontados</span>
          )}
        </div>
        <div className="mt-3 sem-impressao"><button type="button" className="btn-outline" onClick={aoInformar}><Plus size={15} aria-hidden="true" />Atualizar saldo</button></div>
      </Cartao>
    );
  } else {
    saldo = (
      <Cartao
        rotulo="Saldo estimado hoje"
        icone={Landmark}
        tom="brand"
        valor="Não informado"
        fraco
        sub={`Informe o saldo que aparece no extrato do banco. O painel soma os aportes e desconta os resgates feitos depois dele.${outrosRecortes ? " Há saldo informado em outro recorte de empresa ou conta, que não vale para este." : ""}`}
      >
        <div className="mt-3 sem-impressao"><button type="button" className="btn-primary" onClick={aoInformar}><Plus size={15} aria-hidden="true" />Informar saldo do extrato</button></div>
      </Cartao>
    );
  }
  return (
    <>
      {saldo}
      {r.capitalAportado === null ? (
        <Cartao rotulo="Capital aportado líquido" icone={PiggyBank} valor="Sem aportes" fraco sub="Nenhum aporte ou resgate com categoria de aplicação neste recorte." />
      ) : (
        <Cartao
          rotulo="Capital aportado líquido"
          icone={PiggyBank}
          tom="brand"
          valor={dinheiro(r.capitalAportado)}
          sub={`${somas?.resgates ? `Aportes (${dinheiro(somas.aportes)}) menos resgates (${dinheiro(somas.resgates)})` : "Soma dos aportes, sem resgate com categoria,"} desde ${mesLongo(somas?.desde)}, até hoje. Não é saldo: rendimentos e créditos sem categoria ficam fora.`}
        />
      )}
      {somas && somas.rendimentos > 0 ? (
        <Cartao rotulo="Rendimentos creditados" icone={TrendingUp} tom="ok" valor={dinheiro(somas.rendimentos)} sub={`Na conta corrente, desde ${mesLongo(somas.desde)}. Não mudam o saldo aplicado.`} />
      ) : (
        <Cartao rotulo="Rendimentos creditados" icone={TrendingUp} valor="Nenhum" fraco sub="Nenhum crédito com categoria de rendimento no histórico deste recorte." />
      )}
      {possiveis.quantidade > 0 ? (
        <Cartao
          rotulo="Possíveis resgates sem categoria"
          icone={AlertTriangle}
          tom="warn"
          valor={dinheiro(possiveis.total)}
          sub={`${plural(possiveis.quantidade, "crédito", "créditos")} de ${dataLonga(possiveis.primeiraData)} a ${dataLonga(possiveis.ultimaData)}, fora de todos os totais. Toque para conferir.`}
          onClick={aoConferir}
        />
      ) : (
        <Cartao rotulo="Possíveis resgates sem categoria" icone={AlertTriangle} tom="ok" valor="Nenhum" fraco sub="Nenhum crédito sem categoria parece resgate neste recorte." />
      )}
    </>
  );
}

function CartoesHojeSocios({ somas, pessoaNome }) {
  if (!somas) return <Cartao rotulo="Líquido com os sócios" icone={Scale} valor="Sem movimento" fraco sub="Nenhum lançamento com categoria de sócio neste recorte." />;
  const de = `desde ${mesLongo(somas.desde)}`;
  return (
    <>
      <Cartao
        rotulo={pessoaNome ? `Líquido com ${pessoaNome}` : "Líquido com os sócios"}
        icone={Scale}
        tom="brand"
        valor={dinheiro(somas.liquido)}
        sub={`Saídas menos entradas ${de}.`}
      >
        {somas.liquido > 0 && <div className="mt-2"><span className="chip">a empresa enviou mais do que recebeu</span></div>}
        {somas.liquido < 0 && <div className="mt-2"><span className="chip">a empresa recebeu mais do que enviou</span></div>}
      </Cartao>
      <Cartao rotulo="Saídas no histórico" icone={ArrowUpRight} tom="warn" valor={dinheiro(somas.saidas)} sub={`Para os sócios, ${de}.`} />
      {somas.entradas > 0 ? (
        <Cartao rotulo="Entradas no histórico" icone={ArrowDownLeft} tom="ok" valor={dinheiro(somas.entradas)} sub={`Dos sócios para a empresa, ${de}.`} />
      ) : (
        <Cartao rotulo="Entradas no histórico" icone={ArrowDownLeft} valor="Nenhuma" fraco sub={`Nenhuma entrada de sócio ${de}.`} />
      )}
      <Cartao
        rotulo="Média mensal de saídas"
        icone={CalendarRange}
        valor={dinheiro(somas.mediaSaidas)}
        sub={`Nos últimos ${plural(somas.mesesDaMedia, "mês", "meses")}, contando os meses sem saída.`}
      />
    </>
  );
}

function CartoesPeriodo({ tipo, r, aoConferir }) {
  if (tipo === "aplicacoes") {
    const nat = Object.fromEntries((r.chips?.naturezas || []).map((n) => [n.nome, n]));
    // Líquido da natureza no sentido dela: estorno (sentido contrário) abate.
    const liquido = (nome, sai) => (nat[nome] ? Math.round((sai ? nat[nome].saidas - nat[nome].entradas : nat[nome].entradas - nat[nome].saidas) * 100) / 100 : null);
    const aportes = liquido("Aporte", true), resgates = liquido("Resgate", false), rendimentos = liquido("Rendimento", false);
    const suspeitos = r.possiveisResgates?.noPeriodo || { quantidade: 0, total: 0 };
    const avisoSuspeitos = suspeitos.quantidade > 0
      ? `${plural(suspeitos.quantidade, "crédito sem categoria parece", "créditos sem categoria parecem")} resgate no período (${dinheiro(suspeitos.total)}), fora do total. Toque para conferir.`
      : "";
    return (
      <>
        <Cartao rotulo="Aportes" icone={PiggyBank} tom={aportes === null ? "neutral" : "brand"} valor={aportes === null ? "Nenhum" : dinheiro(aportes)} fraco={aportes === null} sub={aportes === null ? "Nenhum aporte com categoria no período." : undefined} />
        <Cartao
          rotulo="Resgates"
          icone={ArrowDownLeft}
          tom={suspeitos.quantidade > 0 ? "warn" : resgates === null ? "neutral" : "warn"}
          valor={resgates === null ? (suspeitos.quantidade > 0 ? "Nenhum com categoria" : "Nenhum") : dinheiro(resgates)}
          fraco={resgates === null}
          sub={avisoSuspeitos || (resgates === null ? "Nenhum resgate com categoria no período." : undefined)}
          onClick={suspeitos.quantidade > 0 ? aoConferir : undefined}
        />
        <Cartao rotulo="Rendimentos" icone={TrendingUp} tom={rendimentos === null ? "neutral" : "ok"} valor={rendimentos === null ? "Nenhum" : dinheiro(rendimentos)} fraco={rendimentos === null} sub={rendimentos === null ? "Nenhum rendimento com categoria no período." : undefined} />
        <Cartao rotulo="Lançamentos" icone={ListChecks} valor={Number(r.itens.length).toLocaleString("pt-BR")} sub="Movimentos bancários com categoria de aplicação." />
      </>
    );
  }
  const vazio = !r.itens.length;
  return (
    <>
      <Cartao rotulo="Saídas para sócios" icone={ArrowUpRight} tom={r.saidas > 0 ? "warn" : "neutral"} valor={r.saidas > 0 ? dinheiro(r.saidas) : "Nenhuma"} fraco={!(r.saidas > 0)} />
      <Cartao rotulo="Entradas dos sócios" icone={ArrowDownLeft} tom={r.entradas > 0 ? "ok" : "neutral"} valor={r.entradas > 0 ? dinheiro(r.entradas) : "Nenhuma"} fraco={!(r.entradas > 0)} />
      <Cartao rotulo="Líquido no período" icone={Scale} tom={vazio ? "neutral" : "brand"} valor={vazio ? "Sem movimento" : dinheiro(r.saidas - r.entradas)} fraco={vazio} sub={vazio ? undefined : "Saídas menos entradas."} />
      <Cartao rotulo="Lançamentos" icone={ListChecks} valor={Number(r.itens.length).toLocaleString("pt-BR")} sub="Movimentos bancários com categoria de sócio." />
    </>
  );
}

/* Uma linha de saldo com a exclusão confirmada NA LINHA. Só se exclui o que é deste
   recorte: o saldo de outro recorte que vale aqui por equivalência se exclui lá. */
function LinhaSaldo({ s, destaque, escopo, alerta, podeExcluir, aoExcluir }) {
  const [confirmar, setConfirmar] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  async function excluir() {
    setExcluindo(true);
    try { await aoExcluir(s); } finally { setExcluindo(false); setConfirmar(false); }
  }
  const valor = dinheiroOu(s.valor, "valor inválido");
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <strong className="tnum text-slate-900">{valor}</strong>
          <span className="text-slate-500">em {s.data ? dataLonga(s.data) : "data inválida"}</span>
          {destaque && <span className="chip-brand">é o que vale hoje</span>}
          <span className="chip">{escopo}</span>
        </p>
        {alerta && <p className="mt-0.5 text-xs text-warn-700">{alerta}</p>}
        {s.observacao && <p className="mt-0.5 break-words text-xs text-slate-600">{s.observacao}</p>}
        {(s.atualizadoPor || s.atualizadoEm) && (
          <p className="mt-0.5 text-xs text-slate-400">Informado{s.atualizadoPor ? ` por ${s.atualizadoPor}` : ""}{s.atualizadoEm ? ` em ${new Date(s.atualizadoEm).toLocaleString("pt-BR")}` : ""}</p>
        )}
      </div>
      {podeExcluir && s.id && (
        <div className="sem-impressao flex flex-wrap items-center gap-2">
          {confirmar ? (
            <>
              <span className="text-xs text-slate-600">Excluir este saldo?</span>
              <button type="button" className="btn-outline text-bad-700" disabled={excluindo} onClick={excluir}>{excluindo ? "Excluindo…" : "Excluir"}</button>
              <button type="button" className="btn-ghost" disabled={excluindo} onClick={() => setConfirmar(false)}>Cancelar</button>
            </>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setConfirmar(true)} aria-label={`Excluir o saldo de ${s.data ? dataLonga(s.data) : "data inválida"}`}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function SaldosInformados({ estado, lista, ignorados, outrosRecortes, nomeEscopo, aoInformar, aoExcluir }) {
  if (estado === "erro") return <p className="text-sm text-bad-700">Os saldos informados não carregaram. Use o botão Tentar de novo no cartão de saldo.</p>;
  return (
    <div className="space-y-3">
      {!lista.length && !ignorados.length ? (
        <p className="text-sm text-slate-600">
          Nenhum saldo informado para este recorte.{outrosRecortes ? " Há saldo em outro recorte de empresa ou conta." : ""}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border" style={{ borderColor: "var(--hairline)" }}>
          {[...lista].reverse().map((s, i) => (
            <LinhaSaldo
              key={s.id || `${s.data}-${i}`}
              s={s}
              destaque={i === 0}
              escopo={`vale para ${nomeEscopo(s.empresa_id, s.conta_bancaria_id)}`}
              alerta={s.origem === "equivalente" ? "Informado em outro recorte, com as mesmas aplicações: para excluir, abra aquele recorte." : ""}
              podeExcluir={s.origem === "exato"}
              aoExcluir={aoExcluir}
            />
          ))}
          {ignorados.map((s, i) => (
            <LinhaSaldo key={s.id || `ignorado-${i}`} s={s} escopo="ignorado" alerta={s.motivo} podeExcluir aoExcluir={aoExcluir} />
          ))}
        </ul>
      )}
      <div className="sem-impressao"><button type="button" className="btn-outline" onClick={aoInformar}><Plus size={15} aria-hidden="true" />Informar saldo do extrato</button></div>
    </div>
  );
}

function Lancamentos({ tipo, itens, naturezas, contas }) {
  const [natureza, setNatureza] = useState("");
  const [limite, setLimite] = useState(40);
  const ativa = naturezas.some((n) => n.nome === natureza) ? natureza : "";
  const lista = useMemo(() => itens.filter((m) => !ativa || m.natureza === ativa).slice().reverse(), [itens, ativa]);
  const nomeConta = (m) => m.conta?.nome || contas.find((c) => c.id === m.conta_bancaria_id)?.nome || "Conta não informada";
  if (!itens.length) return <p className="text-sm text-slate-600">Nenhum lançamento com categoria específica neste período.</p>;
  return (
    <div className="space-y-3">
      {naturezas.length > 1 && (
        <div className="sem-impressao">
          <span className="label">Filtrar a lista por natureza</span>
          <Pilulas
            opcoes={[{ valor: "", rotulo: `Todas (${itens.length})` }, ...naturezas.map((n) => ({ valor: n.nome, rotulo: `${n.nome} (${n.quantidade})` }))]}
            valor={ativa}
            aoEscolher={(v) => { setNatureza(v); setLimite(40); }}
          />
        </div>
      )}
      <ul className="space-y-2">
        {lista.slice(0, limite).map((m) => {
          const entrou = m.tipo === "CREDITO";
          return (
            <li key={m.id}>
              <details className="patrimonial-lanc rounded-xl border bg-white" style={{ borderColor: "var(--hairline)" }}>
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5">
                  <span className="tnum w-[5.5rem] shrink-0 text-sm font-semibold text-slate-800">{dataLonga(m.data_movimento)}</span>
                  <span className="chip-brand">{m.natureza}</span>
                  <span className="chip">{entrou ? "entrou na conta" : "saiu da conta"}</span>
                  <span className={m.conciliado ? "chip-ok" : "chip-warn"}>{m.conciliado ? "conciliado" : "conciliação pendente"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{tipo === "socios" ? m.pessoa : nomeConta(m)}</span>
                  <strong className="tnum ml-auto text-sm text-slate-900">{dinheiro(m.valor)}</strong>
                </summary>
                <dl className="grid gap-x-6 gap-y-2 border-t px-3.5 py-3 text-sm sm:grid-cols-2" style={{ borderColor: "var(--hairline)" }}>
                  <div><dt className="label mb-0">Empresa e conta</dt><dd className="break-words text-slate-700">{[m.empresa?.nome, nomeConta(m)].filter(Boolean).join(" · ")}</dd></div>
                  <div><dt className="label mb-0">Favorecido na origem</dt><dd className="break-words text-slate-700">{m.pessoa}</dd></div>
                  <div><dt className="label mb-0">Categoria</dt><dd className="break-words text-slate-700">{m.categoria}</dd></div>
                  <div><dt className="label mb-0">Descrição</dt><dd className="break-words text-slate-700">{m.descricao || "Sem descrição"}</dd></div>
                  <div><dt className="label mb-0">Origem</dt><dd className="text-slate-700">{m.origem || "Não informada"}</dd></div>
                  <div><dt className="label mb-0">Identificador</dt><dd className="break-all text-slate-700">{m.id_omie || m.fitid || m.id}</dd></div>
                </dl>
              </details>
            </li>
          );
        })}
      </ul>
      {lista.length > limite && (
        <button type="button" className="btn-outline sem-impressao" onClick={() => setLimite((v) => v + 40)}>
          Mostrar mais ({plural(lista.length - limite, "lançamento", "lançamentos")})
        </button>
      )}
    </div>
  );
}

/* Atalhos e datas do período. Fica visível também quando o período está
   inválido: sem isso, a data errada escondia os próprios campos que a corrigem. */
function ControlePeriodo({ atalhos, atalho, de, ate, aoMudar }) {
  return (
    <div className="sem-impressao flex flex-col gap-3">
      <Pilulas opcoes={atalhos} valor={atalho} aoEscolher={(v) => { const p = atalhos.find((a) => a.valor === v); if (p) aoMudar(p.de, p.ate); }} />
      <div className="patrimonial-datas">
        <label className="block"><span className="label">De</span><input className="input" type="date" value={de} onChange={(e) => aoMudar(e.target.value, ate)} /></label>
        <label className="block"><span className="label">Até</span><input className="input" type="date" value={ate} onChange={(e) => aoMudar(de, e.target.value)} /></label>
      </div>
    </div>
  );
}

function ItemConferir({ data, titulo, detalhe, valor, motivo }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-2 odd:bg-slate-50">
      <span className="min-w-0 break-words text-slate-700">
        <span className="tnum font-medium text-slate-800">{data ? dataLonga(data) : "sem data"}</span> · {titulo}
        {detalhe && <span className="block text-xs text-slate-500">{detalhe}</span>}
      </span>
      <strong className="tnum text-slate-900">{valor}</strong>
      {motivo && <span className="w-full text-xs text-slate-500">{motivo}</span>}
    </li>
  );
}

// Os possíveis resgates (histórico todo) e os OUTROS candidatos do período, sem repetir
// o mesmo movimento nas duas listas nem nas contagens.
function separarCandidatos(r) {
  const ids = new Set((r.possiveisResgates?.itens || []).map((m) => m.id));
  return { possiveis: r.possiveisResgates, outros: r.candidatos.filter((m) => !ids.has(m.id)) };
}

function ConferirFora({ tipo, possiveis, outros, pendentes }) {
  const obs = (m) => String(m.dados_omie?.cObservacoes || "").trim().slice(0, 140);
  return (
    <div className="space-y-4 text-sm">
      {tipo === "aplicacoes" && (
        <div>
          <h3 className="font-semibold text-slate-800">Possíveis resgates sem categoria (todo o histórico)</h3>
          {possiveis?.quantidade ? (
            <ul className="mt-2">
              {possiveis.itens.map((m) => (
                <ItemConferir key={m.id} data={m.data_movimento} titulo={m.descricao || "Sem descrição"} detalhe={obs(m)} valor={dinheiroOu(m.valor, "valor não informado")} />
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-slate-600">Nenhum.</p>
          )}
        </div>
      )}
      <div>
        <h3 className="font-semibold text-slate-800">{tipo === "aplicacoes" ? "Outros movimentos para conferir no período" : "Movimentos para conferir no período"}</h3>
        {outros.length ? (
          <ul className="mt-2">
            {outros.map((m) => <ItemConferir key={m.id} data={m.data_movimento} titulo={m.descricao || "Sem descrição"} detalhe={obs(m)} valor={dinheiroOu(m.valor, "valor não informado")} motivo={m.motivo} />)}
          </ul>
        ) : (
          <p className="mt-1 text-slate-600">Nenhum.</p>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-slate-800">Títulos pendentes no período</h3>
        {pendentes.length ? (
          <ul className="mt-2">
            {pendentes.map((t) => <ItemConferir key={t.id} data={t.data_vencimento} titulo={t.fornecedor || t.cliente || "Sem nome"} valor={`pendente ${dinheiroOu(t.valor_pendente, "sem valor")}`} />)}
          </ul>
        ) : (
          <p className="mt-1 text-slate-600">Nenhum.</p>
        )}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Descrição livre não comprova a natureza, por isso nada disto entra nos totais. Para um movimento entrar, corrija a categoria na
        Omie; a sincronização seguinte traz a mudança. Títulos pendentes ainda não são pagamento nem recebimento no banco.
      </p>
      <Link className="inline-flex min-h-11 items-center font-medium text-brand-700 hover:underline" to="/financas/conferencia">Abrir conferência financeira</Link>
    </div>
  );
}

export default function PatrimonialFinanceiro({ tipo }) {
  const aplicacoes = tipo === "aplicacoes";
  const hoje = hojeLocal();
  const [empresa, setEmpresa] = useState("");
  const [conta, setConta] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [de, setDe] = useState(() => `${hojeLocal().slice(0, 4)}-01-01`);
  const [ate, setAte] = useState(hojeLocal);
  // O cálculo usa o último período válido: apagar uma data no meio da digitação não
  // desmonta a tela (posição de hoje e gráfico nem dependem do período).
  const [ultimoValido, setUltimoValido] = useState(() => ({ de: `${hojeLocal().slice(0, 4)}-01-01`, ate: hojeLocal() }));
  const [dados, setDados] = useState(null);
  const [op, setOp] = useState({ empresas: [], contas: [] });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const ultimaVersao = useRef(0);
  const [gerando, setGerando] = useState(false);
  const [saldos, setSaldos] = useState({ estado: aplicacoes ? "carregando" : "ok", lista: [], erro: "" });
  const [versaoSaldos, setVersaoSaldos] = useState(0);
  const [janelaSaldo, setJanelaSaldo] = useState(false);
  const [janelaGrafico, setJanelaGrafico] = useState("tudo");
  const [aviso, setAviso] = useState(null);
  const conferirRef = useRef(null);
  const [aberta, alternar, abrir] = useSecoes(`ml.financeiro.${tipo}.secoes.v1`, aplicacoes ? ["grafico", "saldos"] : ["grafico", "porSocio"]);

  // A base anterior fica na tela enquanto a nova chega (atualizar não pisca).
  // Trocar de empresa não aproveita a anterior: o cálculo só usa base da empresa pedida.
  useEffect(() => {
    let ativo = true;
    setErro("");
    setCarregando(true);
    consultarBaseFinanceira(empresa, versao !== ultimaVersao.current)
      .then((base) => { if (ativo) { setOp(base.opcoes); setDados(base); } })
      .catch((e) => { if (ativo) setErro(e.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    ultimaVersao.current = versao;
    return () => { ativo = false; };
  }, [empresa, versao]);

  useEffect(() => {
    if (!aplicacoes) return undefined;
    let ativo = true;
    setSaldos((s) => ({ ...s, estado: "carregando" }));
    listar(COLECAO_SALDOS)
      .then((lista) => { if (ativo) setSaldos({ estado: "ok", lista: Array.isArray(lista) ? lista : [], erro: "" }); })
      .catch((e) => { if (ativo) setSaldos({ estado: "erro", lista: [], erro: e?.message || "falha ao ler" }); });
    return () => { ativo = false; };
  }, [aplicacoes, versaoSaldos]);

  const periodoOk = periodoValido(de, ate);
  const deCalculo = periodoOk ? de : ultimoValido.de;
  const ateCalculo = periodoOk ? ate : ultimoValido.ate;
  const resultado = useMemo(() => {
    if (!dados || dados.empresa !== empresa) return null;
    try {
      return montarPatrimonial({ ...dados, tipo, empresa, conta, pessoa, de: deCalculo, ate: ateCalculo, saldosInformados: saldos.lista, hoje });
    } catch (e) {
      return { falha: e.message };
    }
  }, [dados, tipo, empresa, conta, pessoa, deCalculo, ateCalculo, saldos.lista, hoje]);
  const r = resultado && !resultado.falha ? resultado : null;
  const avisoPeriodo = periodoOk ? "" : !de || !ate ? "Escolha a data inicial e a final do período." : "A data inicial precisa ser igual ou anterior à final.";
  const candidatos = r ? separarCandidatos(r) : { possiveis: null, outros: [] };
  const nomeEscopo = (e, c) =>
    c ? op.contas.find((x) => x.id === c)?.nome || "a conta informada" : e ? `${op.empresas.find((x) => x.id === e)?.nome || "a empresa informada"}, todas as contas` : "todas as empresas e contas";
  // PDF só com o que a tela mostra: período válido e, nas Aplicações, saldos lidos (senão
  // o PDF diria "nenhum extrato informado" sobre um saldo que só não carregou).
  const pdfBloqueado = !periodoOk ? "Corrija o período antes de baixar o PDF." : aplicacoes && saldos.estado !== "ok" ? "Espere os saldos informados carregarem para baixar o PDF." : "";

  const somas = somasDoHistorico(tipo, r?.evolucao);
  const atalhos = periodosRapidos(hoje, r?.baseDesde);
  const atalho = periodoAtivo(atalhos, de, ate);
  const empresaNome = op.empresas.find((e) => e.id === empresa)?.nome || "Todas as empresas";
  const contaNome = op.contas.find((c) => c.id === conta)?.nome || "Todas as contas";
  const pessoaNome = r?.chips?.pessoas?.find((p) => p.id === pessoa)?.nome || "";
  const titulo = aplicacoes ? "Aplicações financeiras" : "Retiradas e movimentações dos sócios";
  // Saldo de outro recorte: existe na coleção e não vale aqui (nem como válido, nem como ignorado deste recorte).
  const outrosRecortes = saldos.estado === "ok" && !!r && saldos.lista.length > r.saldosInformados.length + r.saldosIgnorados.length;
  const evolucao = r ? (janelaGrafico === "tudo" ? r.evolucao : r.evolucao.slice(-Number(janelaGrafico))) : [];

  async function salvarSaldo({ data, valor, observacao }) {
    // O escopo vai no registro: saldo de uma conta não vira saldo de outra. Com "Todas as
    // empresas", a empresa sai da própria conta escolhida.
    const empresaDoSaldo = empresa || op.contas.find((c) => c.id === conta)?.empresa_id || "";
    const vigente = r?.saldo?.informado?.data;
    await salvar(COLECAO_SALDOS, { data, valor, observacao, empresa_id: empresaDoSaldo, conta_bancaria_id: conta });
    setVersaoSaldos((v) => v + 1);
    abrir("saldos");
    setAviso({
      tipo: "ok",
      texto: vigente && data < vigente
        ? `Saldo de ${dataLonga(data)} salvo. O painel continua partindo do extrato mais recente, de ${dataLonga(vigente)}.`
        : `Saldo de ${dataLonga(data)} salvo. O painel já parte dele.`,
    });
  }
  async function excluirSaldo(s) {
    try {
      await apagar(COLECAO_SALDOS, s.id);
      setVersaoSaldos((v) => v + 1);
      setAviso({ tipo: "ok", texto: `Saldo de ${dataLonga(s.data)} excluído.` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui excluir o saldo: ${e.message}` });
    }
  }
  function mudarPeriodo(novoDe, novoAte) {
    setDe(novoDe);
    setAte(novoAte);
    if (periodoValido(novoDe, novoAte)) setUltimoValido({ de: novoDe, ate: novoAte });
  }
  function irParaConferir() {
    abrir("conferir");
    setTimeout(() => conferirRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
  async function pdf() {
    if (!r || gerando || pdfBloqueado) return;
    setGerando(true);
    try {
      const { gerarPdfPatrimonial } = await import("../lib/pdfPatrimonial.js");
      gerarPdfPatrimonial(r, { titulo, empresa: empresaNome, conta: contaNome, pessoa: pessoaNome, consultadoEm: dados.consultadoEm }).save(`minaslab-${tipo}-${de}-${ate}.pdf`);
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar o PDF: ${e.message}` });
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="patrimonial">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-slate-900">{titulo}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            {aplicacoes
              ? "Saldo a partir do extrato informado, aportes, resgates e rendimentos com categoria de aplicação."
              : "Saídas e entradas por sócio, com a natureza registrada na origem: mútuo, pró-labore, distribuição de lucros."}
          </p>
          {dados?.consultadoEm && <p className="mt-2 text-xs text-slate-500">Base consultada em {dados.consultadoEm.toLocaleString("pt-BR")}</p>}
        </div>
        <div className="sem-impressao flex flex-wrap gap-2">
          {aplicacoes && (
            <button type="button" className="btn-outline" onClick={() => setJanelaSaldo(true)} disabled={!r}>
              <Plus size={16} aria-hidden="true" />Informar saldo
            </button>
          )}
          <button type="button" className="btn-outline" onClick={() => setVersao((v) => v + 1)} disabled={carregando}>
            <RefreshCw size={16} aria-hidden="true" className={carregando ? "animate-spin" : undefined} />Atualizar
          </button>
          <button type="button" className="btn-primary" disabled={!r || gerando || !!pdfBloqueado} title={pdfBloqueado || undefined} onClick={pdf}>
            <FileText size={16} aria-hidden="true" />{gerando ? "Preparando…" : "Baixar PDF"}
          </button>
        </div>
      </header>

      <Navegacao tipo={tipo} />

      <section className="card sem-impressao p-4" aria-labelledby="recorte-titulo">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recorte-titulo" className="font-display text-base font-semibold text-slate-900">Recorte</h2>
          <span className="chip">vale para a tela toda</span>
        </div>
        <div className="patrimonial-filtros mt-3">
          <label className="block">
            <span className="label">Empresa</span>
            <select className="input" value={empresa} onChange={(e) => { setEmpresa(e.target.value); setConta(""); setPessoa(""); }}>
              <option value="">Todas as empresas</option>
              {op.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Conta</span>
            <select className="input" value={conta} onChange={(e) => { setConta(e.target.value); setPessoa(""); }}>
              <option value="">Todas as contas</option>
              {op.contas.filter((c) => !empresa || c.empresa_id === empresa).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        </div>
        {!aplicacoes && r && r.chips.pessoas.length > 0 && (
          <div className="mt-3">
            <span className="label">Sócio ou favorecido identificado na origem</span>
            <ChipsSocios pessoas={r.chips.pessoas} pessoa={pessoa} aoEscolher={setPessoa} />
          </div>
        )}
      </section>

      {erro && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bad-50 px-4 py-3 text-sm text-bad-800">
          <span>{erro}</span>
          <button type="button" className="btn-outline" onClick={() => setVersao((v) => v + 1)}>Tentar de novo</button>
        </div>
      )}
      {dados?.aviso && <p role="status" className="rounded-xl bg-warn-50 px-4 py-3 text-sm text-warn-800">{dados.aviso}</p>}
      {resultado?.falha && <p role="alert" className="rounded-xl bg-bad-50 px-4 py-3 text-sm text-bad-800">Não consegui montar os números: {resultado.falha}</p>}
      {!r && !erro && !resultado?.falha && <div className="card p-4 text-sm text-slate-600" role="status">Consultando a base completa…</div>}

      {r && (
        <div className={clsx("flex flex-col gap-4 transition-opacity", carregando && "opacity-60")}>
          <section aria-labelledby="hoje-titulo">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 id="hoje-titulo" className="font-display text-lg font-semibold text-slate-900">Posição de hoje</h2>
              <span className="chip">histórico completo, não muda com o período</span>
              {pessoaNome && <span className="chip-brand">{pessoaNome}</span>}
            </div>
            <div className="patrimonial-grade">
              {aplicacoes ? (
                <CartoesHojeAplicacoes
                  r={r}
                  somas={somas}
                  saldos={saldos}
                  outrosRecortes={outrosRecortes}
                  aoInformar={() => setJanelaSaldo(true)}
                  aoRecarregarSaldos={() => setVersaoSaldos((v) => v + 1)}
                  aoConferir={irParaConferir}
                />
              ) : (
                <CartoesHojeSocios somas={somas} pessoaNome={pessoaNome} />
              )}
            </div>
          </section>

          <Secao
            titulo="Evolução mês a mês"
            sub={r.evolucao.length ? `Histórico completo desde ${mesLongo(r.evolucao[0].mes)}. O período escolhido aparece destacado.` : "Sem histórico neste recorte."}
            aberta={aberta("grafico")}
            aoAlternar={() => alternar("grafico")}
          >
            {/* A janela fica DENTRO do quadro: no cabeçalho da Secao, os botões tomavam
                a largura e o título quebrava palavra por palavra no celular. */}
            {r.evolucao.length > 12 && (
              <div className="sem-impressao flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">Quanto do histórico desenhar</span>
                <Pilulas opcoes={JANELAS_GRAFICO} valor={janelaGrafico} aoEscolher={setJanelaGrafico} />
              </div>
            )}
            <GraficoPatrimonial tipo={tipo} evolucao={evolucao} saldos={r.saldosInformados} periodo={periodoOk ? r.noPeriodo : null} />
          </Secao>

          <section className="card p-4" aria-labelledby="periodo-titulo">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="periodo-titulo" className="font-display text-lg font-semibold text-slate-900">No período</h2>
                <p className="text-sm text-slate-500">
                  {periodoOk ? `${dataLonga(de)} a ${dataLonga(ate)} · ${plural(r.itens.length, "lançamento", "lançamentos")}${pessoaNome ? ` · ${pessoaNome}` : ""}` : "Período incompleto"}
                </p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><CalendarRange size={19} aria-hidden="true" /></span>
            </div>
            <div className="mt-3"><ControlePeriodo atalhos={atalhos} atalho={atalho} de={de} ate={ate} aoMudar={mudarPeriodo} /></div>
            {!periodoOk && <p role="alert" className="mt-3 rounded-xl bg-warn-50 px-3.5 py-2.5 text-sm text-warn-800">{avisoPeriodo}</p>}
            {periodoOk && (
              <div className="patrimonial-grade mt-4">
                <CartoesPeriodo tipo={tipo} r={r} aoConferir={irParaConferir} />
              </div>
            )}
            {periodoOk && r.chips.naturezas.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Naturezas no período">
                {r.chips.naturezas.map((n) => (
                  <li key={n.nome} className="chip gap-1.5">
                    <Coins size={12} aria-hidden="true" />
                    <span className="font-semibold text-slate-700">{n.nome}</span>
                    <span>· {plural(n.quantidade, "lançamento", "lançamentos")}</span>
                    {n.saidas > 0 && <span>· saiu {dinheiro(n.saidas)}</span>}
                    {n.entradas > 0 && <span>· entrou {dinheiro(n.entradas)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {aplicacoes && (
            <Secao
              titulo="Saldos informados"
              sub={saldos.estado === "erro" ? "Os saldos não carregaram" : saldos.estado === "ok" ? `${plural(r.saldosInformados.length, "extrato vale", "extratos valem")} neste recorte` : "Lendo os saldos…"}
              aberta={aberta("saldos")}
              aoAlternar={() => alternar("saldos")}
            >
              <SaldosInformados
                estado={saldos.estado}
                lista={r.saldosInformados}
                ignorados={r.saldosIgnorados}
                outrosRecortes={outrosRecortes}
                nomeEscopo={nomeEscopo}
                aoInformar={() => setJanelaSaldo(true)}
                aoExcluir={excluirSaldo}
              />
            </Secao>
          )}

          {periodoOk && !aplicacoes && (
            <Secao
              titulo="Por sócio"
              sub={`${plural(r.chips.pessoas.filter((p) => p.quantidade > 0).length, "favorecido", "favorecidos")} com movimento no período. Para filtrar a tela, use os chips do recorte.`}
              aberta={aberta("porSocio")}
              aoAlternar={() => alternar("porSocio")}
            >
              {r.chips.pessoas.length ? (
                <div className="space-y-1">
                  {r.chips.pessoas.map((p) => (
                    <LinhaRanking
                      key={p.id}
                      nome={p.nome}
                      valor={dinheiro(p.saidas)}
                      apoios={[p.entradas > 0 ? `entrou ${dinheiro(p.entradas)}` : "sem entrada", plural(p.quantidade, "lançamento", "lançamentos"), p.empresa].filter(Boolean)}
                      teto={Math.max(...r.chips.pessoas.map((x) => x.saidas), 0)}
                      medida={p.saidas}
                      aberta={p.ativo}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Nenhum sócio com movimento no período.</p>
              )}
            </Secao>
          )}

          {periodoOk && (<>
          <Secao titulo="Mês a mês no período" sub={`${plural(r.meses.length, "mês", "meses")} com lançamento`} aberta={aberta("meses")} aoAlternar={() => alternar("meses")}>
            {r.meses.length ? (
              <div className="overflow-x-auto">
                <table className="patrimonial-tabela">
                  <thead><tr><th scope="col">Mês</th><th scope="col">Entradas</th><th scope="col">Saídas</th><th scope="col">{aplicacoes ? "Líquido na conta (entradas menos saídas)" : "Líquido (saídas menos entradas)"}</th><th scope="col">Lançamentos</th></tr></thead>
                  <tbody>
                    {r.meses.map((m) => (
                      <tr key={m.nome}>
                        <th scope="row">{mesLongo(m.nome)}</th>
                        <td>{dinheiro(m.entradas)}</td>
                        <td>{dinheiro(m.saidas)}</td>
                        <td>{dinheiro(aplicacoes ? m.entradas - m.saidas : m.saidas - m.entradas)}</td>
                        <td>{m.registros}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Nenhum lançamento no período.</p>
            )}
          </Secao>

          <Secao
            titulo="Lançamentos do período"
            sub={`${plural(r.itens.length, "lançamento", "lançamentos")}, do mais recente para o mais antigo`}
            aberta={aberta("lancamentos")}
            aoAlternar={() => alternar("lancamentos")}
          >
            <Lancamentos tipo={tipo} itens={r.itens} naturezas={r.chips.naturezas} contas={op.contas} />
          </Secao>

          <div ref={conferirRef}>
            {pessoa ? (
              <p className="card p-4 text-sm text-slate-600">
                A conferência do que ficou fora dos totais aparece sem filtro de sócio: volte para Todos para ver.
              </p>
            ) : (
              <Secao
                titulo="Conferir fora dos totais"
                sub={aplicacoes
                  ? `${plural(candidatos.possiveis?.quantidade || 0, "possível resgate", "possíveis resgates")} sem categoria (todo o histórico); ${plural(candidatos.outros.length, "outro movimento", "outros movimentos")} e ${plural(r.pendentes.length, "título pendente", "títulos pendentes")} no período`
                  : `${plural(candidatos.outros.length, "movimento", "movimentos")} e ${plural(r.pendentes.length, "título pendente", "títulos pendentes")} no período`}
                aberta={aberta("conferir")}
                aoAlternar={() => alternar("conferir")}
              >
                <ConferirFora tipo={tipo} possiveis={candidatos.possiveis} outros={candidatos.outros} pendentes={r.pendentes} />
              </Secao>
            )}
          </div>
          </>)}

          <details className="rounded-xl bg-brand-50 px-3.5 py-1 text-xs leading-relaxed text-brand-800">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">Como ler estes números</summary>
            <div className="pb-2.5">
            {aplicacoes ? (
              <ul className="list-disc space-y-1 pl-4">
                <li>Saldo estimado: o último extrato informado, mais os aportes e menos os resgates reconhecidos depois da data dele. Rendimentos creditados na conta corrente e créditos sem categoria não entram.</li>
                <li>É uma estimativa mínima: o rendimento que acontece dentro da aplicação só aparece no próximo extrato informado. Se os resgates passarem do saldo informado, a tela pede um extrato mais recente em vez de mostrar saldo negativo.</li>
                <li>Capital aportado líquido: aportes menos resgates desde o início da base. Não é saldo, porque não conta o que a aplicação rendeu.</li>
                <li>Só entram movimentos bancários com categoria específica de aplicação. Descrição livre não comprova a natureza.</li>
              </ul>
            ) : (
              <ul className="list-disc space-y-1 pl-4">
                <li>Mútuo, pró-labore, adiantamento e distribuição de lucros são naturezas diferentes: cada lançamento mantém a categoria de origem.</li>
                <li>O favorecido não é classificado como sócio pelo nome: vale a categoria do movimento.</li>
                <li>Líquido com os sócios: tudo o que saiu para eles menos tudo o que voltou, no histórico do recorte.</li>
              </ul>
            )}
            </div>
          </details>
        </div>
      )}

      {janelaSaldo && (
        <SaldoAplicacaoJanela hoje={hoje} escopoRotulo={`${empresaNome} · ${contaNome}`} aoFechar={() => setJanelaSaldo(false)} aoSalvar={salvarSaldo} />
      )}
    </div>
  );
}
