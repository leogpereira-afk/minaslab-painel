// Acessos — as contas de quem entra no painel. A rota já é só da direção
// (o servidor confere o papel em toda chamada; esta tela é a parte visível).
//
// A regra mais importante da tela: a senha aparece UMA vez, na hora em que é
// criada ou redefinida, num modal próprio — e nunca mais. Lista de contas não
// carrega senha nenhuma.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, KeyRound, Copy, Check, Shield, Power, Dices, UserRound,
} from "lucide-react";
import { contasListar, contaCriar, contaSenha, contaAtiva } from "../services/dados.js";
import { getSessao } from "../lib/sessao.js";
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

function LinhaConta({ conta, minha, aoRedefinir, aoAlternarAtiva }) {
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
          <span className="truncate font-display text-sm font-semibold text-slate-900">{conta.usuario}</span>
          {minha && <span className="chip-brand">você</span>}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {conta.nome || "sem nome"} · criada em {conta.criado_em ? dataLonga(conta.criado_em) : "sem registro"}
        </span>
      </span>

      <span className={conta.papel === "direcao" ? "chip-brand" : "chip"}>{papel.rotulo}</span>
      <span className={ativa ? "chip-ok" : "chip-bad"}>{ativa ? "Ativa" : "Desativada"}</span>

      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => aoRedefinir(conta)}
          title="Redefinir senha"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
            className={`grid h-8 w-8 place-items-center rounded-lg ${
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

function FormNovaConta({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  return (
    <Modal titulo="Criar conta" aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="ac-usuario">Usuário (é o login)</label>
          <input
            id="ac-usuario"
            type="text"
            className="input"
            autoComplete="off"
            value={form.usuario}
            onChange={(e) => setForm({ ...form, usuario: normalizarUsuario(e.target.value) })}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ac-nome">Nome</label>
          <input
            id="ac-nome"
            type="text"
            className="input"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ac-papel">Papel</label>
          <select
            id="ac-papel"
            className="select"
            value={form.papel}
            onChange={(e) => setForm({ ...form, papel: e.target.value })}
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo} — {p.desc}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ac-senha">Senha inicial</label>
          {/* type="text" de propósito: a direção precisa LER a senha para
              entregar. Quem digita às escondidas é quem entra, não quem cria. */}
          <div className="flex gap-2">
            <input
              id="ac-senha"
              type="text"
              className="input"
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
        <div className="flex justify-end gap-2">
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

function FormRedefinirSenha({ alvo, setAlvo, salvando, aoSalvar, aoFechar }) {
  if (!alvo) return null;
  return (
    <Modal titulo={`Redefinir senha de ${alvo.usuario}`} aberto={!!alvo} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="ac-nova-senha">Nova senha</label>
          <div className="flex gap-2">
            <input
              id="ac-nova-senha"
              type="text"
              className="input"
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
          <p className="mt-1.5 text-xs text-slate-500">A senha atual deixa de valer na hora.</p>
        </div>
        <div className="flex justify-end gap-2">
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
        <p className="font-display text-2xl font-bold tracking-wide text-slate-900">{info.senha}</p>
        <button type="button" className="btn-outline mx-auto mt-3" onClick={copiar}>
          {copiado === "ok" ? <Check size={15} className="text-ok-600" /> : <Copy size={15} />}
          {copiado === "ok" ? "Copiada!" : "Copiar"}
        </button>
        {copiado === "falhou" && (
          <p className="mt-2 text-xs text-bad-700">Não consegui copiar — anote à mão.</p>
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
  const [senhaEntregue, setSenhaEntregue] = useState(null); // { usuario, senha }
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(() => {
    contasListar()
      .then((lista) => {
        setContas(lista);
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (vm
        // existe) — sem este aviso, a recarga que falha deixava a lista velha
        // em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
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

  const abrirNova = (predef) =>
    setFormNova({ usuario: "", nome: "", papel: "equipe", senha: "", ...predef });

  const criar = async () => {
    setSalvando(true);
    try {
      // Só os 4 campos crus — nada da tela vai junto.
      const dados = {
        usuario: formNova.usuario,
        nome: formNova.nome.trim(),
        papel: formNova.papel,
        senha: formNova.senha,
      };
      await contaCriar(dados);
      setFormNova(null);
      setAviso({ tipo: "ok", texto: `Conta "${dados.usuario}" criada.` });
      setSenhaEntregue({ usuario: dados.usuario, senha: dados.senha });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const redefinir = async () => {
    setSalvando(true);
    try {
      await contaSenha(alvoSenha.usuario, alvoSenha.senha);
      const entregue = { usuario: alvoSenha.usuario, senha: alvoSenha.senha };
      setAlvoSenha(null);
      setAviso({ tipo: "ok", texto: `Senha de "${entregue.usuario}" redefinida.` });
      setSenhaEntregue(entregue);
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
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
                aoRedefinir={(conta) => setAlvoSenha({ usuario: conta.usuario, senha: "" })}
                aoAlternarAtiva={alternarAtiva}
              />
            ))}
          </div>
        </Card>
      )}

      {vm.lista.length === 0 && (
        <Empty className="mb-6">Nenhuma conta criada ainda — comece pela sua, no cartão acima.</Empty>
      )}

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
        aoSalvar={criar}
        aoFechar={() => setFormNova(null)}
      />
      <FormRedefinirSenha
        alvo={alvoSenha}
        setAlvo={setAlvoSenha}
        salvando={salvando}
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
