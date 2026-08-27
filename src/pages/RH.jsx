// RH — a CASCA do módulo: carrega as 8 coleções, guarda o estado, calcula os
// KPIs e orquestra as abas (Pessoas, Ponto, Férias, Feedback, Exames,
// Vencimentos). A renderização de cada aba mora em src/components/rh/Aba*.jsx;
// helpers usados por mais de uma aba em src/components/rh/uteis.js. Só a
// direção chega nesta rota — e o servidor confere de novo em toda chamada; o
// que a tela esconde é conforto.
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
// - CARIMBO NO ATO: mudança de cargo, setor ou salário grava, junto da ficha,
//   um registro em "rh_historico" com o valor de antes e o de depois. O sistema
//   só sabe o que gravou — deduzir a mudança depois, pelo autor do registro,
//   foi o que produziu 118 falsos positivos na Impresilk.
// - Os 4 cartões estão na ordem da urgência: quadro, exame vencendo, conversa
//   atrasada, quem está fora. Clicar em um cartão leva à aba dele.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Download, Users, Sun, MessagesSquare, Stethoscope } from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { ymdLocal, dataCurta, dataLonga, diaLocalISO, diasEntre, paraNumero } from "../lib/format.js";
import { baixarPlanilha } from "../lib/planilha.js";
import { cadenciaDe, cadenciaDaPessoa } from "../lib/rh/feedbackCadencia.js";
import { situacaoExperiencia } from "../lib/rh/clt.js";
import { feriasEmCurso } from "../lib/rh/ferias.js";
import {
  PageTitle, StatCard, Segmented, CarregandoModulo, ErroModulo, Aviso,
} from "../components/ui.jsx";
import { anoRuim, chipVenc, marcosDaFicha, radarExames } from "../components/rh/uteis.js";
import AbaPessoas from "../components/rh/AbaPessoas.jsx";
import AbaPonto from "../components/rh/AbaPonto.jsx";
import AbaFerias from "../components/rh/AbaFerias.jsx";
import AbaFeedback from "../components/rh/AbaFeedback.jsx";
import AbaExames from "../components/rh/AbaExames.jsx";
import AbaVencimentos from "../components/rh/AbaVencimentos.jsx";

// Todo campo da ficha nasce aqui: campo ausente no VAZIO chega `undefined` no
// input e o React troca o campo de controlado para não controlado no meio da
// digitação. Ficha antiga, gravada antes destes campos existirem, entra pelo
// spread e ganha "" — sem migração e sem apagar nada do que já estava lá.
const VAZIO_PESSOA = {
  id: "", nome: "", apelido: "", cargo: "", admissao: "", telefone: "",
  cpf: "", cnh: "", contatoEmergencia: "", salario: "", obs: "",
  ativo: true, desligadoEm: "", experienciaDecididaEm: "", planoAberto: false,
  // Pessoais
  dataNascimento: "", rg: "", estadoCivil: "", endereco: "", cidade: "", uf: "", email: "",
  // Contrato
  matricula: "", tipoContrato: "", jornada: "", horasSemanais: "", setor: "",
  gestorId: "", gestorNome: "",
  // Banco
  banco: "", agencia: "", conta: "", chavePix: "",
  // Formação
  escolaridade: "", formacao: "", registroConselho: "",
  // Perfil
  pontosFortes: "", pontosMelhoria: "", estiloAprendizagem: "", observacoesPerfil: "",
};
const VAZIO_FERIAS = {
  id: "", pessoaId: "", pessoaNome: "", inicio: "", retorno: "", abonoDias: "", obs: "", status: "marcada",
};
const VAZIO_VENC = {
  id: "", pessoaId: "", pessoaNome: "", tipo: "ASO", descricao: "", vence: "",
};

// A ficha RESUMIDA que vai para a planilha: o que se usa fora da tela (folha,
// conferência de contrato, lista de contato). Perfil, banco e endereço ficam de
// fora de propósito — planilha baixada circula por e-mail.
const COLUNAS_PESSOAS = [
  { chave: "nome", rotulo: "Nome" },
  { chave: "apelido", rotulo: "Apelido" },
  { chave: "matricula", rotulo: "Matrícula" },
  { chave: "cargo", rotulo: "Cargo" },
  { chave: "setor", rotulo: "Setor" },
  { chave: "tipoContrato", rotulo: "Tipo de contrato" },
  { chave: "gestorNome", rotulo: "Gestor" },
  { chave: "admissao", rotulo: "Admissão", tipo: "data" },
  { chave: "salario", rotulo: "Salário", tipo: "dinheiro" },
  { chave: "jornada", rotulo: "Jornada" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "contatoEmergencia", rotulo: "Contato de emergência" },
  { chave: "situacao", rotulo: "Situação" },
  { chave: "desligadoEm", rotulo: "Desligado em", tipo: "data" },
];

const pessoaParaPlanilha = (p) => ({
  nome: p.nome,
  apelido: p.apelido,
  matricula: p.matricula,
  cargo: p.cargo,
  setor: p.setor,
  tipoContrato: p.tipoContrato,
  gestorNome: p.gestorNome,
  admissao: p.admissao,
  // Dinheiro vai NÚMERO — coluna de texto não soma, e somar é a primeira coisa
  // que se faz com a planilha. Vazio fica vazio: a planilha não inventa
  // "R$ 0,00" para quem não tem salário registrado.
  salario: p.salario === "" || p.salario === null || p.salario === undefined ? "" : Number(p.salario),
  jornada: p.jornada,
  telefone: p.telefone,
  email: p.email,
  cpf: p.cpf,
  contatoEmergencia: p.contatoEmergencia,
  situacao: p.ativo === false ? "Desligado" : "Ativo",
  desligadoEm: p.desligadoEm,
});

// Texto que vai ao banco: aparado e nunca undefined.
const txt = (v) => String(v ?? "").trim();

export default function RH() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [dados, setDados] = useState(null); // { pessoas, ferias, vencimentos, feedbacks, ponto, pontoDia, exames, historico }
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
      listar("rh_ponto"), listar("rh_ponto_dia"), listar("rh_exames"), listar("rh_historico"),
    ])
      .then(([pessoas, ferias, vencimentos, feedbacks, ponto, pontoDia, exames, historico]) => {
        setDados({ pessoas, ferias, vencimentos, feedbacks, ponto, pontoDia, exames, historico });
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

    // Exames: o cartão e a aba leem o MESMO radar (components/rh/uteis.js) —
    // vale o exame mais novo de cada pessoa+tipo, e desligado sai da conta.
    const radar = radarExames(dados.exames, dados.pessoas, hojeISO);
    // A frase do cartão. Nenhum exame cadastrado NÃO é "tudo em dia": é
    // ausência de informação, e sai neutra dizendo o que falta. Exame sem data
    // de validade também é dito — some da conta de prazo, não da tela.
    const sobraExames = [];
    if (radar.vencidos.length) {
      sobraExames.push(`${radar.vencidos.length} já ${radar.vencidos.length === 1 ? "venceu" : "venceram"}`);
    }
    if (radar.semData.length) sobraExames.push(`${radar.semData.length} sem data de validade`);
    const cartaoExames = {
      nenhum: radar.vigentes.length === 0,
      emRisco: radar.emRisco.length,
      tom:
        radar.vigentes.length === 0
          ? "neutral"
          : radar.vencidos.length > 0
            ? "bad"
            : radar.emRisco.length > 0
              ? "warn"
              : "ok",
      sub: radar.vigentes.length === 0 ? "nenhum exame cadastrado" : sobraExames.join(" · ") || undefined,
    };

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
      radarExames: radar,
      cartaoExames,
      feriasAgora: linhasFerias.filter((l) => l.situacao.ordem === 0).length,
      feedbackEsperando,
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

  /* Grava a ficha e, DEPOIS de o servidor confirmar como ela ficou, carimba no
     histórico o que mudou. A ordem importa: histórico de uma mudança que não
     gravou é mentira gravada. E os marcos saem do registro CONFIRMADO, não do
     rascunho — ficha nova só tem id depois que o servidor devolve.
     Devolve true quando a ficha foi gravada (quem chamou fecha o próprio modal).
     Falha ao carimbar NÃO derruba a gravação da ficha, mas é DITA: histórico
     que falha calado é pior que histórico que não existe. */
  const gravarFichaComHistorico = async (registro, fazerMarcos, frase, fechar) => {
    setSalvando(true);
    try {
      const gravada = await salvar("rh_pessoas", registro);
      const marcos = fazerMarcos(gravada);
      let falhas = 0;
      for (const m of marcos) {
        try {
          await salvar("rh_historico", m);
        } catch {
          falhas += 1;
        }
      }
      fechar?.();
      const texto = frase(marcos.length - falhas);
      setAviso(
        falhas
          ? {
              tipo: "erro",
              texto: `${texto} Mas ${falhas === 1 ? "1 mudança não entrou" : `${falhas} mudanças não entraram`} no histórico — registre à mão em "Registrar acontecimento".`,
            }
          : { tipo: "ok", texto }
      );
      recarregar();
      return true;
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
      return false;
    } finally {
      setSalvando(false);
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
            // Mesmo desenho para as horas semanais: 0 gravado tem que voltar
            // como "0" no campo, senão o próximo Gravar apaga o zero em silêncio.
            horasSemanais:
              p.horasSemanais == null || p.horasSemanais === "" ? "" : String(p.horasSemanais).replace(".", ","),
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
    const anoNasc = anoRuim(f.dataNascimento);
    if (anoNasc) return setAviso({ tipo: "erro", texto: `Confira o ano do nascimento: ${anoNasc}` });
    if (f.dataNascimento && f.dataNascimento > hojeISO) {
      return setAviso({ tipo: "erro", texto: "A data de nascimento está no futuro. Confira o campo." });
    }

    // O gestor é id + NOME CARIMBADO: se o id não resolve no quadro (gestor
    // desligado, ou trocou de nome), o nome já gravado fica. Zerar aqui apagaria
    // o histórico de quem respondia a quem.
    const gestor = vm.ativos.find((x) => x.id === f.gestorId);
    const gestorNome = f.gestorId ? gestor?.nome || f.gestorNome || "" : "";

    const limpo = {
      ...f,
      nome: txt(f.nome),
      apelido: txt(f.apelido),
      cargo: txt(f.cargo),
      telefone: txt(f.telefone),
      cpf: txt(f.cpf),
      contatoEmergencia: txt(f.contatoEmergencia),
      obs: txt(f.obs),
      rg: txt(f.rg),
      endereco: txt(f.endereco),
      cidade: txt(f.cidade),
      uf: txt(f.uf).toUpperCase(),
      email: txt(f.email),
      matricula: txt(f.matricula),
      jornada: txt(f.jornada),
      banco: txt(f.banco),
      agencia: txt(f.agencia),
      conta: txt(f.conta),
      chavePix: txt(f.chavePix),
      formacao: txt(f.formacao),
      registroConselho: txt(f.registroConselho),
      pontosFortes: txt(f.pontosFortes),
      pontosMelhoria: txt(f.pontosMelhoria),
      observacoesPerfil: txt(f.observacoesPerfil),
      gestorNome,
      // Vazio fica vazio: gravar 0 afirmaria "salário zero", e não é isso.
      salario: txt(f.salario) ? paraNumero(f.salario) : "",
      // Idem para a carga horária: sem registro não é jornada de zero hora.
      horasSemanais: txt(f.horasSemanais) ? paraNumero(f.horasSemanais) : "",
    };

    // O "antes" vem do SERVIDOR, não do rascunho: é ele que diz o que a ficha
    // afirmava até agora, e é dele que sai o valorDe do carimbo.
    const antes = f.id ? dados.pessoas.find((x) => x.id === f.id) || null : null;

    return gravarFichaComHistorico(
      limpo,
      (gravada) => marcosDaFicha(antes, gravada, hojeISO),
      (n) =>
        f.id
          ? n
            ? `Ficha atualizada — ${n === 1 ? "1 mudança registrada" : `${n} mudanças registradas`} no histórico.`
            : "Ficha atualizada."
          : `${limpo.nome} entrou no quadro.`,
      () => setFormPessoa(null)
    );
  };

  /* Desligar mexe no registro do servidor, não no rascunho do formulário —
     edição não gravada não pega carona no desligamento. O motivo digitado no
     modal vira o registro "desligamento" no histórico: quem pediu conta daqui a
     dois anos vai perguntar POR QUE a pessoa saiu, e essa resposta só existe se
     for gravada no ato. A confirmação é o próprio modal (com o botão dizendo
     "Desligar"), por isso não há window.confirm aqui. */
  const desligarPessoa = async (motivo, dataISO) => {
    const p = dados.pessoas.find((x) => x.id === formPessoa?.id);
    if (!p) return false;
    const dia = dataISO || hojeISO;
    const ano = anoRuim(dia);
    if (ano) {
      setAviso({ tipo: "erro", texto: `Confira o ano da data do desligamento: ${ano}` });
      return false;
    }
    return gravarFichaComHistorico(
      { ...p, ativo: false, desligadoEm: dia },
      (gravada) => [
        {
          pessoaId: gravada.id,
          pessoaNome: gravada.nome || "",
          data: dia,
          tipo: "desligamento",
          titulo: "Desligamento",
          detalhe: txt(motivo),
          valorDe: gravada.cargo || "",
          valorPara: "",
          obs: "",
        },
      ],
      () => `${p.nome} saiu do quadro. A ficha está em "Desligados".`,
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

  // A planilha leva EXATAMENTE o que está na tela: a busca vale, e os
  // desligados só entram se a lista deles estiver aberta. Se exportasse tudo, o
  // total do arquivo divergiria do cartão "No quadro" e a conversa passaria a
  // ser sobre qual dos dois números está certo.
  const baixarPessoas = () => {
    const visiveisAgora = [...vm.visiveis, ...(verDesligados ? vm.desligados : [])];
    if (visiveisAgora.length === 0) {
      setAviso({ tipo: "erro", texto: "Não há ninguém neste recorte para baixar." });
      return;
    }
    try {
      const arquivo = baixarPlanilha({
        nome: "rh-quadro",
        titulo: `Quadro da MinasLab${busca.trim() ? ` — busca "${busca.trim()}"` : ""}${verDesligados ? " (com desligados)" : ""}`,
        colunas: COLUNAS_PESSOAS,
        linhas: visiveisAgora.map(pessoaParaPlanilha),
      });
      setAviso({
        tipo: "ok",
        texto: `Planilha baixada: ${arquivo} (${visiveisAgora.length} ${visiveisAgora.length === 1 ? "pessoa" : "pessoas"}).`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="RH"
        descricao="O quadro da MinasLab: quem trabalha aqui, ponto, férias, feedback, exames e o radar de NR e treinamento."
        acao={
          <div className="flex flex-wrap items-center gap-2">
            {/* Baixar não é escrita: quem só consulta também precisa da planilha. */}
            {aba === "pessoas" && (
              <button type="button" className="btn-outline" onClick={baixarPessoas}>
                <Download size={16} strokeWidth={2.5} /> Baixar planilha
              </button>
            )}
            {editavel && aba === "pessoas" && (
              <button type="button" className="btn-primary" onClick={() => abrirPessoa(null)}>
                <Plus size={16} strokeWidth={2.5} /> Nova pessoa
              </button>
            )}
            {editavel && aba === "ferias" && (
              <button type="button" className="btn-primary" onClick={() => abrirFerias(null)}>
                <Plus size={16} strokeWidth={2.5} /> Marcar férias
              </button>
            )}
            {editavel && aba === "vencimentos" && (
              <button type="button" className="btn-primary" onClick={() => abrirVenc(null)}>
                <Plus size={16} strokeWidth={2.5} /> Novo vencimento
              </button>
            )}
            {/* Feedback, Ponto e Exames: o botão de escrita chega com o motor
                de cada aba — botão que não faz nada é pior que a falta dele. */}
          </div>
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
        {/* ZERO NÃO É RESULTADO: sem nenhum exame cadastrado, "0 vencendo" se
            lê como "está tudo em dia", e a verdade é que ninguém sabe. Por isso
            a coleção vazia sai NEUTRA e dizendo o que falta — e os exames sem
            data de validade também são ditos, em vez de sumirem na conta. */}
        <StatCard
          rotulo="Exames vencendo (60 dias)"
          valor={vm.cartaoExames.nenhum ? "—" : String(vm.cartaoExames.emRisco)}
          tom={vm.cartaoExames.tom}
          sub={vm.cartaoExames.sub}
          icone={Stethoscope}
          onClick={() => setAba("exames")}
          ativo={aba === "exames"}
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
          rotulo="Férias agora"
          valor={String(vm.feriasAgora)}
          tom={vm.feriasAgora > 0 ? "ok" : "neutral"}
          icone={Sun}
          onClick={() => setAba("ferias")}
          ativo={aba === "ferias"}
        />
      </div>

      {/* Seis abas não cabem na largura do celular. Sem o overflow aqui, a
          PÁGINA INTEIRA passava a rolar de lado. */}
      <div className="mb-4 max-w-full overflow-x-auto pb-1">
        <Segmented
          opcoes={[
            { valor: "pessoas", rotulo: "Pessoas" },
            { valor: "ponto", rotulo: "Ponto" },
            { valor: "ferias", rotulo: "Férias" },
            { valor: "feedback", rotulo: "Feedback" },
            { valor: "exames", rotulo: "Exames" },
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
          historico={dados.historico}
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
          gravar={gravarRegistro}
          apagarReg={apagarRegistro}
          setAviso={setAviso}
        />
      )}

      {aba === "ponto" && (
        <AbaPonto
          pessoas={dados.pessoas}
          ativos={vm.ativos}
          ponto={dados.ponto}
          pontoDia={dados.pontoDia}
          hojeISO={hojeISO}
          editavel={editavel}
          gravar={gravarRegistro}
          apagarReg={apagarRegistro}
          setAviso={setAviso}
          recarregar={recarregar}
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

      {aba === "exames" && (
        <AbaExames
          pessoas={dados.pessoas}
          ativos={vm.ativos}
          exames={dados.exames}
          radar={vm.radarExames}
          hojeISO={hojeISO}
          editavel={editavel}
          gravar={gravarRegistro}
          apagarReg={apagarRegistro}
          setAviso={setAviso}
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
