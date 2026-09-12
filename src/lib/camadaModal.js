// Uma pilha para formulários e menu móvel: apenas a última janela recebe foco.
const camadas = [];
let fundo;
let inerteAntes;
let rolagemAntes;
const seletor = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ativarCamada(elemento, fechar, origem = document.activeElement) {
  const camada = { elemento, fechar };
  if (!camadas.length) {
    fundo = document.getElementById('root');
    inerteAntes = fundo?.inert;
    rolagemAntes = document.body.style.overflow;
    if (fundo) fundo.inert = true;
    document.body.style.overflow = 'hidden';
  }
  if (camadas.length) camadas.at(-1).elemento.inert = true;
  camadas.push(camada);
  const focaveis = () => [...elemento.querySelectorAll(seletor)].filter(el => el.getClientRects().length && !el.closest('[inert]'));
  const primeiro = () => elemento.querySelector('[autofocus]') || focaveis()[0] || elemento;
  primeiro().focus({ preventScroll: true });
  const teclado = e => {
    if (camadas.at(-1) !== camada) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); fechar(); }
    if (e.key === 'Tab') {
      const itens = focaveis();
      const atual = document.activeElement;
      if (!itens.length) { e.preventDefault(); elemento.focus(); return; }
      if (e.shiftKey && (atual === itens[0] || !itens.includes(atual))) { e.preventDefault(); itens.at(-1).focus(); }
      else if (!e.shiftKey && (atual === itens.at(-1) || !itens.includes(atual))) { e.preventDefault(); itens[0].focus(); }
    }
  };
  document.addEventListener('keydown', teclado, true);
  return () => {
    document.removeEventListener('keydown', teclado, true);
    const eraTopo = camadas.at(-1) === camada;
    const indice = camadas.indexOf(camada);
    if (indice >= 0) camadas.splice(indice, 1);
    elemento.inert = false;
    if (camadas.length) camadas.at(-1).elemento.inert = false;
    else {
      if (fundo) fundo.inert = inerteAntes;
      document.body.style.overflow = rolagemAntes;
    }
    if (eraTopo) {
      const destino = origem?.isConnected && !origem.closest('[inert]') ? origem : camadas.at(-1)?.elemento || document.getElementById('conteudo-principal');
      destino?.focus({ preventScroll: true });
    }
  };
}
