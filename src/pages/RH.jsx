// RH — a CASCA do módulo: carrega as 4 coleções, guarda o estado, calcula os
// KPIs e orquestra as abas (Pessoas, Férias, Feedback, Vencimentos). A
// renderização de cada aba mora em src/components/rh/Aba*.jsx; helpers usados
// por mais de uma aba em src/components/rh/uteis.js. Só a direção chega nesta
// rota — e o servidor confere de novo em toda chamada; o que a tela esconde é
// conforto.
//
// Decisões desta tela:
// - Uma linha POR PESSOA na aba Férias: a pergunta da direção é "quem está
//   fora?", não "quantos lançamentos existem". O histórico abre no clique.
// - Desligar não apaga: a ficha vira "desligado" e fica guardada — folha e
//   vencimento antigos continuam apontando para alguém que existe.
// - Salário vazio escreve "sem registro": zero seria afirmar salário zero,
//   e ausência de dado não é zero (lição paga na Impresilk).
// - Toda gravação/exclusão passa por gravarRegistro/apagarRegistro daqui: as
//   abas recebem callbacks, nunca falam com services/dados.js por conta.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Users, Sun, MessagesSquare, CalendarClock } from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { ymdLocal, dataCurta, dataLonga, diaLocalISO, diasEntre, paraNumero } from "../lib/format.js";
import { cadenciaDe, cadenciaDaPessoa } from "../lib/rh/feedbackCadencia.js";
import { situacaoExperiencia } from "../lib/rh/clt.js";
import { feriasEmCurso } from "../lib/rh/ferias.js";
import {
  PageTitle, StatCard, Segmented, CarregandoModulo, ErroModulo, Aviso,
} from "../components/ui.jsx";
import { anoRuim, chipVenc } from "../components/rh/uteis.js";
import AbaPessoas from "../components/rh/AbaPessoas.jsx";
import AbaFerias from "../components/rh/AbaFerias.jsx";
import AbaFeedback from "../components/rh/AbaFeedback.jsx";
import AbaVencimentos from "../components/rh/AbaVencimentos.jsx";

const VAZIO_PESSOA = {
  id: "", nome: "", apelido: "", cargo: "", admissao: "", telefone: "",
  cpf: "", cnh: "", contatoEmergencia: "", salario: "", obs: "",
  ativo: true, desligadoEm: "", experienciaDecididaEm: "", planoAberto: false,
};
const VAZIO_FERIAS = {
  id: "", pessoaId: "", pessoaNome: "", inicio: "", retorno: "", abonoDias: "", obs: "", status: "marcada",
};
const VAZIO_VENC = {
  id: "", pessoaId: "", pessoaNome: "", tipo: "ASO", descricao: "", vence: "",
};

export default function RH() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [dados, setDados] = useState(null); // { pessoas, ferias, vencimentos, feedbacks }
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aba, setAba] = useState("pessoas");
  const [busca, setBusca] = useState("");
  const [verDesligados, setVerDesligados] = useState(false);
  const [expandida, setExpandida] = useState(null);
  const [filtroVenc, setFiltroVenc] = useState("");
  const [formPessoa, setFormPessoa] = useState(null);
  const [formFerias, setFormFerias] = useState(null);
  const [formVenc, setFormVenc] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // "Hoje" é ESTADO: a tela fica aberta de um dia para o outro e o dia
  // congelado mentia "de férias" para quem já tinha voltado.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    Promise.all([
      listar("rh_pessoas"), listar("rh_ferias"), listar("rh_vencimentos"), listar("rh_feedbacks"),
    ])
      .then(([pessoas, ferias, vencimentos, feedbacks]) => {
        setDados({ pessoas, ferias, vencimentos, feedbacks });
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (vm
        // existe) — sem este aviso, a recarga que falha deixava a tela velha
        // em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
      });
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Voltou para a aba: refaz a conta do dia e busca o que chegou.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [recarregar]);

  const vm = useMemo(() => {
    if (!dados) return null;
    const norm = (s) => String(s || "").toLowerCase();

    const ativos = dados.pessoas
      .filter((p) => p.ativo !== false)
      .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
    const desligados = dados.pessoas
      .filter((p) => p.ativo === false)
      .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));

    const q = norm(busca).trim();
    const visiveis = q
      ? ativos.filter((p) => norm(p.nome).includes(q) || norm(p.apelido).includes(q))
      : ativos;

    // A mesma âncora da lib: meia-noite LOCAL do hojeISO — new Date("AAAA-MM-DD")
    // seria meia-noite UTC e o dia voltaria um no Brasil.
    const [hA, hM, hD] = hojeISO.split("-").map(Number);
    const hojeData = new Date(hA, hM - 1, hD);

    // Férias: uma linha por pessoa. Concluída/cancelada mandam — decisão
    // explícita não é atropelada pela data.
    const porPessoa = new Map();
    for (const f of dados.ferias) {
      if (!porPessoa.has(f.pessoaId)) porPessoa.set(f.pessoaId, []);
      porPessoa.get(f.pessoaId).push(f);
    }
    const linhasFerias = ativos.map((p) => {
      const periodos = (porPessoa.get(p.id) || [])
        .map((f) => ({ ...f, dias: f.inicio && f.retorno ? diasEntre(f.inicio, f.retorno) : null }))
        .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
      // A MESMA régua da aba (lib/rh/ferias.js) — a régua própria daqui exigia
      // status "marcada" e comparava string crua: registro vindo de fora da
      // tela (backup, outro cliente da porta) fazia o cartão negar a lista.
      const emCurso = periodos.find((f) => feriasEmCurso(f, hojeData));
      const futuras = periodos.filter(
        (f) => f.status === "marcada" && f.inicio && diaLocalISO(f.inicio) > hojeISO
      );
      const proxima = futuras.length ? futuras[futuras.length - 1] : null;
      let situacao;
      if (emCurso) {
        situacao = { ordem: 0, quando: emCurso.retorno, chip: "chip-ok", texto: `de férias, volta ${dataCurta(emCurso.retorno)}` };
      } else if (proxima) {
        const n = diasEntre(hojeISO, proxima.inicio);
        situacao = { ordem: 1, quando: proxima.inicio, chip: "chip", texto: `começa em ${n} ${n === 1 ? "dia" : "dias"}` };
      } else {
        // Este sistema começou agora: ausência de registro não é dívida.
        situacao = { ordem: 2, quando: "", chip: "", texto: "sem férias marcadas" };
      }
      return { p, periodos, situacao };
    });
    linhasFerias.sort(
      (a, b) =>
        a.situacao.ordem - b.situacao.ordem ||
        String(a.situacao.quando).localeCompare(String(b.situacao.quando)) ||
        norm(a.p.nome).localeCompare(norm(b.p.nome))
    );

    const vencimentos = dados.vencimentos
      .map((v) => {
        const dias = v.vence ? diasEntre(hojeISO, v.vence) : null;
        return { ...v, dias, cv: chipVenc(dias) };
      })
      .sort((a, b) => String(a.vence).localeCompare(String(b.vence)));

    const pessoasComVenc = [];
    for (const v of vencimentos) {
      if (v.pessoaId && !pessoasComVenc.some((x) => x.id === v.pessoaId)) {
        pessoasComVenc.push({ id: v.pessoaId, nome: v.pessoaNome || "(sem nome)" });
      }
    }
    pessoasComVenc.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));

    // Feedback: quem está esperando conversa, pelo motor portado da Impresilk.
    // Na taxonomia da lib, "atrasado" JÁ inclui quem nunca recebeu e passou do
    // prazo contado da admissão (cadenciaDe dobra os dois no mesmo rótulo);
    // "nunca" dentro do prazo é fato, não cobrança — e não entra no KPI.
    const fbPorPessoa = new Map();
    for (const f of dados.feedbacks) {
      if (!fbPorPessoa.has(f.pessoaId)) fbPorPessoa.set(f.pessoaId, []);
      fbPorPessoa.get(f.pessoaId).push(f);
    }
    const feedbackEsperando = ativos.filter((p) => {
      const c = cadenciaDe(
        fbPorPessoa.get(p.id) || [],
        p.admissao || null,
        hojeData,
        /* Em experiência é FATO DERIVADO (situacaoExperiencia), não campo da
           ficha: "p.emExperiencia" não existia em lugar nenhum e a cadência de
           30 dias nunca ligava — o primeiro feedback só era cobrado no dia 90,
           o MESMO dia em que o contrato vira indeterminado. */
        cadenciaDaPessoa({ emExperiencia: !!situacaoExperiencia(p, hojeData), comPlanoAberto: p.planoAberto === true })
      );
      return c.situacao === "atrasado";
    }).length;

    return {
      ativos,
      desligados,
      visiveis,
      linhasFerias,
      vencimentos,
      pessoasComVenc,
      feriasAgora: linhasFerias.filter((l) => l.situacao.ordem === 0).length,
      feedbackEsperando,
      venc60: vencimentos.filter((v) => v.dias !== null && v.dias <= 60).length,
      vencidos: vencimentos.filter((v) => v.dias !== null && v.dias < 0).length,
    };
  }, [dados, hojeISO, busca]);

  const gravarRegistro = async (colecao, registro, fraseOk, fechar) => {
    setSalvando(true);
    try {
      await salvar(colecao, registro);
      fechar?.();
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // A porta genérica de exclusão: o window.confirm fica em quem chama, junto
  // do texto que faz sentido para aquele registro.
  const apagarRegistro = async (colecao, id, fraseOk) => {
    try {
      await apagar(colecao, id);
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    }
  };

  const abrirPessoa = (p) =>
    setFormPessoa(
      p
        ? {
            ...VAZIO_PESSOA,
            ...p,
            // Salário volta para o campo do jeito que se digita. Não usar
            // paraCampo aqui: ele devolve "" para 0 e esconderia o 0 que está
            // gravado — o campo mostra o que o registro tem. Para a COMPLETUDE
            // a regra é a da lib (completudeCadastro): salário 0 é lacuna, não
            // registro — a ficha segue cobrando o campo até ter valor de verdade.
            salario: p.salario == null || p.salario === "" ? "" : String(p.salario).replace(".", ","),
          }
        : { ...VAZIO_PESSOA }
    );
  const abrirFerias = (f, pessoaId) =>
    setFormFerias(f ? { ...VAZIO_FERIAS, ...f } : { ...VAZIO_FERIAS, pessoaId: pessoaId || "" });
  const abrirVenc = (v) => setFormVenc(v ? { ...VAZIO_VENC, ...v } : { ...VAZIO_VENC });

  const gravarPessoa = () => {
    const f = formPessoa;
    const ano = anoRuim(f.admissao);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano da admissão: ${ano}` });
    const limpo = {
      ...f,
      nome: f.nome.trim(),
      apelido: f.apelido.trim(),
      cargo: f.cargo.trim(),
      telefone: f.telefone.trim(),
      cpf: f.cpf.trim(),
      contatoEmergencia: f.contatoEmergencia.trim(),
      obs: f.obs.trim(),
      // Vazio fica vazio: gravar 0 afirmaria "salário zero", e não é isso.
      salario: String(f.salario).trim() ? paraNumero(f.salario) : "",
    };
    gravarRegistro(
      "rh_pessoas", limpo,
      f.id ? "Ficha atualizada." : `${limpo.nome} entrou no quadro.`,
      () => setFormPessoa(null)
    );
  };

  // Desligar mexe no registro do servidor, não no rascunho do formulário —
  // edição não gravada não pega carona no desligamento.
  const desligarPessoa = () => {
    const p = dados.pessoas.find((x) => x.id === formPessoa?.id);
    if (!p) return;
    if (!window.confirm(`Desligar ${p.nome}? A ficha não é apagada — fica guardada em "Desligados".`)) return;
    gravarRegistro(
      "rh_pessoas", { ...p, ativo: false, desligadoEm: hojeISO },
      `${p.nome} saiu do quadro. A ficha está em "Desligados".`,
      () => setFormPessoa(null)
    );
  };

  const reativarPessoa = () => {
    const p = dados.pessoas.find((x) => x.id === formPessoa?.id);
    if (!p) return;
    if (!window.confirm(`Reativar ${p.nome} no quadro?`)) return;
    gravarRegistro(
      "rh_pessoas", { ...p, ativo: true, desligadoEm: "" },
      `${p.nome} voltou ao quadro.`,
      () => setFormPessoa(null)
    );
  };

  // Efetivar decide o contrato de experiência: grava a DATA da decisão — no
  // registro do servidor, como o desligar (rascunho não pega carona). Com a
  // data gravada, situacaoExperiencia devolve null e o aviso sai sozinho.
  const efetivarPessoa = () => {
    const p = dados.pessoas.find((x) => x.id === formPessoa?.id);
    if (!p) return;
    if (!window.confirm(`Efetivar ${p.nome}? A decisão da experiência fica registrada com a data de hoje.`)) return;
    gravarRegistro(
      "rh_pessoas", { ...p, experienciaDecididaEm: hojeISO },
      `Efetivado(a) — registrado em ${dataLonga(hojeISO)}.`,
      () => setFormPessoa(null)
    );
  };

  const gravarFerias = () => {
    const f = formFerias;
    const anoI = anoRuim(f.inicio);
    if (anoI) return setAviso({ tipo: "erro", texto: `Confira o ano da data de início: ${anoI}` });
    const anoR = anoRuim(f.retorno);
    if (anoR) return setAviso({ tipo: "erro", texto: `Confira o ano da data de retorno: ${anoR}` });
    if (diasEntre(f.inicio, f.retorno) <= 0) {
      return setAviso({ tipo: "erro", texto: "O retorno precisa ser depois do início — é o dia em que a pessoa volta." });
    }
    // Só dado cru vai ao banco; datas puras "AAAA-MM-DD" (meio-dia local
    // virava 15:00Z e a data andava a cada salvar).
    const { dias: _dias, ...cru } = f;
    const pessoa = vm.ativos.find((x) => x.id === cru.pessoaId);
    gravarRegistro(
      "rh_ferias",
      {
        ...cru,
        obs: (cru.obs || "").trim(),
        // Abono vem do campo como texto; no banco vai NÚMERO. Aqui 0 é honesto:
        // abono só existe se foi lançado — não vender é fato, não dado ausente.
        abonoDias: Math.max(0, Math.trunc(Number(cru.abonoDias) || 0)),
        pessoaNome: pessoa?.nome || cru.pessoaNome || "",
      },
      f.id ? "Férias atualizadas." : "Férias marcadas.",
      () => setFormFerias(null)
    );
  };

  const cancelarFerias = (f) => {
    if (!window.confirm(`Cancelar as férias de ${f.pessoaNome || "esta pessoa"} com início em ${dataLonga(f.inicio)}?`)) return;
    const { dias: _dias, ...cru } = f;
    gravarRegistro("rh_ferias", { ...cru, status: "cancelada" }, "Período cancelado.");
  };

  const gravarVenc = () => {
    const f = formVenc;
    const ano = anoRuim(f.vence);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano da data de vencimento: ${ano}` });
    const { dias: _dias, cv: _cv, ...cru } = f;
    const pessoa = vm.ativos.find((x) => x.id === cru.pessoaId);
    gravarRegistro(
      "rh_vencimentos",
      { ...cru, descricao: (cru.descricao || "").trim(), pessoaNome: pessoa?.nome || cru.pessoaNome || "" },
      f.id ? "Vencimento atualizado." : "Vencimento anotado.",
      () => setFormVenc(null)
    );
  };

  const apagarVenc = (v) => {
    if (!window.confirm(`Apagar ${v.tipo} de ${v.pessoaNome || "pessoa sem registro"}?`)) return;
    apagarRegistro("rh_vencimentos", v.id, "Vencimento apagado.");
  };

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="RH"
        descricao="O quadro da MinasLab: quem trabalha aqui, férias, feedback e o radar de ASO, NR e treinamento."
        acao={
          editavel &&
          (aba === "pessoas" ? (
            <button type="button" className="btn-primary" onClick={() => abrirPessoa(null)}>
              <Plus size={16} strokeWidth={2.5} /> Nova pessoa
            </button>
          ) : aba === "ferias" ? (
            <button type="button" className="btn-primary" onClick={() => abrirFerias(null)}>
              <Plus size={16} strokeWidth={2.5} /> Marcar férias
            </button>
          ) : aba === "vencimentos" ? (
            <button type="button" className="btn-primary" onClick={() => abrirVenc(null)}>
              <Plus size={16} strokeWidth={2.5} /> Novo vencimento
            </button>
          ) : null) // Feedback: o botão de escrita chega com o motor da aba.
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="No quadro"
          valor={String(vm.ativos.length)}
          tom="brand"
          icone={Users}
          onClick={() => {
            setAba("pessoas");
            setVerDesligados(false);
          }}
          ativo={aba === "pessoas"}
        />
        <StatCard
          rotulo="Férias agora"
          valor={String(vm.feriasAgora)}
          tom={vm.feriasAgora > 0 ? "ok" : "neutral"}
          icone={Sun}
          onClick={() => setAba("ferias")}
          ativo={aba === "ferias"}
        />
        <StatCard
          rotulo="Feedback esperando"
          valor={String(vm.feedbackEsperando)}
          tom={vm.feedbackEsperando > 0 ? "warn" : "ok"}
          icone={MessagesSquare}
          onClick={() => setAba("feedback")}
          ativo={aba === "feedback"}
        />
        <StatCard
          rotulo="Vencimentos em 60 dias"
          valor={String(vm.venc60)}
          tom={vm.vencidos > 0 ? "bad" : vm.venc60 > 0 ? "warn" : "ok"}
          sub={vm.vencidos > 0 ? `${vm.vencidos} já ${vm.vencidos === 1 ? "venceu" : "venceram"}` : undefined}
          icone={CalendarClock}
          onClick={() => setAba("vencimentos")}
          ativo={aba === "vencimentos"}
        />
      </div>

      <div className="mb-4">
        <Segmented
          opcoes={[
            { valor: "pessoas", rotulo: "Pessoas" },
            { valor: "ferias", rotulo: "Férias" },
            { valor: "feedback", rotulo: "Feedback" },
            { valor: "vencimentos", rotulo: "Vencimentos" },
          ]}
          valor={aba}
          onChange={setAba}
        />
      </div>

      {aba === "pessoas" && (
        <AbaPessoas
          ativos={vm.ativos}
          desligados={vm.desligados}
          visiveis={vm.visiveis}
          hojeISO={hojeISO}
          editavel={editavel}
          busca={busca}
          setBusca={setBusca}
          verDesligados={verDesligados}
          setVerDesligados={setVerDesligados}
          form={formPessoa}
          setForm={setFormPessoa}
          salvando={salvando}
          aoAbrir={abrirPessoa}
          aoGravar={gravarPessoa}
          aoFechar={() => setFormPessoa(null)}
          aoDesligar={desligarPessoa}
          aoReativar={reativarPessoa}
          aoEfetivar={efetivarPessoa}
        />
      )}

      {aba === "ferias" && (
        <AbaFerias
          linhasFerias={vm.linhasFerias}
          ativos={vm.ativos}
          ferias={dados.ferias}
          hojeISO={hojeISO}
          editavel={editavel}
          expandida={expandida}
          setExpandida={setExpandida}
          form={formFerias}
          setForm={setFormFerias}
          salvando={salvando}
          aoAbrir={abrirFerias}
          aoGravar={gravarFerias}
          aoFechar={() => setFormFerias(null)}
          aoCancelar={cancelarFerias}
        />
      )}

      {aba === "feedback" && (
        <AbaFeedback
          pessoas={dados.pessoas}
          feedbacks={dados.feedbacks}
          hojeISO={hojeISO}
          editavel={editavel}
          gravar={gravarRegistro}
          apagarReg={apagarRegistro}
          setAviso={setAviso}
          recarregar={recarregar}
        />
      )}

      {aba === "vencimentos" && (
        <AbaVencimentos
          vencimentos={vm.vencimentos}
          pessoasComVenc={vm.pessoasComVenc}
          ativos={vm.ativos}
          editavel={editavel}
          filtroVenc={filtroVenc}
          setFiltroVenc={setFiltroVenc}
          form={formVenc}
          setForm={setFormVenc}
          salvando={salvando}
          aoAbrir={abrirVenc}
          aoGravar={gravarVenc}
          aoFechar={() => setFormVenc(null)}
          aoApagar={apagarVenc}
        />
      )}
    </div>
  );
}
