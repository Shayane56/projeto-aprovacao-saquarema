import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const tipos = {
  info: { icone: Info, classe: 'border-primaria/25 bg-primaria-suave/60 text-texto', cor: 'text-primaria' },
  sucesso: { icone: CheckCircle2, classe: 'border-sucesso/30 bg-sucesso/10 text-texto', cor: 'text-sucesso' },
  alerta: { icone: AlertTriangle, classe: 'border-alerta/30 bg-alerta/10 text-texto', cor: 'text-alerta' },
  erro: { icone: XCircle, classe: 'border-perigo/30 bg-perigo/10 text-texto', cor: 'text-perigo' },
};

export function Aviso({ tipo = 'info', children, className }: { tipo?: keyof typeof tipos; children: ReactNode; className?: string }) {
  const { icone: Icone, classe, cor } = tipos[tipo];
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={cn('flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm', classe, className)}>
      <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', cor)} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
