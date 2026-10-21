import { useId } from "react";

// Ilustrações vetoriais leves com luz, espessura e sombra. Sem WebGL ou animação contínua.
export function VolumeIcon({ tipo = "agenda", className = "" }) {
  const id = useId().replace(/:/g, "");
  const cores = {
    agenda: ["#c8e3ff", "#528bdc", "#244f9a"],
    licitacao: ["#ffdc99", "#e1a340", "#9d601c"],
    manutencao: ["#ded6ff", "#9a85de", "#594699"],
    compras: ["#a7e8d9", "#46b39b", "#237b69"],
  }[tipo] || ["#a7e8d9", "#46b39b", "#237b69"];
  const fill = `url(#${id}-cor)`;
  return <svg className={`ml-volume-icon ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-cor`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={cores[0]}/><stop offset="1" stopColor={cores[1]}/></linearGradient>
      <linearGradient id={`${id}-papel`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#dfebef"/></linearGradient>
    </defs>
    <ellipse cx="51" cy="87" rx="30" ry="6" fill={cores[2]} opacity=".12"/>
    {tipo === "agenda" && <g transform="rotate(-9 50 50)">
      <rect x="23" y="20" width="59" height="63" rx="12" fill={cores[2]}/>
      <rect x="17" y="15" width="59" height="63" rx="12" fill={`url(#${id}-papel)`}/>
      <path d="M29 15h35a12 12 0 0 1 12 12v10H17V27a12 12 0 0 1 12-12" fill={fill}/>
      <path d="M32 10v14M61 10v14" stroke={cores[2]} strokeWidth="6" strokeLinecap="round"/>
      <path d="M29 49h7m12 0h7m-26 12h7" stroke="#abc3d2" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="66" cy="69" r="15" fill="#1e9d83"/><path d="m59 69 5 5 9-11" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </g>}
    {tipo === "licitacao" && <g>
      <path d="m23 72 48-5 13 10-49 6z" fill={cores[0]}/><path d="m23 72 12 11v7l-12-11z" fill={cores[1]}/><path d="m35 83 49-6v7l-49 6z" fill={cores[2]}/>
      <g transform="rotate(-34 50 45)"><rect x="45" y="31" width="12" height="45" rx="5" fill={cores[2]}/><rect x="42" y="28" width="10" height="43" rx="4" fill={fill}/>
        <rect x="24" y="16" width="56" height="24" rx="7" fill={cores[2]}/><rect x="20" y="12" width="56" height="24" rx="7" fill={fill}/><path d="M31 14v20M65 14v20" stroke="#fff1cc" strokeWidth="4" opacity=".8"/>
      </g>
    </g>}
    {tipo === "manutencao" && <g transform="rotate(8 50 50)">
      <path d="M62 13a22 22 0 0 0-24 29L19 66a12 12 0 0 0 18 16l22-26a22 22 0 0 0 25-28L69 42 57 32z" fill={cores[2]} transform="translate(4 4)"/>
      <path d="M62 13a22 22 0 0 0-24 29L19 66a12 12 0 0 0 18 16l22-26a22 22 0 0 0 25-28L69 42 57 32z" fill={fill}/>
      <circle cx="28" cy="73" r="5" fill={cores[2]}/><path d="M45 46 31 63" stroke="#ede8ff" strokeWidth="4" strokeLinecap="round"/>
    </g>}
    {tipo === "compras" && <g>
      <path d="m16 34 33-17 35 17-34 19z" fill={cores[0]}/><path d="m16 34 34 19v35L16 68z" fill={fill}/><path d="m50 53 34-19v35L50 88z" fill={cores[2]}/>
      <path d="m33 25 35 19 1 17-11 6V49L23 30z" fill="#e2fff3" opacity=".85"/>
      <path d="m24 57 15 8m-15 0 9 5" stroke="#d8fff0" strokeWidth="3" strokeLinecap="round"/>
    </g>}
  </svg>;
}

export function LabIllustration() {
  const id = useId().replace(/:/g, "");
  return <svg className="ml-lab-art" viewBox="0 0 320 190" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f2fffe"/><stop offset="1" stopColor="#96d5d1"/></linearGradient>
      <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#5ff2c7"/><stop offset="1" stopColor="#009482"/></linearGradient>
      <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#267d7a"/><stop offset="1" stopColor="#124c53"/></linearGradient>
    </defs>
    <circle cx="195" cy="95" r="81" fill="none" stroke="#78c4ba" opacity=".17"/>
    <circle cx="195" cy="95" r="62" fill="none" stroke="#78c4ba" opacity=".12"/>
    <ellipse cx="180" cy="166" rx="102" ry="14" fill="#032d35" opacity=".4"/>
    <path d="m68 137 112-54 112 54-112 43z" fill={`url(#${id}-tile)`}/><path d="m68 137 112 43 112-43v9l-112 43-112-43z" fill="#093f48"/>
    <g transform="translate(118 5) rotate(8 65 75)">
      <path d="M47 22h35v10h-6v31l28 65c5 13-3 23-16 23H35c-14 0-21-11-15-24l29-64V32h-2z" fill={`url(#${id}-glass)`} stroke="#d5fcf4" strokeWidth="2"/>
      <path d="M36 100c20-9 39 9 57 0l12 28c4 12-3 20-17 20H36c-14 0-19-9-14-21z" fill={`url(#${id}-liquid)`}/>
      <path d="M55 39v28l-24 56" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" opacity=".7"/>
      <path d="M80 81h-9m15 14h-9m16 15h-9" stroke="#257d7b" strokeWidth="2"/>
      <circle cx="62" cy="121" r="5" fill="#9cf3db"/><circle cx="76" cy="137" r="3" fill="#9cf3db"/>
      <ellipse cx="64" cy="24" rx="18" ry="5" fill="#e5fffa"/><ellipse cx="64" cy="24" rx="12" ry="2" fill="#82bab8"/>
    </g>
    <g transform="translate(69 64) rotate(-13)"><rect width="30" height="77" rx="15" fill={`url(#${id}-glass)`}/><path d="M3 33h24v29a12 12 0 0 1-24 0z" fill="#65b9ef"/><rect x="-2" y="-2" width="34" height="12" rx="4" fill="#a4d7f5"/><path d="M9 19v39" stroke="white" opacity=".7" strokeWidth="4" strokeLinecap="round"/></g>
    <g transform="translate(247 48) rotate(12)"><rect width="49" height="51" rx="13" fill="#f2fff9"/><circle cx="24" cy="25" r="15" fill="#39ba97"/><path d="m16 25 6 6 12-13" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></g>
    <circle cx="94" cy="36" r="5" fill="#82e6c7"/><path d="M280 119v12m-6-6h12" stroke="#87dace" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}
