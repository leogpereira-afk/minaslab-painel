// A porta do painel. O servidor confere usuario+senha (com freio de
// tentativas) e devolve o crachá de 12h.

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { login, motivoSaida } from "../lib/sessao.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  // O motivo de ter caido aqui (cracha vencido, inatividade) aparece UMA vez.
  const [aviso] = useState(() => motivoSaida());
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    if (entrando) return;
    setErro("");
    setEntrando(true);
    try {
      await login(usuario.trim(), senha);
      navigate(location.state?.de || "/", { replace: true });
    } catch (ex) {
      setErro(ex.message);
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-ink text-white">
            <FlaskConical size={26} strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Minas<span className="text-brand-600">Lab</span>
            </h1>
            <p className="text-sm text-slate-500">Painel de Gestão</p>
          </div>
        </div>

        {aviso && (
          <p role="status" className="mb-4 rounded-xl bg-warn-50 px-3.5 py-2.5 text-sm text-warn-800">
            {aviso}
          </p>
        )}

        <form onSubmit={entrar} className="space-y-4">
          <div>
            <label className="label" htmlFor="usuario">Usuário</label>
            <input
              id="usuario"
              type="text"
              className="input"
              autoComplete="username"
              autoCapitalize="none"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              className="input"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          {erro && (
            <p role="alert" className="rounded-xl bg-bad-50 px-3.5 py-2.5 text-sm text-bad-700">
              {erro}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={entrando || !usuario.trim() || !senha}>
            {entrando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
