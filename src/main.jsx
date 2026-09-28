import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./nfse-layout.css";
import "./styles/movimentacao-conta-responsive.css";

/* ABA ABERTA DURANTE UMA PUBLICAÇÃO (auditoria de 28/09/2026). O painel publica
   umas 25 vezes por dia, e cada publicação troca o nome dos arquivos dos módulos.
   Quem estava com o painel aberto, ao entrar num módulo ainda não visitado, pedia
   um arquivo que não existe mais — e a tela quebrava. O Vite avisa com este
   evento; a resposta é recarregar uma vez para pegar a versão nova.
   A trava de 1 minuto impede ciclo: se recarregou e o erro voltou, o problema é
   outro, e aí o erro aparece normalmente em vez de a página piscar sem parar. */
window.addEventListener("vite:preloadError", (evento) => {
  let ultima = 0;
  try { ultima = Number(sessionStorage.getItem("ml_recarga_por_versao") || 0); } catch { /* sem sessionStorage: segue */ }
  if (Date.now() - ultima < 60000) return;
  try { sessionStorage.setItem("ml_recarga_por_versao", String(Date.now())); } catch { /* segue */ }
  evento.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
