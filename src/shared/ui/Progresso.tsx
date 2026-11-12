import { cn } from '@/lib/cn';

export function BarraProgresso({ valor, className, cor = 'bg-primaria', rotulo }: { valor: number; className?: string; cor?: string; rotulo?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(valor * 100)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={rotulo}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-superficie-2', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', cor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AnelProgresso({ valor, tamanho = 112, espessura = 10, children }: { valor: number; tamanho?: number; espessura?: number; children?: React.ReactNode }) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, valor));
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" strokeWidth={espessura} className="stroke-superficie-2" />
        <circle
          cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" strokeWidth={espessura} strokeLinecap="round"
          className="stroke-primaria transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
