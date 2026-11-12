import { useId, type InputHTMLAttributes } from 'react';

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  dica?: string;
}

export function Campo({ rotulo, dica, id, ...resto }: CampoProps) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  return (
    <div>
      <label htmlFor={idCampo} className="mb-1.5 block text-sm font-medium">{rotulo}</label>
      <input id={idCampo} className="campo" aria-describedby={dica ? `${idCampo}-dica` : undefined} {...resto} />
      {dica && <p id={`${idCampo}-dica`} className="mt-1 text-xs text-suave">{dica}</p>}
    </div>
  );
}
