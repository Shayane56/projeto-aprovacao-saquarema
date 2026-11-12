import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { STATUS, type StatusTopico } from './tipos';

export const estiloStatus: Record<StatusTopico, string> = {
  nao_iniciado: 'border-borda bg-superficie text-suave',
  estudando: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  revisando: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  dominado: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

export const pontoStatus: Record<StatusTopico, string> = {
  nao_iniciado: 'bg-borda',
  estudando: 'bg-sky-500',
  revisando: 'bg-amber-500',
  dominado: 'bg-emerald-500',
};

export function StatusSelect({ valor, aoMudar, rotulo }: { valor: StatusTopico; aoMudar: (s: StatusTopico) => void; rotulo: string }) {
  return (
    <span className="relative inline-flex shrink-0">
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value as StatusTopico)}
        aria-label={`Status: ${rotulo}`}
        className={cn(
          'h-9 cursor-pointer appearance-none rounded-lg border py-0 pl-2.5 pr-7 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-primaria/30',
          estiloStatus[valor],
        )}
      >
        {STATUS.map((s) => (
          <option key={s.valor} value={s.valor} className="bg-superficie text-texto">{s.rotulo}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70" aria-hidden />
    </span>
  );
}
