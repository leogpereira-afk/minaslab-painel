import { useState } from "react";
import { login, motivoSaida } from "../lib/sessao.js";
import logoMinasLab from "../assets/logo-minaslab.webp";

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
    try { await login(usuario.trim(), senha); } catch (ex) { setErro(ex.message); } finally { setEntrando(false); }
  };
  return (
    <div className="login">
      <form className="cartao" onSubmit={entrar}>
        <img src={logoMinasLab} alt="MinasLab, Laboratório de Controle de Qualidade" width="200" height="60" />
        <div><h1>MinasLab LIMS</h1><p className="suave" style={{ textAlign: "center", margin: "4px 0 0" }}>Entre com o mesmo usuário do Painel MinasLab</p></div>
        {aviso && <p role="status" className="aviso alerta">{aviso}</p>}
        <div className="fg"><label htmlFor="usuario">Usuário</label><input id="usuario" autoComplete="username" autoCapitalize="none" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus /></div>
        <div className="fg"><label htmlFor="senha">Senha</label><input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        {erro && <p role="alert" className="aviso ruim">{erro}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={entrando || !usuario || !senha}>{entrando ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}
