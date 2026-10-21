// Ícones em traço (sem biblioteca): cada um é um <svg> decorativo.
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };

const I = (paths) => function Icone({ size = 18 }) {
  return <svg {...base} width={size} height={size}>{paths}</svg>;
};

export const IcGrafico = I(<><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>);
export const IcAlvo = I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>);
export const IcFunil = I(<path d="M3 4h18l-7 9v6l-4 2v-8z" />);
export const IcCarteira = I(<><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2" /><path d="M3 10h18" /></>);
export const IcEstrela = I(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />);
export const IcMartelo = I(<><path d="m14 4 6 6" /><path d="m4 20 8-8" /><path d="m11 7 6 6-3 3-6-6z" /></>);
export const IcPessoas = I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5a5 5 0 0 1 5.5 5" /></>);
export const IcMedalha = I(<><circle cx="12" cy="14" r="6" /><path d="M8.5 9 6 3h4l2 4 2-4h4l-2.5 6" /></>);
export const IcAviso = I(<><path d="M12 3 2 20h20z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>);
export const IcBussola = I(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>);
export const IcCalendario = I(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>);
export const IcLivro = I(<><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" /><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" /></>);
export const IcApresentacao = I(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4" /><path d="M8 20h8" /></>);
export const IcEngrenagem = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IcLupa = I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IcMenu = I(<><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>);
export const IcMais = I(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IcLixo = I(<><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>);
export const IcRecarregar = I(<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>);
export const IcBalanca = I(<><path d="M12 3v18" /><path d="M5 21h14" /><path d="M4 7h16" /><path d="m4 7-3 7a4 4 0 0 0 6 0z" /><path d="m20 7-3 7a4 4 0 0 0 6 0z" /></>);
export const IcPasta = I(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></>);
export const IcTrofeu = I(<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4" /><path d="M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4" /><path d="M8 21h8" /><path d="M9 17h6v4H9z" /></>);
export const IcFrasco = I(<><path d="M9 3h6" /><path d="M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7 15h10" /></>);
export const IcCadeado = I(<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>);
export const IcPulso = I(<path d="M3 12h4l2-6 4 12 2-6h6" />);
