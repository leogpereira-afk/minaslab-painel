// Liga e desliga os avisos de mensagem nova: toque e aviso do navegador (que a própria pessoa precisa permitir).
import { useState } from "react";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { ligarSom, somLigado, tocarAviso } from "../../lib/somAviso.js";

const PODE = typeof window !== "undefined" && "Notification" in window;

export default function AvisosDoMessenger() {
  const [som, setSom] = useState(somLigado);
  const [permissao, setPermissao] = useState(PODE ? Notification.permission : "denied");
  const alternarSom = () => {
    const novo = !som;
    setSom(novo);
    ligarSom(novo);
    if (novo) tocarAviso();
  };
  const pedir = async () => { if (PODE) setPermissao(await Notification.requestPermission()); };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500" aria-label="Avisos de mensagem nova">
      <button type="button" onClick={alternarSom} aria-pressed={som} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-slate-100">{som ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}Som {som ? "ligado" : "desligado"}</button>
      {PODE && (permissao === "granted"
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5"><Bell size={13} aria-hidden="true" />Aviso no navegador ligado</span>
        : permissao === "denied"
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5" title="Libere as notificações deste site nas configurações do navegador"><BellOff size={13} aria-hidden="true" />Aviso no navegador bloqueado</span>
          : <button type="button" onClick={pedir} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-sky-700 hover:bg-sky-50"><Bell size={13} aria-hidden="true" />Ativar aviso no navegador</button>)}
    </div>
  );
}
