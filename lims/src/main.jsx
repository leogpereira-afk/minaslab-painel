import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./estilo.css";
import { ligarNomesCurtos, registrarNome } from "../../src/lib/nomesNaTela.js";
import { getSessao } from "./lib/sessao.js";

// Nome de colaborador aparece curto (primeiro e último) em todas as telas.
ligarNomesCurtos();
registrarNome(getSessao()?.nome);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
