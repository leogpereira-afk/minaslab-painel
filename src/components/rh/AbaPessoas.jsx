// Aba Pessoas do RH: o quadro (ativos + desligados) e a ficha da pessoa.
// Estado e gravação moram na casca (pages/RH.jsx); aqui mora a renderização
// da aba e a inteligência de LEITURA — completude da ficha e prazo do contrato
// de experiência. Quem decide é a lib (src/lib/rh); aqui é só frase e cor.

import { clsx } from "clsx";
import { moedaCheia, dataLonga, ymdLocal, paraNumero } from "../../lib/format.js";
import { completudeDaFicha, tomDaCompletude } from "../../lib/rh/completudeCadastro.js";
import { situacaoExperiencia } from "../../lib/rh/clt.js";
import { SectionTitle, Empty, Modal, Card } from "../ui.jsx";
import { tempoDeCasa } from "./uteis.js";

// "Hoje" circula como "AAAA-MM-DD"; a lib da CLT quer Date. Meia-noite LOCAL:
// new Date("AAAA-MM-DD") seria meia-noite UTC e o dia voltaria um no Brasil.
function dataLocalDe(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, m - 1, d);
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

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

// Barra no topo da ficha: a % com peso e O QUE falta. O número sozinho engana —
// por isso a lista de lacunas vem junto, vermelha quando falta essencial.
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
        <p className="mt-1.5 text-xs text-ok-700">Ficha completa.</p>
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
        <span className="block truncate text-xs text-slate-500">{p.cargo || "cargo sem registro"}</span>
        {(chipExp || cc) && (
          <span className="mt-1 flex flex-wrap gap-1">
            {chipExp && <span className={clsx(chipExp.chip, "whitespace-nowrap")}>{chipExp.curta}</span>}
            {cc && <span className={clsx(cc.chip, "whitespace-nowrap")}>{cc.texto}</span>}
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

function FormPessoa({ form, setForm, hojeISO, salvando, aoSalvar, aoFechar, aoDesligar, aoReativar, aoEfetivar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const desligada = form.ativo === false;
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
  return (
    <Modal titulo={form.id ? "Ficha da pessoa" : "Nova pessoa"} aberto={!!form} aoFechar={aoFechar}>
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
        <div>
          <label className="label" htmlFor="p-nome">Nome</label>
          <input id="p-nome" type="text" className="input" value={form.nome} onChange={setCampo("nome")} autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="p-apelido">Apelido</label>
            <input id="p-apelido" type="text" className="input" value={form.apelido} onChange={setCampo("apelido")} />
          </div>
          <div>
            <label className="label" htmlFor="p-cargo">Cargo</label>
            <input id="p-cargo" type="text" className="input" value={form.cargo} onChange={setCampo("cargo")} />
          </div>
          <div>
            <label className="label" htmlFor="p-admissao">Admissão</label>
            <input id="p-admissao" type="date" className="input" value={form.admissao} onChange={setCampo("admissao")} />
          </div>
          <div>
            <label className="label" htmlFor="p-telefone">Telefone</label>
            <input id="p-telefone" type="tel" className="input" placeholder="(31) 99999-0000" value={form.telefone} onChange={setCampo("telefone")} />
          </div>
          <div>
            <label className="label" htmlFor="p-cpf">CPF</label>
            <input id="p-cpf" type="text" inputMode="numeric" className="input" placeholder="000.000.000-00" value={form.cpf} onChange={setCampo("cpf")} />
          </div>
          <div>
            <label className="label" htmlFor="p-cnh">CNH</label>
            <select id="p-cnh" className="select" value={form.cnh} onChange={setCampo("cnh")}>
              <option value="">não informado</option>
              <option value="sim">tem CNH</option>
              <option value="nao">não tem</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-salario">Salário (R$)</label>
            <input id="p-salario" type="text" inputMode="decimal" className="input" placeholder="vazio = sem registro" value={form.salario} onChange={setCampo("salario")} />
          </div>
          <div>
            <label className="label" htmlFor="p-emergencia">Contato de emergência</label>
            <input id="p-emergencia" type="text" className="input" placeholder="nome e telefone" value={form.contatoEmergencia} onChange={setCampo("contatoEmergencia")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="p-obs">Observações</label>
          <textarea id="p-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
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
              <button type="button" className="btn-outline text-bad-700" onClick={aoDesligar}>Desligar</button>
            ))}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={salvando || !form.nome.trim()}>
              {salvando ? "Gravando..." : "Gravar"}
            </button>
          </span>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaPessoas({
  ativos, desligados, visiveis, hojeISO, editavel,
  busca, setBusca, verDesligados, setVerDesligados,
  form, setForm, salvando, aoAbrir, aoGravar, aoFechar, aoDesligar, aoReativar, aoEfetivar,
}) {
  return (
    <>
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
            <LinhaPessoa key={p.id} p={p} hojeISO={hojeISO} editavel={editavel} aoAbrir={() => aoAbrir(p)} />
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
              <LinhaPessoa key={p.id} p={p} hojeISO={hojeISO} editavel={editavel} aoAbrir={() => aoAbrir(p)} />
            ))}
          </div>
        )}
      </Card>

      <FormPessoa
        form={form}
        setForm={setForm}
        hojeISO={hojeISO}
        salvando={salvando}
        aoSalvar={aoGravar}
        aoFechar={aoFechar}
        aoDesligar={aoDesligar}
        aoReativar={aoReativar}
        aoEfetivar={aoEfetivar}
      />
    </>
  );
}
