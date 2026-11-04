// Configurações → Configuração do sistema: as 10 abas do GerenciaLab, um
// registro único no servidor (coleção "config", id "sistema").

import { useState } from "react";
import { useDados, configSistema } from "../lib/dados.jsx";
import { ABAS_SISTEMA, PADROES_SISTEMA } from "../lib/configSistema.js";
import { Campo } from "../components/Cadastro.jsx";
import { Caixa, useAviso } from "../components/ui.jsx";

export default function ConfigSistema() {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [aba, setAba] = useState(0);
  const [valor, setValor] = useState(() => ({ ...PADROES_SISTEMA, ...configSistema(dados), id: "sistema" }));
  const [ocupado, setOcupado] = useState(false);
  const gravar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    try { await salvar("config", valor); avisar("Configuração do sistema salva.", "ok"); }
    catch (ex) { avisar(ex.message, "err"); } finally { setOcupado(false); }
  };
  const atual = ABAS_SISTEMA[aba];
  return (
    <Caixa titulo="Configuração Sistema">
      <div className="abas" role="tablist">
        {ABAS_SISTEMA.map((a, i) => <button key={a.aba} type="button" role="tab" aria-selected={i === aba} className={i === aba ? "on" : ""} onClick={() => setAba(i)}>{a.aba}</button>)}
      </div>
      <form className="frm" onSubmit={gravar} noValidate style={{ marginTop: 18 }}>
        {atual.campos.map((f) => <Campo key={f.c} f={f} valor={valor} setValor={setValor} dados={dados} />)}
        <div className="s12"><button type="submit" className="btn btn-success" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button></div>
      </form>
    </Caixa>
  );
}
