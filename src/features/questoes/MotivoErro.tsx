import { cn } from '@/lib/cn';
import { MOTIVOS, type MotivoErro } from './tipos';

export function SeletorMotivo({ valor, aoMudar }: { valor: MotivoErro | null; aoMudar: (m: MotivoErro) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo do erro">
      {MOTIVOS.map((m) => (
        <button
          key={m.valor}
          type="button"
          role="radio"
          aria-checked={valor === m.valor}
          onClick={() => aoMudar(m.valor)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
            valor === m.valor ? 'border-perigo bg-perigo/10 text-perigo' : 'border-borda bg-superficie hover:bg-superficie-2',
          )}
        >
          {m.rotulo}
        </button>
      ))}
    </div>
  );
}
