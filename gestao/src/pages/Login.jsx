import { useState } from "react";
import { login, motivoSaida } from "../lib/sessao.js";
import { IcGrafico } from "../components/icones.jsx";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso] = useState(() => motivoSaida());
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    if (entrando) return;
    setErro("");
    setEntrando(true);
    try {
      await login(usuario.trim(), senha);
    } catch (ex) {
      setErro(ex.message);
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="login">
      <div className="card">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", marginBottom: 22 }}>
          <span className="marca-icone" style={{ width: 52, height: 52, borderRadius: 16 }}><IcGrafico size={26} /></span>
          <div>
            <h1 style={{ fontSize: 22 }}>Minas<span style={{ color: "var(--marca)" }}>Lab</span> · Gestão</h1>
            <div className="suave peq">Entre com o mesmo usuário do Painel de Gestão</div>
          </div>
        </div>
        {aviso && <p role="status" className="aviso alerta" style={{ marginTop: 0 }}>{aviso}</p>}
        <form onSubmit={entrar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="campo">
            <label htmlFor="usuario">Usuário</label>
            <input id="usuario" className="entrada" autoComplete="username" autoCapitalize="none" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus />
          </div>
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input id="senha" type="password" className="entrada" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <p role="alert" className="aviso ruim" style={{ margin: 0 }}>{erro}</p>}
          <button type="submit" className="btn" disabled={entrando || !usuario || !senha}>{entrando ? "Entrando…" : "Entrar"}</button>
        </form>
      </div>
    </div>
  );
}
