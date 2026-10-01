// Acessos — as contas de quem entra no painel. A rota já é só da direção
// (o servidor confere o papel em toda chamada; esta tela é a parte visível).
//
// A regra mais importante da tela: a senha aparece UMA vez, na hora em que é
// criada ou redefinida, num modal próprio — e nunca mais. Lista de contas não
// carrega senha nenhuma.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, KeyRound, Copy, Check, Shield, Power, Dices, UserRound, Pencil, CaseUpper,
} from "lucide-react";
import { contasListar, contaCriar, contaSenha, contaAtiva, contaPaginas } from "../services/dados.js";
import { contaEditar, contasPadraoLer, contasPadraoNome } from "../services/contas.js";
import { getSessao } from "../lib/sessao.js";
import { GRUPOS_PERMISSOES, PERMISSOES_DISPONIVEIS, SUBPAGINAS_PERMISSOES } from "../lib/catalogoPermissoes.js";
import { dataLonga } from "../lib/format.js";
import {
  PageTitle, Card, Empty, CarregandoModulo, ErroModulo, Aviso, Modal,
} from "../components/ui.jsx";

// Os três papéis da casa — mesma tabela que o servidor conhece.
const PAPEIS = [
  { valor: "direcao", rotulo: "Direção", desc: "tudo, inclusive RH, Finanças e esta tela" },
  { valor: "equipe", rotulo: "Equipe", desc: "lê e edita o operacional; não vê RH" },
  { valor: "leitura", rotulo: "Leitura", desc: "só olha" },
];
const papelDe = (valor) => PAPEIS.find((p) => p.valor === valor) || { rotulo: valor || "—", desc: "" };
const PAGINAS_LEGADAS = [...PERMISSOES_DISPONIVEIS].filter(p => !p.includes("/") && !["patrimonio", "curva-abc"].includes(p));
const paginasDaConta = (conta) => {
  const anteriores = conta.paginas_consulta || [];
  return anteriores.includes("__matriz_v1") || conta.papel === "direcao"
    ? anteriores.filter(p => p !== "__matriz_v1")
    : [...new Set([...PAGINAS_LEGADAS, ...anteriores])];
};
// Padrão de cadastro: com a chave ligada, o nome já aparece em MAIÚSCULAS
// enquanto se digita (na edição, o servidor ml-contas também aplica).
const ajustarNome = (v, maiusculas) => (maiusculas ? String(v || "").toLocaleUpperCase("pt-BR") : v);

function MatrizPaginas({ paginas = [], onChange, direcao = false }) {
  const alternarPagina = (id, marcado) => onChange(marcado
    ? [...new Set([...paginas.filter(p => !p.startsWith(`${id}/`)), id])]
    : paginas.filter(p => p !== id && !p.startsWith(`${id}/`)));
  const alternarSecao = (id, secao, marcado) => {
    const chave = `${id}/${secao}`;
    const herdadas = paginas.includes(id)
      ? (SUBPAGINAS_PERMISSOES[id] || []).map(([s]) => `${id}/${s}`)
      : paginas.filter(p => p.startsWith(`${id}/`));
    const restantes = paginas.filter(p => p !== id && !p.startsWith(`${id}/`));
    onChange([...new Set([...restantes, ...herdadas.filter(p => p !== chave), ...(marcado ? [chave] : [])])]);
  };
  return <div className="grid max-h-[55vh] gap-5 overflow-y-auto rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
    {GRUPOS_PERMISSOES.map(grupo => <section key={grupo.titulo}>
      <h3 className="mb-2 font-semibold text-slate-900">{grupo.titulo}</h3>
      <div className="space-y-2">{grupo.paginas.map(([id, rotulo]) => {
        const disponivel = PERMISSOES_DISPONIVEIS.has(id);
        return <div key={id}>
          <label className={`flex items-start gap-2 text-sm ${disponivel ? "text-slate-700" : "text-slate-400"}`} title={disponivel ? "" : "Acesso individual ainda não disponível nesta página"}>
            <input type="checkbox" className="mt-1 accent-blue-600" checked={direcao || paginas.includes(id) || !!(SUBPAGINAS_PERMISSOES[id]?.length && SUBPAGINAS_PERMISSOES[id].every(([s]) => paginas.includes(`${id}/${s}`)))} disabled={direcao || !disponivel} onChange={e => alternarPagina(id, e.target.checked)}/>
            <span>{rotulo}{id === "crm" && <small className="block text-xs text-slate-500">Exibe o atalho. O acesso ao CRM depende do login e das permissões no próprio CRM.</small>}{!disponivel && <small className="block text-xs">Permissão individual em preparação</small>}</span>
          </label>
          {SUBPAGINAS_PERMISSOES[id] && <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-3">
            {SUBPAGINAS_PERMISSOES[id].map(([secao, nome]) => <label key={secao} className="flex items-center gap-2 text-xs text-slate-500" title={PERMISSOES_DISPONIVEIS.has(`${id}/${secao}`) ? `Liberar somente ${nome}` : "Seleção individual ainda exige proteção dos dados desta aba no servidor"}>
              <input type="checkbox" disabled={direcao || !PERMISSOES_DISPONIVEIS.has(`${id}/${secao}`)} checked={direcao || (disponivel && paginas.includes(id)) || paginas.includes(`${id}/${secao}`)} onChange={e => alternarSecao(id, secao, e.target.checked)} aria-label={`${rotulo} — ${nome}`}/>
              <span>{nome}</span>
            </label>)}
            <small className="block text-[11px] text-slate-400">{["compras", "gestao-estoque", "patrimonio", "curva-abc"].includes(id) ? `Marque ${rotulo} para todas as abas ou escolha cada uma.` : "Abas liberadas juntas com a página; separação individual em preparação."}</small>
          </div>}
        </div>;
      })}</div>
    </section>)}
  </div>;
}

// Senha que dá para DITAR por telefone e anotar sem errar: palavra-numero-
// palavra. Listas curtas de propósito — a força vem da combinação, e a pessoa
// troca a senha depois.
const PALAVRAS_A = ["campo", "serra", "lago", "pedra", "mata", "rio", "trilha", "vale"];
const PALAVRAS_B = ["verde", "azul", "claro", "forte", "novo", "alto", "firme", "vivo"];
function gerarSenha() {
  const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];
  const n = 10 + Math.floor(Math.random() * 90);
  return `${sorteia(PALAVRAS_A)}-${n}-${sorteia(PALAVRAS_B)}`;
}

// O usuário é CHAVE de login: minúsculo, sem espaço nem acento, digitável em
// qualquer teclado. Normalizar no onChange evita a conta "Léo " que ninguém
// consegue reproduzir na tela de entrada.
function normalizarUsuario(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function LinhaConta({ conta, minha, aoEditar, aoRedefinir, aoAlternarAtiva, aoPaginas }) {
  const ativa = conta.ativo !== false;
  const papel = papelDe(conta.papel);
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 ${ativa ? "" : "opacity-60"}`}
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <UserRound size={17} strokeWidth={2.2} />
      </span>

      <span className="min-w-0 flex-1 basis-48">
        <span className="flex items-center gap-2">
          <span className="min-w-0 break-words font-display text-sm font-semibold text-slate-900">{conta.usuario}</span>
          {minha && <span className="chip-brand">você</span>}
        </span>
        <span className="block break-words text-xs text-slate-500">
          {conta.nome || "sem nome"} · criada em {conta.criado_em ? dataLonga(conta.criado_em) : "sem registro"}
        </span>
      </span>

      <span className={conta.papel === "direcao" ? "chip-brand" : "chip"}>{papel.rotulo}</span>
      <span className={ativa ? "chip-ok" : "chip-bad"}>{ativa ? "Ativa" : "Desativada"}</span>

      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => aoEditar(conta)}
          title="Editar cadastro"
          aria-label={`Editar cadastro de ${conta.usuario}`}
          className="btn-outline text-xs"
        ><Pencil size={13} /> Editar</button>
        <button
          type="button"
          onClick={() => aoPaginas(conta)}
          className="btn-outline text-xs"
        >Páginas</button>
        <button
          type="button"
          onClick={() => aoRedefinir(conta)}
          title="Redefinir senha"
          aria-label={`Redefinir senha de ${conta.usuario}`}
          className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <KeyRound size={15} />
        </button>
        {/* A própria conta não se desativa — a direção não pode se trancar
            fora do painel. O servidor também barra. */}
        {!minha && (
          <button
            type="button"
            onClick={() => aoAlternarAtiva(conta)}
            title={ativa ? "Desativar" : "Reativar"}
            aria-label={`${ativa ? "Desativar" : "Reativar"} conta ${conta.usuario}`}
            className={`grid h-10 w-10 place-items-center rounded-lg ${
              ativa
                ? "text-slate-500 hover:bg-bad-50 hover:text-bad-700"
                : "text-slate-500 hover:bg-ok-50 hover:text-ok-700"
            }`}
          >
            <Power size={15} />
          </button>
        )}
      </span>
    </div>
  );
}

function FormNovaConta({ form, setForm, salvando, erro, aoSalvar, aoFechar, maiusculas }) {
  if (!form) return null;
  return (
    <Modal titulo="Criar conta" aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
        aria-busy={salvando}
      >
        {erro && <p role="alert" className="rounded-xl bg-bad-50 p-3 text-sm text-bad-800 break-words">{erro}</p>}
        <div>
          <label className="label" htmlFor="ac-usuario">Usuário (é o login)</label>
          <input
            id="ac-usuario"
            type="text"
            className="input"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="ac-usuario-ajuda"
            value={form.usuario}
            onChange={(e) => setForm({ ...form, usuario: normalizarUsuario(e.target.value) })}
            autoFocus
            required
          />
          <p id="ac-usuario-ajuda" className="mt-1 text-xs text-slate-600">Use letras sem acentos, números, ponto, hífen ou sublinhado. Espaços são removidos.</p>
        </div>
        <div>
          <label className="label" htmlFor="ac-nome">Nome</label>
          <input
            id="ac-nome"
            type="text"
            className="input"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: ajustarNome(e.target.value, maiusculas) })}
            required
          />
          {maiusculas && <p className="mt-1 text-xs text-slate-600">Padrão ligado: o nome é salvo em MAIÚSCULAS.</p>}
        </div>
        <div>
          <label className="label" htmlFor="ac-papel">Papel</label>
          <select
            id="ac-papel"
            className="select"
            aria-describedby="ac-papel-ajuda"
            value={form.papel}
            onChange={(e) => setForm({ ...form, papel: e.target.value })}
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
          <p id="ac-papel-ajuda" className="mt-1 text-xs text-slate-600">{papelDe(form.papel).desc}</p>
        </div>
        <MatrizPaginas paginas={form.paginas_consulta} direcao={form.papel === "direcao"} onChange={paginas_consulta => setForm({ ...form, paginas_consulta })}/>
        <div>
          <label className="label" htmlFor="ac-senha">Senha inicial</label>
          {/* type="text" de propósito: a direção precisa LER a senha para
              entregar. Quem digita às escondidas é quem entra, não quem cria. */}
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              id="ac-senha"
              type="text"
              className="input min-w-0"
              autoComplete="off"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              required
            />
            <button type="button" className="btn-outline shrink-0" onClick={() => setForm({ ...form, senha: gerarSenha() })}>
              <Dices size={15} /> Gerar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={salvando || !form.usuario || !form.nome.trim() || !form.senha}
          >
            {salvando ? "Criando..." : "Criar conta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormEditarConta({ alvo, setAlvo, salvando, erro, aoSalvar, aoFechar, minha, maiusculas }) {
  if (!alvo) return null;
  return (
    <Modal titulo={`Editar cadastro de ${alvo.usuario}`} aberto={!!alvo} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
        aria-busy={salvando}
      >
        {erro && <p role="alert" className="rounded-xl bg-bad-50 p-3 text-sm text-bad-800 break-words">{erro}</p>}
        <div>
          <label className="label" htmlFor="ac-ed-usuario">Usuário (login)</label>
          <input id="ac-ed-usuario" type="text" className="input bg-slate-50 text-slate-500" value={alvo.usuario} readOnly aria-describedby="ac-ed-usuario-ajuda" />
          <p id="ac-ed-usuario-ajuda" className="mt-1 text-xs text-slate-600">O usuário é a chave de entrada e não muda. Para outro login, crie uma conta nova.</p>
        </div>
        <div>
          <label className="label" htmlFor="ac-ed-nome">Nome</label>
          <input
            id="ac-ed-nome"
            type="text"
            className="input"
            value={alvo.nome}
            onChange={(e) => setAlvo({ ...alvo, nome: ajustarNome(e.target.value, maiusculas) })}
            autoFocus
            required
          />
          {maiusculas && <p className="mt-1 text-xs text-slate-600">Padrão ligado: o nome é salvo em MAIÚSCULAS.</p>}
        </div>
        <div>
          <label className="label" htmlFor="ac-ed-papel">Papel</label>
          <select
            id="ac-ed-papel"
            className="select"
            aria-describedby="ac-ed-papel-ajuda"
            value={alvo.papel}
            disabled={minha}
            onChange={(e) => setAlvo({ ...alvo, papel: e.target.value })}
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </select>
          <p id="ac-ed-papel-ajuda" className="mt-1 text-xs text-slate-600">
            {minha ? "Você não pode mudar o papel da própria conta." : `${papelDe(alvo.papel).desc}${alvo.papel !== alvo.papelOriginal ? " — ao salvar, a pessoa precisará entrar de novo." : ""}`}
          </p>
        </div>
        <MatrizPaginas paginas={alvo.paginas_consulta} direcao={alvo.papel === "direcao"} onChange={paginas_consulta => setAlvo({ ...alvo, paginas_consulta })}/>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !alvo.nome.trim()}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormRedefinirSenha({ alvo, setAlvo, salvando, erro, aoSalvar, aoFechar }) {
  if (!alvo) return null;
  return (
    <Modal titulo={`Redefinir senha de ${alvo.usuario}`} aberto={!!alvo} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
        aria-busy={salvando}
      >
        {erro && <p role="alert" className="rounded-xl bg-bad-50 p-3 text-sm text-bad-800 break-words">{erro}</p>}
        <div>
          <label className="label" htmlFor="ac-nova-senha">Nova senha</label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              id="ac-nova-senha"
              type="text"
              className="input min-w-0"
              aria-describedby="ac-nova-senha-ajuda"
              autoComplete="off"
              value={alvo.senha}
              onChange={(e) => setAlvo({ ...alvo, senha: e.target.value })}
              autoFocus
              required
            />
            <button type="button" className="btn-outline shrink-0" onClick={() => setAlvo({ ...alvo, senha: gerarSenha() })}>
              <Dices size={15} /> Gerar
            </button>
          </div>
          <p id="ac-nova-senha-ajuda" className="mt-1.5 text-xs text-slate-500">A senha atual deixa de valer na hora.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !alvo.senha}>
            {salvando ? "Gravando..." : "Redefinir"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// A ÚNICA vez em que a senha aparece. Fechou, acabou — ela não mora em lugar
// nenhum da tela.
function ModalSenhaEntregue({ info, aoFechar }) {
  const [copiado, setCopiado] = useState(null); // "ok" | "falhou" | null
  if (!info) return null;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(info.senha);
      setCopiado("ok");
    } catch {
      setCopiado("falhou");
    }
  };
  return (
    <Modal titulo={`Senha de ${info.usuario}`} aberto={!!info} aoFechar={aoFechar}>
      <Card className="border-2 border-brand-300 bg-brand-50/60 text-center">
        <p className="break-all select-text font-display text-2xl font-bold tracking-wide text-slate-900">{info.senha}</p>
        <button type="button" className="btn-outline mx-auto mt-3" onClick={copiar}>
          {copiado === "ok" ? <Check size={15} className="text-ok-600" /> : <Copy size={15} />}
          {copiado === "ok" ? "Copiada!" : "Copiar"}
        </button>
        {copiado === "ok" && <p role="status" className="sr-only">Senha copiada.</p>}
        {copiado === "falhou" && (
          <p role="alert" className="mt-2 text-xs text-bad-700">Não consegui copiar — selecione a senha e copie manualmente, ou anote à mão.</p>
        )}
      </Card>
      <p className="mt-4 text-sm text-slate-600">
        Anote e entregue para a pessoa — ela pode trocar depois. Esta senha não aparece de novo.
      </p>
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={aoFechar}>Anotei, pode fechar</button>
      </div>
    </Modal>
  );
}

export default function Acessos() {
  const sessao = getSessao();

  const [contas, setContas] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [formNova, setFormNova] = useState(null); // { usuario, nome, papel, senha }
  const [alvoSenha, setAlvoSenha] = useState(null); // { usuario, senha }
  const [alvoPaginas, setAlvoPaginas] = useState(null);
  const [alvoEditar, setAlvoEditar] = useState(null); // { usuario, nome, papel, papelOriginal, paginas_consulta }
  const [nomeMaiusculas, setNomeMaiusculas] = useState(false);
  const [salvandoPadrao, setSalvandoPadrao] = useState(false);
  const [senhaEntregue, setSenhaEntregue] = useState(null); // { usuario, senha }
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState(null);

  const recarregar = useCallback(() => {
    contasPadraoLer().then(setNomeMaiusculas).catch(() => {});
    contasListar()
      .then((lista) => {
        setContas(lista);
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message || "Não foi possível carregar as contas.");
      });
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const vm = useMemo(() => {
    if (!contas) return null;
    const ordemPapel = { direcao: 0, equipe: 1, leitura: 2 };
    const lista = [...contas].sort(
      (a, b) =>
        (a.ativo === false) - (b.ativo === false) ||
        (ordemPapel[a.papel] ?? 9) - (ordemPapel[b.papel] ?? 9) ||
        String(a.usuario).localeCompare(String(b.usuario))
    );
    return {
      lista,
      ativas: lista.filter((c) => c.ativo !== false).length,
      desativadas: lista.filter((c) => c.ativo === false).length,
    };
  }, [contas]);

  const abrirNova = (predef) => {
    setErroFormulario(null);
    setFormNova({ usuario: "", nome: "", papel: "equipe", senha: "", paginas_consulta: [], ...predef });
  };

  const criar = async () => {
    setErroFormulario(null);
    setSalvando(true);
    try {
      // Só os 4 campos crus — nada da tela vai junto.
      const dados = {
        usuario: formNova.usuario,
        nome: ajustarNome(formNova.nome.trim().replace(/\s+/g, " "), nomeMaiusculas),
        papel: formNova.papel,
        senha: formNova.senha,
        paginas_consulta: formNova.papel === "direcao" ? [] : ["__matriz_v1", ...formNova.paginas_consulta],
      };
      await contaCriar(dados);
      setFormNova(null);
      setAviso({ tipo: "ok", texto: `Conta "${dados.usuario}" criada.` });
      setSenhaEntregue({ usuario: dados.usuario, senha: dados.senha });
      recarregar();
    } catch (e) {
      setErroFormulario(e.message || "Não foi possível criar a conta. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const redefinir = async () => {
    setErroFormulario(null);
    setSalvando(true);
    try {
      await contaSenha(alvoSenha.usuario, alvoSenha.senha);
      const entregue = { usuario: alvoSenha.usuario, senha: alvoSenha.senha };
      setAlvoSenha(null);
      setAviso({ tipo: "ok", texto: `Senha de "${entregue.usuario}" redefinida.` });
      setSenhaEntregue(entregue);
      recarregar();
    } catch (e) {
      setErroFormulario(e.message || "Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtiva = async (conta) => {
    const ativa = conta.ativo !== false;
    const frase = ativa
      ? `Desativar a conta "${conta.usuario}"? A pessoa não consegue mais entrar (dá para reativar depois).`
      : `Reativar a conta "${conta.usuario}"?`;
    if (!window.confirm(frase)) return;
    try {
      await contaAtiva(conta.usuario, !ativa);
      setAviso({ tipo: "ok", texto: `Conta "${conta.usuario}" ${ativa ? "desativada" : "reativada"}.` });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    }
  };
  const abrirEditar = (conta) => {
    setErroFormulario(null);
    setAlvoEditar({
      usuario: conta.usuario,
      nome: conta.nome || "",
      papel: conta.papel,
      papelOriginal: conta.papel,
      paginas_consulta: paginasDaConta(conta),
    });
  };

  const salvarEdicao = async () => {
    setErroFormulario(null);
    setSalvando(true);
    try {
      await contaEditar({
        usuario: alvoEditar.usuario,
        nome: ajustarNome(alvoEditar.nome.trim().replace(/\s+/g, " "), nomeMaiusculas),
        papel: alvoEditar.papel,
        paginas_consulta: alvoEditar.papel === "direcao" ? [] : ["__matriz_v1", ...alvoEditar.paginas_consulta],
      });
      const mudouPapel = alvoEditar.papel !== alvoEditar.papelOriginal;
      setAviso({
        tipo: "ok",
        texto: `Cadastro de "${alvoEditar.usuario}" atualizado.${mudouPapel ? " Como o papel mudou, a pessoa precisará entrar novamente." : " Peça ao usuário que entre novamente para atualizar o menu."}`,
      });
      setAlvoEditar(null);
      recarregar();
    } catch (e) {
      setErroFormulario(e.message || "Não foi possível salvar o cadastro. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const alternarPadraoNome = async (ligar) => {
    let converter = false;
    if (ligar && (contas || []).some((c) => c.nome && c.nome !== c.nome.toLocaleUpperCase("pt-BR"))) {
      converter = window.confirm("Converter também os nomes já cadastrados para MAIÚSCULAS?\n\nOK = converter todos · Cancelar = só os próximos cadastros");
    }
    setSalvandoPadrao(true);
    try {
      const r = await contasPadraoNome(ligar, converter);
      setNomeMaiusculas(ligar);
      setAviso({
        tipo: "ok",
        texto: ligar
          ? `Padrão MAIÚSCULAS ligado.${r?.convertidas ? ` ${r.convertidas} ${r.convertidas === 1 ? "nome convertido" : "nomes convertidos"}.` : ""}`
          : "Padrão MAIÚSCULAS desligado — os nomes são salvos como digitados.",
      });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message || "Não foi possível alterar o padrão." });
    } finally {
      setSalvandoPadrao(false);
    }
  };

  const salvarPaginas = async () => {
    setSalvando(true);
    setErroFormulario(null);
    try {
      await contaPaginas(alvoPaginas.usuario, alvoPaginas.papel === "direcao" ? [] : ["__matriz_v1", ...alvoPaginas.paginas_consulta]);
      setAlvoPaginas(null);
      setAviso({ tipo: "ok", texto: "Permissões salvas. Peça ao usuário que entre novamente para atualizar o menu." });
      recarregar();
    } catch (e) { setErroFormulario(e.message); }
    finally { setSalvando(false); }
  };

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Acessos"
        descricao="Quem entra no painel e com qual papel. Só a direção vê esta tela."
        acao={
          <button type="button" className="btn-primary" onClick={() => abrirNova()}>
            <Plus size={16} strokeWidth={2.5} /> Criar conta
          </button>
        }
      />

      {erro && <div role="alert" className="mb-4 rounded-xl bg-bad-50 p-3 text-sm text-bad-800">
        <p>Não foi possível atualizar as contas. A lista exibida é da última carga.</p>
        <button type="button" className="btn-outline mt-2" onClick={recarregar}>Tentar novamente</button>
      </div>}

      {vm.lista.length === 0 ? (
        /* Primeiro acesso: quem está aqui entrou com a senha-mestra. O caminho
           certo é um só — criar a própria conta agora. */
        <Card className="mb-6 border-2 border-brand-400 bg-brand-50/60">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white">
              <Shield size={20} strokeWidth={2.2} />
            </span>
            <p className="min-w-0 flex-1 basis-64 text-sm text-slate-700">
              Você entrou com a senha-mestra. Crie agora a <strong>SUA</strong> conta (usuário{" "}
              <strong>leo</strong>) — depois disso a senha-mestra deixa de valer e o painel passa a
              ser só de quem tem conta.
            </p>
            <button
              type="button"
              className="btn-primary shrink-0"
              onClick={() => abrirNova({ usuario: "leo", nome: "Léo", papel: "direcao" })}
            >
              <Plus size={16} strokeWidth={2.5} /> Criar a minha conta
            </button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
            Contas{" "}
            <span className="text-slate-400">
              ({vm.ativas} {vm.ativas === 1 ? "ativa" : "ativas"}
              {vm.desativadas > 0 ? `, ${vm.desativadas} ${vm.desativadas === 1 ? "desativada" : "desativadas"}` : ""})
            </span>
          </h2>
          <div className="space-y-2">
            {vm.lista.map((c) => (
              <LinhaConta
                key={c.usuario}
                conta={c}
                minha={c.usuario === sessao?.usuario}
                aoRedefinir={(conta) => { setErroFormulario(null); setAlvoSenha({ usuario: conta.usuario, senha: "" }); }}
                aoEditar={abrirEditar}
                aoAlternarAtiva={alternarAtiva}
                aoPaginas={conta => { setErroFormulario(null); setAlvoPaginas({ usuario: conta.usuario, papel: conta.papel, paginas_consulta: paginasDaConta(conta) }); }}
              />
            ))}
          </div>
        </Card>
      )}

      {vm.lista.length === 0 && (
        <Empty className="mb-6">Nenhuma conta criada ainda — comece pela sua, no cartão acima.</Empty>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
          Padrão de cadastro
        </h2>
        <label className="flex cursor-pointer flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <CaseUpper size={18} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1 basis-56">
            <span className="block text-sm font-semibold text-slate-900">Nomes em MAIÚSCULAS</span>
            <span className="block text-xs text-slate-500">
              {nomeMaiusculas
                ? "Ligado: todo nome criado ou editado é salvo em MAIÚSCULAS."
                : "Desligado: os nomes são salvos exatamente como digitados."}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="h-5 w-5 accent-blue-600"
            checked={nomeMaiusculas}
            disabled={salvandoPadrao}
            onChange={(e) => alternarPadraoNome(e.target.checked)}
            aria-label="Padronizar nomes das contas em maiúsculas"
          />
        </label>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
          Os três papéis
        </h2>
        <div className="space-y-3">
          {PAPEIS.map((p) => (
            <div key={p.valor} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`${p.valor === "direcao" ? "chip-brand" : "chip"} shrink-0`}>{p.rotulo}</span>
              <span className="text-sm text-slate-600">{p.desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Quem barra de verdade é o servidor, em toda chamada — o papel aqui só decide o que o menu
          mostra.
        </p>
      </Card>

      <FormNovaConta
        form={formNova}
        setForm={setFormNova}
        salvando={salvando}
        erro={erroFormulario}
        aoSalvar={criar}
        aoFechar={() => setFormNova(null)}
        maiusculas={nomeMaiusculas}
      />
      <FormEditarConta
        alvo={alvoEditar}
        setAlvo={setAlvoEditar}
        salvando={salvando}
        erro={erroFormulario}
        aoSalvar={salvarEdicao}
        aoFechar={() => setAlvoEditar(null)}
        minha={alvoEditar?.usuario === sessao?.usuario}
        maiusculas={nomeMaiusculas}
      />
      {alvoPaginas && <Modal titulo={`Páginas de ${alvoPaginas.usuario}`} aberto aoFechar={() => setAlvoPaginas(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Ao salvar, somente as páginas marcadas ficarão disponíveis para consulta. A direção tem acesso a todas. Em Serviços Gerados, a equipe também pode conferir pagamentos.</p>
          <MatrizPaginas paginas={alvoPaginas.paginas_consulta} direcao={alvoPaginas.papel === "direcao"} onChange={paginas_consulta => setAlvoPaginas(v => ({ ...v, paginas_consulta }))}/>
          {erroFormulario && <p role="alert" className="text-sm text-red-700">{erroFormulario}</p>}
          <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => setAlvoPaginas(null)}>Cancelar</button><button type="button" className="btn-primary" disabled={salvando} onClick={salvarPaginas}>{salvando ? "Salvando..." : "Salvar páginas"}</button></div>
        </div>
      </Modal>}
      <FormRedefinirSenha
        alvo={alvoSenha}
        setAlvo={setAlvoSenha}
        salvando={salvando}
        erro={erroFormulario}
        aoSalvar={redefinir}
        aoFechar={() => setAlvoSenha(null)}
      />
      {/* key = a senha: troca de senha remonta o modal e zera o estado do
          "Copiar" — sem ele, o "Copiada!" da senha anterior aparecia na nova. */}
      <ModalSenhaEntregue
        key={senhaEntregue ? `${senhaEntregue.usuario}:${senhaEntregue.senha}` : "vazio"}
        info={senhaEntregue}
        aoFechar={() => setSenhaEntregue(null)}
      />
    </div>
  );
}
