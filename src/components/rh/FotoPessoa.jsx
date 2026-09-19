import { fotoValida } from '../../lib/rh/fotoPessoa.js';
export default function FotoPessoa({ pessoa, pequena = false }) {
  const classe = `${pequena ? 'h-10 w-10 text-sm' : 'h-16 w-16 text-xl'} shrink-0 rounded-2xl object-cover`;
  if (fotoValida(pessoa?.foto)) return <img className={classe} src={pessoa.foto} alt={`Foto de ${pessoa.nome || 'pessoa'}`} />;
  const letras = String(pessoa?.nome || '').trim().split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();
  return <span aria-hidden="true" className={`${classe} grid place-items-center bg-brand-ink font-semibold text-white`}>{letras || '?'}</span>;
}
