import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';

const estilos: Record<Variante, string> = {
  primario: 'bg-primaria text-primaria-texto hover:bg-primaria/90 shadow-sm',
  secundario: 'border border-borda bg-superficie text-texto hover:bg-superficie-2',
  fantasma: 'text-texto hover:bg-superficie-2',
  perigo: 'border border-perigo/30 bg-perigo/10 text-perigo hover:bg-perigo/15',
};

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
  pequeno?: boolean;
}

export function Botao({ variante = 'primario', carregando, pequeno, className, children, disabled, type = 'button', ...resto }: BotaoProps) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        pequeno ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-[15px]',
        estilos[variante],
        className,
      )}
      {...resto}
    >
      {carregando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
